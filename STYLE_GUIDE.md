# 🎨 STYLE GUIDE — LoyaltyClub Platform
> **Este archivo define el lenguaje visual oficial de la plataforma.**
> Toda página nueva o modificada DEBE ajustarse a estas reglas sin excepción.
> El menú (`/menu`), el portal de cliente, el registro, y cualquier pantalla B2C o B2B deben seguir esta guía.

---

## ⚠️ La Regla de Oro

El estilo oficial de la plataforma es **LIGHT (claro)**:
- ✅ **Fondo blanco / gris muy claro**
- ✅ **Texto oscuro casi negro**
- ✅ **Botones rojos**
- ❌ **NO fondos negros** (`bg-[#050505]`, `bg-zinc-900`, `bg-black`)
- ❌ **NO texto amarillo** (`text-amber-400`, `text-yellow-*`)
- ❌ **NO estética "dark mode"**

El menú actual usa estilo oscuro que NO corresponde a la plataforma. Cualquier página nueva debe verse como el **dashboard** y el **login**, no como el menú.

---

## 1. Colores Base

### Fondos (Backgrounds)

| Token CSS | Valor Hex | Tailwind equivalente | Uso |
|-----------|-----------|---------------------|-----|
| `--bg-canvas` | `#ffffff` | `bg-white` | Fondo de página principal |
| `--bg-muted` | `#fafafa` | `bg-[#fafafa]` | Fondo de secciones secundarias, inputs |
| `--bg-subtle` | `#f4f4f5` | `bg-[#f4f4f5]` | Hover de filas, fondos de chips |
| `--surface` | `#ffffff` | `bg-white` | Superficie de cards y modales |

```tsx
// ✅ CORRECTO — Fondo de página
<div className="min-h-screen bg-[#fafafa]">

// ✅ CORRECTO — Fondo de card
<div className="bg-white rounded-2xl border border-[#e4e4e7]">

// ❌ INCORRECTO
<div className="min-h-screen bg-[#050505]">
<div className="bg-zinc-900/80">
```

### Textos

| Token CSS | Valor Hex | Tailwind | Uso |
|-----------|-----------|----------|-----|
| `--text-primary` | `#09090b` | `text-[#09090b]` | Títulos y texto principal |
| `--text-secondary` | `#52525b` | `text-[#52525b]` | Subtítulos, descripciones |
| `--text-muted` | `#a1a1aa` | `text-[#a1a1aa]` | Placeholders, pies de página |

```tsx
// ✅ CORRECTO
<h1 className="text-2xl font-bold text-[#09090b]">Título</h1>
<p className="text-sm text-[#52525b]">Descripción</p>
<p className="text-xs text-[#a1a1aa]">Footer o hint</p>

// ❌ INCORRECTO
<h1 className="text-white font-black">Título</h1>
<p className="text-zinc-400">Descripción</p>
<p className="text-amber-400 font-black">Precio</p>
```

### Bordes

| Token CSS | Valor Hex | Tailwind | Uso |
|-----------|-----------|----------|-----|
| `--border` | `#e4e4e7` | `border-[#e4e4e7]` | Borde estándar de cards e inputs |
| `--border-strong` | `#d4d4d8` | `border-[#d4d4d8]` | Borde en estado hover/focus |

### Color de Marca (Acento)

| Token CSS | Valor Hex | Tailwind | Uso |
|-----------|-----------|----------|-----|
| `--brand-red` | `#dc2626` | `bg-[#dc2626]` / `text-[#dc2626]` | Botones primarios, links activos |
| `--brand-red-dark` | `#b91c1c` | `bg-[#b91c1c]` | Hover de botones primarios |

> ⚠️ El amarillo/ámbar (`#fbbf24`, `text-amber-*`) NO es un color de la plataforma. Es el color secundario del **tenant** (negocio), solo se usa en páginas donde el tenant activa su propio branding. En la interfaz de la plataforma (dashboard, login, admin), nunca se usa el ámbar.

---

## 2. Cards y Contenedores

### Card Estándar (`.card-clean`)

```tsx
// Clase global definida en globals.css
<div className="card-clean p-6">...</div>

// Equivalente manual
<div className="bg-white border border-[#e4e4e7] rounded-2xl shadow-sm p-6">...</div>
```

### Card con más sombra

```tsx
<div className="bg-white rounded-2xl shadow-[0_2px_20px_rgba(0,0,0,0.07)] border border-[#f0f0f0] p-8">
```

### Modal / Overlay

```tsx
// Overlay de fondo
<div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
  // Card del modal
  <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 border border-[#e4e4e7] animate-fadeIn">
```

### Sección de alerta / aviso

```tsx
// Aviso de info (ámbar) — SOLO para avisos de negocio, no como estilo base
<div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
  <p className="text-xs font-bold uppercase tracking-widest text-amber-600">⚠️ Aviso</p>

// Aviso de error
<div className="bg-red-50 border border-red-100 rounded-xl p-3">
  <p className="text-sm text-red-600 font-medium">Error</p>

// Aviso de éxito
<div className="bg-green-50 border border-green-100 rounded-xl p-3">
  <p className="text-sm text-green-600 font-medium">Éxito</p>
```

---

## 3. Botones

### Botón Primario (`.btn-primary`)

El botón de acción principal. **Siempre rojo**, letras blancas.

```tsx
// Con clase global (PREFERIDO)
<button className="btn-primary w-full py-3.5 text-sm">
  Iniciar Sesión
</button>

// Manual equivalente
<button className="bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold text-sm
                   rounded-xl px-6 py-3 transition-all
                   shadow-[0_1px_3px_rgba(220,38,38,0.3)]
                   hover:shadow-[0_4px_20px_rgba(220,38,38,0.35)]
                   hover:-translate-y-px active:scale-[0.98]">
  Acción Principal
</button>
```

### Botón Secundario / Outline

```tsx
<button className="border border-[#e4e4e7] rounded-xl py-2.5 px-4 text-sm
                   font-semibold text-[#52525b] hover:bg-[#fafafa] transition-colors">
  Cancelar
</button>
```

### Botón Ghost (solo texto)

```tsx
<button className="text-[#52525b] hover:text-[#09090b] text-sm font-medium transition-colors">
  ← Volver
</button>
```

### Botón de Peligro / Destructivo

```tsx
<button className="bg-red-50 border border-red-100 text-red-600 hover:bg-red-100
                   font-semibold text-sm rounded-xl px-4 py-2 transition-colors">
  Eliminar
</button>
```

### Botón de Éxito (WhatsApp, Confirmar)

```tsx
<button className="bg-green-600 hover:bg-green-700 text-white font-bold
                   py-3 px-6 rounded-xl text-sm transition-all">
  📱 Confirmar por WhatsApp
</button>
```

> ⚠️ **NUNCA** usar `bg-gradient-to-r from-red-700 to-red-900` ni `bg-gradient-to-r from-amber-600 to-amber-800` como botones de la plataforma. Los gradientes oscuros pertenecen al estilo del menú que queremos corregir.

---

## 4. Inputs y Formularios

### Input estándar (`.input-clean`)

```tsx
// Con clase global (PREFERIDO)
<input className="input-clean" placeholder="..." />

// Manual equivalente
<input className="w-full bg-[#fafafa] border-[1.5px] border-[#e4e4e7] rounded-xl
                  px-4 py-3 text-[15px] text-[#09090b] placeholder-[#a1a1aa]
                  focus:outline-none focus:border-[#dc2626] focus:bg-white
                  focus:shadow-[0_0_0_3px_rgba(220,38,38,0.1)]
                  transition-all" />
```

### Label de campo

```tsx
<label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide mb-1.5">
  Nombre completo
</label>
```

### Estado de error en input

```tsx
<input className="input-clean border-red-300 bg-red-50" />
```

---

## 5. Navegación y Tabs

### Nav Tabs (`.nav-tab`)

Barra de pestañas con línea inferior animada en rojo.

```tsx
<div className="flex border-b border-[#e4e4e7]">
  <button className="nav-tab flex-1 pb-3 pt-1 text-sm active">
    Pestaña Activa
  </button>
  <button className="nav-tab flex-1 pb-3 pt-1 text-sm">
    Pestaña Inactiva
  </button>
</div>
```

### Tab Bar Superior (versión ícono + texto)

Para páginas B2C como el menú o el portal de cliente, la barra de tabs sigue siendo **light**:

```tsx
// ✅ CORRECTO — Tab bar sobre fondo claro
<div className="border-b border-[#e4e4e7] bg-white sticky top-0 z-20">
  <div className="flex justify-around items-center max-w-lg mx-auto">
    {tabs.map(tab => {
      const activo = tabActiva === tab.id
      return (
        <button
          key={tab.id}
          className={`flex-1 py-4 flex flex-col items-center gap-1 transition-all relative ${
            activo
              ? 'text-[#dc2626] font-black'
              : 'text-[#a1a1aa] hover:text-[#52525b] font-bold'
          }`}
        >
          <span className="text-xl">{tab.icon}</span>
          <span className="text-[10px] uppercase tracking-wider">{tab.label}</span>
          {activo && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#dc2626]" />
          )}
        </button>
      )
    })}
  </div>
</div>

// ❌ INCORRECTO — Tab bar oscura
<div className="border-b border-zinc-800 bg-black/60 sticky top-0 z-20 backdrop-blur-md">
```

### Tabs de categorías / filtros (pills horizontales)

```tsx
<div className="flex gap-2 overflow-x-auto py-3">
  <button className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider
                     bg-[#dc2626] text-white shadow-sm">
    Categoría Activa
  </button>
  <button className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider
                     text-[#a1a1aa] hover:text-[#52525b] transition-colors">
    Otra Categoría
  </button>
</div>
```

---

## 6. Badges y Chips de Estado

```tsx
// Badge verde — activo / disponible
<span className="badge bg-green-50 text-green-700 border border-green-200">
  Activo
</span>

// Badge rojo — error / inactivo
<span className="badge bg-red-50 text-red-600 border border-red-100">
  Suspendido
</span>

// Badge ámbar — advertencia / pendiente
<span className="badge bg-amber-50 text-amber-700 border border-amber-200">
  Pendiente
</span>

// Badge gris — neutro
<span className="badge bg-[#f4f4f5] text-[#52525b] border border-[#e4e4e7]">
  Inactivo
</span>
```

---

## 7. Tablas

```tsx
// Header de tabla
<thead>
  <tr className="table-header">
    <th className="px-4 py-3 text-left">Columna</th>
  </tr>
</thead>

// Fila de tabla
<tbody>
  <tr className="table-row">
    <td className="px-4 py-3 text-sm text-[#09090b]">Valor</td>
  </tr>
</tbody>
```

---

## 8. Cards de Producto / Lista (Estilo Menú Correcto)

Así es como deben verse los items del menú, adaptados al estilo light de la plataforma:

```tsx
// ✅ CORRECTO — Card de producto light
<div className="bg-white border border-[#e4e4e7] rounded-2xl p-4 flex gap-4
                hover:border-[#d4d4d8] hover:shadow-md transition-all">
  <div className="flex-1">
    <h3 className="font-bold text-[#09090b] text-sm">{product.nombre}</h3>
    <p className="text-[#71717a] text-xs mt-1 line-clamp-2">{product.descripcion}</p>
    <p className="text-[#dc2626] font-black text-sm mt-2">
      ${product.precio.toLocaleString()} MXN
    </p>
  </div>
  {product.imagen_url && (
    <img src={product.imagen_url} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
  )}
  <div className="flex flex-col items-center justify-center gap-2">
    <button className="w-8 h-8 rounded-lg bg-[#dc2626] text-white font-bold text-lg
                       flex items-center justify-center hover:bg-[#b91c1c]
                       transition-all active:scale-95 shadow-sm">
      +
    </button>
  </div>
</div>

// ❌ INCORRECTO — Card de producto dark
<div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 flex gap-4">
  <p className="text-amber-400 font-black text-sm">${product.precio}</p>
```

---

## 9. Pantallas de Carga y Estados Vacíos

### Spinner / Loading

```tsx
// ✅ CORRECTO — Loading en fondo light
<div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
  <div className="w-10 h-10 border-2 border-[#e4e4e7] border-t-[#dc2626]
                  rounded-full animate-spin" />
</div>

// ❌ INCORRECTO — Loading en fondo oscuro
<div className="min-h-screen bg-[#050505] flex items-center justify-center">
  <div className="w-10 h-10 border-2 border-zinc-800 border-t-amber-500 rounded-full animate-spin" />
</div>
```

### Estado vacío

```tsx
<div className="text-center py-16">
  <p className="text-5xl mb-4">🍽️</p>
  <p className="font-bold text-[#09090b]">Título del estado vacío</p>
  <p className="text-sm text-[#a1a1aa] mt-1">Descripción explicativa</p>
</div>
```

---

## 10. Pantallas Especiales (Confirmado, Error, VIP)

### Pantalla de confirmación / éxito

```tsx
// ✅ CORRECTO
<div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-6">
  <div className="text-center max-w-sm w-full">
    <div className="w-24 h-24 bg-green-50 border border-green-200 rounded-full
                    flex items-center justify-center mx-auto mb-6">
      <span className="text-5xl">✅</span>
    </div>
    <h1 className="text-3xl font-black text-[#09090b] mb-2">¡Pedido Recibido!</h1>
    <p className="text-[#52525b] mb-6 leading-relaxed">Descripción...</p>
  </div>
</div>
```

### Pantalla de invitación VIP / Club

```tsx
// ✅ CORRECTO — VIP invite en light
<div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-6">
  <div className="max-w-sm w-full">
    <div className="text-center mb-8">
      <div className="w-20 h-20 bg-red-50 border-2 border-[#dc2626]/20 rounded-2xl
                      flex items-center justify-center mx-auto mb-4">
        <span className="text-4xl">⭐</span>
      </div>
      <h2 className="text-2xl font-black text-[#09090b] mb-2">
        ¿Quieres unirte al Club VIP?
      </h2>
      <p className="text-[#52525b] text-sm leading-relaxed">
        Gana tu <strong className="text-[#dc2626]">primer sello GRATIS</strong>
      </p>
    </div>
  </div>
</div>
```

---

## 11. Banner del Negocio (Header de Tenant)

```tsx
// ✅ CORRECTO — Header light con overlay suave
<div className="relative h-48 bg-gradient-to-b from-[#fafafa] to-white border-b border-[#e4e4e7]">
  {business.banner_url && (
    <img src={business.banner_url} className="absolute inset-0 w-full h-full object-cover opacity-10" />
  )}
  <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end gap-4">
    <div className="w-16 h-16 bg-white rounded-2xl border border-[#e4e4e7] shadow-md
                    flex items-center justify-center overflow-hidden">
      {/* Logo del negocio */}
    </div>
    <div>
      <h1 className="text-2xl font-black text-[#09090b]">{business.nombre}</h1>
      <div className="flex items-center gap-2 mt-1">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-xs text-[#52525b] font-bold uppercase">Abierto</span>
      </div>
    </div>
  </div>
</div>

// ❌ INCORRECTO — Header oscuro
<div className="relative h-48 bg-gradient-to-b from-red-950/40 to-[#050505]">
  <div className="w-16 h-16 bg-zinc-800 border border-amber-500/20 ...">
```

---

## 12. Tipografía y Espaciado

### Jerarquía de textos

```tsx
// Título de página principal
<h1 className="text-2xl font-bold text-[#09090b] tracking-tight">

// Título de sección
<h2 className="text-xl font-black text-[#09090b]">

// Subtítulo / label de sección
<p className="text-xs font-bold uppercase tracking-widest text-[#a1a1aa]">

// Texto de cuerpo
<p className="text-sm text-[#52525b] leading-relaxed">

// Texto de hint / pie de página
<p className="text-xs text-[#a1a1aa]">

// Monoespaciado (precios, códigos)
<span className="font-mono font-bold text-[#09090b]">$100 MXN</span>

// Precio / cifra importante — en rojo
<span className="text-[#dc2626] font-black text-sm">$100 MXN</span>
```

### Layout de página

```tsx
// Página principal (mobile-first, centrada)
<main className="min-h-screen bg-[#fafafa] font-sans">
  <div className="max-w-lg mx-auto px-4 py-6 space-y-6 pb-32">
    {/* contenido */}
  </div>
</main>
```

---

## 13. Animaciones Disponibles

```tsx
// Fade in desde abajo (0.2s) — para cards y modales
<div className="animate-fadeIn">

// Slide up (0.3s) — para paneles que suben
<div className="animate-slideUp">

// Spinner — para estados de carga
<div className="animate-spin">

// Pulse — para alertas y estados que llaman la atención
<div className="animate-pulse">
```

---

## 14. Resumen Visual Rápido (Cheat Sheet)

| Elemento | ✅ Correcto | ❌ Incorrecto |
|----------|-----------|--------------|
| Fondo de página | `bg-[#fafafa]` o `bg-white` | `bg-[#050505]` / `bg-zinc-900` |
| Texto principal | `text-[#09090b]` | `text-white` / `text-zinc-100` |
| Texto secundario | `text-[#52525b]` | `text-zinc-400` |
| Precio / cifra | `text-[#dc2626] font-black` | `text-amber-400 font-black` |
| Botón primario | `btn-primary` (rojo #dc2626) | `bg-gradient-to-r from-red-700 to-red-900` |
| Botón VIP/Especial | `bg-[#dc2626]` | `bg-gradient-to-r from-amber-600 to-amber-800` |
| Card | `bg-white border border-[#e4e4e7] rounded-2xl` | `bg-zinc-900/80 border border-zinc-800` |
| Input | `input-clean` | `bg-zinc-900 border border-zinc-700 text-white` |
| Tab activo | `text-[#dc2626]` + línea roja | `text-amber-500` + glow ámbar |
| Tab inactivo | `text-[#a1a1aa]` | `text-zinc-500` |
| Spinner | `border-t-[#dc2626]` en fondo `#fafafa` | `border-t-amber-500` en fondo `#050505` |
| Borde | `border-[#e4e4e7]` | `border-zinc-800` / `border-zinc-700` |
| Overlay de modal | `bg-black/40 backdrop-blur-sm` | `bg-zinc-950` |

---

*Última actualización: Mayo 2026 — LoyaltyClub v12 Enterprise*
*Extraído del Dashboard (`/tenant/[slug]/dashboard/page.tsx`) y Login (`/tenant/[slug]/login/page.tsx`) que son la referencia visual oficial de la plataforma.*
