-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN v23: Geopush — Alertas Masivas a Todos los Socios
-- LoyaltyClub.mx — 2026
-- ═══════════════════════════════════════════════════════════════════

-- Agregar columna para almacenar la alerta masiva activa del negocio
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS alerta_masiva text DEFAULT NULL;
