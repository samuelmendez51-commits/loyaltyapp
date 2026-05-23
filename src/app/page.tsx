'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PaginaInicial() {
  const router = useRouter()

  useEffect(() => {
    // Redirección inteligente. El middleware se encargará de validar si debe ir 
    // al dashboard o al escáner según la cookie de sesión.
    // Damos un pequeño delay para que la pantalla negra se sienta como un "cargando" elegante.
    const timer = setTimeout(() => {
      router.replace('/dashboard') 
    }, 500)

    return () => clearTimeout(timer)
  }, [router])

  return (
    <main className="min-h-screen bg-[#050505] flex items-center justify-center">
      {/* Indicador de carga sutil */}
      <div className="animate-pulse">
        <img 
          src="https://hjaeireljkcvjnigfhzb.supabase.co/storage/v1/object/public/logo.png/assets/logo.png" 
          alt="Cargando..." 
          className="w-20 h-20 object-contain opacity-50"
        />
      </div>
    </main>
  )
}