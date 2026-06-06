-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN v30: Campos de Dirección para Socios (Clientes)
-- LoyaltyClub.mx — 2026
-- Ejecutar este script en el editor SQL de Supabase.
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS calle TEXT DEFAULT NULL;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS numero TEXT DEFAULT NULL;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS colonia TEXT DEFAULT NULL;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS referencia TEXT DEFAULT NULL;
