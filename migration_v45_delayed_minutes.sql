-- =============================================
-- LOYALTYCLUB — MIGRACIÓN SQL V45
-- Sistema de Retraso de Cocina Explicito
-- Ejecutar en el Editor SQL de Supabase
-- =============================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delayed_minutes INTEGER DEFAULT 0;
