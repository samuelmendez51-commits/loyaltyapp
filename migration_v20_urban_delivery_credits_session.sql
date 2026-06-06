-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN v20: Urban Delivery — Monetización y Seguridad Anti-Fraude
-- LoyaltyClub.mx — 2026
-- ═══════════════════════════════════════════════════════════════════

-- 1. ADICIONES A LA TABLA DELIVERY_FLEETS (Configuración de Monetización)
ALTER TABLE delivery_fleets ADD COLUMN IF NOT EXISTS precio_credito numeric(10,2) DEFAULT 0.00;
ALTER TABLE delivery_fleets ADD COLUMN IF NOT EXISTS tiempo_credito_dias integer DEFAULT 7;
ALTER TABLE delivery_fleets ADD COLUMN IF NOT EXISTS dias_regalo_nuevo integer DEFAULT 0;

-- 2. ADICIONES A LA TABLA BIKERS (Candado de Dispositivo Único y Acceso Temporal por Crédito)
ALTER TABLE bikers ADD COLUMN IF NOT EXISTS current_session_id uuid DEFAULT NULL;
ALTER TABLE bikers ADD COLUMN IF NOT EXISTS activo_hasta timestamptz DEFAULT NULL;
