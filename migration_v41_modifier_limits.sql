-- ═══════════════════════════════════════════════════════════════════════════
-- LOYALTYCLUB — MIGRACIÓN v41: REGLAS Y LÍMITES DE MODIFICADORES DE RESTAURANTE
-- Añade soporte para modificadores incluidos en el precio base y límites de selección.
-- Ejecutar en Supabase SQL Editor
-- Autor: LoyaltyClub.mx — 2026
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE product_modifiers ADD COLUMN IF NOT EXISTS incluidos INT DEFAULT 0;
ALTER TABLE product_modifiers ADD COLUMN IF NOT EXISTS maximo_permitido INT DEFAULT NULL;
