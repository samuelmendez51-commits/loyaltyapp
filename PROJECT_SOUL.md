# 🧠 PROJECT SOUL — LoyaltyClub
> **Este archivo es la fuente de verdad del proyecto.**
> Antes de hacer cualquier cambio, el agente DEBE leer este archivo y verificar que no viola ninguna de las reglas aquí definidas.

---

## 1. ¿Qué es este proyecto?

**LoyaltyClub** es una plataforma SaaS multi-tenant de programas de fidelidad para restaurantes y negocios de alimentos. Cada negocio tiene su propio subdominio (`laburreria.loyaltyclub.mx`) con branding dinámico, portal de clientes, panel de administración y sistema de sellos/puntos.

- **Dominio de producción:** `loyaltyclub.mx`
- **Dominio de desarrollo:** `*.localhost:3000`
- **Tenant demo:** `laburreria` (La Burrería)
- **Deploy:** Vercel

---

## 2. Stack Tecnológico — REGLAS ABSOLUTAS

| Capa | Tecnología | Versión | Notas |
|------|-----------|---------|-------|
| Framework | **Next.js** | `16.2.6` | App Router — NO Pages Router |
| Runtime | **React** | `19.2.4` | Server Components por defecto |
| Lenguaje | **TypeScript** | `^5` | Strict mode. `ignoreBuildErrors: true` solo en prod |
| Estilos | **TailwindCSS v4** | `^4` | Con `@tailwindcss/postcss` |
| Base de datos | **Supabase** | `^2.106.0` | PostgreSQL. NO Prisma, NO Drizzle |
| Auth | **Cookies de sesión custom** | — | NO Supabase Auth, NO NextAuth |
| Fuente | **Inter** | Google Fonts | Variable `--font-inter`. Única fuente permitida |
| Iconos | **lucide-react** | `^1.16.0` | NO heroicons, NO FontAwesome |
| Charts | **recharts** | `^3.8.1` | Para métricas del dashboard |
| QR | **html5-qrcode** + **qrcode.react** | — | Escáner y generación de QR |

> ⚠️ **NUNCA** instalar nuevas dependencias sin autorización explícita del dueño del proyecto.

---

## 3. Arquitectura Multi-Tenant

### Modelo de Subdominio

```
loyaltyclub.mx          → Dominio raíz (superadmin + login global)
www.loyaltyclub.mx      → Igual que raíz
laburreria.loyaltyclub.mx → Portal del tenant "laburreria"
otronegocio.loyaltyclub.mx → Portal del tenant "otronegocio"
```

### Rutas Internas (Next.js App Router)

El middleware reescribe rutas externas a rutas internas del tenant:

| URL Externa (usuario ve) | Ruta Interna (Next.js sirve) |
|--------------------------|------------------------------|
| `laburreria.loyaltyclub.mx/` | `/tenant/laburreria` |
| `laburreria.loyaltyclub.mx/login` | `/tenant/laburreria/login` |
| `laburreria.loyaltyclub.mx/dashboard` | `/tenant/laburreria/dashboard` |
| `laburreria.loyaltyclub.mx/escaner` | `/tenant/laburreria/escaner` |
| `laburreria.loyaltyclub.mx/ajustes` | `/tenant/laburreria/ajustes` |
| `laburreria.loyaltyclub.mx/registro` | `/tenant/laburreria/registro` |
| `laburreria.loyaltyclub.mx/cliente/[id]` | `/tenant/laburreria/cliente/[id]` |
| `laburreria.loyaltyclub.mx/menu` | `/tenant/laburreria/menu` |
| `loyaltyclub.mx/superadmin` | `/superadmin` (dominio raíz) |

> ⚠️ **REGLA CRÍTICA:** NUNCA crear rutas en `/app/dashboard`, `/app/login`, `/app/escaner` directamente. Todas las páginas de tenant viven en `/app/tenant/[slug]/`. El middleware se encarga del mapeo.

---

## 4. Sistema de Autenticación

### Cookies de Sesión (NO JWT en frontend, NO Supabase Auth)

La sesión se maneja con cookies HTTP. Las cookies de sesión son:

| Cookie | Descripción |
|--------|-------------|
| `session_rol` | Rol del usuario: `superadmin`, `admin_comercio`, `empleado`, `cajero` |
| `session_user` | Nombre del usuario |
| `session_user_id` | UUID del usuario en `business_users` |
| `session_business_id` | UUID del negocio |
| `session_business_slug` | Slug del negocio (ej: `laburreria`) |
| `session_branch_id` | UUID de la sucursal (opcional) |

### Roles y Permisos

| Rol | Acceso | Descripción |
|-----|--------|-------------|
| `superadmin` | Panel `/superadmin` en dominio raíz | Dueño del SaaS. Gestiona todos los tenants |
| `admin_comercio` | `/dashboard`, `/ajustes` del tenant | Dueño del negocio |
| `empleado` / `cajero` | Solo `/escaner` | Terminal de escaneo QR |

### Flujo de Login
1. El usuario ingresa **email + PIN** (NO contraseña clásica)
2. Se valida contra `business_users` (para admin/empleado) o `superadmins` (para superadmin)
3. Se setean las cookies de sesión
4. El middleware redirige según el rol

> ⚠️ **REGLA:** Los PINs son texto plano en la BD (sin hash). No cambiar este comportamiento sin autorización.

---

## 5. Base de Datos (Supabase / PostgreSQL)

### Tablas Principales

| Tabla | Descripción |
|-------|-------------|
| `superadmins` | Administradores raíz del SaaS |
| `businesses` | Tenants (negocios). El slug es la clave de multi-tenancy |
| `branches` | Sucursales de un negocio |
| `business_users` | Empleados y admins de cada negocio |
| `clientes` | Socios VIP (clientes finales del negocio) |
| `historial_puntos` | Auditoría de movimientos de puntos/sellos |
| `loyalty_rewards` | Premios del programa clásico de sellos |
| `reward_milestones` | Hitos de la ruleta gamificada |
| `milestone_prizes` | Pool de premios por hito de ruleta |
| `roulette_spins` | Log de giros de ruleta + cupones generados |
| `credit_transactions` | Ledger de créditos SaaS (facturación) |
| `menu_groups` | Categorías del menú digital |
| `menu_products` | Productos del menú |
| `product_modifiers` | Modificadores de producto |
| `modifier_options` | Opciones de modificadores |
| `orders` | Pedidos + control de sellos |
| `tracking_events` | Auditoría global de eventos |
| `audit_logs` | Log de acciones críticas |
| `business_schedules` | Horarios detallados por día |

### Acceso a Supabase
- **Cliente:** `src/lib/supabase.ts` → `import { supabase } from '@/lib/supabase'`
- **Helper de Tenant:** `src/lib/tenant.ts` → `getTenantBySlug()`, `getTenantOrNull()`, `buildTenantUrl()`
- **RLS:** Desactivado en desarrollo. En producción, verificar antes de activar.
- **Schema actual:** `complete_schema_v12.sql` + `migration_v14_tabs_geopush.sql` + `migration_v15_previewer_min_ruleta.sql`

### Reglas de la BD
- ✅ Siempre filtrar por `business_id` en queries de tenant (aislamiento multi-tenant)
- ✅ Usar `.maybeSingle()` en vez de `.single()` cuando el registro puede no existir
- ✅ Usar `React.cache()` para deduplicar queries en Server Components
- ❌ NUNCA hacer queries sin filtro de `business_id` en tablas de tenant
- ❌ NUNCA modificar el schema sin crear un archivo de migración versionado

---

## 6. Estructura de Archivos

```
loyaltyapp/
├── src/
│   ├── app/
│   │   ├── layout.tsx              ← Root layout (Inter font, PWA meta)
│   │   ├── globals.css             ← Design system tokens + clases globales
│   │   ├── page.tsx                ← Landing pública (dominio raíz)
│   │   ├── login/                  ← Login global (superadmin)
│   │   ├── superadmin/             ← Panel super admin (dominio raíz)
│   │   ├── dashboard/              ← Redirect helper (dominio raíz)
│   │   ├── registro/               ← Registro global (redirect)
│   │   ├── suspended/              ← Página de suspensión pública
│   │   ├── google-wallet-simulacion/ ← Debug de wallet
│   │   ├── api/
│   │   │   ├── orders/route.ts     ← API de pedidos
│   │   │   └── wallet/
│   │   │       ├── apple/          ← Apple Wallet (.pkpass)
│   │   │       └── google/         ← Google Wallet (JWT)
│   │   └── tenant/[slug]/          ← ⭐ CORE: Todo el multi-tenant aquí
│   │       ├── layout.tsx          ← Valida tenant, genera metadata SEO
│   │       ├── page.tsx            ← Portal público del tenant
│   │       ├── login/              ← Login con branding del tenant
│   │       ├── registro/           ← Alta de clientes finales
│   │       ├── cliente/[id]/       ← Tarjeta VIP del cliente
│   │       ├── escaner/            ← Terminal QR (empleados)
│   │       ├── dashboard/          ← Panel admin del tenant
│   │       │   ├── page.tsx        ← Dashboard principal (monolítico ~164KB)
│   │       │   ├── vip/            ← Gestión de clientes VIP
│   │       │   ├── gamification/   ← Config de ruleta y premios
│   │       │   ├── mapa/           ← Geocerca y mapa
│   │       │   └── metrics/        ← Métricas y reportes
│   │       ├── ajustes/            ← Configuración del negocio
│   │       └── menu/               ← Menú digital público
│   └── lib/
│       ├── supabase.ts             ← Cliente Supabase
│       ├── tenant.ts               ← Helpers de tenant
│       └── auth.ts                 ← Helpers de autenticación
├── middleware.ts                   ← 🔑 Routing multi-tenant (NO TOCAR sin entender bien)
├── next.config.ts                  ← Config Next.js (ignoreBuildErrors, PWA headers)
├── tailwind.config.ts              ← Config Tailwind v4
└── public/                         ← Assets estáticos, service-worker, manifest
```

---

## 7. Design System — REGLAS DE UI

### Paleta de Colores (Clean Light)

```css
--brand-red: #dc2626           /* Color primario de la plataforma */
--brand-red-dark: #b91c1c      /* Hover del primario */
--brand-accent: #ef4444        /* Acento */
--bg-canvas: #ffffff           /* Fondo principal */
--bg-muted: #fafafa            /* Fondo de secciones secundarias */
--bg-subtle: #f4f4f5           /* Fondo sutil */
--surface: #ffffff             /* Superficie de cards */
--border: #e4e4e7              /* Borde estándar */
--border-strong: #d4d4d8       /* Borde fuerte */
--text-primary: #09090b        /* Texto principal */
--text-secondary: #52525b      /* Texto secundario */
--text-muted: #a1a1aa          /* Texto atenuado */
```

> ⚠️ **CADA TENANT** tiene su propio `color_primario` y `color_secundario` en la BD.
> El branding dinámico se aplica con `style={{ color: tenant.color_primario }}` o CSS variables inline.
> El rojo `#dc2626` es el color base de la **plataforma**, no necesariamente del tenant.

### Clases CSS Globales (usar siempre estas, NO inventar nuevas)

| Clase | Uso |
|-------|-----|
| `.btn-primary` | Botón principal (rojo, con hover y shadow) |
| `.card-clean` | Card con borde y sombra ligera |
| `.card-glass` | Card con estilo glassmorphism (legacy) |
| `.input-clean` | Input con focus ring rojo |
| `.table-header` | Cabecera de tabla |
| `.table-row` | Fila de tabla con hover |
| `.badge` | Chip/tag de estado |
| `.nav-tab` | Tab de navegación con underline animado |
| `.animate-fadeIn` | Fade in desde abajo (0.2s) |
| `.animate-slideUp` | Slide up (0.3s) |

### Tipografía
- **Fuente única:** `Inter` (Google Fonts)
- **Variable CSS:** `--font-inter`
- **Headings:** `font-weight: 700`, `letter-spacing: -0.02em`
- **Body:** `font-size: 15px` (0.9375rem)

### Border Radius
```css
--radius-sm: 8px
--radius: 12px
--radius-lg: 16px
--radius-xl: 20px
--radius-2xl: 28px
```

### Sombras
```css
--shadow-sm: 0 1px 3px rgba(0,0,0,0.06)
--shadow-md: 0 4px 16px rgba(0,0,0,0.08)
--shadow-lg: 0 10px 40px rgba(0,0,0,0.10)
--shadow-xl: 0 20px 60px rgba(0,0,0,0.12)
```

---

## 8. Funcionalidades del Sistema

### Motor 1: Programa de Sellos Clásico
- `max_sellos` sellos por tarjeta (por defecto 10)
- Monto mínimo para sello: `monto_minimo_sello` (por defecto $100 MXN)
- Premios intermedios y finales en `loyalty_rewards`
- Sellos se otorgan mediante escaneo QR en escáner

### Motor 2: Ruleta Gamificada (V12)
- Hitos configurables en `reward_milestones`
- Pool de premios con probabilidades en `milestone_prizes` (tiers: `base`, `medio`, `grande`)
- Log de giros y cupones únicos en `roulette_spins`
- Animación CSS con `@keyframes spinRuleta`

### Motor 3: Menú Digital
- Grupos/categorías en `menu_groups`
- Productos en `menu_products` con modificadores
- Tipos de menú: `mesa`, `delivery`, `ambos`
- Switch de upsell por producto (`es_upsell`)

### Motor 4: Pedidos y Control de Sellos
- Pedidos en `orders` (tipos: `mesa`, `delivery`, `mostrador`)
- Flujo de aprobación de sellos: pendiente → aprobado/rechazado
- Canal de origen: `whatsapp`, `qr`, `mostrador`

### Motor 5: Anti-Churn
- Función SQL `get_churn_candidates()` detecta inactivos (>21 días por defecto)
- Mensaje de rescate configurable por WhatsApp

### Motor 6: Anti-Fraude
- Función SQL `detectar_fraude_velocidad()` detecta escaneos sospechosos
- Campo `bandera_roja` en clientes
- Auditoría completa en `audit_logs` y `tracking_events`

### PWA + Wallets Digitales
- **Apple Wallet:** `.pkpass` generado con `passkit-generator`
- **Google Wallet:** JWT con `jose` + `google-auth-library`
- **PWA:** Service Worker + manifest.json + offline support
- Certificados Apple en raíz del proyecto (`*.pem`, `*.cer`, `*.key`)

### SuperAdmin
- Panel en `/superadmin` (solo dominio raíz)
- Gestión de todos los tenants: crear, suspender, renovar, cargar créditos
- Impersonación de tenant para soporte
- Logs de auditoría global

---

## 9. Reglas de Desarrollo — OBLIGATORIO CUMPLIR

### Código
1. **TypeScript siempre.** No crear archivos `.js` en `src/`. Solo `.ts` o `.tsx`.
2. **Server Components por defecto.** Solo usar `'use client'` cuando es estrictamente necesario (interactividad, hooks de estado/efecto, APIs del browser).
3. **Params asíncronos.** En Next.js 16+, los `params` de page/layout son `Promise<{}>`. Siempre usar `await params`.
   ```tsx
   // ✅ CORRECTO
   export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
     const { slug } = await params
   }
   // ❌ INCORRECTO
   export default function Page({ params }: { params: { slug: string } }) {
     const { slug } = params // Error en Next.js 16
   }
   ```
4. **No hardcodear business_id.** Siempre obtenerlo desde las cookies de sesión o desde el slug del tenant.
5. **Imports con alias `@/`** siempre. No usar rutas relativas `../../`.
6. **No modificar `middleware.ts`** sin entender completamente el flujo de routing multi-tenant.

### Base de Datos
7. **Aislamiento multi-tenant:** Todo query a tablas de tenant DEBE incluir `WHERE business_id = ?`.
8. **No borrar migraciones.** Solo agregar nuevas. El historial de `migration_v*.sql` es sagrado.
9. **Nombres en español.** Los campos de la BD están en español (excepto `id`, `slug`, `email`, etc.). Respetar la convención.

### Estilos
10. **Tailwind v4.** No usar clases de Tailwind v3 que no existan en v4. En caso de duda, usar CSS inline o clases de `globals.css`.
11. **Branding dinámico:** Usar `tenant.color_primario` para el color de acento de cada tenant. NO hardcodear `#dc2626` como color de tenant.
12. **Modo oscuro:** El sistema es **light-only**. No implementar dark mode salvo autorización.
13. **Mobile-first:** Todos los layouts deben funcionar en móvil (320px+). Los clientes finales usan el portal en su teléfono.

### Seguridad
14. **Verificar rol en cada API route** protegida. Leer la cookie `session_rol` en el servidor.
15. **No exponer datos de otros tenants.** Validar siempre el `session_business_slug` vs el slug de la ruta.
16. **Los certificados Apple** (`*.pem`, `*.cer`, `*.key`) son secretos. No commitear nuevos certificados.

---

## 10. Variables de Entorno (.env.local)

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima de Supabase |
| `GOOGLE_SERVICE_ACCOUNT_*` | Credenciales para Google Wallet |
| `APPLE_PASS_*` | Configuración de Apple Wallet |

> ⚠️ NUNCA commitear `.env.local`. Está en `.gitignore`.

---

## 11. Comandos de Desarrollo

```bash
# Desarrollo local
npm run dev

# Build de producción (solo cuando se solicite)
npm run build

# Lint
npm run lint
```

> **Desarrollo local multi-tenant:** Para probar subdominos en local, editar el archivo `hosts`:
> ```
> 127.0.0.1  laburreria.localhost
> ```
> Luego acceder a `http://laburreria.localhost:3000`

---

## 12. Notas Importantes del Proyecto

- **La Burrería** (`laburreria`) es el negocio real del dueño del proyecto. Es el tenant principal de prueba/producción.
- El proyecto está desplegado en **Vercel** con dominio personalizado `loyaltyclub.mx`.
- El dashboard del tenant (`/tenant/[slug]/dashboard/page.tsx`) es un archivo monolítico de ~164KB. Se está planificando su refactor en componentes.
- Los archivos de migración SQL en la raíz representan el historial de cambios de schema. El más reciente es `migration_v15_previewer_min_ruleta.sql`.
- `typescript.ignoreBuildErrors: true` está activado en `next.config.ts` para no bloquear deploys. Aun así, escribir TypeScript correcto siempre.

---

## 13. Checklist antes de cada cambio

Antes de implementar cualquier modificación, verificar:

- [ ] ¿El cambio viola alguna regla de esta sección 9?
- [ ] ¿Estoy usando `await params` si es una page/layout con params dinámicos?
- [ ] ¿Los queries de Supabase filtran por `business_id`?
- [ ] ¿Las nuevas rutas de tenant van dentro de `/tenant/[slug]/`?
- [ ] ¿El diseño es mobile-first?
- [ ] ¿Estoy usando las clases CSS globales en vez de inventar nuevas?
- [ ] ¿El branding usa `tenant.color_primario` para el color del tenant?
- [ ] ¿Las APIs protegidas validan el rol de sesión?
- [ ] ¿El TypeScript es correcto (tipos bien definidos, sin `any` innecesarios)?
- [ ] ¿Los imports usan alias `@/` en vez de rutas relativas?

---

*Última actualización: Mayo 2026 — LoyaltyClub v12 Enterprise*
