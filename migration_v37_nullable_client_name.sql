-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN v37: Hacer campo nombre de la tabla clientes nullable
-- LoyaltyClub.mx — 2026
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.clientes ALTER COLUMN nombre DROP NOT NULL;
