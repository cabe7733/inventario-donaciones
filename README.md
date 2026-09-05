# Donario

Inventario de donaciones **offline-first** (PWA) para operarios hispanohablantes no técnicos.

## Stack

- React 18 + Vite 5 + TypeScript + Tailwind 3 (design tokens en `src/styles/tokens.css`)
- **Dexie** (IndexedDB) — la app funciona 100% offline; el sync con Supabase se activa en la fase 5
- i18next / react-i18next — catálogo de copy en `locales/es-419.json`
- Fuse.js — búsqueda fuzzy insensible a acentos
- PWA: `vite-plugin-pwa` (manifest + service worker con Workbox)

## Development

```bash
# Importante: en este entorno NODE_ENV=production está seteado a nivel shell.
# Anteponerlo para que npm instale devDependencies:
$env:NODE_ENV=''

npm install
npm run dev        # dev server
npm run build      # typecheck + build a dist/
npm run preview    # sirve el build en :4173
node scripts/smoke.mjs   # smoke test end-to-end (requiere preview corriendo)
```

## Deploy

### Vercel (frontend)

1. Importa el repo en Vercel.
2. Framework preset: **Vite**. Build command: `npm run build`. Output: `dist`.
3. El `vercel.json` ya incluye el rewrite SPA a `/index.html`.
4. Sin variables de entorno necesarias para v1 (100% local). En la fase 5 se agregan:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### Supabase (backend de sync, fase 5)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Aplica la migración inicial:

```bash
npx supabase db push
```

3. Copia `VITE_SUPABASE_URL` y la anon key a las variables de Vercel.

### Comedor y certificados

```bash
npx supabase db push
npx supabase secrets set RESEND_API_KEY=re_xxx
npx supabase secrets set RESEND_FROM="Donario <onboarding@resend.dev>"
npx supabase secrets set RESEND_DONATION_TEMPLATE_ID=223b057a-b539-49de-87aa-c1e3f5db0fe0
npx supabase secrets set RESEND_DIRECTOR_NAME="Equipo de la fundación"
npx supabase functions deploy send-donation-certificate
```

La plantilla `donation-certificate` ya está publicada en Resend. `docs/resend-donation-template.html` es la copia local editable basada en `public/plantilla`. Nunca pongas `RESEND_API_KEY` en variables `VITE_*` ni en el frontend.

`onboarding@resend.dev` es un remitente sandbox: Resend solo permite entregas de prueba al correo de la cuenta de Resend. Para enviar a donantes reales se necesitará verificar un dominio propio en Resend; Vercel y Supabase no proporcionan un dominio remitente gratuito.

## Estructura

```
src/
  db/          esquema Dexie (schema.ts), tipos (types.ts), seed idempotente
  lib/         ids (UUIDs y deviceId persistente), búsqueda (Fuse), tema, i18n
  components/  UI primitives (Button, Field, Modal, Toast, AutocompleteOrCreate...)
  features/    páginas por dominio: productos, configuracion, dashboard
supabase/migrations/  SQL del backend (espejo del esquema Dexie)
scripts/       smoke test end-to-end con Playwright
```

## Roadmap

1. [x] Fase 0 — scaffold, PWA, esquema Dexie, app shell
2. [x] Fase 1 — CRUD de productos + categorías + unidades (autocomplete-or-create)
3. [ ] Fase 2 — entradas/salidas con bloqueo de stock negativo
4. [ ] Fase 3 — kits con trazabilidad
5. [ ] Fase 4 — medicamentos con lote/vencimiento (FEFO)
6. [ ] Fase 5 — cola de sync a Supabase
7. [ ] Fase 6 — pulido, a11y, rendimiento
