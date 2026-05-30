const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hjaeireljkcvjnigfhzb.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqYWVpcmVsamtjdmpuaWdmaHpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MDA4NjIsImV4cCI6MjA5NDI3Njg2Mn0.vB76RwGG_4VgDKC8RAllkH7HZgWQB4JWcUtq7Z6svas'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  try {
    console.log("🧹 Iniciando limpieza y siembra fresca de lealtad para La Burrería...")

    // 1. Obtener ID de La Burrería
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('id, nombre')
      .eq('slug', 'laburreria')
      .maybeSingle()

    if (bizError || !business) {
      throw new Error("No se pudo encontrar el negocio 'laburreria': " + (bizError?.message || 'Inexistente'))
    }

    const bizId = business.id
    console.log(`🏢 Negocio encontrado: ${business.nombre} (ID: ${bizId})`)

    // 2. Limpieza de usuarios/clientes de prueba asociados
    const { data: oldClients, error: getClientsError } = await supabase
      .from('clientes')
      .select('id')
      .eq('business_id', bizId)

    if (getClientsError) throw getClientsError

    if (oldClients && oldClients.length > 0) {
      const clientIds = oldClients.map(c => c.id)
      console.log(`🧹 Eliminando historial de ${clientIds.length} clientes antiguos...`)
      
      await supabase.from('tracking_events').delete().in('cliente_id', clientIds)
      await supabase.from('historial_puntos').delete().in('cliente_id', clientIds)
      await supabase.from('orders').delete().in('cliente_id', clientIds)
      await supabase.from('premios_canjes').delete().in('cliente_id', clientIds)
      await supabase.from('roulette_spins').delete().in('cliente_id', clientIds)
      
      const { error: deleteClientsErr } = await supabase.from('clientes').delete().in('id', clientIds)
      if (deleteClientsErr) throw deleteClientsErr
      console.log("🧹 ¡Clientes antiguos eliminados con éxito!")
    } else {
      console.log("🧹 No hay clientes antiguos para eliminar.")
    }

    // 3. Borrar programas y recompensas de lealtad anteriores
    console.log("🧹 Limpiando programas y recompensas antiguas...")
    await supabase.from('recompensas').delete().eq('business_id', bizId)
    await supabase.from('programas_fidelidad').delete().eq('business_id', bizId)

    // 4. Crear el nuevo programa de lealtad: CLUB VIP LA BURRERIA
    console.log("💳 Creando programa 'CLUB VIP LA BURRERIA' (10 sellos)...")
    const { data: program, error: progError } = await supabase
      .from('programas_fidelidad')
      .insert({
        business_id: bizId,
        tipo_programa: 'estampillas',
        nombre_club: 'CLUB VIP LA BURRERIA',
        estampillas_max_dia: 1,
        total_estampillas: 10,
        precargadas: 0,
        comportamiento_completado: 'sin_limite',
        activo: true
      })
      .select()
      .single()

    if (progError || !program) {
      throw new Error("Error al crear programa de lealtad: " + (progError?.message || 'Error desconocido'))
    }
    console.log(`💳 ¡Programa creado con éxito! ID: ${program.id}`)

    // 5. Crear las recompensas del programa ("recompensas")
    console.log("🎁 Creando las recompensas en 'recompensas'...")
    const { error: recError } = await supabase
      .from('recompensas')
      .insert([
        { programa_id: program.id, business_id: bizId, nombre: 'Refresco Mediano Gratis', estampillas_requeridas: 3, estado: true },
        { programa_id: program.id, business_id: bizId, nombre: 'Papas Fritas Chicas Gratis', estampillas_requeridas: 7, estado: true },
        { programa_id: program.id, business_id: bizId, nombre: 'Chavipizza Final Gratis', estampillas_requeridas: 10, estado: true }
      ])

    if (recError) throw recError
    console.log("🎁 ¡Recompensas creadas y vinculadas con éxito!")

    // 6. Eliminar socio duplicado global con teléfono 4521049625 para evitar colisiones de clave única
    console.log("🧹 Eliminando socio duplicado global con teléfono 4521049625...")
    const { data: dups } = await supabase.from('clientes').select('id').eq('telefono', '4521049625')
    if (dups && dups.length > 0) {
      const dupIds = dups.map(d => d.id)
      await supabase.from('tracking_events').delete().in('cliente_id', dupIds)
      await supabase.from('historial_puntos').delete().in('cliente_id', dupIds)
      await supabase.from('orders').delete().in('cliente_id', dupIds)
      await supabase.from('premios_canjes').delete().in('cliente_id', dupIds)
      await supabase.from('roulette_spins').delete().in('cliente_id', dupIds)
      await supabase.from('clientes').delete().in('id', dupIds)
      console.log("🧹 ¡Socio duplicado eliminado con éxito!")
    }

    // 6. Crear Cliente Nuevo: SAMUEL MENDEZ
    console.log("👤 Creando cliente VIP 'SAMUEL MENDEZ'...")
    const { data: client, error: clientError } = await supabase
      .from('clientes')
      .insert({
        business_id: bizId,
        nombre: 'SAMUEL MENDEZ',
        telefono: '4521049625',
        puntos: 0
      })
      .select()
      .single()

    if (clientError || !client) {
      throw new Error("Error al registrar cliente VIP: " + (clientError?.message || 'Error desconocido'))
    }
    console.log(`👤 ¡Cliente VIP registrado exitosamente! ID: ${client.id}, Token: ${client.qr_token}`)

    console.log("\n🚀 ¡PROCESO DE REINICIO DE LEALTAD COMPLETADO CON ÉXITO ABSOLUTO! 🚀")
  } catch (err) {
    console.error("❌ Error en la siembra de datos:", err.message)
    process.exit(1)
  }
}

run()
