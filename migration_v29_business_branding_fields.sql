-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN v29: Campos para Branding Multi-Tenant en Businesses
-- LoyaltyClub.mx — 2026
-- Ejecutar este script en el editor SQL de Supabase.
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS color_primario TEXT DEFAULT '#ef4444';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS nombre_premio TEXT DEFAULT 'BURRITO';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS icono_sello TEXT DEFAULT 'burrito';
