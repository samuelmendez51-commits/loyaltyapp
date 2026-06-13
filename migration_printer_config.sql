-- =============================================
-- LOYALTYCLUB — MIGRACIÓN SQL CONFIGURACIÓN IMPRESORA
-- Ejecutar en el Editor SQL de Supabase para terminal_config
-- =============================================

ALTER TABLE public.terminal_config 
ADD COLUMN IF NOT EXISTS paper_width INT DEFAULT 48,
ADD COLUMN IF NOT EXISTS large_font_items BOOLEAN DEFAULT false;
