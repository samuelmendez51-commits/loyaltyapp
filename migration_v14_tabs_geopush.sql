-- ============================================================
-- LoyaltyClub — Migración v14 (Pestañas, Geopush y Horarios Diarios)
-- Ejecuta este script en el editor SQL de Supabase
-- ============================================================

-- ── 1. Corregir programas_fidelidad ──────────────────────────
ALTER TABLE programas_fidelidad ADD COLUMN IF NOT EXISTS activo boolean DEFAULT true;

-- ── 2. Crear tabla premios_canjes ────────────────────────────
CREATE TABLE IF NOT EXISTS premios_canjes (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id    UUID REFERENCES clientes(id) ON DELETE CASCADE,
  premio_nombre TEXT NOT NULL,
  estado        TEXT DEFAULT 'Pendiente',
  creado_en     TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS para premios_canjes
ALTER TABLE premios_canjes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "premios_canjes_open" ON premios_canjes;
CREATE POLICY "premios_canjes_open" ON premios_canjes FOR ALL USING (true) WITH CHECK (true);

-- ── 3. Crear tabla horarios_semanales ────────────────────────
CREATE TABLE IF NOT EXISTS horarios_semanales (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sucursal_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  dia_text    TEXT NOT NULL,
  abierto     BOOLEAN DEFAULT true,
  apertura    TIME NOT NULL DEFAULT '14:00',
  cierre      TIME NOT NULL DEFAULT '22:00',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS para horarios_semanales
ALTER TABLE horarios_semanales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "horarios_semanales_open" ON horarios_semanales;
CREATE POLICY "horarios_semanales_open" ON horarios_semanales FOR ALL USING (true) WITH CHECK (true);

-- ── 4. Crear tabla configuracion_geopush ─────────────────────
CREATE TABLE IF NOT EXISTS configuracion_geopush (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id  UUID REFERENCES businesses(id) ON DELETE CASCADE,
  latitud      NUMERIC NOT NULL DEFAULT 19.421583,
  longitud     NUMERIC NOT NULL DEFAULT -102.067222,
  radio_metros INTEGER NOT NULL DEFAULT 500,
  mensaje_push TEXT NOT NULL DEFAULT '¡Estás cerca de tu premio VIP! Pasa por tus sellos.'
);

-- Habilitar RLS para configuracion_geopush
ALTER TABLE configuracion_geopush ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "configuracion_geopush_open" ON configuracion_geopush;
CREATE POLICY "configuracion_geopush_open" ON configuracion_geopush FOR ALL USING (true) WITH CHECK (true);

-- ── 5. Agregar soporte para ruleta en businesses ──────────────
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS reiniciar_sellos_ruleta BOOLEAN DEFAULT true;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS premios_ruleta JSONB DEFAULT '["Café Gratis", "Postre Sorpresa", "Bebida Grande", "20% Descuento"]'::jsonb;

