-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN v18: Urban Delivery — Motor de Flota de Repartidores
-- LoyaltyClub.mx — 2026
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1. DELIVERY FLEETS
--    Una empresa de repartidores independiente (tenant tipo delivery_fleet)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_fleets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  nombre        text NOT NULL,
  ciudad        text,
  activo        boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 2. BIKERS
--    Repartidores de la flota. PIN hasheado en la app.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bikers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_id      uuid NOT NULL REFERENCES delivery_fleets(id) ON DELETE CASCADE,
  nombre        text NOT NULL,
  telefono      text,
  foto_url      text,
  pin           text NOT NULL,                -- PIN de acceso (mínimo 4 dígitos)
  rol           text DEFAULT 'biker'          -- 'biker' | 'admin_flota'
                CHECK (rol IN ('biker', 'admin_flota')),
  -- Presencia en tiempo real (solo se escribe al conectar/desconectar, NO por GPS ping)
  conectado     boolean DEFAULT false,
  ultimo_ping   timestamptz,
  -- Última posición CONOCIDA (escrita solo al desconectarse, el realtime viaja por Broadcast)
  lat_ultima    double precision,
  lng_ultima    double precision,
  activo        boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bikers_fleet_conectado ON bikers(fleet_id, conectado) WHERE activo = true;

-- ─────────────────────────────────────────────────────────────
-- 3. DELIVERY REQUESTS
--    Núcleo del módulo — cada solicitud de repartidor
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_id            uuid NOT NULL REFERENCES delivery_fleets(id),
  restaurante_id      uuid NOT NULL REFERENCES businesses(id),
  biker_id            uuid REFERENCES bikers(id),           -- NULL hasta ser aceptado

  -- Datos del pedido para el Biker
  descripcion         text,
  direccion_entrega   text NOT NULL,
  lat_entrega         double precision,
  lng_entrega         double precision,
  nota_biker          text,

  -- Máquina de estados
  -- pendiente → aceptado → en_camino → completado
  --    ↑             ↓ (cancelar_biker regresa a pendiente)
  estado              text NOT NULL DEFAULT 'pendiente'
                      CHECK (estado IN (
                        'pendiente',
                        'aceptado',
                        'en_camino',
                        'completado',
                        'cancelado_biker',
                        'cancelado_restaurante'
                      )),

  -- Timestamps de auditoría por estado
  aceptado_at         timestamptz,
  recogido_at         timestamptz,
  entregado_at        timestamptz,
  cancelado_at        timestamptz,
  motivo_cancelacion  text,

  -- Tarifas (calculadas al completar)
  tarifa_base         numeric(10,2),
  tarifa_extra        numeric(10,2) DEFAULT 0,
  total_cobrado       numeric(10,2),

  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- Índices para queries en tiempo real (críticos para latencia)
CREATE INDEX IF NOT EXISTS idx_dr_fleet_estado
  ON delivery_requests(fleet_id, estado);

CREATE INDEX IF NOT EXISTS idx_dr_biker_activo
  ON delivery_requests(biker_id, estado)
  WHERE estado NOT IN ('completado', 'cancelado_restaurante');

CREATE INDEX IF NOT EXISTS idx_dr_restaurante_reciente
  ON delivery_requests(restaurante_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 4. FUNCIÓN ATÓMICA: reclamar_viaje
--    Previene race condition cuando dos Bikers presionan "¡YO!" simultáneamente.
--    Solo el primer UPDATE que encuentre estado='pendiente' gana.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION reclamar_viaje(
  p_request_id uuid,
  p_biker_id   uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE delivery_requests
  SET
    estado     = 'aceptado',
    biker_id   = p_biker_id,
    aceptado_at = now(),
    updated_at = now()
  WHERE
    id     = p_request_id
    AND estado = 'pendiente';   -- Solo gana si nadie más lo tomó primero

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;     -- true = reclamado | false = ya fue tomado
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. FUNCIÓN: cancelar_viaje_biker
--    Devuelve el request a 'pendiente' y limpia el biker_id
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cancelar_viaje_biker(
  p_request_id uuid,
  p_biker_id   uuid,
  p_motivo     text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE delivery_requests
  SET
    estado             = 'pendiente',
    biker_id           = NULL,
    aceptado_at        = NULL,
    cancelado_at       = now(),
    motivo_cancelacion = p_motivo,
    updated_at         = now()
  WHERE
    id       = p_request_id
    AND biker_id = p_biker_id
    AND estado IN ('aceptado', 'en_camino');

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 6. TRIGGER: updated_at automático
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_requests_updated ON delivery_requests;
CREATE TRIGGER trg_delivery_requests_updated
  BEFORE UPDATE ON delivery_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_bikers_updated ON bikers;
CREATE TRIGGER trg_bikers_updated
  BEFORE UPDATE ON bikers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 7. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────
ALTER TABLE delivery_fleets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bikers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_requests  ENABLE ROW LEVEL SECURITY;

-- Política abierta para service role (API routes del servidor)
-- Las políticas granulares se implementan a nivel de API route con validación de sesión

CREATE POLICY "service_role_full_fleets" ON delivery_fleets
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_bikers" ON bikers
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_requests" ON delivery_requests
  TO service_role USING (true) WITH CHECK (true);

-- Lectura anónima solo para requests pendientes de la flota (para el portal Biker)
CREATE POLICY "anon_read_pendientes" ON delivery_requests
  FOR SELECT TO anon
  USING (estado = 'pendiente');

-- ─────────────────────────────────────────────────────────────
-- 8. PUBLICAR TABLAS EN REALTIME (para postgres_changes)
--    Los cambios de estado se propagan vía canal realtime de Supabase
-- ─────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE delivery_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE bikers;

-- Fin de migración v18
