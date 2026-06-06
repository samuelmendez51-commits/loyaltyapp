-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN v26: Habilitar Políticas RLS para Repartidores (Bikers)
-- LoyaltyClub.mx — 2026
-- Ejecutar este script en el editor SQL de Supabase para permitir
-- consultas y actualizaciones desde el portal cliente del Repartidor.
-- ═══════════════════════════════════════════════════════════════════

-- 1. POLÍTICAS PARA: delivery_fleets
-- Permite que los portales carguen los datos de la flota vinculada
DROP POLICY IF EXISTS "public_select_fleets" ON delivery_fleets;
CREATE POLICY "public_select_fleets" ON delivery_fleets
  FOR SELECT TO anon, authenticated
  USING (true);

-- 2. POLÍTICAS PARA: bikers
-- Permite buscar perfiles de bikers (para iniciar sesión y verificar estatus)
DROP POLICY IF EXISTS "public_select_bikers" ON bikers;
CREATE POLICY "public_select_bikers" ON bikers
  FOR SELECT TO anon, authenticated
  USING (activo = true);

-- Permite al biker iniciar sesión única y cambiar su estado Conectado/Desconectado
DROP POLICY IF EXISTS "public_update_bikers" ON bikers;
CREATE POLICY "public_update_bikers" ON bikers
  FOR UPDATE TO anon, authenticated
  USING (activo = true)
  WITH CHECK (activo = true);

-- 3. POLÍTICAS PARA: delivery_requests
-- Permite a los bikers ver el pool de viajes y sus viajes asignados
DROP POLICY IF EXISTS "public_select_requests" ON delivery_requests;
DROP POLICY IF EXISTS "anon_read_pendientes" ON delivery_requests;
CREATE POLICY "public_select_requests" ON delivery_requests
  FOR SELECT TO anon, authenticated
  USING (true);

-- Permite a los bikers reclamar viajes, avanzar estados y cancelar viajes
DROP POLICY IF EXISTS "public_update_requests" ON delivery_requests;
CREATE POLICY "public_update_requests" ON delivery_requests
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);
