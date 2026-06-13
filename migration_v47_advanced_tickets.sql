-- =============================================
-- LOYALTYCLUB — MIGRACIÓN SQL V47
-- Configuración Avanzada de Tickets para Terminales de Socios
-- Ejecutar en el Editor SQL de Supabase
-- =============================================

-- 1. Eliminar la columna paper_width anterior (si existía como TEXT)
ALTER TABLE public.terminal_config DROP COLUMN IF EXISTS paper_width;

-- 2. Añadir columna paper_width como entero con valor predeterminado 48 (80mm)
ALTER TABLE public.terminal_config ADD COLUMN paper_width INTEGER DEFAULT 48;

-- 3. Añadir columna large_font_items como booleano con valor predeterminado FALSE
ALTER TABLE public.terminal_config ADD COLUMN IF NOT EXISTS large_font_items BOOLEAN DEFAULT FALSE;
