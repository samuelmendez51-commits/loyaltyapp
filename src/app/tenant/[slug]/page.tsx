'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { UtensilsCrossed, LogIn, Loader2, Award } from 'lucide-react'

interface Business {
  id: string
  nombre: string
  slug: string
  logo_url: string | null
  color_primario: string
  estado: string
  bloqueado_manual: boolean
  banner_url?: string | null
}

export default function TenantLandingPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [business, setBusiness] = useState<Business | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    // Redirección automática si el socio ya tiene una sesión activa guardada en este navegador
    const savedClientId = typeof window !== 'undefined' ? localStorage.getItem('vip_cliente_id') : null
    if (savedClientId) {
      router.replace(`/cliente/${savedClientId}`)
      return
    }

    const cargarBranding = async () => {
      if (!slug) return
      try {
        const { data, error: dbError } = await supabase
          .from('businesses')
          .select('id, nombre, slug, logo_url, color_primario, estado, bloqueado_manual, banner_url')
          .eq('slug', slug)
          .maybeSingle()

        if (dbError) throw dbError

        if (!data) {
          setError(true)
        } else {
          setBusiness(data as Business)
        }
      } catch (err) {
        console.error('[TenantLanding] Error cargando portal:', err)
        setError(true)
      } finally {
        setCargando(false)
      }
    }

    cargarBranding()
  }, [slug])

  if (cargando) {
    return (
      <main className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-zinc-400 animate-spin" />
          <span className="text-zinc-500 text-xs font-semibold uppercase tracking-widest animate-pulse font-sans">
            Cargando Portal...
          </span>
        </div>
      </main>
    )
  }

  if (error || !business) {
    return (
      <main className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-4 font-sans text-center">
        <div className="bg-white rounded-3xl w-full max-w-sm p-10 shadow-lg border border-[#f0f0f0] space-y-6">
          <div className="text-5xl">⚠️</div>
          <h1 className="text-xl font-bold text-[#09090b]">Portal No Encontrado</h1>
          <p className="text-sm text-[#71717a] leading-relaxed">
            El subdominio de negocio <strong>{slug}</strong> no coincide con ninguna marca registrada en nuestro sistema de fidelización.
          </p>
          <button
            onClick={() => window.location.href = 'https://loyaltyclub.mx'}
            className="w-full bg-[#09090b] text-white py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors"
          >
            Ir al Sitio Principal
          </button>
        </div>
      </main>
    )
  }

  if (business.bloqueado_manual || business.estado === 'vencido') {
    return (
      <main className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-4 font-sans text-center">
        <div className="bg-white rounded-3xl w-full max-w-sm p-10 shadow-lg border border-[#f0f0f0] space-y-6">
          <div className="text-5xl">⏸️</div>
          <h1 className="text-xl font-bold text-[#dc2626]">Portal Temporalmente Suspendido</h1>
          <p className="text-sm text-[#71717a] leading-relaxed">
            La suscripción del portal de <strong>{business.nombre}</strong> ha expirado o se encuentra inactiva. Por favor contacta al administrador del comercio.
          </p>
        </div>
      </main>
    )
  }

  const colorActivo = business.color_primario || '#dc2626'

  return (
    <main className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Círculos decorativos de fondo con el color de marca difuminado */}
      <div 
        className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ backgroundColor: colorActivo }}
      />
      <div 
        className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ backgroundColor: colorActivo }}
      />

      <div className="w-full max-w-[400px] space-y-8 relative z-10 animate-fadeIn">
        {/* Card Principal de Branding */}
        <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-[#f0f0f0] overflow-hidden text-center">
          
          {/* Portada si existe */}
          {business.banner_url && (
            <div className="h-28 w-full relative bg-zinc-100 border-b border-[#f4f4f5]">
              <img 
                src={business.banner_url.startsWith('http') || business.banner_url.startsWith('/') || business.banner_url.startsWith('data:') ? business.banner_url : `/${business.banner_url}`} 
                alt="" 
                className="w-full h-full object-cover opacity-90" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </div>
          )}

          <div className="p-8 space-y-6">
            {/* Logo dinámico (con margen negativo para superponer sobre la portada) */}
            <div className={`w-20 h-20 mx-auto rounded-3xl overflow-hidden border border-[#e4e4e7] shadow-sm bg-white flex items-center justify-center relative z-10 ${
              business.banner_url ? '-mt-16 border-white ring-4 ring-white' : ''
            }`}>
              {business.logo_url ? (
                <img 
                  src={business.logo_url.startsWith('http') || business.logo_url.startsWith('/') || business.logo_url.startsWith('data:') ? business.logo_url : `/${business.logo_url}`} 
                  alt={business.nombre} 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <span className="text-3xl text-zinc-400">🏪</span>
              )}
            </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold text-[#09090b] tracking-tight">
              {business.nombre}
            </h1>
            <p className="text-xs text-[#71717a] uppercase tracking-widest font-semibold flex items-center justify-center gap-1">
              <Award size={14} style={{ color: colorActivo }} />
              Club de Fidelidad & Carta
            </p>
          </div>

          <div className="h-[1px] bg-[#f4f4f5]" />

          {/* Botones de acción del portal */}
          <div className="space-y-4 pt-2">
            <button
              onClick={() => router.push('/menu')}
              className="w-full text-white py-4 rounded-2xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all hover:brightness-110 active:scale-[0.99] flex items-center justify-center gap-2.5"
              style={{ backgroundColor: colorActivo, boxShadow: `0 4px 14px ${colorActivo}33` }}
            >
              <UtensilsCrossed size={16} />
              Ver Menú Digital
            </button>

            <button
              onClick={() => router.push('/registro')}
              className="w-full bg-[#09090b] text-white hover:bg-zinc-800 py-4 rounded-2xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all active:scale-[0.99] flex items-center justify-center gap-2.5"
            >
              <Award size={16} style={{ color: colorActivo }} />
              Soy Socio VIP (Ingresar / Registro)
            </button>
          </div>
        </div>
      </div>

        {/* Footer corporativo sutil */}
        <div className="text-center space-y-2">
          <p className="text-[10px] text-[#a1a1aa] uppercase tracking-[0.2em] font-medium">
            Portal Oficial de Socio VIP
          </p>
          <p className="text-[9px] text-[#c4c4c5] font-semibold">
            Powered by LoyaltyClub.mx
          </p>
          <div className="pt-2">
            <button 
              onClick={() => router.push('/login')} 
              className="text-[9px] text-zinc-400 hover:text-zinc-600 transition-colors font-medium underline"
            >
              Acceso de Personal / Administración
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
