-- ═══════════════════════════════════════════════════════════════════
-- SCRIPT DE INICIALIZACIÓN (SEED) PARA EL TENANT DE REPARTIDORES
-- LoyaltyClub.mx — 2026
-- Ejecutar este script en el editor SQL de Supabase
-- ═══════════════════════════════════════════════════════════════════

-- 1. Insertar el negocio/tenant "bikers" si no existe
INSERT INTO businesses (id, nombre, slug, estado, owner_name, owner_email, plan, direccion, latitude, longitude, mensaje_push)
VALUES (
  '949043f9-4834-45d7-9e55-2cdaf395c484', -- UUID fijo y seguro para asociar otros registros
  'Urban Delivery',
  'bikers',
  'activo',
  'Admin Flota',
  'admin@bikers.com',
  'enterprise',
  'Uruapan, Michoacán',
  19.421583,
  -102.067222,
  'Repartidor cerca de tu ubicación.'
)
ON CONFLICT (slug) DO UPDATE 
SET nombre = EXCLUDED.nombre, estado = EXCLUDED.estado;

-- 2. Insertar la flota central de reparto vinculada
INSERT INTO delivery_fleets (business_id, nombre, ciudad, activo, precio_credito, tiempo_credito_dias, dias_regalo_nuevo)
VALUES (
  '949043f9-4834-45d7-9e55-2cdaf395c484',
  'Bikers Upn',
  'Uruapan',
  true,
  10.00,
  7,
  0
)
ON CONFLICT DO NOTHING;

-- 3. Insertar el usuario administrador (Modulador) para el subdominio
INSERT INTO business_users (business_id, nombre, email, pin, rol, activo)
VALUES (
  '949043f9-4834-45d7-9e55-2cdaf395c484',
  'Modulador Central',
  'admin@bikers.com',
  '1234',
  'admin_flota',
  true
)
ON CONFLICT (email) DO UPDATE 
SET pin = EXCLUDED.pin, rol = EXCLUDED.rol, activo = EXCLUDED.activo;
