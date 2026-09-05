import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return response({ error: 'method_not_allowed' }, 405);

  const authorization = req.headers.get('Authorization');
  if (!authorization) return response({ error: 'unauthorized' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authorization } } },
  );

  const { data: role, error: roleError } = await supabase.rpc('get_user_role');
  if (roleError || !['admin', 'super_admin'].includes(role))
    return response({ error: 'forbidden' }, 403);

  let donorId: string;
  try {
    const payload = await req.json();
    donorId = String(payload.donor_id ?? '');
  } catch {
    return response({ error: 'invalid_json' }, 400);
  }
  if (!donorId) return response({ error: 'missing_donor_id' }, 400);

  const { data: donor, error: donorError } = await supabase
    .from('donors')
    .select('id, full_name, email, center_id')
    .eq('id', donorId)
    .eq('is_active', true)
    .single();
  if (donorError || !donor) return response({ error: 'donor_not_found' }, 404);
  if (!donor.email) return response({ error: 'donor_without_email' }, 400);

  const { data: center, error: centerError } = await supabase
    .from('centers')
    .select('name, entity_name, city, representative_name')
    .eq('id', donor.center_id)
    .eq('is_active', true)
    .single();
  if (centerError || !center) return response({ error: 'foundation_not_found' }, 404);

  const apiKey = Deno.env.get('RESEND_API_KEY');
  const templateId = Deno.env.get('RESEND_DONATION_TEMPLATE_ID');
  const from = Deno.env.get('RESEND_FROM') ?? 'Donario <onboarding@resend.dev>';
  if (!apiKey || !templateId) return response({ error: 'resend_not_configured' }, 503);

  const date = new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Bogota',
  }).format(new Date());
  let res: Response;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // Resend keeps this key idempotent for 24 hours, preventing double clicks from duplicating the email.
        'Idempotency-Key': `donation-certificate/${donor.id}/${new Date().toISOString().slice(0, 10)}`,
      },
      body: JSON.stringify({
        from,
        to: [donor.email],
        subject: `Certificado de agradecimiento - ${center.entity_name || center.name}`,
        template: {
          id: templateId,
          variables: {
            DONOR_NAME: donor.full_name,
            CENTER_NAME: center.entity_name || center.name,
            CITY: center.city || 'Pereira',
            DONATION_DATE: date,
            DIRECTOR_NAME:
              center.representative_name ||
              Deno.env.get('RESEND_DIRECTOR_NAME') ||
              'Equipo de la fundación',
          },
        },
      }),
    });
  } catch (error) {
    console.error('Resend network error', error);
    return response({ error: 'email_provider_unavailable' }, 502);
  }
  if (!res.ok) {
    console.error('Resend error', res.status, await res.text());
    return response({ error: 'email_provider_error' }, 502);
  }
  const result = await res.json();
  return response({ sent: true, provider_id: result.id ?? null });
});
