-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN v19: Urban Delivery — Control de Admisión, Bloqueos y Asignación Manual
-- LoyaltyClub.mx — 2026
-- ═══════════════════════════════════════════════════════════════════

-- 1. MODIFICACIONES A LA TABLA BIKERS (Gestión de Admisión y Bloqueos)
ALTER TABLE bikers ADD COLUMN IF NOT EXISTS estado_aprobacion text DEFAULT 'pendiente'
  CONSTRAINT bikers_estado_aprobacion_check CHECK (estado_aprobacion IN ('pendiente', 'aprobado', 'rechazado'));

ALTER TABLE bikers ADD COLUMN IF NOT EXISTS bloqueado_hasta timestamptz DEFAULT NULL;
ALTER TABLE bikers ADD COLUMN IF NOT EXISTS bloqueado_permanente boolean DEFAULT false;

-- 2. MODIFICACIONES A LA TABLA DELIVERY REQUESTS (Asignación Híbrida y Tiempos de Flota)
ALTER TABLE delivery_requests ADD COLUMN IF NOT EXISTS aceptado_flota_at timestamptz DEFAULT NULL;

-- Modificar restricción check de estado en delivery_requests para incluir 'aceptado_flota'
ALTER TABLE delivery_requests DROP CONSTRAINT IF EXISTS delivery_requests_estado_check;
ALTER TABLE delivery_requests ADD CONSTRAINT delivery_requests_estado_check CHECK (
  estado IN (
    'pendiente',
    'aceptado_flota',
    'aceptado',
    'en_camino',
    'completado',
    'cancelado_biker',
    'cancelado_restaurante'
  )
);
