'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import DashboardPage from '../../dashboard/page'

export default function DynamicDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const [autorizado, setAutorizado] = useState(false)
  const [validando, setValidando] = useState(true)
  
  useEffect(() => {
    const validarAcceso = async () => {
      const slug = params.slug as string
      if (!slug) return router.replace('/login')
      
      // Buscar el negocio en Supabase para obtener su ID y estado
      const { data: biz } = await supabase
        .from('businesses')
        .select('id, bloqueado_manual, estado')
        .eq('slug', slug)
        .maybeSingle()
        
      if (!biz) {
        alert('⚠️ Este portal / subdominio de negocio no existe')
        return router.replace('/login')
      }
      
      if (biz.bloqueado_manual || biz.estado === 'vencido') {
        return router.replace('/suspended')
      }
      
      // Validar las cookies de sesión activa
      const getCookie = (name: string) => {
        if (typeof document === 'undefined') return ''
        return document.cookie.match(new RegExp(`${name}=([^;]+)`))?.[1] || ''
      }
      
      const sessionBusinessId = getCookie('session_business_id')
      const sessionRol = getCookie('session_rol')
      
      if (!sessionRol) {
        // Redirigir al login y pasarle la ruta de retorno para onboarding automático
        return router.replace(`/login?redirect=/${slug}/dashboard`)
      }
      
      // Si está logueado pero pertenece a otro negocio, y no es SuperAdmin
      if (sessionRol !== 'superadmin' && sessionBusinessId !== biz.id) {
        alert('⚠️ No tienes autorización para administrar este negocio. Por favor inicia sesión con tu PIN respectivo.')
        return router.replace(`/login?redirect=/${slug}/dashboard`)
      }
      
      setAutorizado(true)
      setValidando(false)
    }
    
    validarAcceso()
  }, [params.slug, router])
  
  if (validando) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-zinc-800 border-t-amber-500 rounded-full animate-spin" />
          <span className="text-zinc-550 text-[10px] uppercase tracking-widest animate-pulse font-mono font-bold">
            Validando Portal...
          </span>
        </div>
      </div>
    )
  }
  
  if (!autorizado) return null
  
  return <DashboardPage />
}
