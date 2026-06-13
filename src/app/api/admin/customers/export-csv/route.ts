import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function cleanText(text: string): string {
  if (!text) return "";
  return text
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const business_id = searchParams.get('business_id')

    if (!business_id) {
      return NextResponse.json(
        { error: 'El parámetro business_id es requerido' },
        { status: 400 }
      )
    }

    const { data: customers, error } = await supabase
      .from('clientes')
      .select('nombre, telefono, fecha_nacimiento')
      .eq('business_id', business_id)

    if (error) {
      console.error('Error fetching customers for export:', error)
      return NextResponse.json(
        { error: 'Error al obtener los clientes de la base de datos' },
        { status: 500 }
      )
    }

    let csvContent = '\uFEFF';
    csvContent += '"Name","Given Name","Birthday","Phone 1 - Type","Phone 1 - Value"\r\n';

    if (customers && customers.length > 0) {
      for (const c of customers) {
        const name = cleanText(c.nombre || '');
        const phone = c.telefono ? cleanText(c.telefono.trim()) : '';
        const birthday = c.fecha_nacimiento || '';
        const phoneType = 'MOBILE';

        const escapedName = name.replace(/"/g, '""');
        const escapedPhone = phone.replace(/"/g, '""');
        const escapedBirthday = birthday.replace(/"/g, '""');

        csvContent += `"${escapedName}","${escapedName}","${escapedBirthday}","${phoneType}","${escapedPhone}"\r\n`;
      }
    }

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="google_contacts_${business_id}.csv"`,
        'Cache-Control': 'no-store'
      }
    });

  } catch (err: any) {
    console.error('Unhandled error exporting CSV:', err)
    return NextResponse.json(
      { error: err.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
