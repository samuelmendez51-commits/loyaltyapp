# PROJECT SOUL — LoyaltyClub / Urban Delivery Platform
> **Fuente de Verdad Técnica y Arquitectónica.** Este documento define la lógica de negocio,
> la arquitectura del sistema y las decisiones de diseño clave para prevenir regresiones y alucinaciones.
> Última actualización: Junio 2026.

---

## 1. Propósito del Producto

**LoyaltyClub** es una plataforma multi-tenant SaaS que ofrece dos módulos principales:

1. **Fidelización** — Tarjetas de sellos digitales VIP, ruleta de premios gamificada y gestión de clientes para negocios locales.
2. **Urban Delivery** — Sistema logístico de reparto en tiempo real con dashboard para restaurantes, portal para bikers y panel para el modulador (operador central).

---

## 2. Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js (App Router) — leer `node_modules/next/dist/docs/` antes de usar APIs |
| Base de datos | Supabase (PostgreSQL + Realtime + RLS) |
| Auth | Supabase Auth para clientes finales; cookies propias para bikers y modulador |
| Estilos | Tailwind CSS + `globals.css` con tokens custom |
| Iconos | `lucide-react` exclusivamente |
| Canvas | Web API nativa para el demo de ruleta |
| GPS | `navigator.geolocation.watchPosition` + Supabase Realtime Broadcast (sin writes a DB) |

---

## 3. Arquitectura Multi-Tenant

### Mapeo de Subdominios
```
[slug].loyaltyclub.mx            → Dashboard del restaurante (tenant)
[slug].loyaltyclub.mx/biker      → Portal móvil del repartidor
[slug].loyaltyclub.mx/modulador  → Panel del modulador / operador central
[slug].loyaltyclub.mx/registro   → Alta pública de aspirantes a biker
[slug].loyaltyclub.mx/cliente    → Tarjeta VIP del cliente final
```

### Slug especial: `bikers`
- El slug `bikers` está reservado para la flota de Urban Delivery.
- `bikers.loyaltyclub.mx/modulador` → Panel central del modulador.
- `bikers.loyaltyclub.mx/registro` → Formulario público de alta de aspirantes.

### Resolución de Tenant
El middleware de Next.js lee el subdominio y lo pasa como `params.slug` al App Router.
Cada página carga su `business` desde `supabase.from('businesses').eq('slug', slug)`.

---

## 4. Módulo de Fidelización

### Flujo de Sellos
1. Cliente escanea QR o ingresa su tarjeta VIP.
2. El escáner del negocio valida el cliente y agrega un sello.
3. Al alcanzar N sellos (configurable `max_stamps`) → se desbloquea la **Ruleta Final**.
4. Al alcanzar M sellos intermedios (configurable por `ruleta_config`) → se desbloquea la **Ruleta Intermedia**.

### Protección Anti-Fraude (Sellos)
- No se pueden agregar más sellos de los configurados (`max_stamps`).
- El monto mínimo de pedido (`monto_minimo_ruleta`) debe cumplirse para activar la ruleta.
- Si no se cumple, se muestra un candado dorado explicativo en la UI del cliente.

### Sistema de Ruleta Variable (Estado Actual — Junio 2026)

#### Ruleta Principal
- **Sectores**: De 1 a 10, configurables desde el Dashboard → Pestaña "Promociones (Ruleta)".
- **Estado**: `premiosPrincipal: string[]` + `numSectoresPrincipal: number`.
- **Helper `ajustarPremiosPrincipal(n)`**: Expande o trunca el array SIN perder valores ya escritos.
- **Peso/Probabilidad**: Repetir el mismo texto en múltiples sectores aumenta su probabilidad. Se muestra un badge `Repetido ×N` junto al label del sector.
- **Persistencia**: Columna `businesses.premios_ruleta` (tipo `text[]`, longitud variable).

#### Ruletas Intermedias
- Una por cada "rango de sellos" (ej: 3★, 5★, 7★).
- Cada una tiene su propio número de sectores independiente (1-10).
- **Estado**: `ruletaConfig: { [sello: string]: { activo: boolean, premios: string[] } }`.
- **Persistencia**: Columna `businesses.ruleta_config` (tipo `jsonb`).
- El formulario de nueva ruleta usa `numSectoresNuevo` + `nuevosPremios: string[]` con `ajustarNuevosPremios(n)`.

#### Demo Interactivo
- Componente `RuletaDemo` en `dashboard/page.tsx` (antes del export principal).
- Canvas 260×260px, animación `requestAnimationFrame`, easing quartic (`1 - (1-t)^4`).
- Se re-dibuja automáticamente al cambiar `premiosPrincipal`.

### Sistema de Geopush y Geocercas Inteligente
- **Frecuencia de Notificaciones**: Configurable en `configuracion_geopush.frecuencia_minutos` (0 para siempre, 60 para 1 hora, 240 para 4 horas, 720 para 12 horas, 1440 para 24 horas).
- **Filtro Anti-Vecinos**: Si `configuracion_geopush.evitar_molestar_vecinos` está activo, durante la registración del cliente (`/registro`), se verifica vía GPS si el cliente se encuentra dentro del radio perimetral de la geocerca. Si es así, se marca `clientes.es_vecino = true`.
- **Comportamiento en Apple Wallet**: Si el cliente es vecino y el filtro está activo, se omiten las coordenadas en el pass `.pkpass` para evitar que iOS lo notifique ininterrumpidamente en su domicilio. En caso contrario, se define `locations` con `latitude`, `longitude`, `relevantText` (mensaje push de la geocerca) y `maxDistance` igual al radio en metros de la geocerca.

---

## 5. Módulo Urban Delivery

### Actores del Sistema

| Actor | Portal | Auth |
|-------|--------|------|
| Restaurante | `[slug]/dashboard/` → pestaña "🛵 Solicitar Repartidor" | Supabase Auth (email) |
| Modulador | `bikers/modulador` | Email + PIN en `business_users` |
| Biker | `bikers/biker` | PIN de 4-6 dígitos en tabla `bikers` |
| Aspirante | `bikers/registro` | Sin auth, formulario público |

### Máquina de Estados: `delivery_requests.estado`

```
pendiente
    │
    ├── aceptado_flota   ← El modulador asigna manualmente (estado intermedio)
    │       │
    │       └── aceptado ← Un biker reclamó el viaje (RPC atómica)
    │               │
    │               ├── en_camino  ← Biker confirmó que recogió el pedido
    │               │       │
    │               │       └── completado ← Biker confirmó entrega
    │               │
    │               └── cancelado_biker ← Biker liberó el viaje (vuelve a pendiente)
    │
    └── cancelado_restaurante ← Restaurante cancela en cualquier momento
```

### RPC Atómica: `reclamar_viaje`
- Previene condiciones de carrera cuando múltiples bikers intentan tomar el mismo viaje.
- Recibe `p_request_id` y `p_biker_id`.
- Retorna `boolean`: `true` si el biker lo obtuvo, `false` si otro llegó primero.
- Implementada en PostgreSQL con `FOR UPDATE SKIP LOCKED`.

### RPC: `cancelar_viaje_biker`
- El biker libera el viaje con un motivo.
- El estado vuelve a `pendiente` para que otros bikers puedan tomarlo.

### GPS Broadcast (Efímero — Sin Writes)
- Canal Supabase Realtime: `fleet:{fleetId}:bikers`
- Evento: `biker_location` con payload `{ biker_id, lat, lng, accuracy, ts }`.
- Throttle: 12 segundos entre broadcasts para no saturar Supabase.
- **NO escribe en base de datos**. Solo el modulador (suscrito al canal) recibe los pings.

### Candado Anti-Fraude de Sesión Única (`current_session_id`)
1. Al hacer login el biker, se genera un `UUID` nuevo.
2. Se guarda en `bikers.current_session_id` (DB) y en cookie `biker_session_id` (browser).
3. Cada 20 segundos, `verificarBikerStatus()` compara la cookie con la DB.
4. Si no coinciden → la cookie se destruye, el biker es expulsado con alerta.
5. Garantiza que una cuenta no pueda estar activa en dos dispositivos simultáneamente.

### Monetización por Tiempo
- Campo `bikers.activo_hasta` (timestamp) — el biker puede operar hasta esta fecha.
- Campo `delivery_fleets.precio_credito` — precio en MXN de una recarga.
- Campo `delivery_fleets.tiempo_credito_dias` — días que otorga una recarga.
- Campo `delivery_fleets.dias_regalo_nuevo` — días de cortesía para nuevos bikers aprobados.
- Al aprobar un aspirante, se establece `activo_hasta = NOW() + dias_regalo_nuevo`.
- Al recargar, se suma `tiempo_credito_dias` a `activo_hasta` desde hoy (no desde vencimiento).

### Sistema de Alarmas del Modulador
Cuando llega una nueva `delivery_request` con estado `pendiente`:
1. **Audio** (Web Audio API): Se sintetiza un acorde D5 + A5 con `OscillatorNode` (sinusoidal, fade-out en 1.5s).
2. **Parpadeo de Título**: `setInterval` alterna `document.title` entre `🚨 (N) ¡Nueva Petición!` y el título base.
3. **Notificación HTML5**: `new Notification(...)` si el permiso fue concedido.
4. El parpadeo se detiene cuando el modulador vuelve al foco de la pestaña (`document.visibilitychange`).

---

## 6. Esquema de Base de Datos (Tablas Clave)

### `businesses`
```sql
premios_ruleta      text[]      -- Array variable de premios de ruleta (1-10 items)
ruleta_config       jsonb       -- { [sello]: { activo: bool, premios: string[] } }
monto_minimo_ruleta numeric     -- Mínimo de pedido para activar ruleta
reiniciar_sellos_ruleta bool    -- Reset automático a 0 tras girar
max_stamps          int         -- Máximo de sellos en la tarjeta
```

### `delivery_fleets`
```sql
business_id         uuid        -- FK a businesses (el negocio dueño de la flota)
nombre              text        -- Nombre de la flota
ciudad              text
activo              bool
precio_credito      numeric     -- MXN por recarga
tiempo_credito_dias int         -- Días que otorga cada recarga
dias_regalo_nuevo   int         -- Días gratis para nuevos bikers
```

### `bikers`
```sql
fleet_id            uuid        -- FK a delivery_fleets
nombre              text
telefono            text
pin                 text        -- 4-6 dígitos, sin hash (simplicidad operativa)
foto_url            text
rol                 text        -- 'biker' | 'admin_flota'
conectado           bool
estado_aprobacion   text        -- 'pendiente' | 'aprobado' | 'rechazado'
activo              bool
activo_hasta        timestamptz -- Monetización por tiempo
bloqueado_hasta     timestamptz -- Suspensión temporal
bloqueado_permanente bool
current_session_id  uuid        -- Candado de sesión única
ultimo_ping         timestamptz
```

### `delivery_requests`
```sql
fleet_id            uuid
restaurante_id      uuid        -- FK a businesses
biker_id            uuid        -- NULL hasta que alguien reclama el viaje
descripcion         text
direccion_entrega   text
lat_entrega         float8
lng_entrega         float8
nota_biker          text
estado              text        -- Ver máquina de estados arriba
tarifa_base         numeric
tarifa_extra        numeric
total_cobrado       numeric
aceptado_flota_at   timestamptz
aceptado_at         timestamptz
recogido_at         timestamptz
entregado_at        timestamptz
cancelado_at        timestamptz
motivo_cancelacion  text
```

### `business_users`
```sql
business_id         uuid        -- FK a businesses
email               text
pin                 text
rol                 text        -- 'admin_flota' | 'modulador'
```

---

## 7. Reglas de Desarrollo

1. **Leer primero los docs de Next.js** en `node_modules/next/dist/docs/` antes de usar cualquier API de Next — la versión puede diferir del training data.
2. **RLS activo en Supabase** — Todas las operaciones deben estar dentro del scope del tenant autenticado.
3. **No polling** — Usar Supabase Realtime (`postgres_changes` o `broadcast`) para actualizaciones en vivo.
4. **TypeScript estricto** — `npx tsc --noEmit` debe pasar sin errores ni warnings antes de cualquier commit.
5. **Modo oscuro prohibido** — Ver STYLE_GUIDE.md.
6. **Sin depuración en producción** — Eliminar `console.log` de depuración antes de merge (excepto `console.error`).
7. **GPS sin writes** — El hook `useGPSBroadcast` NUNCA escribe pings en la base de datos. Solo usa Realtime Broadcast.

---

## 8. Archivos Clave de Referencia

| Archivo | Propósito |
|---------|-----------|
| `src/app/tenant/[slug]/dashboard/page.tsx` | Dashboard principal del restaurante (~5300 líneas) |
| `src/app/tenant/[slug]/dashboard/DeliveryPanel.tsx` | Widget Solicitar Moto con Realtime |
| `src/app/tenant/[slug]/biker/page.tsx` | Portal móvil del repartidor |
| `src/app/tenant/[slug]/modulador/page.tsx` | Panel del modulador con alarmas |
| `src/lib/supabase.ts` | Cliente Supabase singleton |
| `STYLE_GUIDE.md` | Paleta, tipografía, componentes UI |
| `urban_delivery_schema.md` (artifacts) | Esquema detallado de BD para delivery |
