-- ============================================================
-- MIGRACIÓN v39 — Columna comentarios_preparacion en orders
-- Ejecutar en Supabase SQL Editor
-- Fecha: 2026-06-11
-- ============================================================

-- 1. Agregar columna si no existe
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS comentarios_preparacion TEXT;

-- 2. Verificar resultado
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'orders'
  AND column_name = 'comentarios_preparacion';
