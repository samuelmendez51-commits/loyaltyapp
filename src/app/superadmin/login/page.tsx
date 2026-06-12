'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldAlert, Key, Mail, Lock } from 'lucide-react'

export default function SuperAdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setCargando(true)

    await new Promise((resolve) => setTimeout(resolve, 800))

    const emailCorrecto = 'samen_mg@hotmail.com'
    const passwordCorrecto = 'Samuelmendez51'
    const pinCorrecto = '155432'

    if (
      email.trim().toLowerCase() === emailCorrecto &&
      password === passwordCorrecto &&
      pin === pinCorrecto
    ) {
      const isProduction = typeof window !== 'undefined' && window.location.hostname.includes('loyaltyclub.mx')
      const domainSuffix = isProduction ? '; Domain=.loyaltyclub.mx; SameSite=Lax' : '; SameSite=Strict'
      const cookieBase = `; path=/${domainSuffix}`

      document.cookie = `session_rol=superadmin${cookieBase}`
      document.cookie = `session_user=Samuel Mendez${cookieBase}`

      router.push('/superadmin')
    } else {
      setError('Credenciales inválidas. Verifique su Email, Contraseña o PIN.')
      setCargando(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-white p-4">

      <div className="w-full max-w-md bg-white border border-[#e4e4e7] p-8 rounded-2xl shadow-sm space-y-6">

        {/* Branding */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 bg-[#eab308] rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-md shadow-yellow-200">
            👑
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#09090b]">SaaS Superadmin</h1>
            <p className="text-xs text-[#71717a] font-medium mt-1">Portal administrativo central de LoyaltyClub.mx</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-xs flex gap-2.5 items-start">
            <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span className="font-semibold leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-[#52525b] uppercase tracking-wider block">
              Email de Propietario
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-clean text-xs pl-10 py-3 focus:border-[#eab308]"
                placeholder="admin@loyaltyclub.mx"
              />
              <Mail className="w-4 h-4 text-[#a1a1aa] absolute left-3 top-3.5" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-[#52525b] uppercase tracking-wider block">
              Contraseña
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-clean text-xs pl-10 py-3 focus:border-[#eab308]"
                placeholder="••••••••"
              />
              <Lock className="w-4 h-4 text-[#a1a1aa] absolute left-3 top-3.5" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-[#52525b] uppercase tracking-wider block">
              PIN de Seguridad (6 dígitos)
            </label>
            <div className="relative">
              <input
                type="password"
                required
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="input-clean text-xs pl-10 py-3 font-mono tracking-widest text-center focus:border-[#eab308]"
                placeholder="••••••"
              />
              <Key className="w-4 h-4 text-[#a1a1aa] absolute left-3 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-[#eab308] hover:bg-[#ca8a04] disabled:opacity-50 text-black font-extrabold text-xs uppercase tracking-wider py-4 rounded-xl transition-all shadow-sm active:scale-[0.99] flex items-center justify-center gap-2 mt-2 cursor-pointer"
          >
            {cargando ? (
              <>
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Autenticando...
              </>
            ) : (
              'Iniciar Sesión Master'
            )}
          </button>
        </form>

        <div className="text-center border-t border-[#f4f4f5] pt-4">
          <p className="text-[9px] text-[#a1a1aa] uppercase tracking-widest font-mono">
            LoyaltyClub Enterprise · SaaS Multi-Tenant
          </p>
        </div>
      </div>
    </main>
  )
}
