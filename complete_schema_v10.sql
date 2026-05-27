-- =============================================
-- LOYALTYAPP — SCHEMA COMPLETO V10 ENTERPRISE
-- SaaS Multi-Tenant · Motor 6 Completo
-- Ejecutar en Supabase SQL Editor
-- Proyecto: hjaeireljkcvjnigfhzb
-- =============================================

-- 0. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- TABLA: superadmins (PIN maestra root)
-- =============================================
CREATE TABLE IF NOT EXISTS superadmins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL DEFAULT 'Super Admin',
  email TEXT UNIQUE NOT NULL,
  pin TEXT NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  ultimo_acceso TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar SuperAdmin raíz por defecto
INSERT INTO superadmins (nombre, email, pin) VALUES
  ('LoyaltyApp Root', 'superadmin@loyaltyapp.com', '0000')
ON CONFLICT (email) DO NOTHING;

-- =============================================
-- TABLA: businesses (Tenants SaaS)
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
  -- Branding personalizable
  color_primario TEXT DEFAULT '#ef4444',
  color_secundario TEXT DEFAULT '#fbbf24',
  -- Geolocalización
  latitude DECIMAL(10, 8) DEFAULT 0,
  longitude DECIMAL(11, 8) DEFAULT 0,
  radio_geocerca_metros INT DEFAULT 500,
  mensaje_push TEXT DEFAULT '¡Pasa por tus recompensas!',
  -- Horario comercial
  hora_apertura TIME DEFAULT '08:00',
  hora_cierre TIME DEFAULT '22:00',
  dias_activos JSONB DEFAULT '["lunes","martes","miercoles","jueves","viernes","sabado"]',
  -- Plan y vigencia (Sistema de Créditos)
  plan TEXT DEFAULT 'demo',
  estado TEXT DEFAULT 'demo',
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

-- =============================================
-- TABLA: branches (Sucursales)
-- =============================================
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

-- =============================================
-- TABLA: business_users (Admins y Cajeros)
-- =============================================
CREATE TABLE IF NOT EXISTS business_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id),
  nombre TEXT NOT NULL,
  email TEXT,
  pin TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'empleado',   -- 'admin_comercio', 'empleado', 'supervisor'
  activo BOOLEAN DEFAULT TRUE,
  ultimo_acceso TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email)
);

-- =============================================
-- TABLA: clientes (Socios VIP)
-- =============================================
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  branch_id UUID REFERENCES branches(id),
  nombre TEXT NOT NULL,
  telefono TEXT NOT NULL,
  email TEXT,
  fecha_nacimiento DATE,
  puntos INT DEFAULT 0,
  visitas INT DEFAULT 0,
  total_gastado DECIMAL(10,2) DEFAULT 0,
  -- Anti-fraude
  ultima_visita TIMESTAMPTZ,
  bloqueado BOOLEAN DEFAULT FALSE,
  bandera_roja BOOLEAN DEFAULT FALSE,
  -- QR de socio
  qr_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, telefono)
);

-- =============================================
-- TABLA: historial_puntos (Auditoría VIP)
-- =============================================
CREATE TABLE IF NOT EXISTS historial_puntos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id),
  tipo_movimiento TEXT NOT NULL,  -- 'sello', 'canje', 'ajuste_manual', 'bono'
  cantidad INT NOT NULL,
  descripcion TEXT,
  motivo_auditoria TEXT,          -- Para ajustes manuales anti-fraude
  aprobado_por UUID REFERENCES business_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLA: loyalty_rewards (Premios)
-- =============================================
CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  sello_requerido INT NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  tipo TEXT DEFAULT 'final',  -- 'intermedio', 'final'
  imagen_url TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLA: credit_transactions (Ledger SaaS)
-- =============================================
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  tipo TEXT NOT NULL,  -- 'compra', 'demo', 'ajuste_manual', 'renovacion'
  creditos INT NOT NULL,
  meses INT DEFAULT 0,
  monto_mxn DECIMAL(10,2),
  notas TEXT,
  creado_por TEXT DEFAULT 'superadmin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLA: menu_groups (Categorías del Menú)
-- =============================================
CREATE TABLE IF NOT EXISTS menu_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  imagen_url TEXT,
  orden INT DEFAULT 0,
  tipo_menu TEXT DEFAULT 'ambos',  -- 'mesa', 'delivery', 'ambos'
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLA: menu_products (Productos del Menú)
-- =============================================
CREATE TABLE IF NOT EXISTS menu_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES menu_groups(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio DECIMAL(10,2) NOT NULL DEFAULT 0,
  imagen_url TEXT,
  disponible BOOLEAN DEFAULT TRUE,
  es_combo BOOLEAN DEFAULT FALSE,
  items_combo JSONB DEFAULT '[]',  -- [{nombre, precio_extra}]
  calorias INT,
  tiempo_preparacion_min INT,
  etiquetas TEXT[],  -- ['vegetariano', 'sin_gluten', 'picante']
  orden INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLA: product_modifiers (Modificadores de Producto)
-- =============================================
CREATE TABLE IF NOT EXISTS product_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES menu_products(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  requerido BOOLEAN DEFAULT FALSE,
  seleccion_multiple BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLA: modifier_options (Opciones de Modificadores)
-- =============================================
CREATE TABLE IF NOT EXISTS modifier_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modifier_id UUID NOT NULL REFERENCES product_modifiers(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  precio_extra DECIMAL(10,2) DEFAULT 0,
  disponible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLA: orders (Pedidos + Control de Sellos)
-- =============================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  branch_id UUID REFERENCES branches(id),
  cliente_id UUID REFERENCES clientes(id),
  nombre_cliente TEXT NOT NULL,
  telefono_cliente TEXT NOT NULL,
  calle TEXT,
  numero TEXT,
  colonia TEXT,
  tipo TEXT DEFAULT 'delivery',  -- 'mesa', 'delivery', 'mostrador'
  items JSONB NOT NULL DEFAULT '[]',
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  sello_otorgado BOOLEAN DEFAULT FALSE,
  sello_aprobado BOOLEAN DEFAULT FALSE,
  sello_rechazado BOOLEAN DEFAULT FALSE,
  aprobado_por UUID REFERENCES business_users(id),
  estado TEXT DEFAULT 'pendiente',  -- 'pendiente', 'aprobado', 'rechazado', 'entregado'
  canal TEXT DEFAULT 'whatsapp',    -- 'whatsapp', 'qr', 'mostrador'
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLA: tracking_events (Auditoría Global)
-- =============================================
CREATE TABLE IF NOT EXISTS tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  cliente_id UUID REFERENCES clientes(id),
  order_id UUID REFERENCES orders(id),
  user_id UUID REFERENCES business_users(id),
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  codigo_cupon TEXT UNIQUE,
  cupon_canjeado BOOLEAN DEFAULT FALSE,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLA: audit_logs (Log de Acciones Críticas)
-- =============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  user_id UUID REFERENCES business_users(id),
  accion TEXT NOT NULL,           -- 'login', 'ajuste_puntos', 'bloqueo', 'impersonacion'
  recurso TEXT,                   -- 'clientes', 'business_users', 'menu_products'
  recurso_id TEXT,
  valor_anterior JSONB,
  valor_nuevo JSONB,
  ip_address TEXT,
  superadmin_action BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLA: business_schedules (Horarios Detallados)
-- =============================================
CREATE TABLE IF NOT EXISTS business_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  dia_semana INT NOT NULL,         -- 0=domingo, 1=lunes, ..., 6=sabado
  hora_apertura TIME NOT NULL,
  hora_cierre TIME NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, dia_semana)
);

-- =============================================
-- ÍNDICES DE RENDIMIENTO
-- =============================================
CREATE INDEX IF NOT EXISTS idx_businesses_slug ON businesses(slug);
CREATE INDEX IF NOT EXISTS idx_businesses_estado ON businesses(estado);
CREATE INDEX IF NOT EXISTS idx_businesses_vencimiento ON businesses(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_clientes_business ON clientes(business_id);
CREATE INDEX IF NOT EXISTS idx_clientes_telefono ON clientes(telefono);
CREATE INDEX IF NOT EXISTS idx_clientes_qr_token ON clientes(qr_token);
CREATE INDEX IF NOT EXISTS idx_orders_business ON orders(business_id);
CREATE INDEX IF NOT EXISTS idx_orders_estado ON orders(estado);
CREATE INDEX IF NOT EXISTS idx_historial_cliente ON historial_puntos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_historial_business ON historial_puntos(business_id);
CREATE INDEX IF NOT EXISTS idx_tracking_cliente ON tracking_events(cliente_id);
CREATE INDEX IF NOT EXISTS idx_tracking_event_type ON tracking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_tracking_created ON tracking_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_business ON audit_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_menu_products_business ON menu_products(business_id);
CREATE INDEX IF NOT EXISTS idx_menu_products_group ON menu_products(group_id);

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

DROP TRIGGER IF EXISTS update_businesses_updated_at ON businesses;
CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- FUNCIÓN: Anti-Churn (Clientes Inactivos 21d)
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
-- FUNCIÓN: Detectar Velocidad de Escaneo (Fraude)
-- =============================================
CREATE OR REPLACE FUNCTION detectar_fraude_velocidad(
  p_cliente_id UUID,
  p_business_id UUID,
  p_minutos INT DEFAULT 5,
  p_umbral INT DEFAULT 3
)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM tracking_events
  WHERE cliente_id = p_cliente_id
    AND business_id = p_business_id
    AND event_type IN ('approved_by_staff', 'sello_otorgado')
    AND created_at > NOW() - (p_minutos || ' minutes')::INTERVAL;
  
  RETURN v_count >= p_umbral;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- DATOS INICIALES: La Burrería (Tenant Demo)
-- =============================================
INSERT INTO businesses (
  slug, nombre, estado, plan, es_demo,
  fecha_vencimiento, creditos_totales, creditos_usados,
  latitude, longitude,
  telefono_whatsapp, moneda, max_sellos, monto_minimo_sello,
  owner_name, owner_email,
  color_primario, color_secundario
) VALUES (
  'laburreria', 'La Burrería', 'activo', 'anual', false,
  NOW() + INTERVAL '365 days', 12, 1,
  19.421583, -102.067222,
  '521234567890', 'MXN', 10, 100.00,
  'Samuel Méndez', 'samen_mg@hotmail.com',
  '#ef4444', '#fbbf24'
) ON CONFLICT (slug) DO UPDATE SET
  estado = EXCLUDED.estado,
  fecha_vencimiento = EXCLUDED.fecha_vencimiento,
  color_primario = EXCLUDED.color_primario;

-- Usuario administrador de La Burrería
INSERT INTO business_users (
  business_id, nombre, email, pin, rol, activo
)
SELECT id, 'Samuel Méndez', 'samen_mg@hotmail.com', 'Samuelmendez51!', 'admin_comercio', true
FROM businesses WHERE slug = 'laburreria'
ON CONFLICT (email) DO UPDATE SET
  pin = EXCLUDED.pin,
  rol = EXCLUDED.rol,
  activo = EXCLUDED.activo;

-- Premios por defecto
INSERT INTO loyalty_rewards (business_id, sello_requerido, nombre, descripcion, tipo)
SELECT id, 5, 'Envío Gratis', 'Tu próximo pedido a domicilio sin costo de envío', 'intermedio'
FROM businesses WHERE slug = 'laburreria'
ON CONFLICT DO NOTHING;

INSERT INTO loyalty_rewards (business_id, sello_requerido, nombre, descripcion, tipo)
SELECT id, 10, 'Burrito Gratis', '¡Un burrito clásico completamente gratis para celebrar tu lealtad!', 'final'
FROM businesses WHERE slug = 'laburreria'
ON CONFLICT DO NOTHING;

-- =============================================
-- COLUMNAS ADICIONALES (ALTER TABLE)
-- Para agregar a un schema existente sin romper datos
-- =============================================
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS color_primario TEXT DEFAULT '#ef4444';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS color_secundario TEXT DEFAULT '#fbbf24';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS hora_apertura TIME DEFAULT '08:00';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS hora_cierre TIME DEFAULT '22:00';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS dias_activos JSONB DEFAULT '["lunes","martes","miercoles","jueves","viernes","sabado"]';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS radio_geocerca_metros INT DEFAULT 500;
ALTER TABLE menu_products ADD COLUMN IF NOT EXISTS es_combo BOOLEAN DEFAULT FALSE;
ALTER TABLE menu_products ADD COLUMN IF NOT EXISTS items_combo JSONB DEFAULT '[]';
ALTER TABLE menu_products ADD COLUMN IF NOT EXISTS calorias INT;
ALTER TABLE menu_products ADD COLUMN IF NOT EXISTS tiempo_preparacion_min INT;
ALTER TABLE menu_products ADD COLUMN IF NOT EXISTS etiquetas TEXT[];
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS visitas INT DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS total_gastado DECIMAL(10,2) DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS bandera_roja BOOLEAN DEFAULT FALSE;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS qr_token TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS canal TEXT DEFAULT 'whatsapp';

-- Actualizar qr_token para clientes que no lo tengan
UPDATE clientes SET qr_token = encode(gen_random_bytes(12), 'hex')
WHERE qr_token IS NULL;

-- =============================================
-- RLS (Desactivado para desarrollo)
-- Activar con políticas en producción
-- =============================================
ALTER TABLE businesses DISABLE ROW LEVEL SECURITY;
ALTER TABLE branches DISABLE ROW LEVEL SECURITY;
ALTER TABLE business_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE menu_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE menu_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rewards DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE business_schedules DISABLE ROW LEVEL SECURITY;

-- =============================================
-- VERIFICACIÓN FINAL
-- =============================================
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as columnas
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
