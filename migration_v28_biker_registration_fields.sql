-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN v28: Campos para Registro Público de Bikers
-- LoyaltyClub.mx — 2026
-- Ejecutar este script en el editor SQL de Supabase.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE bikers ADD COLUMN IF NOT EXISTS direccion_residencial TEXT DEFAULT NULL;
ALTER TABLE bikers ADD COLUMN IF NOT EXISTS numero_biker TEXT DEFAULT NULL;
ALTER TABLE bikers ADD COLUMN IF NOT EXISTS moto_marca TEXT DEFAULT NULL;
ALTER TABLE bikers ADD COLUMN IF NOT EXISTS moto_cilindrada TEXT DEFAULT NULL;
ALTER TABLE bikers ADD COLUMN IF NOT EXISTS moto_color TEXT DEFAULT NULL;

-- Cambiar el nombre de la flota default a 'Bikers Upn'
UPDATE delivery_fleets SET nombre = 'Bikers Upn' WHERE nombre = 'Flota Central';
UPDATE delivery_fleets SET nombre = 'Bikers Upn' WHERE nombre = 'flota central';
