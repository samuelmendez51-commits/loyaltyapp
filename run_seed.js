const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hjaeireljkcvjnigfhzb.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqYWVpcmVsamtjdmpuaWdmaHpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MDA4NjIsImV4cCI6MjA5NDI3Njg2Mn0.vB76RwGG_4VgDKC8RAllkH7HZgWQB4JWcUtq7Z6svas'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function seed() {
  try {
    console.log("🌱 Iniciando siembra de datos LoyaltyClub...")

    // 1. Obtener o crear el negocio La Burrería
    let { data: business } = await supabase
      .from('businesses')
      .select('*')
      .eq('slug', 'laburreria')
      .maybeSingle()

    if (!business) {
      console.log("🏢 Negocio La Burrería no encontrado, creándolo...")
      const { data: newBiz, error: bizError } = await supabase
        .from('businesses')
        .insert({
          nombre: 'La Burrería',
          slug: 'laburreria',
          estado: 'activo',
          plan: 'anual',
          fecha_vencimiento: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          max_sellos: 10,
          monto_minimo_sello: 150.00,
          moneda: 'MXN',
          latitude: 19.421583,
          longitude: -102.067222,
          telefono_whatsapp: '3221234567'
        })
        .select()
        .single()
      
      if (bizError) throw bizError
      business = newBiz
      console.log("🏢 Negocio La Burrería creado con éxito!")
    } else {
      console.log("🏢 Negocio La Burrería ya existe:", business.id)
    }

    const bizId = business.id

    // 1.5. Inyección del Cliente Cero (Samuel Méndez / La Burrería)
    console.log("🔑 Creando o actualizando Cliente Cero: samen_mg@hotmail.com...")
    await supabase.from('business_users').delete().eq('email', 'samen_mg@hotmail.com')
    const { error: userError } = await supabase
      .from('business_users')
      .insert({
        business_id: bizId,
        nombre: 'Samuel Méndez',
        email: 'samen_mg@hotmail.com',
        pin: 'Samuelmendez51!',
        rol: 'admin_comercio',
        activo: true
      })

    if (userError) throw userError
    console.log("🔑 Cliente Cero inyectado con éxito!")

    // 2. Limpiar/crear premios en loyalty_rewards
    console.log("🎁 Creando premios en loyalty_rewards...")
    await supabase.from('loyalty_rewards').delete().eq('business_id', bizId)
    const { data: rewards, error: rewError } = await supabase
      .from('loyalty_rewards')
      .insert([
        { business_id: bizId, sello_requerido: 3, nombre: 'Refresco Mediano Gratis', descripcion: 'Desbloqueado en tu sello 3', tipo: 'intermedio', activo: true },
        { business_id: bizId, sello_requerido: 7, nombre: 'Papas Fritas Chicas Gratis', descripcion: 'Desbloqueado en tu sello 7', tipo: 'intermedio', activo: true },
        { business_id: bizId, sello_requerido: 10, nombre: 'Chavipizza Familiar Gratis', descripcion: 'Premio Mayor acumulando 10 sellos', tipo: 'final', activo: true }
      ])
      .select()

    if (rewError) throw rewError
    console.log("🎁 Premios inyectados con éxito!")

    // 3. Limpiar clientes existentes en el negocio para evitar conflictos
    console.log("🧹 Limpiando datos viejos de clientes de prueba para evitar duplicidades...")
    const { data: oldClients } = await supabase.from('clientes').select('id').eq('business_id', bizId)
    if (oldClients && oldClients.length > 0) {
      const clientIds = oldClients.map(c => c.id)
      await supabase.from('tracking_events').delete().in('cliente_id', clientIds)
      await supabase.from('historial_puntos').delete().in('cliente_id', clientIds)
      await supabase.from('orders').delete().in('cliente_id', clientIds)
      await supabase.from('clientes').delete().in('id', clientIds)
    }

    // 4. Inserción de Clientes de Prueba
    console.log("👥 Registrando clientes VIP de prueba...")
    const { data: clientes, error: cliError } = await supabase
      .from('clientes')
      .insert([
        { business_id: bizId, nombre: 'Yareli Lozano', telefono: '3221234567', puntos: 10 },
        { business_id: bizId, nombre: 'Juan Pérez', telefono: '3227654321', puntos: 4 },
        { business_id: bizId, nombre: 'María Rodríguez', telefono: '3229876543', puntos: 8 }
      ])
      .select()

    if (cliError || !clientes) throw cliError || new Error('Error al insertar clientes')
    console.log("👥 Clientes de prueba registrados!")

    const [yareli, juan, maria] = clientes

    // 5. Poblar historial de puntos (simulados)
    console.log("📊 Poblando historial de puntos...")
    const { error: histError } = await supabase.from('historial_puntos').insert([
      { cliente_id: yareli.id, business_id: bizId, cantidad: 10, motivo: 'suma' },
      { cliente_id: juan.id, business_id: bizId, cantidad: 4, motivo: 'suma' },
      { cliente_id: maria.id, business_id: bizId, cantidad: 8, motivo: 'suma' }
    ])
    if (histError) throw histError

    // 6. Poblar pedidos (orders) simulados para las métricas del dashboard
    console.log("🛍️ Insertando pedidos de prueba...")
    const haceDias = (dias) => new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()

    const { error: ordError } = await supabase.from('orders').insert([
      { business_id: bizId, cliente_id: yareli.id, nombre_cliente: yareli.nombre, telefono_cliente: yareli.telefono, tipo: 'delivery', total: 280.00, items: [{ nombre: 'Chavipizza Mediana', cantidad: 1, precio_unitario: 220.00, subtotal: 220.00 }, { nombre: 'Papas Chicas', cantidad: 1, precio_unitario: 60.00, subtotal: 60.00 }], estado: 'entregado', sello_otorgado: true, sello_aprobado: true, created_at: haceDias(30) },
      { business_id: bizId, cliente_id: yareli.id, nombre_cliente: yareli.nombre, telefono_cliente: yareli.telefono, tipo: 'delivery', total: 340.00, items: [{ nombre: 'Burrito Gigante', cantidad: 2, precio_unitario: 170.00, subtotal: 340.00 }], estado: 'entregado', sello_otorgado: true, sello_aprobado: true, created_at: haceDias(20) },
      { business_id: bizId, cliente_id: yareli.id, nombre_cliente: yareli.nombre, telefono_cliente: yareli.telefono, tipo: 'delivery', total: 190.00, items: [{ nombre: 'Hamburguesa Burrera', cantidad: 1, precio_unitario: 190.00, subtotal: 190.00 }], estado: 'entregado', sello_otorgado: true, sello_aprobado: true, created_at: haceDias(10) },

      { business_id: bizId, cliente_id: juan.id, nombre_cliente: juan.nombre, telefono_cliente: juan.telefono, tipo: 'mesa', total: 175.00, items: [{ nombre: 'Tacos Dorados', cantidad: 1, precio_unitario: 120.00, subtotal: 120.00 }, { nombre: 'Agua Fresca', cantidad: 1, precio_unitario: 55.00, subtotal: 55.00 }], estado: 'entregado', sello_otorgado: true, sello_aprobado: true, created_at: haceDias(15) },
      { business_id: bizId, cliente_id: juan.id, nombre_cliente: juan.nombre, telefono_cliente: juan.telefono, tipo: 'mesa', total: 210.00, items: [{ nombre: 'Burrito Clásico', cantidad: 1, precio_unitario: 150.00, subtotal: 150.00 }, { nombre: 'Refresco', cantidad: 2, precio_unitario: 30.00, subtotal: 60.00 }], estado: 'entregado', sello_otorgado: true, sello_aprobado: true, created_at: haceDias(5) },
      { business_id: bizId, cliente_id: juan.id, nombre_cliente: juan.nombre, telefono_cliente: juan.telefono, tipo: 'delivery', total: 50.00, items: [{ nombre: 'Refresco', cantidad: 1, precio_unitario: 50.00, subtotal: 50.00 }], estado: 'rechazado', sello_otorgado: false, sello_aprobado: false, sello_rechazado: true, created_at: haceDias(2) },

      { business_id: bizId, cliente_id: maria.id, nombre_cliente: maria.nombre, telefono_cliente: maria.telefono, tipo: 'delivery', total: 320.00, items: [{ nombre: 'Paquete Pareja', cantidad: 1, precio_unitario: 320.00, subtotal: 320.00 }], estado: 'entregado', sello_otorgado: true, sello_aprobado: true, created_at: haceDias(25) },
      { business_id: bizId, cliente_id: maria.id, nombre_cliente: maria.nombre, telefono_cliente: maria.telefono, tipo: 'delivery', total: 290.00, items: [{ nombre: 'Chavipizza Grande', cantidad: 1, precio_unitario: 290.00, subtotal: 290.00 }], estado: 'entregado', sello_otorgado: true, sello_aprobado: true, created_at: haceDias(12) },

      { business_id: bizId, cliente_id: juan.id, nombre_cliente: juan.nombre, telefono_cliente: juan.telefono, tipo: 'delivery', total: 185.00, items: [{ nombre: 'Burrito de Res', cantidad: 1, precio_unitario: 155.00, subtotal: 155.00 }, { nombre: 'Limonada', cantidad: 1, precio_unitario: 30.00, subtotal: 30.00 }], estado: 'pendiente', sello_otorgado: true, sello_aprobado: false, created_at: haceDias(0.1) },
      { business_id: bizId, cliente_id: maria.id, nombre_cliente: maria.nombre, telefono_cliente: maria.telefono, tipo: 'delivery', total: 260.00, items: [{ nombre: 'Alitas Pro', cantidad: 1, precio_unitario: 200.00, subtotal: 200.00 }, { nombre: 'Papas Medianas', cantidad: 1, precio_unitario: 60.00, subtotal: 60.00 }], estado: 'pendiente', sello_otorgado: true, sello_aprobado: false, created_at: haceDias(0.2) }
    ])
    if (ordError) throw ordError

    // 7. Inserción de eventos iniciales en tracking_events
    console.log("📈 Poblando tracking_events...")
    const { error: trackError } = await supabase.from('tracking_events').insert([
      { business_id: bizId, cliente_id: yareli.id, event_type: 'vip_joined', metadata: { canal: 'mostrador' } },
      { business_id: bizId, cliente_id: juan.id, event_type: 'vip_joined', metadata: { canal: 'mostrador' } },
      { business_id: bizId, cliente_id: maria.id, event_type: 'vip_joined', metadata: { canal: 'mostrador' } }
    ])
    if (trackError) throw trackError

    console.log("🎉 ¡Proceso de Siembra completado con éxito absoluto!")
    process.exit(0)

  } catch (error) {
    console.error("❌ Error en la siembra de base de datos:", error.message)
    process.exit(1)
  }
}

seed()
