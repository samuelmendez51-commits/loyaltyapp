'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function PanelAjustes() {
  const [config, setConfig] = useState<any>(null)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase.from('configuracion').select('*').single()
      if (data) setConfig(data)
    }
    fetchConfig()
  }, [])

  const guardarCambios = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('configuracion').update(config).eq('id', config.id)
    
    if (!error) {
      setMensaje('✅ Ajustes actualizados correctamente')
      setTimeout(() => setMensaje(''), 3000)
    }
  }

  if (!config) return <div className="p-8 text-white bg-burreria-dark min-h-screen">Cargando ajustes...</div>

  return (
    <main className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200">
        <div className="bg-burreria-dark p-6 text-white flex justify-between items-center">
          <h1 className="text-xl font-bold uppercase tracking-widest">Ajustes de Marca ⚙️</h1>
          {mensaje && <span className="text-xs bg-green-500 px-3 py-1 rounded-full animate-pulse">{mensaje}</span>}
        </div>

        <form onSubmit={guardarCambios} className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase mb-2">Nombre de la Marca</label>
              <input type="text" className="w-full p-3 border-2 rounded-xl focus:border-burreria-orange outline-none transition-all"
                value={config.nombre_marca} onChange={(e) => setConfig({...config, nombre_marca: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase mb-2">Moneda (Símbolo)</label>
              <input type="text" className="w-full p-3 border-2 rounded-xl focus:border-burreria-orange outline-none"
                value={config.moneda} onChange={(e) => setConfig({...config, moneda: e.target.value})} />
            </div>
          </div>

          <div className="bg-orange-50 p-6 rounded-2xl border-2 border-dashed border-burreria-orange">
            <h3 className="text-sm font-black text-burreria-orange uppercase mb-4 tracking-tighter">Reglas de Lealtad (Límites)</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-2">Número total de sellos</label>
                <input type="number" className="w-full p-3 border-2 rounded-xl"
                  value={config.max_sellos} onChange={(e) => setConfig({...config, max_sellos: parseInt(e.target.value)})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-2">Horas de bloqueo (Seguridad)</label>
                <input type="number" className="w-full p-3 border-2 rounded-xl"
                  value={config.horas_bloqueo} onChange={(e) => setConfig({...config, horas_bloqueo: parseInt(e.target.value)})} />
              </div>
            </div>
          </div>

          <button type="submit" className="w-full bg-burreria-orange hover:bg-burreria-red text-white font-black py-4 rounded-2xl shadow-lg transform transition active:scale-95 uppercase">
            Guardar Configuración
          </button>
        </form>
      </div>
    </main>
  )
}