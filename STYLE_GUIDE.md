# STYLE GUIDE — LoyaltyClub / Urban Delivery
> **Fuente de Verdad Visual.** Toda nueva UI debe adherirse a estas convenciones sin excepción.
> Última actualización: Junio 2026 — Sistema de Ruleta Variable implementado.

---

## 1. Paleta de Colores

### Comercios (Dashboard del Restaurante)
| Token | Valor | Uso |
|-------|-------|-----|
| `bg-primary` | `#dc2626` | Botones de acción primaria, acentos, badges clave |
| `bg-primary-hover` | `#b91c1c` | Estado hover de botones primarios |
| `bg-primary-shadow` | `rgba(220,38,38,0.25)` | Sombra de botones CTA rojos |
| `text-base` | `#09090b` | Texto principal / títulos |
| `text-secondary` | `#52525b` | Texto de soporte |
| `text-muted` | `#71717a` | Etiquetas, subtítulos, hints |
| `text-disabled` | `#a1a1aa` | Placeholders, estados vacíos |
| `bg-page` | `#fafafa` | Fondo de página / contenedor global |
| `bg-card` | `#ffffff` | Fondo de cards y paneles |
| `border-base` | `#e4e4e7` | Bordes de inputs, cards, separadores |
| `border-subtle` | `#f4f4f5` | Separadores internos dentro de cards |

### Módulo de Reparto (Bikers / Modulador)
| Token | Valor | Uso |
|-------|-------|-----|
| `accent-delivery` | `#2563eb` | Acento principal del panel bikers/modulador |
| `accent-delivery-hover` | `#1d4ed8` | Hover de botones azules |
| `bg-connected` | `rgba(22,163,74,0.08)` | Fondo de card cuando biker está conectado |
| `text-connected` | `#16a34a` | Texto de estado conectado |
| `bg-warning` | `bg-amber-50 / border-amber-200` | Alertas y solicitudes pendientes |

### Prohibiciones
- **Modo oscuro prohibido.** Ningún componente tiene variante `dark:`. El diseño es 100% "Clean Light Mode".
- No usar colores genéricos de Tailwind (`red-500`, `blue-600`) sin pasar por los tokens anteriores.
- No usar `#000000` puro — usar `#09090b` para negros.

---

## 2. Tipografía

- **Fuente**: `Inter` (Google Fonts, importada globalmente) / fallback `system-ui, sans-serif`.
- **Jerarquía**:
  - `text-2xl font-black` — Títulos de pantalla (login, portal biker)
  - `text-xl font-bold` — Títulos de sección
  - `text-sm font-bold` — Subtítulos de card, labels de grupo
  - `text-xs font-semibold uppercase tracking-wider` — Labels de inputs (patrón `LBL`)
  - `text-[10px] font-bold uppercase tracking-wider` — Micro-badges, chips de categoría
  - `text-[9px] font-black uppercase tracking-wider` — Tags de estado en tablas

---

## 3. Componentes Base

### Card limpia (`.card-clean`)
```html
<div class="bg-white border border-[#e4e4e7] rounded-2xl shadow-sm p-6 space-y-4">
```
- Radio: `rounded-2xl` (16px) para cards principales, `rounded-xl` (12px) para inputs.
- Sombra: `shadow-sm` en reposo, `shadow-[0_4px_24px_rgba(0,0,0,0.06)]` en hover/active.

### Input estándar (pattern `IC`)
```
w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-2.5
text-[#09090b] text-sm focus:outline-none focus:border-[#dc2626]
focus:bg-white focus:shadow-[0_0_0_3px_rgba(220,38,38,0.1)] transition-all
```

### Label estándar (pattern `LBL`)
```
block text-[10px] font-bold text-[#71717a] uppercase tracking-wider mb-1.5
```

### Botón primario rojo
```
bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold text-sm
rounded-xl py-3 px-6 transition-all active:scale-95
shadow-[0_1px_3px_rgba(220,38,38,0.3)]
hover:shadow-[0_4px_20px_rgba(220,38,38,0.35)]
hover:-translate-y-px disabled:opacity-50
```

### Botón primario azul (Delivery / Modulador)
```
bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-sm
rounded-xl py-3 px-6 transition-all shadow-xs
```

### Stepper [-] N [+]
Patrón estándar para inputs numéricos con botones decrement/increment. El array de datos
se ajusta sin perder los valores ya escritos (expande con '' al crecer, trunca al reducir).
- Wrapper: `flex items-center gap-4 bg-[#fafafa] border border-[#e4e4e7] rounded-2xl p-4`
- Botones: `w-9 h-9 rounded-xl bg-white border border-[#e4e4e7] flex items-center justify-center hover:bg-[#f4f4f5] disabled:opacity-40 active:scale-95 shadow-sm`
- Número: `w-16 text-center font-black text-xl text-[#09090b] tabular-nums select-none`

### Badge de estado repetido (Ruleta)
Para indicar que el mismo premio ocupa múltiples sectores (mayor probabilidad):
```
ml-2 text-[#dc2626] text-[9px] font-black uppercase tracking-wider
bg-[#fef2f2] border border-[#fecaca] px-1.5 py-0.5 rounded-full
```
Lógica: `premios.filter(x => x.trim() === p.trim()).length > 1`

---

## 4. Animaciones y Micro-interacciones

| Clase | Descripción |
|-------|-------------|
| `animate-fadeIn` | Aparición suave — definida en `globals.css` |
| `animate-slideUp` | Toast deslizándose desde abajo |
| `animate-pulse` | Indicador de estado "activo" (dot verde del biker) |
| `animate-spin` | Loader de carga (siempre en `Loader2` de lucide) |
| `active:scale-95` | Feedback táctil en todos los botones |
| `transition-all` | Transición suave en inputs y cards |

---

## 5. Sistema de Ruleta Variable (Junio 2026)

### Arquitectura de Estado
```typescript
// Ruleta Principal — 1 a 10 sectores
const [numSectoresPrincipal, setNumSectoresPrincipal] = useState(4)
const [premiosPrincipal, setPremiosPrincipal] = useState<string[]>([...])

const ajustarPremiosPrincipal = (n: number) => {
  setNumSectoresPrincipal(n)
  setPremiosPrincipal(prev => {
    const copy = [...prev]
    while (copy.length < n) copy.push('')
    return copy.slice(0, n)
  })
}

// Ruleta Intermedia — N sectores independientes por estrella
const [numSectoresNuevo, setNumSectoresNuevo] = useState(4)
const [nuevosPremios, setNuevosPremios] = useState<string[]>([...])
const ajustarNuevosPremios = (n: number) => { /* mismo patrón */ }
```

### Persistencia en Supabase
- `businesses.premios_ruleta` (tipo `text[]`) — array de longitud variable.
- `businesses.ruleta_config` (tipo `jsonb`) — `{ [sello: string]: { activo: boolean, premios: string[] } }`.

### Demo Interactivo RuletaDemo
- Componente standalone antes de `DashboardPage` en `dashboard/page.tsx`.
- Canvas API + `requestAnimationFrame`.
- Curva easing: `t => 1 - Math.pow(1 - t, 4)` (quartic ease-out).
- El winner se fija antes de la animación y el ángulo final se calcula para alinear el sector con el puntero triangular.

---

## 6. Iconografía

- **Librería**: `lucide-react` exclusivamente.
- **Tamaños**: `w-3.5 h-3.5` (micro), `w-4 h-4` (inline), `w-5 h-5` (card), `w-8 h-8` (hero).
- **Iconos reservados por módulo**:
  - `Gift` — Ruleta / Premios
  - `Truck` — Delivery / Solicitar Moto
  - `Navigation` — Portal Biker
  - `Wifi / WifiOff` — Estado conexión biker
  - `Settings` — Configuración de Flota
  - `Plus / Minus` — Steppers de incremento

---

## 7. Responsive y Layout

- **Sidebar desktop**: Fijo a la izquierda en `md:`, oculto en mobile con hamburguesa.
- **Bottom nav mobile**: `fixed bottom-0 h-16 z-40` — presente en Modulador.
- **Max-width de contenido**: `max-w-3xl` formularios, `max-w-4xl` listas.
- **Grid de premios**: `grid-cols-1 sm:grid-cols-2` (ruleta principal); `grid-cols-1 sm:grid-cols-2 md:grid-cols-3` (intermedia).
