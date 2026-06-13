-- ═══════════════════════════════════════════════════════════════════════════
-- LOYALTYCLUB — MIGRACIÓN v48: REFACTORIZACIÓN CORE ENTERPRISE MULTI-TENANT
-- SaaS Multi-Tenant · Seguridad de Billetera y Reparto
-- Ejecutar en el Editor SQL de Supabase
-- Autor: LoyaltyClub.mx — 2026
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. MODIFICACIONES DE ESQUEMA (COLUMNAS DE AISLAMIENTO Y CACHÉ) ──────────

-- Tabla: businesses (Caché de Wallet Class)
ALTER TABLE businesses 
  ADD COLUMN IF NOT EXISTS google_class_created boolean DEFAULT false;

-- Tabla: premios_canjes (Columna de aislamiento tenant)
ALTER TABLE premios_canjes 
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES businesses(id) ON DELETE CASCADE;

-- Tabla: bikers (Columna de aislamiento tenant)
ALTER TABLE bikers 
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES businesses(id) ON DELETE CASCADE;


-- ── 2. RETROALIMENTACIÓN DE DATOS (BACKFILL) ───────────────────────────────

-- Limpiar huérfanos antes de forzar integridad referencial
DELETE FROM premios_canjes WHERE cliente_id NOT IN (SELECT id FROM clientes);
DELETE FROM bikers WHERE fleet_id NOT IN (SELECT id FROM delivery_fleets);

-- Backfill business_id en premios_canjes
UPDATE premios_canjes pc
SET business_id = c.business_id
FROM clientes c
WHERE pc.cliente_id = c.id
  AND pc.business_id IS NULL;

-- Backfill business_id en bikers
UPDATE bikers b
SET business_id = df.business_id
FROM delivery_fleets df
WHERE b.fleet_id = df.id
  AND b.business_id IS NULL;

-- Forzar restricción NOT NULL tras el backfill
ALTER TABLE premios_canjes ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE bikers ALTER COLUMN business_id SET NOT NULL;


-- ── 3. CREACIÓN DE ÍNDICES DE SOPORTE MULTI-TENANT ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_premios_canjes_business ON premios_canjes(business_id);
CREATE INDEX IF NOT EXISTS idx_bikers_business ON bikers(business_id);


-- ── 4. FUNCIÓN HELPER: OBTENER ID DEL BIKER ACTUAL DESDE COOKIES ───────────
CREATE OR REPLACE FUNCTION current_biker_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cookie text;
  v_session_id text;
  v_biker_id uuid;
BEGIN
  -- Obtener cookies desde las cabeceras HTTP de PostgREST
  v_cookie := current_setting('request.headers', true)::json->>'cookie';
  IF v_cookie IS NULL THEN
    RETURN NULL;
  END IF;

  -- Extraer la cookie biker_session_id usando regex
  v_session_id := substring(v_cookie from 'biker_session_id=([^;]+)');
  IF v_session_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Resolver biker activo
  SELECT id INTO v_biker_id 
  FROM bikers 
  WHERE current_session_id = v_session_id::uuid 
    AND activo = true;

  RETURN v_biker_id;
END;
$$;


-- ── 5. SEGURIDAD A NIVEL DE FILA (RLS) Y POLÍTICAS ──────────────────────────

-- Habilitar y forzar RLS en business_users, premios_canjes y bikers
ALTER TABLE business_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_users FORCE ROW LEVEL SECURITY;

ALTER TABLE premios_canjes ENABLE ROW LEVEL SECURITY;
ALTER TABLE premios_canjes FORCE ROW LEVEL SECURITY;

ALTER TABLE bikers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bikers FORCE ROW LEVEL SECURITY;

ALTER TABLE delivery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_requests FORCE ROW LEVEL SECURITY;


-- ── Políticas para: business_users
DROP POLICY IF EXISTS "business_users_staff_all" ON business_users;
DROP POLICY IF EXISTS "business_users_public_select" ON business_users;

-- Staff del negocio puede gestionar usuarios de su propio negocio
CREATE POLICY "business_users_staff_all" ON business_users
  FOR ALL TO authenticated
  USING ( is_staff_of_business(business_id) )
  WITH CHECK ( is_staff_of_business(business_id) );

-- Permitir consultas de inicio de sesión/pin anónimas limitadas por activo
CREATE POLICY "business_users_public_select" ON business_users
  FOR SELECT TO anon
  USING ( activo = true );


-- ── Políticas para: premios_canjes
DROP POLICY IF EXISTS "premios_canjes_staff_all" ON premios_canjes;
CREATE POLICY "premios_canjes_staff_all" ON premios_canjes
  FOR ALL TO authenticated
  USING ( is_staff_of_business(business_id) )
  WITH CHECK ( is_staff_of_business(business_id) );


-- ── Políticas para: bikers
DROP POLICY IF EXISTS "public_select_bikers" ON bikers;
DROP POLICY IF EXISTS "public_update_bikers" ON bikers;
DROP POLICY IF EXISTS "bikers_staff_all" ON bikers;
DROP POLICY IF EXISTS "bikers_anon_select" ON bikers;

-- Staff del negocio puede gestionar bikers
CREATE POLICY "bikers_staff_all" ON bikers
  FOR ALL TO authenticated
  USING ( is_staff_of_business(business_id) )
  WITH CHECK ( is_staff_of_business(business_id) );

-- Permitir a bikers e invitados consultar bikers activos (para validar login)
CREATE POLICY "bikers_anon_select" ON bikers
  FOR SELECT TO anon
  USING ( activo = true );


-- ── Políticas para: delivery_requests (reparto seguro)
DROP POLICY IF EXISTS "public_select_requests" ON delivery_requests;
DROP POLICY IF EXISTS "public_update_requests" ON delivery_requests;
DROP POLICY IF EXISTS "anon_read_pendientes" ON delivery_requests;
DROP POLICY IF EXISTS "delivery_requests_staff_all" ON delivery_requests;
DROP POLICY IF EXISTS "delivery_requests_anon_select" ON delivery_requests;

-- Staff: CRUD total sobre pedidos de su restaurante
CREATE POLICY "delivery_requests_staff_all" ON delivery_requests
  FOR ALL TO authenticated
  USING ( is_staff_of_business(restaurante_id) )
  WITH CHECK ( is_staff_of_business(restaurante_id) );

-- Biker (anon): Ver solicitudes pendientes de la flota, o las asignadas a él mismo
CREATE POLICY "delivery_requests_anon_select" ON delivery_requests
  FOR SELECT TO anon
  USING (
    estado = 'pendiente'
    OR 
    biker_id = current_biker_id()
  );


-- ── 6. FUNCIONES Y RPCS SEGURAS (SECURITY DEFINER) ─────────────────────────

-- RPC: login_biker
-- Valida credenciales, comprueba bloqueos y actualiza sesión de forma protegida
CREATE OR REPLACE FUNCTION login_biker(
  p_fleet_id uuid,
  p_telefono text,
  p_pin text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_biker record;
  v_session_id uuid;
BEGIN
  -- Buscar biker activo con credenciales correctas
  SELECT * INTO v_biker
  FROM bikers
  WHERE fleet_id = p_fleet_id
    AND telefono = p_telefono
    AND pin = p_pin
    AND activo = true;

  IF v_biker.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Comprobar estado de aprobación y bloqueos
  IF v_biker.estado_aprobacion = 'pendiente' THEN
    RETURN jsonb_build_object('error', 'Tu solicitud de ingreso está pendiente de aprobación.');
  ELSIF v_biker.estado_aprobacion = 'rechazado' THEN
    RETURN jsonb_build_object('error', 'Tu solicitud de ingreso ha sido rechazada.');
  ELSIF v_biker.bloqueado_permanente THEN
    RETURN jsonb_build_object('error', 'Tu acceso ha sido bloqueado de forma indefinida.');
  ELSIF v_biker.bloqueado_hasta IS NOT NULL AND v_biker.bloqueado_hasta > now() THEN
    RETURN jsonb_build_object('error', 'Acceso suspendido temporalmente hasta el ' || v_biker.bloqueado_hasta::text);
  END IF;

  -- Generar nueva sesión única
  v_session_id := gen_random_uuid();

  -- Registrar sesión
  UPDATE bikers
  SET current_session_id = v_session_id,
      conectado = true,
      conectado_desde = now(),
      ultimo_ping = now()
  WHERE id = v_biker.id;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'biker', jsonb_build_object(
      'id', v_biker.id,
      'nombre', v_biker.nombre,
      'fleet_id', v_biker.fleet_id,
      'rol', v_biker.rol,
      'conectado', true,
      'current_session_id', v_session_id
    )
  );
END;
$$;

-- RPC: actualizar_presencia_biker
-- Actualiza estatus de conexión del biker verificando sesión
CREATE OR REPLACE FUNCTION actualizar_presencia_biker(
  p_biker_id uuid,
  p_session_id uuid,
  p_conectado boolean,
  p_conectado_desde text DEFAULT NULL,
  p_minutos_conexion_hoy integer DEFAULT NULL,
  p_ultimo_ping text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row_updated integer;
BEGIN
  UPDATE bikers
  SET
    conectado = p_conectado,
    conectado_desde = CASE WHEN p_conectado_desde IS NULL THEN conectado_desde ELSE p_conectado_desde::timestamptz END,
    minutos_conexion_hoy = COALESCE(p_minutos_conexion_hoy, minutos_conexion_hoy),
    ultimo_ping = CASE WHEN p_ultimo_ping IS NULL THEN ultimo_ping ELSE p_ultimo_ping::timestamptz END,
    updated_at = now()
  WHERE id = p_biker_id
    AND current_session_id = p_session_id
    AND activo = true;

  GET DIAGNOSTICS v_row_updated = ROW_COUNT;
  RETURN v_row_updated > 0;
END;
$$;

-- RPC: avanzar_estado_viaje
-- Transición segura de estados de entrega validando la sesión del biker
CREATE OR REPLACE FUNCTION avanzar_estado_viaje(
  p_request_id uuid,
  p_biker_id uuid,
  p_session_id uuid,
  p_estado text,
  p_tarifa_base numeric DEFAULT NULL,
  p_tarifa_extra numeric DEFAULT NULL,
  p_total_cobrado numeric DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_biker_valido boolean;
  v_row_updated integer;
BEGIN
  -- Validar sesión y biker activo
  SELECT EXISTS (
    SELECT 1 FROM bikers
    WHERE id = p_biker_id
      AND current_session_id = p_session_id
      AND activo = true
  ) INTO v_biker_valido;

  IF NOT v_biker_valido THEN
    RETURN false;
  END IF;

  -- Aplicar máquina de estados transaccional
  IF p_estado = 'en_camino' THEN
    UPDATE delivery_requests
    SET estado = 'en_camino',
        recogido_at = now(),
        updated_at = now()
    WHERE id = p_request_id
      AND biker_id = p_biker_id
      AND estado = 'aceptado';
      
  ELSIF p_estado = 'completado' THEN
    UPDATE delivery_requests
    SET estado = 'completado',
        entregado_at = now(),
        tarifa_base = COALESCE(p_tarifa_base, tarifa_base),
        tarifa_extra = COALESCE(p_tarifa_extra, tarifa_extra),
        total_cobrado = COALESCE(p_total_cobrado, total_cobrado),
        updated_at = now()
    WHERE id = p_request_id
      AND biker_id = p_biker_id
      AND estado = 'en_camino';
  ELSE
    RETURN false;
  END IF;

  GET DIAGNOSTICS v_row_updated = ROW_COUNT;
  RETURN v_row_updated > 0;
END;
$$;
