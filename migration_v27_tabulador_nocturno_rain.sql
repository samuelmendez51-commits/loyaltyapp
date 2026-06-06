-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN v27: Configuración de Horario Nocturno, Lluvia Global y Referencia
-- LoyaltyClub.mx — 2026
-- Ejecutar este script en el editor SQL de Supabase.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Agregar columnas a delivery_fleets
ALTER TABLE delivery_fleets ADD COLUMN IF NOT EXISTS horario_nocturno_inicio TEXT DEFAULT '21:30';
ALTER TABLE delivery_fleets ADD COLUMN IF NOT EXISTS tarifa_lluvia_activa BOOLEAN DEFAULT FALSE;

-- 2. Agregar columna de referencia a delivery_requests
ALTER TABLE delivery_requests ADD COLUMN IF NOT EXISTS referencia TEXT DEFAULT NULL;
