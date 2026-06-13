'use client'

import { useState } from 'react'
import { toggleIngredientStatus } from '@/app/actions/ingredients'
import { AlertCircle, CheckCircle2, Loader2, Salad } from 'lucide-react'

interface Ingredient {
  id: string
  nombre: string
  is_available: boolean
}

interface IngredientsClientProps {
  initialIngredients: Ingredient[]
}

export default function IngredientsClient({ initialIngredients }: IngredientsClientProps) {
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleToggle = async (ingredientId: string, currentStatus: boolean) => {
    if (loadingId) return
    setLoadingId(ingredientId)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const res = await toggleIngredientStatus(ingredientId, currentStatus)
      if (res.success) {
        setIngredients(prev =>
          prev.map(ing => (ing.id === ingredientId ? { ...ing, is_available: !currentStatus } : ing))
        )
        const name = ingredients.find(i => i.id === ingredientId)?.nombre || 'Ingrediente'
        setSuccessMessage(`✅ "${name}" ${!currentStatus ? 'desactivado (Kill Switch)' : 'reactivado'} correctamente.`)
        setTimeout(() => setSuccessMessage(null), 4000)
      } else {
        setErrorMessage(res.error || 'Error al actualizar estado del ingrediente.')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error inesperado al ejecutar el Server Action.')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast Notifications */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 flex items-center gap-3 shadow-sm text-xs font-bold uppercase tracking-wider">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-center gap-3 shadow-sm text-xs font-bold uppercase tracking-wider">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="card-clean p-6 space-y-4">
        <div className="border-b border-zinc-200 pb-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Salad className="w-5 h-5 text-[#dc2626]" />
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Control de Ingredientes ({ingredients.length})
            </h3>
          </div>
          <span className="bg-zinc-100 text-zinc-500 border border-zinc-250 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase">
            ISR Activa
          </span>
        </div>

        {ingredients.length === 0 ? (
          <div className="text-center py-12 text-zinc-400 font-mono text-xs uppercase tracking-wider">
            No se encontraron insumos configurados para este comercio.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-150">
            {ingredients.map(ing => {
              const isToggling = loadingId === ing.id
              const isDisabled = loadingId !== null
              return (
                <li
                  key={ing.id}
                  className={`py-4 flex items-center justify-between transition-all duration-200 ${
                    isToggling ? 'opacity-50' : 'opacity-100'
                  }`}
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-sm text-zinc-900">{ing.nombre}</span>
                    <p className="text-[9px] text-zinc-400 font-mono uppercase tracking-wider">
                      Ref: #{ing.id.slice(-8).toUpperCase()}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {isToggling && (
                      <Loader2 className="w-4 h-4 animate-spin text-[#dc2626]" />
                    )}
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={ing.is_available}
                        disabled={isDisabled}
                        onChange={() => handleToggle(ing.id, ing.is_available)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#dc2626] disabled:opacity-50"></div>
                    </label>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
