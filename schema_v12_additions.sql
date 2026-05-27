-- =============================================
-- LOYALTYAPP — SCHEMA ADICIONES V12
-- BI & Gamification Engine
-- Ejecutar sobre schema V10 existente (seguro)
-- =============================================

-- TABLAS: Ruleta de Recompensas
CREATE TABLE IF NOT EXISTS reward_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  sello_objetivo INT NOT NULL,
  nombre TEXT NOT NULL DEFAULT 'Premio',
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, sello_objetivo)
);

CREATE TABLE IF NOT EXISTS milestone_prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID NOT NULL REFERENCES reward_milestones(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'base',
  nombre TEXT NOT NULL,
  descripcion TEXT,
  probabilidad INT DEFAULT 33,
  imagen_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roulette_spins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id),
  milestone_id UUID REFERENCES reward_milestones(id),
  prize_id UUID REFERENCES milestone_prizes(id),
  prize_nombre TEXT,
  codigo_cupon TEXT UNIQUE DEFAULT upper(substring(encode(gen_random_bytes(6),'hex'),1,8)),
  canjeado BOOLEAN DEFAULT FALSE,
  sello_numero INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Upsell: columna en productos
ALTER TABLE menu_products ADD COLUMN IF NOT EXISTS es_upsell BOOLEAN DEFAULT FALSE;

-- Anti-churn: configuración por negocio
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS dias_inactividad_churn INT DEFAULT 21;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS mensaje_rescate_whatsapp TEXT DEFAULT '¡Hola {nombre}! Te extrañamos en {negocio}. ¡Tienes {puntos} sellos esperándote! 🎁 Ven esta semana y recibe un beneficio especial.';

-- Indices
CREATE INDEX IF NOT EXISTS idx_reward_milestones_business ON reward_milestones(business_id);
CREATE INDEX IF NOT EXISTS idx_milestone_prizes_milestone ON milestone_prizes(milestone_id);
CREATE INDEX IF NOT EXISTS idx_roulette_spins_cliente ON roulette_spins(cliente_id);
CREATE INDEX IF NOT EXISTS idx_roulette_spins_business ON roulette_spins(business_id);

-- RLS desactivado (dev)
ALTER TABLE reward_milestones DISABLE ROW LEVEL SECURITY;
ALTER TABLE milestone_prizes DISABLE ROW LEVEL SECURITY;
ALTER TABLE roulette_spins DISABLE ROW LEVEL SECURITY;

-- Datos demo: hitos para La Burrería
INSERT INTO reward_milestones (business_id, sello_objetivo, nombre)
SELECT id, 5, 'Premio Intermedio (Sello 5)'
FROM businesses WHERE slug = 'laburreria'
ON CONFLICT (business_id, sello_objetivo) DO NOTHING;

INSERT INTO reward_milestones (business_id, sello_objetivo, nombre)
SELECT id, 10, 'Gran Premio Final (Sello 10)'
FROM businesses WHERE slug = 'laburreria'
ON CONFLICT (business_id, sello_objetivo) DO NOTHING;

INSERT INTO milestone_prizes (milestone_id, tier, nombre, probabilidad)
SELECT rm.id, 'base', 'Refresco Gratis', 50
FROM reward_milestones rm
JOIN businesses b ON b.id = rm.business_id
WHERE b.slug = 'laburreria' AND rm.sello_objetivo = 5
ON CONFLICT DO NOTHING;

INSERT INTO milestone_prizes (milestone_id, tier, nombre, probabilidad)
SELECT rm.id, 'medio', '10% de Descuento', 35
FROM reward_milestones rm
JOIN businesses b ON b.id = rm.business_id
WHERE b.slug = 'laburreria' AND rm.sello_objetivo = 5
ON CONFLICT DO NOTHING;

INSERT INTO milestone_prizes (milestone_id, tier, nombre, probabilidad)
SELECT rm.id, 'grande', 'Papas Gratis', 15
FROM reward_milestones rm
JOIN businesses b ON b.id = rm.business_id
WHERE b.slug = 'laburreria' AND rm.sello_objetivo = 5
ON CONFLICT DO NOTHING;

INSERT INTO milestone_prizes (milestone_id, tier, nombre, probabilidad)
SELECT rm.id, 'base', 'Charola Chica', 50
FROM reward_milestones rm
JOIN businesses b ON b.id = rm.business_id
WHERE b.slug = 'laburreria' AND rm.sello_objetivo = 10
ON CONFLICT DO NOTHING;

INSERT INTO milestone_prizes (milestone_id, tier, nombre, probabilidad)
SELECT rm.id, 'medio', 'MegaBox Familiar', 35
FROM reward_milestones rm
JOIN businesses b ON b.id = rm.business_id
WHERE b.slug = 'laburreria' AND rm.sello_objetivo = 10
ON CONFLICT DO NOTHING;

INSERT INTO milestone_prizes (milestone_id, tier, nombre, probabilidad)
SELECT rm.id, 'grande', 'Charola de Alas', 15
FROM reward_milestones rm
JOIN businesses b ON b.id = rm.business_id
WHERE b.slug = 'laburreria' AND rm.sello_objetivo = 10
ON CONFLICT DO NOTHING;

-- Verificación
SELECT 'reward_milestones' as tabla, COUNT(*) as registros FROM reward_milestones
UNION ALL
SELECT 'milestone_prizes', COUNT(*) FROM milestone_prizes
UNION ALL
SELECT 'roulette_spins', COUNT(*) FROM roulette_spins;
