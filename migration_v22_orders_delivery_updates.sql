-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN v22: Urban Delivery — Integración de Pedidos y Logística
-- LoyaltyClub.mx — 2026
-- ═══════════════════════════════════════════════════════════════════

-- 1. Coordenadas de entrega en el pedido del cliente
ALTER TABLE orders ADD COLUMN IF NOT EXISTS lat_entrega double precision DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS lng_entrega double precision DEFAULT NULL;

-- 2. Método de pago (efectivo / transferencia)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS metodo_pago text DEFAULT 'efectivo'
  CONSTRAINT orders_metodo_pago_check CHECK (metodo_pago IN ('efectivo', 'transferencia'));

-- 3. Estado de verificación del pago (para transferencias bancarias)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pago_verificado boolean DEFAULT false;

-- 4. Tiempo de preparación solicitado por el negocio para el repartidor (en minutos, ej. 15, 20, 25)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tiempo_preparacion_estimado integer DEFAULT 15;

-- 5. Relación entre solicitudes de entrega y pedidos del cliente
ALTER TABLE delivery_requests ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES orders(id) ON DELETE SET NULL;
