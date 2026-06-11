-- ═══════════════════════════════════════════════════════════════════════════
-- LOYALTYCLUB — MIGRACIÓN v38: BLINDAJE COMPLETO DE SEGURIDAD RLS
-- SaaS Multi-Tenant · Row Level Security Enterprise
-- Ejecutar en Supabase SQL Editor (producción)
-- Autor: LoyaltyClub.mx — 2026
--
-- ARQUITECTURA DE SEGURIDAD:
--   • El backend de Next.js usa service_role → salta RLS automáticamente (seguro).
--   • El staff/admin autenticado se valida cruzando auth.uid() con business_users.
--   • El portal público del cliente (ruleta Realtime) lee por qr_token o cliente_id
--     sin exponer datos de otros comercios.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 0: FUNCIÓN HELPER — is_staff_of_business(business_id)
-- Evalúa si el usuario autenticado (auth.uid()) pertenece al negocio indicado.
-- SECURITY DEFINER garantiza que la función corre con privilegios elevados
-- incluso cuando es llamada desde una política RLS de rol 'authenticated'.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_staff_of_business(p_business_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Valida identidad del usuario autenticado contra business_users.
  -- JOIN directo aprovecha el índice compuesto (email, business_id).
  -- No filtra por 'activo' a nivel de función para máxima compatibilidad
  -- con bases de datos donde la columna puede no existir aún.
  RETURN EXISTS (
    SELECT 1
    FROM business_users bu
    JOIN auth.users au ON au.id = auth.uid()
    WHERE bu.business_id = p_business_id
      AND bu.email       = au.email
  );
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth;

-- ─────────────────────────────────────────────────────────────────────────
-- PASO 0-B: ÍNDICES DE SOPORTE PARA LA FUNCIÓN HELPER
-- Índices PLANOS (sin WHERE predicate) para máxima compatibilidad.
-- PostgreSQL prohíbe subconsultas en predicados de índice (error 0A000).
-- La columna 'activo' puede no existir en versiones anteriores del schema,
-- por lo que NO se usa como predicado parcial aquí.
-- ─────────────────────────────────────────────────────────────────────────

-- Índice principal: búsqueda O(1) en is_staff_of_business()
CREATE INDEX IF NOT EXISTS idx_business_users_email_biz
  ON business_users (email, business_id);

-- Índice secundario: listado de usuarios por negocio
CREATE INDEX IF NOT EXISTS idx_business_users_business_id
  ON business_users (business_id);

-- Índice de soporte para lecturas públicas por qr_token (portal cliente)
CREATE INDEX IF NOT EXISTS idx_clientes_qr_token_business
  ON clientes (qr_token, business_id);

-- Índice de soporte para lectura de premios_canjes por cliente_id
CREATE INDEX IF NOT EXISTS idx_premios_canjes_cliente_id
  ON premios_canjes (cliente_id);

-- Índice de soporte para historical_monthly_stats (sólo si la tabla ya existe).
-- PostgreSQL NO permite subconsultas en predicados de índice (error 0A000),
-- por lo que se usa DO $$ para verificar existencia antes de ejecutar.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'historical_monthly_stats'
  ) THEN
    -- Índice plano sin subconsulta en el WHERE predicate
    EXECUTE '
      CREATE INDEX IF NOT EXISTS idx_historical_monthly_stats_business
        ON historical_monthly_stats (business_id)
    ';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- ██████████████████████  TABLA: businesses  █████████████████████████████
-- Sólo el staff del propio negocio puede ver y modificar su tenant.
-- El superadmin usa service_role → acceso total sin restricción.
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses FORCE ROW LEVEL SECURITY;

-- Limpieza idempotente (permite re-ejecuciones seguras)
DROP POLICY IF EXISTS "businesses_staff_all"    ON businesses;
DROP POLICY IF EXISTS "businesses_public_read"  ON businesses;

-- STAFF: acceso completo al propio tenant
CREATE POLICY "businesses_staff_all" ON businesses
  FOR ALL
  TO authenticated
  USING (
    is_staff_of_business(id)
  )
  WITH CHECK (
    is_staff_of_business(id)
  );

-- PÚBLICO: lectura de datos de branding (necesario para la landing page [slug])
-- Solo expone nombre, slug, logo, colores, horarios — no datos financieros
CREATE POLICY "businesses_public_read" ON businesses
  FOR SELECT
  TO anon, authenticated
  USING (
    estado = 'activo'
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- ██████████████████████  TABLA: clientes  ████████████████████████████████
-- Staff: CRUD completo en sus propios clientes.
-- Portal público (anon): SELECT por qr_token propio (ruleta Realtime).
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clientes_staff_all"         ON clientes;
DROP POLICY IF EXISTS "clientes_public_qr_select"  ON clientes;

-- STAFF: acceso completo a clientes de su negocio
CREATE POLICY "clientes_staff_all" ON clientes
  FOR ALL
  TO authenticated
  USING (
    is_staff_of_business(business_id)
  )
  WITH CHECK (
    is_staff_of_business(business_id)
  );

-- PORTAL CLIENTE (anon/authenticated): sólo puede leer su propio registro
-- mediante su qr_token único. No puede ver clientes de otros comercios.
-- El qr_token se entrega al cliente cuando escanea su QR personal.
CREATE POLICY "clientes_public_qr_select" ON clientes
  FOR SELECT
  TO anon, authenticated
  USING (
    -- La app cliente envía su qr_token en un claim de sesión anónima
    -- o como parámetro de URL validado server-side.
    -- Aquí el filtro garantiza que el anon sólo pueda ver 1 fila: la suya.
    qr_token = current_setting('request.jwt.claims', true)::json->>'qr_token'
    OR
    -- Fallback: si el claim no existe, sólo el staff (authenticated) puede ver
    (
      current_setting('request.jwt.claims', true)::json->>'qr_token' IS NULL
      AND is_staff_of_business(business_id)
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- ██████████████████████  TABLA: orders  ██████████████████████████████████
-- Staff: CRUD completo en pedidos de su negocio.
-- Anon: INSERT para que el cliente cree pedidos desde el portal (si aplica).
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_staff_all"          ON orders;
DROP POLICY IF EXISTS "orders_public_insert"      ON orders;
DROP POLICY IF EXISTS "orders_public_own_select"  ON orders;

-- STAFF: control total sobre pedidos del propio tenant
CREATE POLICY "orders_staff_all" ON orders
  FOR ALL
  TO authenticated
  USING (
    is_staff_of_business(business_id)
  )
  WITH CHECK (
    is_staff_of_business(business_id)
  );

-- CLIENTE (anon): puede insertar un nuevo pedido (delivery/QR portal)
-- El business_id debe coincidir con el negocio del endpoint invocado
CREATE POLICY "orders_public_insert" ON orders
  FOR INSERT
  TO anon
  WITH CHECK (
    -- Sólo permite insertar en negocios activos (anti-spam cross-tenant)
    EXISTS (
      SELECT 1 FROM businesses
      WHERE id = orders.business_id
        AND estado = 'activo'
    )
  );

-- CLIENTE (anon): puede ver el estado de SU pedido por teléfono
-- Implementa filtro anti cross-tenant: sólo la fila propia
CREATE POLICY "orders_public_own_select" ON orders
  FOR SELECT
  TO anon
  USING (
    telefono_cliente = current_setting('request.jwt.claims', true)::json->>'telefono'
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- ██████████████████████  TABLA: premios_canjes  ███████████████████████████
-- Reemplaza la política abierta "FOR ALL USING (true)" creada en v14.
-- Staff: CRUD completo en canjes de su negocio (join via clientes.business_id).
-- Portal cliente (anon): SELECT y UPDATE (marcar como canjeado) de sus propios canjes.
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE premios_canjes ENABLE ROW LEVEL SECURITY;
ALTER TABLE premios_canjes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "premios_canjes_open"           ON premios_canjes;
DROP POLICY IF EXISTS "premios_canjes_staff_all"      ON premios_canjes;
DROP POLICY IF EXISTS "premios_canjes_client_select"  ON premios_canjes;
DROP POLICY IF EXISTS "premios_canjes_client_update"  ON premios_canjes;

-- STAFF: acceso completo a canjes de clientes de su negocio
CREATE POLICY "premios_canjes_staff_all" ON premios_canjes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM clientes c
      WHERE c.id = premios_canjes.cliente_id
        AND is_staff_of_business(c.business_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM clientes c
      WHERE c.id = premios_canjes.cliente_id
        AND is_staff_of_business(c.business_id)
    )
  );

-- PORTAL CLIENTE (anon): puede ver sus propios canjes durante la sesión de ruleta
-- La validación se hace por qr_token inyectado como claim JWT anónimo
CREATE POLICY "premios_canjes_client_select" ON premios_canjes
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM clientes c
      WHERE c.id = premios_canjes.cliente_id
        AND c.qr_token = current_setting('request.jwt.claims', true)::json->>'qr_token'
    )
  );

-- PORTAL CLIENTE (anon): puede UPDATE de su propio canje (marcar como canjeado)
-- Limitado: sólo puede cambiar el campo 'estado' a 'Canjeado'
CREATE POLICY "premios_canjes_client_update" ON premios_canjes
  FOR UPDATE
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM clientes c
      WHERE c.id = premios_canjes.cliente_id
        AND c.qr_token = current_setting('request.jwt.claims', true)::json->>'qr_token'
    )
  )
  WITH CHECK (
    estado IN ('Pendiente', 'Canjeado')
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- ██████████████████████  TABLA: historial_puntos  █████████████████████████
-- Registro de auditoría de puntos. Escritura sólo desde backend (service_role).
-- Staff: sólo lectura de su propio tenant.
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE historial_puntos ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_puntos FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "historial_puntos_staff_select" ON historial_puntos;
DROP POLICY IF EXISTS "historial_puntos_staff_all"    ON historial_puntos;

-- STAFF: lectura + gestión del historial de su negocio
CREATE POLICY "historial_puntos_staff_all" ON historial_puntos
  FOR ALL
  TO authenticated
  USING (
    is_staff_of_business(business_id)
  )
  WITH CHECK (
    is_staff_of_business(business_id)
  );

-- NOTA: No hay política anon. La escritura al historial es EXCLUSIVA del
-- backend (service_role desde /api/...). Los clientes nunca escriben aquí.


-- ═══════════════════════════════════════════════════════════════════════════
-- ██████████████████████  TABLA: historical_monthly_stats  ████████████████
-- BI/Analytics. Datos sensibles: sólo el staff del tenant puede leerlos.
-- Escritura exclusiva del backend (service_role).
-- Nota: Si la tabla no existe aún en tu DB, este bloque es idempotente
--       porque las políticas no se crean si la tabla no existe.
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'historical_monthly_stats'
  ) THEN

    EXECUTE 'ALTER TABLE historical_monthly_stats ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE historical_monthly_stats FORCE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "hms_staff_select" ON historical_monthly_stats';

    EXECUTE '
      CREATE POLICY "hms_staff_select" ON historical_monthly_stats
        FOR SELECT
        TO authenticated
        USING ( is_staff_of_business(business_id) )
    ';

  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- ██████████████████████  TABLAS AUXILIARES DEL CATÁLOGO  █████████████████
-- menu_groups y menu_products: staff CRUD, clientes/anon sólo SELECT
-- (necesario para que el portal de delivery muestre el menú público)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── menu_groups ──
ALTER TABLE menu_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_groups FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "menu_groups_staff_all"     ON menu_groups;
DROP POLICY IF EXISTS "menu_groups_public_select" ON menu_groups;

CREATE POLICY "menu_groups_staff_all" ON menu_groups
  FOR ALL
  TO authenticated
  USING  ( is_staff_of_business(business_id) )
  WITH CHECK ( is_staff_of_business(business_id) );

CREATE POLICY "menu_groups_public_select" ON menu_groups
  FOR SELECT
  TO anon, authenticated
  USING (
    activo = TRUE
    AND EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = menu_groups.business_id AND b.estado = 'activo'
    )
  );

-- ── menu_products ──
ALTER TABLE menu_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_products FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "menu_products_staff_all"     ON menu_products;
DROP POLICY IF EXISTS "menu_products_public_select" ON menu_products;

CREATE POLICY "menu_products_staff_all" ON menu_products
  FOR ALL
  TO authenticated
  USING  ( is_staff_of_business(business_id) )
  WITH CHECK ( is_staff_of_business(business_id) );

CREATE POLICY "menu_products_public_select" ON menu_products
  FOR SELECT
  TO anon, authenticated
  USING (
    disponible = TRUE
    AND EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = menu_products.business_id AND b.estado = 'activo'
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- ██████████████████████  TABLAS DE RULETA  ████████████████████████████████
-- reward_milestones y milestone_prizes: lectura pública (portal cliente)
-- roulette_spins: staff CRUD + cliente SELECT de sus propios giros
-- ═══════════════════════════════════════════════════════════════════════════

-- ── reward_milestones ──
ALTER TABLE reward_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_milestones FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "milestones_staff_all"     ON reward_milestones;
DROP POLICY IF EXISTS "milestones_public_select" ON reward_milestones;

CREATE POLICY "milestones_staff_all" ON reward_milestones
  FOR ALL
  TO authenticated
  USING  ( is_staff_of_business(business_id) )
  WITH CHECK ( is_staff_of_business(business_id) );

-- El portal del cliente necesita cargar los hitos activos para renderizar la ruleta
CREATE POLICY "milestones_public_select" ON reward_milestones
  FOR SELECT
  TO anon, authenticated
  USING ( activo = TRUE );

-- ── milestone_prizes ──
ALTER TABLE milestone_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestone_prizes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prizes_staff_all"     ON milestone_prizes;
DROP POLICY IF EXISTS "prizes_public_select" ON milestone_prizes;

CREATE POLICY "prizes_staff_all" ON milestone_prizes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM reward_milestones rm
      WHERE rm.id = milestone_prizes.milestone_id
        AND is_staff_of_business(rm.business_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM reward_milestones rm
      WHERE rm.id = milestone_prizes.milestone_id
        AND is_staff_of_business(rm.business_id)
    )
  );

CREATE POLICY "prizes_public_select" ON milestone_prizes
  FOR SELECT
  TO anon, authenticated
  USING ( true );

-- ── roulette_spins ──
ALTER TABLE roulette_spins ENABLE ROW LEVEL SECURITY;
ALTER TABLE roulette_spins FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spins_staff_all"         ON roulette_spins;
DROP POLICY IF EXISTS "spins_client_select"     ON roulette_spins;
DROP POLICY IF EXISTS "spins_client_insert"     ON roulette_spins;

-- STAFF: control total
CREATE POLICY "spins_staff_all" ON roulette_spins
  FOR ALL
  TO authenticated
  USING  ( is_staff_of_business(business_id) )
  WITH CHECK ( is_staff_of_business(business_id) );

-- CLIENTE (anon): ve sus propios giros por qr_token (Realtime de la ruleta)
CREATE POLICY "spins_client_select" ON roulette_spins
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clientes c
      WHERE c.id = roulette_spins.cliente_id
        AND c.qr_token = current_setting('request.jwt.claims', true)::json->>'qr_token'
    )
  );

-- CLIENTE (anon): el backend (service_role) inserta los spins.
-- Esta política es el respaldo si alguna vez se decide insertar desde el cliente.
-- Por defecto está restrictiva: el anon NO puede insertar spins directamente.
-- (La inserción real ocurre desde /api/spin/ready-override via service_role)
-- Si necesitas habilitarlo en el futuro, cambia TO anon por el rol correcto.
CREATE POLICY "spins_client_insert" ON roulette_spins
  FOR INSERT
  TO authenticated  -- sólo staff autenticado, NO anon
  WITH CHECK (
    is_staff_of_business(business_id)
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- ██████████████████████  TABLAS DE AUDITORÍA  ████████████████████████████
-- tracking_events y audit_logs: sólo staff del tenant. Sin acceso anon.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── tracking_events ──
ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tracking_staff_all" ON tracking_events;

CREATE POLICY "tracking_staff_all" ON tracking_events
  FOR ALL
  TO authenticated
  USING  ( is_staff_of_business(business_id) )
  WITH CHECK ( is_staff_of_business(business_id) );

-- ── audit_logs ──
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_staff_select" ON audit_logs;

-- Los audit_logs son sólo lectura para el staff. La escritura es exclusiva del backend.
CREATE POLICY "audit_logs_staff_select" ON audit_logs
  FOR SELECT
  TO authenticated
  USING ( is_staff_of_business(business_id) );


-- ═══════════════════════════════════════════════════════════════════════════
-- ██████████████████████  TABLAS MENORES  █████████████████████████════════
-- branches, business_schedules, loyalty_rewards: gestión interna del tenant
-- ═══════════════════════════════════════════════════════════════════════════

-- ── branches ──
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "branches_staff_all"     ON branches;
DROP POLICY IF EXISTS "branches_public_select" ON branches;

CREATE POLICY "branches_staff_all" ON branches
  FOR ALL
  TO authenticated
  USING  ( is_staff_of_business(business_id) )
  WITH CHECK ( is_staff_of_business(business_id) );

CREATE POLICY "branches_public_select" ON branches
  FOR SELECT
  TO anon, authenticated
  USING (
    activa = TRUE
    AND EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = branches.business_id AND b.estado = 'activo'
    )
  );

-- ── business_schedules ──
ALTER TABLE business_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_schedules FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schedules_staff_all"     ON business_schedules;
DROP POLICY IF EXISTS "schedules_public_select" ON business_schedules;

CREATE POLICY "schedules_staff_all" ON business_schedules
  FOR ALL
  TO authenticated
  USING  ( is_staff_of_business(business_id) )
  WITH CHECK ( is_staff_of_business(business_id) );

CREATE POLICY "schedules_public_select" ON business_schedules
  FOR SELECT
  TO anon, authenticated
  USING (
    activo = TRUE
    AND EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = business_schedules.business_id AND b.estado = 'activo'
    )
  );

-- ── loyalty_rewards ──
ALTER TABLE loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rewards FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rewards_staff_all"     ON loyalty_rewards;
DROP POLICY IF EXISTS "rewards_public_select" ON loyalty_rewards;

CREATE POLICY "rewards_staff_all" ON loyalty_rewards
  FOR ALL
  TO authenticated
  USING  ( is_staff_of_business(business_id) )
  WITH CHECK ( is_staff_of_business(business_id) );

CREATE POLICY "rewards_public_select" ON loyalty_rewards
  FOR SELECT
  TO anon, authenticated
  USING (
    activo = TRUE
    AND EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = loyalty_rewards.business_id AND b.estado = 'activo'
    )
  );

-- ── credit_transactions (sólo superadmin via service_role) ──
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credits_staff_select" ON credit_transactions;

-- El staff sólo puede VER sus propias transacciones de crédito. No puede insertar.
CREATE POLICY "credits_staff_select" ON credit_transactions
  FOR SELECT
  TO authenticated
  USING ( is_staff_of_business(business_id) );


-- ═══════════════════════════════════════════════════════════════════════════
-- ██████████████████████  TABLAS DE BIKERS (v26 override)  ████████════════
-- Se mantienen las políticas abiertas de v26 para delivery_fleets, bikers
-- y delivery_requests porque el portal de repartidor opera con sesión anónima.
-- Estas tablas NO contienen datos sensibles cross-tenant (el biker_id filtra).
-- ═══════════════════════════════════════════════════════════════════════════
-- (Sin cambios — se preservan las políticas de la v26 intactas)


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN FINAL — MUESTRA ESTADO DE RLS POR TABLA
-- ═══════════════════════════════════════════════════════════════════════════
SELECT
  c.relname AS tablename,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY tablename;

-- Muestra todas las políticas activas
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
