// Donario v2: Edge Function para enviar invitaciones por email.
// Usa Resend (https://resend.com) — servicio recomendado para apps pequeñas,
// free tier 3.000 emails/mes.
//
// SETUP:
//   1. Crear cuenta en https://resend.com y verificar el dominio (o usar onboarding@resend.dev para pruebas).
//   2. Obtener API key en https://resend.com/api-keys
//   3. Configurar el secret en Supabase:
//        npx supabase secrets set RESEND_API_KEY=re_xxx
//        npx supabase secrets set RESEND_FROM="Donario <hola@tudominio.com>"
//   4. Desplegar:
//        npx supabase functions deploy send-invitation
//
// Si RESEND_API_KEY no está configurado, la función responde 200 con sent=false
// para que el frontend muestre el código de invitación como antes (fallback).
// El error NO se propaga al usuario: el admin siempre ve el código en la UI.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface InvitePayload {
  invitation_id: string;
  email: string;
  role: 'admin' | 'visualizer';
  center_name: string;
  accept_url: string;
}

function htmlTemplate({ email, role, centerName, acceptUrl, code }: InvitePayload & { code: string }): string {
  const roleLabel = role === 'admin' ? 'administrador' : 'visualizador';
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 1px 2px rgba(15,23,42,0.06);">
          <tr><td>
            <h1 style="margin:0 0 8px 0;font-size:24px;font-weight:700;color:#0d9488;">Donario</h1>
            <p style="margin:0 0 24px 0;font-size:14px;color:#475569;">Te invitaron a un centro de acopio</p>
            <p style="margin:0 0 16px 0;font-size:16px;line-height:1.5;">
              Hola,
            </p>
            <p style="margin:0 0 16px 0;font-size:16px;line-height:1.5;">
              <strong>${escapeHtml(centerName)}</strong> te invitó a unirte como <strong>${roleLabel}</strong>.
            </p>
            <p style="margin:24px 0 8px 0;font-size:14px;color:#475569;">Tu código de invitación:</p>
            <div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:16px;font-family:'SF Mono',Menlo,monospace;font-size:18px;font-weight:700;letter-spacing:1px;text-align:center;color:#0f172a;word-break:break-all;">
              ${code}
            </div>
            <p style="margin:24px 0 8px 0;font-size:14px;color:#475569;">Pasos para unirte:</p>
            <ol style="margin:0 0 24px 0;padding-left:20px;font-size:15px;line-height:1.6;color:#0f172a;">
              <li>Crea una cuenta en Donario con este correo: <strong>${escapeHtml(email)}</strong></li>
              <li>Inicia sesión</li>
              <li>En la pantalla de bienvenida, elige "Unirme a un centro existente" e ingresa el código de arriba</li>
            </ol>
            <p style="margin:0 0 4px 0;font-size:12px;color:#94a3b8;">Este código expira en 7 días.</p>
          </td></tr>
        </table>
        <p style="margin:16px 0 0 0;font-size:12px;color:#94a3b8;text-align:center;">
          Donario · Inventario de donaciones
        </p>
      </td></tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function textTemplate({ email, role, centerName, acceptUrl, code }: InvitePayload & { code: string }): string {
  const roleLabel = role === 'admin' ? 'administrador' : 'visualizador';
  return [
    `Donario — Te invitaron a un centro de acopio`,
    ``,
    `${centerName} te invitó a unirte como ${roleLabel}.`,
    ``,
    `Tu código de invitación: ${code}`,
    ``,
    `Pasos para unirte:`,
    `1. Crea una cuenta en Donario con este correo: ${email}`,
    `2. Inicia sesión`,
    `3. En la pantalla de bienvenida, elige "Unirme a un centro existente" e ingresa el código`,
    ``,
    `Este código expira en 7 días.`,
  ].join('\n');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM') ?? 'Donario <onboarding@resend.dev>';

  let payload: InvitePayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { invitation_id, email, role, center_name, accept_url } = payload;
  if (!invitation_id || !email || !role || !center_name) {
    return new Response(JSON.stringify({ error: 'missing_fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!resendKey) {
    return new Response(
      JSON.stringify({ sent: false, reason: 'RESEND_API_KEY not configured' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const html = htmlTemplate({ ...payload, code: invitation_id });
  const text = textTemplate({ ...payload, code: invitation_id });

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `Invitación a ${center_name} — Donario`,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error('Resend error', res.status, detail);
    return new Response(
      JSON.stringify({ sent: false, reason: `resend_${res.status}`, detail }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const result = await res.json();
  return new Response(
    JSON.stringify({ sent: true, provider_id: result.id ?? null }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
