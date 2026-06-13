-- =============================================
-- LOYALTYCLUB — MIGRACIÓN SQL V46
-- Adición de Ancho de Papel para Terminales de Socios
-- Ejecutar en el Editor SQL de Supabase
-- =============================================

ALTER TABLE public.terminal_config ADD COLUMN IF NOT EXISTS paper_width TEXT DEFAULT '80mm';
