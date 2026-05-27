'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Settings, Palette, Clock, Globe, ChevronRight,
  Check, Upload, Eye, Smartphone, Monitor, Share2
} from 'lucide-react'

// ── Paso del wizard ─────────────────────────────────────────────────────────
type WizardStep = 'branding' | 'horario' | 'geo' | 'lealtad' | 'preview'

const PASOS: { id: WizardStep; label: string; icono: React.ReactNode }[] = [
  { id: 'branding',  label: 'Branding',    icono: <Palette size={16} /> },
  { id: 'horario',   label: 'Horario',     icono: <Clock size={16} /> },
  { id: 'geo',       label: 'Geoloc.',     icono: <Globe size={16} /> },
  { id: 'lealtad',   label: 'Lealtad',     icono: <Settings size={16} /> },
  { id: 'preview',   label: 'Preview',     icono: <Eye size={16} /> },
]

// Paleta de colores primarios sugeridos
const PALETA_COLORES = [
  { nombre: 'Rojo Crimson',  hex: '#ef4444' },
  { nombre: 'Naranja Fuego', hex: '#f97316' },
  { nombre: 'Ámbar Dorado',  hex: '#f59e0b' },
  { nombre: 'Lima Eléctrica',hex: '#84cc16' },
  { nombre: 'Cian Neon',     hex: '#06b6d4' },
  { nombre: 'Violeta Royal', hex: '#8b5cf6' },
  { nombre: 'Rosa Coral',    hex: '#ec4899' },
  { nombre: 'Blanco',        hex: '#f1f5f9' },
]

function parseDMSToDecimal(input: string): number | null {
  // Soporta: 19°25'17.7"N, 19.421583, -102.067222
  const decimal = parseFloat(input)
  if (!isNaN(decimal) && input.trim().match(/^-?\d+(\.\d+)?$/)) return decimal

  const dmsRegex = /(\d+)[°\s]+(\d+)['\'\s]+(\d+(?:\.\d+)?)["\"\s]*([NSEW]?)/i
  const match = input.trim().match(dmsRegex)
  if (!match) return null
  const [, deg, min, sec, dir] = match
  let dd = parseFloat(deg) + parseFloat(min) / 60 + parseFloat(sec) / 3600
  if (dir && ['S', 'W'].includes(dir.toUpperCase())) dd = -dd
  return parseFloat(dd.toFixed(8))
}

export default function AjustesPage() {
  const [paso, setPaso] = useState<WizardStep>('branding')
  const [config, setConfig] = useState<any>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // Branding
  const [nombreNegocio, setNombreNegocio] = useState('')
  const [colorPrimario, setColorPrimario] = useState('#ef4444')
  const [colorPersonalizado, setColorPersonalizado] = useState('')
  const [logoPreview, setLogoPreview] = useState('')
  const [bannerPreview, setBannerPreview] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)

  // Horario
  const [horaApertura, setHoraApertura] = useState('08:00')
  const [horaCierre, setHoraCierre] = useState('22:00')
  const [diasActivos, setDiasActivos] = useState<string[]>(['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'])
  const [whatsapp, setWhatsapp] = useState('')

  // Geo
  const [geoInput, setGeoInput] = useState('')
  const [geoLngInput, setGeoLngInput] = useState('')
  const [geoLat, setGeoLat] = useState<number | null>(null)
  const [geoLng, setGeoLng] = useState<number | null>(null)
  const [mensajePush, setMensajePush] = useState('¡Estás cerca de tu premio VIP!')
  const [radioGeo, setRadioGeo] = useState(500)

  // Lealtad
  const [maxSellos, setMaxSellos] = useState('10')
  const [montoMinimo, setMontoMinimo] = useState('0')
  const [horasBloqueo, setHorasBloqueo] = useState('24')

  // Vista previa tipo dispositivo
  const [vistaDispositivo, setVistaDispositivo] = useState<'mobile' | 'desktop'>('mobile')

  const getCookieVal = (name: string) => {
    if (typeof document === 'undefined') return ''
    return document.cookie.match(new RegExp(`${name}=([^;]+)`))?.[1] || ''
  }

  useEffect(() => {
    const cargar = async () => {
      const businessId = getCookieVal('session_business_id')
      if (!businessId) { setCargando(false); return }

      const { data } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .maybeSingle()

      if (data) {
        setConfig(data)
        setNombreNegocio(data.nombre || '')
        setColorPrimario(data.color_primario || '#ef4444')
        setLogoPreview(data.logo_url || '')
        setBannerPreview(data.banner_url || '')
        setHoraApertura(data.hora_apertura || '08:00')
        setHoraCierre(data.hora_cierre || '22:00')
        setWhatsapp(data.telefono_whatsapp || '')
        setGeoLat(data.latitude || null)
        setGeoLng(data.longitude || null)
        if (data.latitude) setGeoInput(String(data.latitude))
        if (data.longitude) setGeoLngInput(String(data.longitude))
        setMensajePush(data.mensaje_push || '¡Estás cerca de tu premio VIP!')
        setMaxSellos(String(data.max_sellos || 10))
        setMontoMinimo(String(data.monto_minimo_sello || 0))
        setHorasBloqueo(String(data.horas_bloqueo || 24))
      }
      setCargando(false)
    }
    cargar()
  }, [])

  const parsearGeo = () => {
    const lat = parseDMSToDecimal(geoInput)
    const lng = parseDMSToDecimal(geoLngInput)
    if (lat !== null) setGeoLat(lat)
    if (lng !== null) setGeoLng(lng)
    if (lat === null) setError('Latitud inválida. Usa formato decimal o DMS (19°25\'17.7"N)')
    else if (lng === null) setError('Longitud inválida.')
    else setError('')
  }

  const toggleDia = (dia: string) => {
    setDiasActivos(prev => 
      prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia]
    )
  }

  const subirLogo = async (file: File) => {
    if (!config?.id) return
    setUploadingLogo(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `logos/${config.id}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('business-assets')
        .upload(path, file, { upsert: true })
      
      if (upErr) throw upErr

      const { data: urlData } = supabase.storage
        .from('business-assets')
        .getPublicUrl(path)

      const url = urlData.publicUrl
      setLogoPreview(url)
      await supabase.from('businesses').update({ logo_url: url }).eq('id', config.id)
    } catch (err: any) {
      setError('Error subiendo logo: ' + err.message)
    } finally {
      setUploadingLogo(false)
    }
  }

  const guardarTodo = async () => {
    if (!config?.id) return
    setGuardando(true)
    setError('')

    const colorFinal = colorPersonalizado.startsWith('#') ? colorPersonalizado : colorPrimario

    const payload: any = {
      nombre: nombreNegocio,
      color_primario: colorFinal,
      hora_apertura: horaApertura,
      hora_cierre: horaCierre,
      telefono_whatsapp: whatsapp,
      mensaje_push: mensajePush,
      max_sellos: parseInt(maxSellos) || 10,
      monto_minimo_sello: parseFloat(montoMinimo) || 0,
      horas_bloqueo: parseInt(horasBloqueo) || 24,
    }

    if (geoLat !== null) payload.latitude = geoLat
    if (geoLng !== null) payload.longitude = geoLng

    const { error: updErr } = await supabase
      .from('businesses')
      .update(payload)
      .eq('id', config.id)

    if (updErr) {
      setError('Error al guardar: ' + updErr.message)
    } else {
      setSuccess('✅ Configuración guardada con éxito')
      setTimeout(() => setSuccess(''), 3000)
    }
    setGuardando(false)
  }

  const pasoIndex = PASOS.findIndex(p => p.id === paso)
  const colorActivo = colorPersonalizado.startsWith('#') ? colorPersonalizado : colorPrimario

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-800 border-t-red-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white font-sans p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">Configuración del Portal</h1>
            <p className="text-zinc-500 text-xs uppercase tracking-widest mt-1">Onboarding Wizard · {config?.nombre || 'Tu Negocio'}</p>
          </div>
          {success && (
            <div className="flex items-center gap-2 bg-green-950/60 border border-green-800/40 px-4 py-2 rounded-xl">
              <Check size={14} className="text-green-400" />
              <span className="text-green-400 text-xs font-bold">{success}</span>
            </div>
          )}
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {PASOS.map((p, i) => (
            <>
              <button
                key={p.id}
                onClick={() => setPaso(p.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                  paso === p.id
                    ? 'text-white border'
                    : 'text-zinc-500 hover:text-zinc-300 border border-zinc-800'
                }`}
                style={paso === p.id ? { background: `${colorActivo}22`, borderColor: `${colorActivo}55`, color: colorActivo } : {}}
              >
                {p.icono}
                {p.label}
                {i < pasoIndex && <Check size={10} className="text-green-400" />}
              </button>
              {i < PASOS.length - 1 && <ChevronRight size={12} className="text-zinc-700 shrink-0" />}
            </>
          ))}
        </div>

        {/* Contenido del paso */}
        <div className="bg-[#121212] border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6">

          {/* ── PASO: BRANDING ─────────────────────────────────────── */}
          {paso === 'branding' && (
            <div className="space-y-6">
              <h2 className="text-lg font-black flex items-center gap-2">
                <Palette size={20} style={{ color: colorActivo }} />
                Identidad Visual
              </h2>

              <div className="space-y-2">
                <label className="text-[10px] text-zinc-400 uppercase font-black block">Nombre del Negocio</label>
                <input
                  type="text"
                  value={nombreNegocio}
                  onChange={e => setNombreNegocio(e.target.value)}
                  className="w-full bg-black/50 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-colors"
                  style={{ '--tw-ring-color': colorActivo } as any}
                  placeholder="Ej: La Burrería"
                />
              </div>

              {/* Selector de color */}
              <div className="space-y-3">
                <label className="text-[10px] text-zinc-400 uppercase font-black block">Color Principal de Marca</label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {PALETA_COLORES.map(c => (
                    <button
                      key={c.hex}
                      onClick={() => { setColorPrimario(c.hex); setColorPersonalizado('') }}
                      title={c.nombre}
                      className={`h-10 w-full rounded-xl border-2 transition-all ${
                        colorPrimario === c.hex && !colorPersonalizado
                          ? 'border-white scale-110 shadow-lg'
                          : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={colorPersonalizado || colorPrimario}
                    onChange={e => setColorPersonalizado(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-zinc-700 bg-transparent cursor-pointer"
                  />
                  <span className="text-zinc-400 text-xs">Color personalizado</span>
                  <code className="text-zinc-300 text-xs font-mono bg-zinc-900 px-2 py-1 rounded">
                    {colorActivo}
                  </code>
                </div>
              </div>

              {/* Preview en vivo del color */}
              <div className="rounded-2xl border border-zinc-800 overflow-hidden">
                <div className="p-4 text-white font-black text-sm" style={{ background: `linear-gradient(135deg, ${colorActivo}, ${colorActivo}88)` }}>
                  {nombreNegocio || 'Tu Negocio'} — Preview de Marca
                </div>
                <div className="p-4 bg-zinc-900 flex items-center gap-4">
                  {logoPreview ? (
                    <img src={logoPreview} alt="logo" className="w-12 h-12 rounded-xl object-cover border border-zinc-700" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center border border-zinc-700 text-2xl"
                      style={{ background: `${colorActivo}22` }}>
                      🏪
                    </div>
                  )}
                  <div>
                    <p className="text-white font-black">{nombreNegocio || 'Tu Negocio'}</p>
                    <div className="mt-1 px-3 py-0.5 rounded-full text-[10px] font-black text-white inline-block"
                      style={{ backgroundColor: colorActivo }}>
                      ⭐ Programa VIP
                    </div>
                  </div>
                </div>
              </div>

              {/* Subida de logo */}
              <div className="space-y-2">
                <label className="text-[10px] text-zinc-400 uppercase font-black block">Logo del Negocio</label>
                <label className="flex items-center gap-3 border border-dashed border-zinc-700 rounded-xl p-4 cursor-pointer hover:border-zinc-500 transition-colors">
                  <Upload size={18} className="text-zinc-400" />
                  <span className="text-zinc-400 text-xs">
                    {uploadingLogo ? 'Subiendo...' : logoPreview ? 'Cambiar logo' : 'Subir logo (PNG, JPG, SVG)'}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) subirLogo(file)
                    }}
                  />
                </label>
              </div>
            </div>
          )}

          {/* ── PASO: HORARIO ─────────────────────────────────────── */}
          {paso === 'horario' && (
            <div className="space-y-6">
              <h2 className="text-lg font-black flex items-center gap-2">
                <Clock size={20} style={{ color: colorActivo }} />
                Horario Comercial
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-zinc-400 uppercase font-black block">Hora de Apertura</label>
                  <input
                    type="time"
                    value={horaApertura}
                    onChange={e => setHoraApertura(e.target.value)}
                    className="w-full bg-black/50 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-zinc-400 uppercase font-black block">Hora de Cierre</label>
                  <input
                    type="time"
                    value={horaCierre}
                    onChange={e => setHoraCierre(e.target.value)}
                    className="w-full bg-black/50 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] text-zinc-400 uppercase font-black block">Días de Servicio</label>
                <div className="flex flex-wrap gap-2">
                  {['lunes','martes','miercoles','jueves','viernes','sabado','domingo'].map(dia => (
                    <button
                      key={dia}
                      onClick={() => toggleDia(dia)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                        diasActivos.includes(dia)
                          ? 'text-white border-transparent'
                          : 'text-zinc-500 border-zinc-800 hover:border-zinc-600'
                      }`}
                      style={diasActivos.includes(dia) ? { backgroundColor: colorActivo, borderColor: colorActivo } : {}}
                    >
                      {dia.slice(0,3).toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-zinc-400 uppercase font-black block">WhatsApp del Negocio</label>
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={e => setWhatsapp(e.target.value)}
                  className="w-full bg-black/50 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none"
                  placeholder="521234567890 (con código de país)"
                />
              </div>

              {/* Preview horario */}
              <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                <p className="text-[10px] text-zinc-500 uppercase font-black mb-2">Vista de Clientes (Menú Digital)</p>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400"></span>
                  <p className="text-white text-sm font-bold">Abierto · {horaApertura} – {horaCierre} hrs</p>
                </div>
                <p className="text-zinc-400 text-xs mt-1">
                  Disponible: {diasActivos.length > 0 ? diasActivos.map(d => d.slice(0,3).toUpperCase()).join(', ') : 'Sin días'}
                </p>
              </div>
            </div>
          )}

          {/* ── PASO: GEOLOCALIZACIÓN ─────────────────────────────── */}
          {paso === 'geo' && (
            <div className="space-y-6">
              <h2 className="text-lg font-black flex items-center gap-2">
                <Globe size={20} style={{ color: colorActivo }} />
                Geolocalización y Push
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-zinc-400 uppercase font-black block">
                    Latitud (Decimal o DMS)
                  </label>
                  <input
                    type="text"
                    value={geoInput}
                    onChange={e => setGeoInput(e.target.value)}
                    className="w-full bg-black/50 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none font-mono"
                    placeholder="19.421583 o 19d25'17.7''N"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-zinc-400 uppercase font-black block">
                    Longitud (Decimal o DMS)
                  </label>
                  <input
                    type="text"
                    value={geoLngInput}
                    onChange={e => setGeoLngInput(e.target.value)}
                    className="w-full bg-black/50 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none font-mono"
                    placeholder="-102.067222 o 102d04'02''W"
                  />
                </div>
              </div>

              <button
                onClick={parsearGeo}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-zinc-700 hover:border-zinc-500 text-zinc-300 transition-all"
              >
                🧭 Parsear Coordenadas
              </button>

              {geoLat !== null && geoLng !== null && (
                <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                  <p className="text-[10px] text-zinc-500 uppercase font-black mb-2">Coordenadas Validadas</p>
                  <div className="flex gap-4">
                    <div>
                      <p className="text-zinc-400 text-[9px] uppercase">Latitud</p>
                      <p className="text-white font-mono font-bold">{geoLat.toFixed(6)}</p>
                    </div>
                    <div>
                      <p className="text-zinc-400 text-[9px] uppercase">Longitud</p>
                      <p className="text-white font-mono font-bold">{geoLng.toFixed(6)}</p>
                    </div>
                  </div>
                  <div className="mt-3 h-36 rounded-xl overflow-hidden border border-zinc-700">
                    <iframe
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${geoLng! - 0.01}%2C${geoLat! - 0.01}%2C${geoLng! + 0.01}%2C${geoLat! + 0.01}&layer=mapnik&marker=${geoLat}%2C${geoLng}`}
                      className="w-full h-full border-0"
                      loading="lazy"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <label className="text-[10px] text-zinc-400 uppercase font-black block">
                  Radio de Geocerca: {radioGeo >= 1000 ? `${(radioGeo/1000).toFixed(1)} km` : `${radioGeo} m`}
                </label>
                <input
                  type="range"
                  min={100}
                  max={5000}
                  step={100}
                  value={radioGeo}
                  onChange={e => setRadioGeo(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-[9px] text-zinc-600">
                  <span>100m</span>
                  <span>1km</span>
                  <span>5km</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-zinc-400 uppercase font-black block">Mensaje de Alerta Push (Geocerca)</label>
                <textarea
                  value={mensajePush}
                  onChange={e => setMensajePush(e.target.value)}
                  rows={3}
                  className="w-full bg-black/50 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none resize-none"
                  placeholder="¡Estás cerca de tu premio VIP! Pasa por tus sellos."
                />
              </div>
            </div>
          )}

          {/* ── PASO: LEALTAD ─────────────────────────────────────── */}
          {paso === 'lealtad' && (
            <div className="space-y-6">
              <h2 className="text-lg font-black flex items-center gap-2">
                <Settings size={20} style={{ color: colorActivo }} />
                Reglas de Lealtad
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-zinc-400 uppercase font-black block">Sellos para Premio Final</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={maxSellos}
                    onChange={e => setMaxSellos(e.target.value)}
                    className="w-full bg-black/50 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none text-center font-black text-2xl"
                  />
                  <p className="text-zinc-600 text-[9px] text-center">Número total de sellos</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-zinc-400 uppercase font-black block">Monto Mínimo (MXN)</label>
                  <input
                    type="number"
                    min={0}
                    value={montoMinimo}
                    onChange={e => setMontoMinimo(e.target.value)}
                    className="w-full bg-black/50 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none text-center font-black text-2xl"
                  />
                  <p className="text-zinc-600 text-[9px] text-center">Compra mínima para sello</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-zinc-400 uppercase font-black block">Horas Anti-Fraude</label>
                  <input
                    type="number"
                    min={0}
                    max={168}
                    value={horasBloqueo}
                    onChange={e => setHorasBloqueo(e.target.value)}
                    className="w-full bg-black/50 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none text-center font-black text-2xl"
                  />
                  <p className="text-zinc-600 text-[9px] text-center">Horas entre visitas</p>
                </div>
              </div>

              {/* Preview de la tarjeta de lealtad */}
              <div className="space-y-2">
                <label className="text-[10px] text-zinc-400 uppercase font-black block">Preview Tarjeta VIP</label>
                <div className="rounded-2xl p-6 border border-zinc-700" style={{ background: `linear-gradient(135deg, #0a0a0a, ${colorActivo}11)`, borderColor: `${colorActivo}33` }}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-white font-black">{nombreNegocio || 'Tu Negocio'}</p>
                      <p className="text-xs" style={{ color: colorActivo }}>Programa de Lealtad VIP</p>
                    </div>
                    <div className="text-right">
                      <p className="text-zinc-400 text-[9px] uppercase">Sellos</p>
                      <p className="font-black text-2xl text-white">0 / {maxSellos}</p>
                    </div>
                  </div>
                  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(parseInt(maxSellos)||10, 10)}, 1fr)` }}>
                    {Array.from({ length: Math.min(parseInt(maxSellos)||10, 10) }).map((_, i) => (
                      <div key={i} className="h-7 rounded-lg border border-zinc-700 flex items-center justify-center text-xs">
                        ⭐
                      </div>
                    ))}
                  </div>
                  {parseInt(maxSellos) > 10 && (
                    <p className="text-zinc-500 text-[9px] mt-2">... y {parseInt(maxSellos) - 10} sellos más</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── PASO: PREVIEW ─────────────────────────────────────── */}
          {paso === 'preview' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black flex items-center gap-2">
                  <Eye size={20} style={{ color: colorActivo }} />
                  Vista Final
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setVistaDispositivo('mobile')}
                    className={`p-2 rounded-lg border transition-all ${
                      vistaDispositivo === 'mobile' ? 'border-zinc-400 text-white bg-zinc-800' : 'border-zinc-800 text-zinc-500'
                    }`}
                  >
                    <Smartphone size={16} />
                  </button>
                  <button
                    onClick={() => setVistaDispositivo('desktop')}
                    className={`p-2 rounded-lg border transition-all ${
                      vistaDispositivo === 'desktop' ? 'border-zinc-400 text-white bg-zinc-800' : 'border-zinc-800 text-zinc-500'
                    }`}
                  >
                    <Monitor size={16} />
                  </button>
                </div>
              </div>

              {/* Resumen de configuración */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Negocio', value: nombreNegocio || '—' },
                  { label: 'Color', value: colorActivo, isColor: true },
                  { label: 'Apertura', value: horaApertura },
                  { label: 'Cierre', value: horaCierre },
                  { label: 'Sellos Max', value: maxSellos },
                  { label: 'Monto Mín.', value: `$${montoMinimo} MXN` },
                  { label: 'Anti-Fraude', value: `${horasBloqueo}h` },
                  { label: 'Geo', value: geoLat ? `${geoLat?.toFixed(4)}, ${geoLng?.toFixed(4)}` : 'Sin configurar' },
                ].map(item => (
                  <div key={item.label} className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
                    <p className="text-[9px] text-zinc-500 uppercase font-black">{item.label}</p>
                    {(item as any).isColor ? (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: colorActivo }} />
                        <p className="text-white font-bold text-sm font-mono">{colorActivo}</p>
                      </div>
                    ) : (
                      <p className="text-white font-bold text-sm mt-1">{item.value}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Preview del menú digital */}
              <div className={`mx-auto rounded-2xl overflow-hidden border border-zinc-700 ${
                vistaDispositivo === 'mobile' ? 'max-w-xs' : 'max-w-full'
              }`}>
                <div className="p-4" style={{ background: `linear-gradient(135deg, ${colorActivo}, ${colorActivo}88)` }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">
                      {logoPreview ? <img src={logoPreview} className="w-full h-full object-cover rounded-xl" alt="" /> : '🏪'}
                    </div>
                    <div>
                      <p className="text-white font-black">{nombreNegocio || 'Tu Negocio'}</p>
                      <p className="text-white/60 text-[10px]">Menú Digital Oficial</p>
                    </div>
                  </div>
                </div>
                <div className="bg-[#0a0a0a] p-4 space-y-2">
                  {['Tacos de Canasta', 'Burritos Especiales', 'Bebidas'].map(cat => (
                    <div key={cat} className="flex justify-between items-center py-2 border-b border-zinc-900">
                      <p className="text-white text-xs font-bold">{cat}</p>
                      <span className="text-[9px] px-2 py-0.5 rounded-full text-white font-black" style={{ backgroundColor: colorActivo }}>
                        Ver
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Link compartible */}
              {config?.slug && (
                <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                  <p className="text-[10px] text-zinc-500 uppercase font-black mb-2">Link para Compartir con Clientes</p>
                  <div className="flex items-center gap-2">
                    <code className="text-red-400 font-mono text-xs flex-1 bg-black/50 px-3 py-2 rounded-lg truncate">
                      loyaltyapp.vercel.app/{config.slug}/menu
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`https://loyaltyapp.vercel.app/${config.slug}/menu`)
                        setSuccess('¡Link copiado!')
                        setTimeout(() => setSuccess(''), 2000)
                      }}
                      className="p-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white transition-colors"
                    >
                      <Share2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-red-400 text-xs font-bold bg-red-950/20 border border-red-900/30 rounded-lg px-4 py-2">
              {error}
            </p>
          )}

        </div>

        {/* Navegación */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              const idx = PASOS.findIndex(p => p.id === paso)
              if (idx > 0) setPaso(PASOS[idx - 1].id)
            }}
            disabled={paso === 'branding'}
            className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 transition-all disabled:opacity-30"
          >
            ← Anterior
          </button>

          <button
            onClick={guardarTodo}
            disabled={guardando}
            className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all hover:brightness-110 disabled:opacity-50 shadow-lg"
            style={{ background: `linear-gradient(135deg, ${colorActivo}, ${colorActivo}aa)` }}
          >
            {guardando ? 'Guardando...' : '💾 Guardar Todo'}
          </button>

          <button
            onClick={() => {
              const idx = PASOS.findIndex(p => p.id === paso)
              if (idx < PASOS.length - 1) setPaso(PASOS[idx + 1].id)
            }}
            disabled={paso === 'preview'}
            className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 transition-all disabled:opacity-30"
          >
            Siguiente →
          </button>
        </div>

      </div>
    </main>
  )
}