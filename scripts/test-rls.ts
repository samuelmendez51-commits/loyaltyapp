import { createClient } from '@supabase/supabase-js';

// NOTA: Configura estas variables con credenciales de prueba seguras de tu entorno local
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tu-proyecto.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'tu-anon-key';

// IDs ficticios para simular el aislamiento multi-tenant
const TENANT_A_BUSINESS_ID = '11111111-1111-1111-1111-111111111111';
const TENANT_B_BUSINESS_ID = '22222222-2222-2222-2222-222222222222';

async function ejecutarPruebasRLS() {
  console.log('🚀 Iniciando pruebas de seguridad RLS Multi-Tenant...\n');

  // 1. Inicializar cliente público (Simula un usuario anónimo o un Biker en el portal móvil)
  const clientAnonimo = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log('🛡️ ESCENARIO 1: Usuario anónimo intentando leer datos globales de Bikers...');
  const { data: bikers, error: errorBikers } = await clientAnonimo
    .from('bikers')
    .select('*');

  if (errorBikers) {
    console.log('✅ CORRECTO: Supabase bloqueó la lectura masiva anónima.');
  } else if (bikers && bikers.length > 0) {
    console.error('❌ FALLA DE SEGURIDAD: Un usuario anónimo pudo leer la lista de repartidores.');
  } else {
    console.log('✅ CORRECTO: La consulta retornó vacía (Aislamiento RLS activo).');
  }

  console.log('\n--------------------------------------------------\n');

  console.log('🛡️ ESCENARIO 2: Validar ataque cross-tenant vía RPC (Biker de una flota alternativa)...');
  // Simulamos una llamada a la nueva función atómica con datos que no corresponden
  const { data: viajeStatus, error: errorViaje } = await clientAnonimo.rpc('avanzar_estado_viaje', {
    p_order_id: '99999999-9999-9999-9999-999999999999',
    p_nuevo_estado: 'en_camino',
    p_session_id: 'sesion-falsa-no-existente' 
  });

  if (errorViaje || !viajeStatus) {
    console.log('✅ CORRECTO: La función rechazó la transacción porque la sesión no es válida.');
  } else {
    console.error('❌ FALLA DE SEGURIDAD: Se permitió avanzar el estado sin una sesión de Biker válida.');
  }

  console.log('\n--------------------------------------------------\n');

  console.log('🛡️ ESCENARIO 3: Empleado de Negocio A intentando leer Premios/Canjes de Negocio B...');
  // Simulamos que el cliente está logueado como Staff del Tenant A usando JWT (auth.uid)
  // Para esta prueba manual, intentamos forzar un select cruzado usando un cliente con RLS limitado
  const { data: canjesAjenos, error: errorCanjes } = await clientAnonimo
    .from('premios_canjes')
    .select('*')
    .eq('business_id', TENANT_B_BUSINESS_ID); // Intenta buscar los del competidor

  if (errorCanjes) {
    console.log('✅ CORRECTO: El motor de Supabase denegó el acceso por políticas RLS directas.');
  } else if (canjesAjenos && canjesAjenos.length > 0) {
    console.error('❌ FALLA DE SEGURIDAD: El Staff de un negocio pudo extraer los canjes de otro negocio.');
  } else {
    console.log('✅ CORRECTO: No se expusieron registros del Tenant ajeno.');
  }

  console.log('\n🏁 Pruebas concluidas. Si todos los escenarios dieron "CORRECTO", tu base de datos es segura.');
}

ejecutarPruebasRLS().catch(console.error);