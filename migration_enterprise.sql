-- =============================================
-- LOYALTYAPP — MIGRACIÓN COMPLETA ENTERPRISE
-- Ejecutar en Supabase SQL Editor
-- Proyecto: hjaeireljkcvjnigfhzb
-- =============================================

-- =============================================
-- MIGRACIÓN 001: MODELO MULTI-TENANT
-- =============================================

CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identidad
  nombre TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  banner_url TEXT,
  direccion TEXT,
  telefono_whatsapp TEXT,
  -- Geolocalización
  latitude DECIMAL(10, 8) DEFAULT 0,
  longitude DECIMAL(11, 8) DEFAULT 0,
  mensaje_push TEXT DEFAULT '¡Pasa por tus recompensas!',
  -- Plan y vigencia (Sistema de Créditos)
  plan TEXT DEFAULT 'demo',           -- 'demo', 'mensual', 'semestral', 'anual'
  estado TEXT DEFAULT 'demo',         -- 'activo', 'demo', 'vencido', 'bloqueado'
  fecha_inicio TIMESTAMPTZ DEFAULT NOW(),
  fecha_vencimiento TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  creditos_usados INT DEFAULT 0,
  creditos_totales INT DEFAULT 0,
  es_demo BOOLEAN DEFAULT TRUE,
  bloqueado_manual BOOLEAN DEFAULT FALSE,
  -- Configuración de lealtad
  max_sellos INT DEFAULT 10,
  monto_minimo_sello DECIMAL(10,2) DEFAULT 0,
  horas_bloqueo INT DEFAULT 24,
  moneda TEXT DEFAULT 'MXN',
  -- Metadata
  owner_name TEXT,
  owner_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  direccion TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  telefono TEXT,
  activa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id),
  nombre TEXT NOT NULL,
  email TEXT UNIQUE,
  pin TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'empleado', -- 'admin_comercio', 'empleado'
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Añadir multi-tenant a la tabla de clientes existente
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

-- =============================================
-- MIGRACIÓN 002: SISTEMA DE CRÉDITOS SAAS
-- =============================================

CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  tipo TEXT NOT NULL,                  -- 'compra', 'demo', 'ajuste_manual', 'renovacion'
  creditos INT NOT NULL,
  meses INT DEFAULT 0,
  monto_mxn DECIMAL(10,2),
  notas TEXT,
  creado_por TEXT DEFAULT 'superadmin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- MIGRACIÓN 003: MENÚ DIGITAL JERÁRQUICO
-- =============================================

CREATE TABLE IF NOT EXISTS menu_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  imagen_url TEXT,
  orden INT DEFAULT 0,
  tipo_menu TEXT DEFAULT 'ambos',      -- 'mesa', 'delivery', 'ambos'
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES menu_groups(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio DECIMAL(10,2) NOT NULL DEFAULT 0,
  imagen_url TEXT,
  disponible BOOLEAN DEFAULT TRUE,
  orden INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES menu_products(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  requerido BOOLEAN DEFAULT FALSE,
  seleccion_multiple BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS modifier_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modifier_id UUID NOT NULL REFERENCES product_modifiers(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  precio_extra DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- MIGRACIÓN 004: PEDIDOS + SELLOS PENDIENTES
-- =============================================

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  branch_id UUID REFERENCES branches(id),
  cliente_id UUID REFERENCES clientes(id),
  -- Datos del cliente en el momento del pedido
  nombre_cliente TEXT NOT NULL,
  telefono_cliente TEXT NOT NULL,
  calle TEXT,
  numero TEXT,
  colonia TEXT,
  -- Tipo de pedido
  tipo TEXT DEFAULT 'delivery',        -- 'mesa', 'delivery'
  -- Items (JSON array de productos con modificadores y precios)
  items JSONB NOT NULL DEFAULT '[]',
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  -- Control de sello anti-fraude
  sello_otorgado BOOLEAN DEFAULT FALSE,
  sello_aprobado BOOLEAN DEFAULT FALSE,
  sello_rechazado BOOLEAN DEFAULT FALSE,
  aprobado_por UUID REFERENCES business_users(id),
  -- Estado general
  estado TEXT DEFAULT 'pendiente',     -- 'pendiente', 'aprobado', 'rechazado', 'entregado'
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- MIGRACIÓN 005: TRACKING TABLE (AUDITORÍA)
-- =============================================

CREATE TABLE IF NOT EXISTS tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  cliente_id UUID REFERENCES clientes(id),
  order_id UUID REFERENCES orders(id),
  -- Tipo de evento
  event_type TEXT NOT NULL,
  -- Valores:
  -- 'created_pending'    → Sello en espera
  -- 'approved_by_staff'  → Sello validado
  -- 'rejected_fraud'     → Sello removido
  -- 'reward_generated'   → Cupón generado
  -- 'reward_redeemed'    → Cupón canjeado
  -- 'geofence_checkin'   → Check-in de geocerca
  -- 'vip_joined'         → Nuevo miembro VIP
  -- 'churn_incentive'    → Cupón anti-churn (21 días)
  -- Metadata flexible
  metadata JSONB DEFAULT '{}',
  -- Para cupones de un solo uso
  codigo_cupon TEXT UNIQUE,
  cupon_canjeado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- MIGRACIÓN 006: PREMIOS INTERMEDIOS
-- =============================================

CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  sello_requerido INT NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  tipo TEXT DEFAULT 'final',           -- 'intermedio', 'final'
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ÍNDICES DE RENDIMIENTO
-- =============================================

CREATE INDEX IF NOT EXISTS idx_businesses_slug ON businesses(slug);
CREATE INDEX IF NOT EXISTS idx_businesses_estado ON businesses(estado);
CREATE INDEX IF NOT EXISTS idx_businesses_vencimiento ON businesses(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_clientes_business ON clientes(business_id);
CREATE INDEX IF NOT EXISTS idx_clientes_telefono ON clientes(telefono);
CREATE INDEX IF NOT EXISTS idx_orders_business ON orders(business_id);
CREATE INDEX IF NOT EXISTS idx_orders_estado ON orders(estado);
CREATE INDEX IF NOT EXISTS idx_orders_sello ON orders(sello_otorgado, sello_aprobado);
CREATE INDEX IF NOT EXISTS idx_tracking_cliente ON tracking_events(cliente_id);
CREATE INDEX IF NOT EXISTS idx_tracking_event_type ON tracking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_tracking_created ON tracking_events(created_at DESC);

-- =============================================
-- DATOS INICIALES: Tenant "La Burrería"
-- =============================================

INSERT INTO businesses (
  slug, nombre, estado, plan, es_demo,
  fecha_vencimiento, creditos_totales, creditos_usados,
  latitude, longitude,
  telefono_whatsapp, moneda, max_sellos, monto_minimo_sello,
  owner_name, owner_email
) VALUES (
  'laburreria', 'La Burrería', 'activo', 'anual', false,
  NOW() + INTERVAL '365 days', 12, 1,
  19.421583, -102.067222,
  '521234567890', 'MXN', 10, 100.00,
  'Samuel Méndez', 'admin@laburreria.com'
) ON CONFLICT (slug) DO UPDATE SET
  estado = EXCLUDED.estado,
  fecha_vencimiento = EXCLUDED.fecha_vencimiento;

-- Sucursal principal de La Burrería
INSERT INTO branches (business_id, nombre, direccion, latitude, longitude)
SELECT id, 'Sucursal Principal', 'Dirección Principal, Colima', 19.421583, -102.067222
FROM businesses WHERE slug = 'laburreria'
ON CONFLICT DO NOTHING;

-- Premios por defecto para La Burrería
INSERT INTO loyalty_rewards (business_id, sello_requerido, nombre, descripcion, tipo)
SELECT id, 5, 'Envío Gratis', 'Tu próximo pedido a domicilio sin costo de envío', 'intermedio'
FROM businesses WHERE slug = 'laburreria'
ON CONFLICT DO NOTHING;

INSERT INTO loyalty_rewards (business_id, sello_requerido, nombre, descripcion, tipo)
SELECT id, 10, 'Burrito Gratis', '¡Un burrito clásico completamente gratis para celebrar tu lealtad!', 'final'
FROM businesses WHERE slug = 'laburreria'
ON CONFLICT DO NOTHING;

-- Usuario administrador de La Burrería (Cliente Cero)
INSERT INTO business_users (
  business_id, nombre, email, pin, rol, activo
)
SELECT id, 'Samuel Méndez', 'samen_mg@hotmail.com', 'Samuelmendez51!', 'admin_comercio', true
FROM businesses WHERE slug = 'laburreria'
ON CONFLICT (email) DO UPDATE SET
  pin = EXCLUDED.pin,
  rol = EXCLUDED.rol,
  activo = EXCLUDED.activo;

-- =============================================
-- FUNCIÓN: Auto-actualizar updated_at
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- FUNCIÓN ANTI-CHURN: detectar clientes inactivos (21 días)
-- (Para usar como base de Edge Function)
-- =============================================

CREATE OR REPLACE FUNCTION get_churn_candidates(p_business_id UUID)
RETURNS TABLE(
  cliente_id UUID,
  nombre TEXT,
  telefono TEXT,
  ultimo_evento TIMESTAMPTZ,
  dias_inactivo INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.nombre,
    c.telefono,
    MAX(te.created_at) AS ultimo_evento,
    EXTRACT(DAY FROM NOW() - MAX(te.created_at))::INT AS dias_inactivo
  FROM clientes c
  LEFT JOIN tracking_events te ON te.cliente_id = c.id
    AND te.event_type = 'approved_by_staff'
    AND te.business_id = p_business_id
  WHERE c.business_id = p_business_id
    AND c.puntos > 0
  GROUP BY c.id, c.nombre, c.telefono
  HAVING
    MAX(te.created_at) IS NULL
    OR EXTRACT(DAY FROM NOW() - MAX(te.created_at)) >= 21
  ORDER BY dias_inactivo DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- RLS (Row Level Security) - Bases
-- =============================================

-- Por ahora desactivar RLS para desarrollo
-- En producción se activará con políticas por business_id
ALTER TABLE businesses DISABLE ROW LEVEL SECURITY;
ALTER TABLE branches DISABLE ROW LEVEL SECURITY;
ALTER TABLE business_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE menu_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE menu_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rewards DISABLE ROW LEVEL SECURITY;

-- =============================================
-- VERIFICACIÓN FINAL
-- =============================================
SELECT 
  'businesses' as tabla, COUNT(*) as registros FROM businesses
UNION ALL SELECT 'branches', COUNT(*) FROM branches
UNION ALL SELECT 'loyalty_rewards', COUNT(*) FROM loyalty_rewards;
