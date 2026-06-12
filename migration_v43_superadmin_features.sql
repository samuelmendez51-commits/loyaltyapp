-- =============================================
-- LOYALTYCLUB — MIGRACIÓN SQL V43
-- Agregar Características del Plan y Vitalicio
-- Ejecutar en el Editor SQL de Supabase
-- =============================================

ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS plan_vitalicio BOOLEAN DEFAULT FALSE;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS portal_cliente_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS terminal_cocina_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS logistica_bikers_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS ruleta_vip_enabled BOOLEAN DEFAULT TRUE;

-- Actualizar "La Burrería" para tener todos los módulos activos por defecto
UPDATE public.businesses 
SET 
  plan_vitalicio = TRUE,
  portal_cliente_enabled = TRUE,
  terminal_cocina_enabled = TRUE,
  logistica_bikers_enabled = TRUE,
  ruleta_vip_enabled = TRUE
WHERE slug = 'laburreria';
