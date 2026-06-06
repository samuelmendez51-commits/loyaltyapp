'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  Settings, Check, Loader2, Sparkles, HelpCircle, Save, 
  ArrowLeft, Gift, Lock, RefreshCw, FileText, Eye 
} from 'lucide-react'

interface CustomLabels {
  card_title: string
  reward_instruction: string
  stamps_suffix: string
  roulette_locked_title: string
  roulette_locked_desc: string
  footer_instruction: string
}

const DEFAULT_LABELS: CustomLabels = {
  card_title: "TARJETA VIP DIGITAL",
  reward_instruction: "¡ACUMULA {total_stamps} SELLOS Y OBTÉN TU PREMIO GRATIS!",
  stamps_suffix: "SELLOS ACUMULADOS",
  roulette_locked_title: "Ruleta VIP Bloqueada",
  roulette_locked_desc: "¡Felicidades! Alcanzaste los sellos necesarios. Esta ruleta requiere una compra mínima de ${min_amount} MXN para activarse.",
  footer_instruction: "Realiza un pedido desde el menú o en caja que iguale o supere este monto."
}

export default function CustomizerTarjetaPage() {
  const params = useParams()
  const router = useRouter()
  const slug = (params.tenantSlug || params.slug) as string || ''

  const [business, setBusiness] = useState<any>(null)
  const [labels, setLabels] = useState<CustomLabels>(DEFAULT_LABELS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Preview options
  const [previewStamps, setPreviewStamps] = useState(4)

  useEffect(() => {
    if (!slug) return
    
    const fetchBusiness = async () => {
      try {
        const { data, error } = await supabase
          .from('businesses')
          .select('*')
          .eq('slug', slug.toLowerCase().trim())
          .maybeSingle()

        if (error) throw error
        if (data) {
          setBusiness(data)
          if (data.card_custom_labels) {
            setLabels({
              card_title: data.card_custom_labels.card_title || DEFAULT_LABELS.card_title,
              reward_instruction: data.card_custom_labels.reward_instruction || DEFAULT_LABELS.reward_instruction,
              stamps_suffix: data.card_custom_labels.stamps_suffix || DEFAULT_LABELS.stamps_suffix,
              roulette_locked_title: data.card_custom_labels.roulette_locked_title || DEFAULT_LABELS.roulette_locked_title,
              roulette_locked_desc: data.card_custom_labels.roulette_locked_desc || DEFAULT_LABELS.roulette_locked_desc,
              footer_instruction: data.card_custom_labels.footer_instruction || DEFAULT_LABELS.footer_instruction,
            })
          }
        }
      } catch (err: any) {
        console.error('Error fetching business settings:', err)
        setErrorMsg('No se pudo cargar la información del negocio.')
      } finally {
        setLoading(false)
      }
    }

    fetchBusiness()
  }, [slug])

  const handleSave = async () => {
    if (!business?.id) return
    setSaving(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const { error } = await supabase
        .from('businesses')
        .update({
          card_custom_labels: labels
        })
        .eq('id', business.id)

      if (error) throw error
      setSuccessMsg('✅ Configuración de tarjeta guardada con éxito.')
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err: any) {
      console.error('Error updating custom labels:', err)
      setErrorMsg(`Error al guardar: ${err.message || 'Verifica que la migración v32 haya sido ejecutada.'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleResetToDefault = () => {
    if (window.confirm('¿Estás seguro de que deseas restablecer los textos a los valores predeterminados?')) {
      setLabels(DEFAULT_LABELS)
    }
  }

  const formatPreviewLabel = (template: string) => {
    const totalStamps = business?.max_sellos || 10
    const minAmount = business?.monto_minimo_ruleta || 50
    return template
      .replace(/{total_stamps}/g, String(totalStamps))
      .replace(/{min_amount}/g, String(minAmount))
      .replace(/\${min_amount}/g, `$${minAmount}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
          <p className="text-zinc-600 text-sm font-semibold">Cargando panel de personalización...</p>
        </div>
      </div>
    )
  }

  const totalStamps = business?.max_sellos || 10
  const colorPrimario = business?.color_primario || '#ef4444'

  return (
    <div className="min-h-screen bg-slate-50 text-zinc-950 font-sans">
      {/* Top Navigation / Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-40 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.back()}
              className="p-2 hover:bg-zinc-100 rounded-xl transition-all border border-zinc-200 text-zinc-650"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-zinc-900 uppercase tracking-tight">Personalizar Tarjeta VIP</h1>
                <span className="bg-amber-150 text-amber-800 text-[9px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-200">
                  <Sparkles className="w-2.5 h-2.5" /> Premium Customizer
                </span>
              </div>
              <p className="text-xs text-zinc-500 font-medium mt-0.5">Controla los textos del portal de fidelidad de {business?.nombre}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleResetToDefault}
              className="px-4 py-2 border border-zinc-200 hover:bg-zinc-150 text-zinc-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Restablecer
            </button>
            
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-zinc-950 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" /> Guardar Cambios
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {successMsg && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-250 text-emerald-800 rounded-2xl text-sm font-semibold flex items-center gap-2.5 shadow-sm animate-fadeIn">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-250 text-rose-800 rounded-2xl text-sm font-semibold flex items-center gap-2.5 shadow-sm animate-fadeIn">
            <span className="text-rose-600 shrink-0 font-bold">⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Form Fields: 7 Columns */}
          <div className="lg:col-span-7 bg-white border border-zinc-250 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="border-b border-zinc-150 pb-4">
              <h2 className="text-sm font-black text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" /> Textos de Tarjeta y Ruleta
              </h2>
              <p className="text-xs text-zinc-500 mt-1">Modifica los textos que ven tus clientes finales al consultar su pase digital.</p>
            </div>

            {/* Field: Card Title */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-750 uppercase tracking-wide">Título Superior de la Tarjeta</label>
                <span className="text-[10px] text-zinc-400 italic">card_title</span>
              </div>
              <input
                type="text"
                value={labels.card_title}
                onChange={e => setLabels(prev => ({ ...prev, card_title: e.target.value }))}
                placeholder="Ej: TARJETA VIP DIGITAL"
                className="w-full bg-slate-50 border border-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 focus:bg-white text-sm text-[#09090b]"
              />
            </div>

            {/* Field: Reward Instruction */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-750 uppercase tracking-wide">Instrucción / Beneficio de Sellos</label>
                <span className="text-[10px] text-zinc-400 italic">reward_instruction</span>
              </div>
              <input
                type="text"
                value={labels.reward_instruction}
                onChange={e => setLabels(prev => ({ ...prev, reward_instruction: e.target.value }))}
                placeholder="¡ACUMULA {total_stamps} SELLOS Y OBTÉN TU PREMIO!"
                className="w-full bg-slate-50 border border-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 focus:bg-white text-sm text-[#09090b]"
              />
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 italic bg-slate-50 p-2 rounded-lg">
                <HelpCircle className="w-3 h-3 text-zinc-400" />
                <span>Usa <strong>{"{total_stamps}"}</strong> para reemplazar automáticamente por el total de sellos ({totalStamps}).</span>
              </div>
            </div>

            {/* Field: Stamps Suffix */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-750 uppercase tracking-wide">Sufijo del Contador de Sellos</label>
                <span className="text-[10px] text-zinc-400 italic">stamps_suffix</span>
              </div>
              <input
                type="text"
                value={labels.stamps_suffix}
                onChange={e => setLabels(prev => ({ ...prev, stamps_suffix: e.target.value }))}
                placeholder="SELLOS ACUMULADOS"
                className="w-full bg-slate-50 border border-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 focus:bg-white text-sm text-[#09090b]"
              />
              <p className="text-[10px] text-zinc-400">Se mostrará junto a los sellos marcados (Ej: "4 / {totalStamps} SELLOS ACUMULADOS")</p>
            </div>

            <div className="border-t border-zinc-150 pt-6 space-y-6">
              <div className="pb-1">
                <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wider">🔒 Mensajes de Ruleta Bloqueada</h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">Se muestran cuando el usuario tiene los sellos necesarios pero no alcanza el ticket mínimo para girar.</p>
              </div>

              {/* Field: Roulette Locked Title */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-750 uppercase tracking-wide">Título del Bloqueo</label>
                  <span className="text-[10px] text-zinc-400 italic">roulette_locked_title</span>
                </div>
                <input
                  type="text"
                  value={labels.roulette_locked_title}
                  onChange={e => setLabels(prev => ({ ...prev, roulette_locked_title: e.target.value }))}
                  placeholder="Ruleta VIP Bloqueada"
                  className="w-full bg-slate-50 border border-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 focus:bg-white text-sm text-[#09090b]"
                />
              </div>

              {/* Field: Roulette Locked Desc */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-750 uppercase tracking-wide">Descripción del Requisito</label>
                  <span className="text-[10px] text-zinc-400 italic">roulette_locked_desc</span>
                </div>
                <textarea
                  value={labels.roulette_locked_desc}
                  onChange={e => setLabels(prev => ({ ...prev, roulette_locked_desc: e.target.value }))}
                  rows={3}
                  placeholder="¡Felicidades! Alcanzaste los sellos necesarios. Esta ruleta requiere una compra mínima de {min_amount} para activarse."
                  className="w-full bg-slate-50 border border-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 focus:bg-white text-sm text-[#09090b] resize-none"
                />
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 italic bg-slate-50 p-2 rounded-lg">
                  <HelpCircle className="w-3 h-3 text-zinc-400" />
                  <span>Usa <strong>{"{min_amount}"}</strong> para inyectar automáticamente el monto mínimo de ruleta configurado.</span>
                </div>
              </div>

              {/* Field: Footer Instruction */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-750 uppercase tracking-wide">Instrucción Pie de Bloqueo (Cómo Activarlo)</label>
                  <span className="text-[10px] text-zinc-400 italic">footer_instruction</span>
                </div>
                <input
                  type="text"
                  value={labels.footer_instruction}
                  onChange={e => setLabels(prev => ({ ...prev, footer_instruction: e.target.value }))}
                  placeholder="Realiza un pedido desde el menú o en caja que iguale o supere este monto."
                  className="w-full bg-slate-50 border border-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 focus:bg-white text-sm text-[#09090b]"
                />
              </div>
            </div>
          </div>

          {/* Live Preview Widget: 5 Columns */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
            <div className="bg-white border border-zinc-250 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-150 pb-4 mb-5">
                <h2 className="text-sm font-black text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-500" /> Vista Previa en Vivo
                </h2>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase mr-1">Simular sellos:</span>
                  {[2, 4, 10].map(s => (
                    <button
                      key={s}
                      onClick={() => setPreviewStamps(s)}
                      className={`w-6 h-6 text-[10px] font-bold rounded-md border flex items-center justify-center transition-all cursor-pointer ${
                        previewStamps === s 
                          ? 'bg-zinc-900 text-white border-zinc-900' 
                          : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-650'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mock Device Container */}
              <div className="max-w-[340px] mx-auto bg-slate-50 border-8 border-zinc-900 rounded-[36px] shadow-lg overflow-hidden relative font-sans">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-4 bg-zinc-900 rounded-b-xl z-20"></div>
                
                {/* Screen Content */}
                <div className="pt-6 pb-4 px-4 space-y-4 max-h-[560px] overflow-y-auto">
                  
                  {/* Mock Loyalty Card */}
                  <div 
                    className="rounded-2xl shadow-sm border border-black/10 overflow-hidden p-4 text-white relative" 
                    style={{ backgroundColor: colorPrimario }}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      {business?.logo_url ? (
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-white shadow-sm bg-white flex items-center justify-center">
                          <img src={business.logo_url} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-white text-zinc-950 flex items-center justify-center font-bold text-xs">
                          LB
                        </div>
                      )}
                      <div>
                        <h3 className="text-xs font-black uppercase leading-none">{business?.nombre || 'Mi Negocio'}</h3>
                        <p className="text-[8px] opacity-80 mt-0.5">Socio: Samuel Méndez</p>
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <p className="text-[9px] font-black uppercase opacity-75 tracking-wider">
                        {labels.card_title || 'TARJETA VIP DIGITAL'}
                      </p>
                      <h4 className="text-xs font-black uppercase leading-snug">
                        {formatPreviewLabel(labels.reward_instruction)}
                      </h4>
                    </div>

                    {/* Stamps display block */}
                    <div className="bg-white rounded-xl p-3.5 mt-3 shadow-sm text-zinc-900 space-y-3">
                      <p className="text-[9px] font-black uppercase text-zinc-400 tracking-wide">
                        {previewStamps >= totalStamps 
                          ? '🏆 ¡Ruleta de Premios Activa!' 
                          : `${previewStamps} / ${totalStamps} ${labels.stamps_suffix}`}
                      </p>

                      <div className="grid grid-cols-5 gap-2 place-items-center">
                        {[...Array(totalStamps)].map((_, i) => (
                          <div 
                            key={i} 
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                              i < previewStamps 
                                ? 'bg-amber-100 border border-amber-350 text-amber-650' 
                                : 'border border-dashed border-zinc-200 bg-slate-50 text-zinc-300'
                            }`}
                          >
                            <span className="text-[10px] font-bold">{i < previewStamps ? '⭐' : i + 1}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Mock Locked Roulette Block (Simulated) */}
                  {previewStamps >= totalStamps && (
                    <div className="bg-amber-50 border border-amber-250 rounded-xl p-4 text-center space-y-2.5 shadow-sm animate-fadeIn">
                      <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center mx-auto text-yellow-800">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-extrabold text-amber-900 text-xs flex items-center justify-center gap-1.5">
                          <span>🔒 {labels.roulette_locked_title}</span>
                        </p>
                        <p className="text-[9px] text-amber-700 leading-relaxed mt-1">
                          {formatPreviewLabel(labels.roulette_locked_desc)}
                        </p>
                        <div className="mt-2 py-1 px-2 bg-white/70 border border-amber-100 rounded-lg text-[9px] inline-block text-amber-800">
                          Tu última compra: <span className="font-bold text-red-600">$0 MXN</span>
                        </div>
                        <p className="text-[8px] text-amber-600 italic mt-1 leading-normal">
                          {formatPreviewLabel(labels.footer_instruction)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Mock QR section */}
                  {previewStamps < totalStamps && (
                    <div className="bg-white border border-zinc-200 rounded-xl p-4 flex flex-col items-center gap-2.5">
                      <div className="w-24 h-24 bg-slate-50 border border-zinc-200 rounded-lg flex items-center justify-center text-3xl">
                        🔳
                      </div>
                      <span className="text-[9px] font-mono bg-zinc-100 px-2 py-0.5 rounded text-zinc-650 font-semibold uppercase">ID: 8a7f92bc</span>
                    </div>
                  )}

                </div>
              </div>
            </div>

            {/* Hint Box */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-2.5 shadow-sm text-amber-900">
              <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                💡 Consejos de Redacción
              </h4>
              <ul className="text-xs space-y-2 leading-relaxed list-disc list-inside">
                <li>Mantén las instrucciones cortas para que luzcan perfectas en pantallas de teléfonos pequeños.</li>
                <li>Usa mayúsculas para las llamadas a la acción importantes (Ej: "¡PREMIO GRATIS!").</li>
                <li>Verifica que tus tags dinámicos estén bien escritos: <code className="bg-white/80 px-1 py-0.5 rounded font-mono font-bold">{"{total_stamps}"}</code> y <code className="bg-white/80 px-1 py-0.5 rounded font-mono font-bold">{"{min_amount}"}</code>.</li>
              </ul>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
