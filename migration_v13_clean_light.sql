-- ============================================================
-- LoyaltyApp — Migración v13 FINAL (100% Safe & Autosanable)
-- Maneja tablas ya creadas parcialmente en intentos previos
-- ============================================================

-- ── OPCIONAL: LIMPIEZA ABSOLUTA (Recomendado si no hay datos de producción) ──
-- Si tuviste errores en intentos previos, puedes descomentar las siguientes 4 líneas
-- para reiniciar las tablas desde cero y evitar cualquier conflicto de columnas/restricciones:
-- DROP TABLE IF EXISTS recompensas CASCADE;
-- DROP TABLE IF EXISTS programas_fidelidad CASCADE;
-- DROP TABLE IF EXISTS menus_digitales CASCADE;
-- DROP TABLE IF EXISTS configuracion_negocio CASCADE;

-- ── PASO 1: ENUMs ─────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE tipo_programa_enum AS ENUM ('estampillas', 'gift_card', 'niveles');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE comportamiento_completado_enum AS ENUM ('sin_limite', 'limitado', 'reiniciar');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── PASO 2: Sanear columnas en businesses ─────────────────────

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS nombre_contacto      TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS apellido_contacto    TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS telefono_empresa     TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS hora_apertura        TEXT DEFAULT '14:00';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS hora_cierre          TEXT DEFAULT '22:00';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS link_facebook        TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS link_instagram       TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS link_tiktok          TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS link_youtube         TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS horario_semanal      JSONB;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS color_primario       TEXT DEFAULT '#dc2626';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS sucursal_registro_id UUID;

-- ── PASO 3: Sanear columnas en clientes ──────────────────────

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS sucursal_registro_id UUID;

-- ── PASO 4: Reparar tablas que pudieron crearse incompletas ──
-- (Agrega la columna business_id de forma 100% segura usando PL/pgSQL dinámico)

DO $$
BEGIN
  -- Agregar business_id a programas_fidelidad si existe y no lo tiene
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'programas_fidelidad') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'programas_fidelidad' AND column_name = 'business_id') THEN
      ALTER TABLE public.programas_fidelidad ADD COLUMN business_id UUID;
    END IF;
  END IF;

  -- Agregar business_id y programa_id a recompensas si existe y no los tiene
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recompensas') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'recompensas' AND column_name = 'business_id') THEN
      ALTER TABLE public.recompensas ADD COLUMN business_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'recompensas' AND column_name = 'programa_id') THEN
      ALTER TABLE public.recompensas ADD COLUMN programa_id UUID;
    END IF;
  END IF;

  -- Agregar business_id a menus_digitales si existe y no lo tiene
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menus_digitales') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'menus_digitales' AND column_name = 'business_id') THEN
      ALTER TABLE public.menus_digitales ADD COLUMN business_id UUID;
    END IF;
  END IF;

  -- Agregar business_id a configuracion_negocio si existe y no lo tiene
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'configuracion_negocio') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'configuracion_negocio' AND column_name = 'business_id') THEN
      ALTER TABLE public.configuracion_negocio ADD COLUMN business_id UUID;
    END IF;
  END IF;
END $$;

-- ── PASO 5: Crear tabla programas_fidelidad ───────────────────

CREATE TABLE IF NOT EXISTS programas_fidelidad (
  id                        UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id               UUID    NOT NULL,
  tipo_programa             TEXT    NOT NULL DEFAULT 'estampillas',
  nombre_club               TEXT    NOT NULL DEFAULT 'Mi Club VIP',
  estampillas_max_dia       INTEGER NOT NULL DEFAULT 1,
  total_estampillas         INTEGER NOT NULL DEFAULT 10,
  precargadas               INTEGER NOT NULL DEFAULT 0,
  comportamiento_completado TEXT    NOT NULL DEFAULT 'sin_limite',
  activo                    BOOLEAN NOT NULL DEFAULT true,
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now()
);

-- Aseguramos que tenga business_id si fue creada anteriormente sin él
ALTER TABLE programas_fidelidad ADD COLUMN IF NOT EXISTS business_id UUID;

-- ── PASO 6: Crear tabla recompensas ──────────────────────────

CREATE TABLE IF NOT EXISTS recompensas (
  id                     UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  programa_id            UUID,
  business_id            UUID    NOT NULL,
  nombre                 TEXT    NOT NULL,
  descripcion            TEXT,
  estampillas_requeridas INTEGER NOT NULL DEFAULT 5,
  imagen_url             TEXT,
  estado                 BOOLEAN NOT NULL DEFAULT true,
  orden                  INTEGER DEFAULT 0,
  created_at             TIMESTAMPTZ DEFAULT now()
);

-- Aseguramos que tenga business_id y programa_id si fue creada anteriormente sin ellos
ALTER TABLE recompensas ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE recompensas ADD COLUMN IF NOT EXISTS programa_id UUID;

-- ── PASO 7: Crear tabla menus_digitales ──────────────────────

CREATE TABLE IF NOT EXISTS menus_digitales (
  id                UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id       UUID    NOT NULL,
  sucursal_id       UUID,
  tipo              TEXT    NOT NULL DEFAULT 'local',
  url_consumo_local TEXT,
  url_domicilio     TEXT,
  qr_local_path     TEXT,
  qr_domicilio_path TEXT,
  archivo_url       TEXT,
  nombre            TEXT    DEFAULT 'Menú',
  activo            BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- Aseguramos que tenga business_id si fue creada anteriormente sin él
ALTER TABLE menus_digitales ADD COLUMN IF NOT EXISTS business_id UUID;

-- ── PASO 8: Crear tabla configuracion_negocio ────────────────

CREATE TABLE IF NOT EXISTS configuracion_negocio (
  id                UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id       UUID    UNIQUE,
  nombre_empresa    TEXT,
  nombre_contacto   TEXT,
  apellido_contacto TEXT,
  telefono_empresa  TEXT,
  telefono_whatsapp TEXT,
  horario_apertura  TEXT    DEFAULT '14:00',
  horario_cierre    TEXT    DEFAULT '22:00',
  horario_semanal   JSONB,
  link_facebook     TEXT,
  link_instagram    TEXT,
  link_tiktok       TEXT,
  link_youtube      TEXT,
  color_primario    TEXT    DEFAULT '#dc2626',
  logo_url          TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- Aseguramos que tenga business_id si fue creada anteriormente sin él
ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS business_id UUID;

-- ── PASO 9: Índices (Verificación defensiva) ─────────────────

DO $$
BEGIN
  -- Crear índice en programas_fidelidad(business_id) si la columna existe
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'programas_fidelidad' AND column_name = 'business_id') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_prog_fid_biz' AND n.nspname = 'public') THEN
      CREATE INDEX idx_prog_fid_biz ON public.programas_fidelidad(business_id);
    END IF;
  END IF;
  
  -- Crear índice en recompensas(business_id) si la column existe
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'recompensas' AND column_name = 'business_id') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_recomp_biz' AND n.nspname = 'public') THEN
      CREATE INDEX idx_recomp_biz ON public.recompensas(business_id);
    END IF;
  END IF;

  -- Crear índice en recompensas(programa_id) si la column existe
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'recompensas' AND column_name = 'programa_id') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_recomp_prog' AND n.nspname = 'public') THEN
      CREATE INDEX idx_recomp_prog ON public.recompensas(programa_id);
    END IF;
  END IF;

  -- Crear índice en menus_digitales(business_id) si la column existe
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'menus_digitales' AND column_name = 'business_id') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_menus_biz' AND n.nspname = 'public') THEN
      CREATE INDEX idx_menus_biz ON public.menus_digitales(business_id);
    END IF;
  END IF;

  -- Crear índice en configuracion_negocio(business_id) si la column existe
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'configuracion_negocio' AND column_name = 'business_id') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_conf_neg_biz' AND n.nspname = 'public') THEN
      CREATE INDEX idx_conf_neg_biz ON public.configuracion_negocio(business_id);
    END IF;
  END IF;
END $$;

-- ── PASO 10: RLS ─────────────────────────────────────────────

ALTER TABLE programas_fidelidad   ENABLE ROW LEVEL SECURITY;
ALTER TABLE recompensas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus_digitales       ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion_negocio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pf_open"   ON programas_fidelidad;
DROP POLICY IF EXISTS "rec_open"  ON recompensas;
DROP POLICY IF EXISTS "men_open"  ON menus_digitales;
DROP POLICY IF EXISTS "conf_open" ON configuracion_negocio;

CREATE POLICY "pf_open"   ON programas_fidelidad   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "rec_open"  ON recompensas           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "men_open"  ON menus_digitales       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "conf_open" ON configuracion_negocio FOR ALL USING (true) WITH CHECK (true);

-- ── PASO 11: Función y triggers updated_at ───────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pf_upd   ON programas_fidelidad;
DROP TRIGGER IF EXISTS trg_conf_upd ON configuracion_negocio;
DROP TRIGGER IF EXISTS trg_men_upd  ON menus_digitales;

CREATE TRIGGER trg_pf_upd
  BEFORE UPDATE ON programas_fidelidad
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_conf_upd
  BEFORE UPDATE ON configuracion_negocio
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_men_upd
  BEFORE UPDATE ON menus_digitales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ✅ Migración v13 FINAL completada sin errores.
-- ============================================================
