-- =============================================
-- LOYALTYCLUB — MIGRACIÓN SQL V44 COMPLETA
-- Ecosistema de Socios, Timestamps de Semáforo y Configuración de Impresoras
-- Ejecutar en el Editor SQL de Supabase
-- =============================================

-- 1. Asegurar estados y timestamps precisos en la tabla de órdenes para controlar el flujo operativo real
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'pendiente';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS aceptado_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS listo_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS repartidor_solicitado_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tengo_el_pedido_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS entregado_at TIMESTAMP WITH TIME ZONE;

-- 2. Crear la tabla definitiva de configuración de hardware, ticket e impresión de las tablets
CREATE TABLE IF NOT EXISTS public.terminal_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    auto_aceptar BOOLEAN DEFAULT FALSE,
    imprimir_automatico BOOLEAN DEFAULT FALSE,
    tiene_autocorte BOOLEAN DEFAULT TRUE,
    tipo_impresora TEXT DEFAULT 'bluetooth', -- 'red_usb', 'wifi', 'bluetooth'
    config_impresora TEXT, -- Guarda IP (ej. 192.168.1.100), puerto o dirección MAC
    tamano_fuente TEXT DEFAULT 'normal', -- 'normal', 'doble_alto'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Garantizar registro único de configuración de hardware por restaurante
CREATE UNIQUE INDEX IF NOT EXISTS unique_business_terminal_config ON public.terminal_config(business_id);

-- Activar RLS de seguridad total multi-tenant
ALTER TABLE public.terminal_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "terminal_config_open" ON public.terminal_config;
CREATE POLICY "terminal_config_open" ON public.terminal_config FOR ALL USING (true) WITH CHECK (true);

-- Inicializar automáticamente la configuración de La Burrería para evitar campos nulos en el primer render
INSERT INTO public.terminal_config (business_id, auto_aceptar, imprimir_automatico, tiene_autocorte, tipo_impresora, tamano_fuente)
SELECT id, FALSE, FALSE, TRUE, 'bluetooth', 'normal'
FROM public.businesses 
WHERE slug = 'laburreria'
ON CONFLICT (business_id) DO NOTHING;