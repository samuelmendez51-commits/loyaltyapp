const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hjaeireljkcvjnigfhzb.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqYWVpcmVsamtjdmpuaWdmaHpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MDA4NjIsImV4cCI6MjA5NDI3Njg2Mn0.vB76RwGG_4VgDKC8RAllkH7HZgWQB4JWcUtq7Z6svas'

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  try {
    console.log("🌱 Iniciando siembra de ingredientes y vinculación para 'La Burrería'...")

    // 1. Obtener el ID de La Burrería
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('id, nombre')
      .eq('slug', 'laburreria')
      .maybeSingle()

    if (bizError || !business) {
      throw new Error("No se encontró el negocio 'laburreria': " + (bizError?.message || 'Inexistente'))
    }

    const tenantId = business.id
    console.log(`🏢 Negocio encontrado: ${business.nombre} (ID: ${tenantId})`)

    // 2. Obtener el producto "Refresco (355ml)"
    const { data: product, error: prodError } = await supabase
      .from('menu_products')
      .select('id, nombre')
      .eq('business_id', tenantId)
      .ilike('nombre', '%Refresco%')
      .maybeSingle()

    if (prodError || !product) {
      throw new Error("No se encontró ningún producto 'Refresco' en menu_products: " + (prodError?.message || 'Inexistente'))
    }

    console.log(`🥤 Producto listo: ${product.nombre} (ID: ${product.id})`)

    // 3. Crear el ingrediente de prueba en la tabla 'ingredients'
    console.log("🥬 Creando ingrediente 'Jarabe Endulzante'...")
    const { data: ingredient, error: ingError } = await supabase
      .from('ingredients')
      .insert({
        tenant_id: tenantId,
        nombre: 'Jarabe Endulzante',
        is_available: true
      })
      .select()
      .maybeSingle()

    if (ingError) {
      console.error("❌ Error al insertar ingrediente (puede que la tabla no exista o no tengas permisos):", ingError.message)
      console.log("\n💡 Asegúrate de haber ejecutado el SQL en Supabase para crear las tablas:")
      console.log(`
      CREATE TABLE IF NOT EXISTS public.ingredients (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
          nombre TEXT NOT NULL,
          is_available BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.product_ingredients (
          product_id UUID REFERENCES public.menu_products(id) ON DELETE CASCADE,
          ingredient_id UUID REFERENCES public.ingredients(id) ON DELETE CASCADE,
          PRIMARY KEY (product_id, ingredient_id)
      );

      -- RLS Habilitado
      ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.product_ingredients ENABLE ROW LEVEL SECURITY;
      
      DROP POLICY IF EXISTS "ingredients_open" ON public.ingredients;
      CREATE POLICY "ingredients_open" ON public.ingredients FOR ALL USING (true) WITH CHECK (true);
      
      DROP POLICY IF EXISTS "product_ingredients_open" ON public.product_ingredients;
      CREATE POLICY "product_ingredients_open" ON public.product_ingredients FOR ALL USING (true) WITH CHECK (true);
      `)
      return
    }

    console.log(`✅ Ingrediente creado con éxito! ID: ${ingredient.id}`)

    // 4. Vincular el producto con el ingrediente en la tabla pivote 'product_ingredients'
    console.log(`🔗 Vinculando ${product.nombre} con ${ingredient.nombre}...`)
    const { error: linkError } = await supabase
      .from('product_ingredients')
      .insert({
        product_id: product.id,
        ingredient_id: ingredient.id
      })

    if (linkError) {
      throw new Error("Error al vincular ingrediente con producto: " + linkError.message)
    }

    console.log("🎉 ¡Proceso completado con éxito absoluto! El ingrediente está listo para el Kill Switch.")
  } catch (err) {
    console.error("❌ Error en la siembra de ingredientes:", err.message)
  }
}

run()
