-- Migration: Make public views honor caller RLS and drop direct anon access
-- Fixes "Security Definer View" advisor findings for public_center_details,
-- public_inventory_needs and public_inventario_resumen.
-- Public reads go through the SECURITY DEFINER RPCs (get_public_*), which keep
-- working because they run as the function owner, not as anon.

ALTER VIEW public.public_center_details     SET (security_invoker = true);
ALTER VIEW public.public_inventory_needs    SET (security_invoker = true);
ALTER VIEW public.public_inventario_resumen SET (security_invoker = true);

REVOKE SELECT ON public.public_center_details,
                 public.public_inventory_needs,
                 public.public_inventario_resumen
  FROM anon, authenticated;
