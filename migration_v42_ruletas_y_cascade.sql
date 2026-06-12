-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN v42: Arquitectura de Ruletas Independientes y Reglas de Borrado Seguro
-- LoyaltyClub.mx — 2026
-- Ejecutar este script en el editor SQL de Supabase.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Crear tabla de ruletas independientes
CREATE TABLE IF NOT EXISTS public.ruletas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  premios JSONB NOT NULL DEFAULT '["Café Gratis", "Postre Sorpresa", "Bebida Grande", "20% Descuento"]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS en la tabla de ruletas
ALTER TABLE public.ruletas ENABLE ROW LEVEL SECURITY;

-- Política de RLS abierta para desarrollo/SaaS multi-tenant (acceso total)
DROP POLICY IF EXISTS "ruletas_open" ON public.ruletas;
CREATE POLICY "ruletas_open" ON public.ruletas FOR ALL USING (true) WITH CHECK (true);

-- 2. Vincular programas de fidelidad a una ruleta
ALTER TABLE public.programas_fidelidad ADD COLUMN IF NOT EXISTS ruleta_id UUID REFERENCES public.ruletas(id) ON DELETE SET NULL;

-- 3. Modificar llave foránea en orders para permitir ON DELETE SET NULL
-- Conserva el historial de órdenes para la contabilidad del negocio al borrar clientes de prueba
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_cliente_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;

-- 4. Modificar llaves foráneas en premios_canjes y tracking_events a ON DELETE CASCADE
-- Limpia canjes y eventos huérfanos cuando se borra un cliente
ALTER TABLE public.premios_canjes DROP CONSTRAINT IF EXISTS premios_canjes_cliente_id_fkey;
ALTER TABLE public.premios_canjes ADD CONSTRAINT premios_canjes_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;

ALTER TABLE public.tracking_events DROP CONSTRAINT IF EXISTS tracking_events_cliente_id_fkey;
ALTER TABLE public.tracking_events ADD CONSTRAINT tracking_events_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;
