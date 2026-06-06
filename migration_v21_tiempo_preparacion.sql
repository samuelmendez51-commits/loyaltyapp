-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN v21: Urban Delivery — Tiempo Estimado de Entrega/Preparación
-- LoyaltyClub.mx — 2026
-- ═══════════════════════════════════════════════════════════════════

-- Adición del campo tiempo_estimado_entrega en minutos (por defecto 15)
ALTER TABLE delivery_requests ADD COLUMN IF NOT EXISTS tiempo_estimado_entrega integer DEFAULT 15;
