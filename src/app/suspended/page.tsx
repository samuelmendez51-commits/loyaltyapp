'use client'

export default function SuspendedPage() {
  return (
    <main className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-24 h-24 bg-red-950 border border-red-900 rounded-full flex items-center justify-center mb-8">
        <span className="text-5xl">⛔</span>
      </div>
      <h1 className="text-3xl font-black text-white mb-3">Servicio Suspendido</h1>
      <p className="text-zinc-400 text-sm max-w-sm leading-relaxed mb-8">
        La suscripción de este negocio ha vencido o ha sido suspendida temporalmente.
        Para reactivar el servicio, contacta al administrador de LoyaltyClub.
      </p>
      <a
        href="mailto:soporte@loyaltyclub.com"
        className="bg-red-900/30 border border-red-700 text-red-400 font-bold py-3 px-8 rounded-xl text-sm uppercase tracking-widest hover:bg-red-900/50 transition-all"
      >
        Contactar Soporte
      </a>
    </main>
  )
}
