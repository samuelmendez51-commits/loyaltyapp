-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN v40: Campos de Vinculación de Programas y Ruleta
-- LoyaltyClub.mx — 2026
-- Ejecutar este script en el editor SQL de Supabase.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Agregar columna de programa a los clientes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS programa_id UUID REFERENCES programas_fidelidad(id);

-- 2. Agregar columna de programa asociado a la ruleta en negocios
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES programas_fidelidad(id);
