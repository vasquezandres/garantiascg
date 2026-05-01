# Frontend — Cloudflare Pages

Frontend del sistema de Garantías. Mobile-first, PWA instalable,
sin frameworks. Vanilla HTML/CSS/JS.

## Estructura

```
frontend-pages/
├── index.html                 ← Crear formulario (módulo interno)
├── firmar.html                ← Firma del cliente (público)
├── manifest.webmanifest       ← PWA manifest
├── service-worker.js          ← SW conservador (solo módulo interno)
├── icons/
│   ├── icon-32.png            ← favicon
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── icon-maskable-192.png  ← para Android (safe zone)
│   └── icon-maskable-512.png
├── assets/
│   ├── styles.css             ← Mobile-first
│   ├── api.js                 ← Cliente fetch (text/plain, evita CORS)
│   ├── config.js              ← API_URL aquí
│   ├── crear.js
│   └── firmar.js
├── _redirects                 ← Cloudflare rewrites (no usados; reservado)
└── README.md
```

## Configuración antes de desplegar

Edita `assets/config.js`:

```javascript
window.APP_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/TU_ID/exec',
  CLIENTE_ID: '',
  CLIENTE_NOMBRE: 'Garantías'
};
```

Ese es el único cambio obligatorio.

## Despliegue en Cloudflare Pages

1. Sube esta carpeta como raíz de un repo Git.
2. Cloudflare Pages → Connect to Git → selecciona el repo.
3. Build command: vacío. Output directory: `/`.
4. Custom domain: `garantias.tu-dominio.com`.

## Rutas

| URL | Sirve |
|---|---|
| `/` | `index.html` (módulo interno, instalable como PWA) |
| `/firmar?token=ABC` | `firmar.html` con `?token=ABC` (cliente externo) |

> Nota: en su momento se intentó usar `/f/TOKEN` con rewrite. Se
> descartó por inestabilidad. La URL definitiva es
> `/firmar?token=TOKEN`. El backend ya genera enlaces así cuando
> se configura `PUBLIC_FIRMA_BASE_URL` con la línea adecuada en
> `Codigo.gs` (ver README principal del proyecto).

## PWA

### Comportamiento

- **Instalable** desde Android (Chrome) y desktop (Edge/Chrome).
- **iOS**: instalable con "Añadir a pantalla de inicio". iOS no
  soporta el prompt de instalación automático, pero sí respeta
  el manifest.
- **Solo se registra el Service Worker en `index.html`** (módulo
  interno). La pantalla de firma `firmar.html` NO registra SW
  ni cachea — siempre va a la red para garantizar estado fresco.

### Qué cachea el Service Worker

Solo el "shell" del módulo interno:
- `/index.html`, `/`
- `/assets/styles.css`, `/assets/api.js`, `/assets/config.js`,
  `/assets/crear.js`
- Manifest e iconos

### Qué NUNCA cachea

- Llamadas a la API (`script.google.com`) — POST nunca se cachea
  y además el origen es externo
- `/firmar.html`, `/firmar` y `/assets/firmar.js`
- Recursos externos (Font Awesome CDN, etc.)

### Estrategia

**Network-first con fallback a cache.** Si hay red, siempre se sirve
la versión más reciente y se actualiza el cache. Si no hay red, se
sirve lo último que se cacheó.

### Versionado

Para forzar a todos los usuarios a refrescar tras un cambio de
diseño, sube `CACHE_VERSION` en `service-worker.js`:

```javascript
const CACHE_VERSION = 'garantias-v2';  // antes era v1
```

Al activarse el SW nuevo se borran los caches viejos.

## Compatibilidad con la API actual

El JS preserva exactamente los IDs y funciones que el backend
espera:

**Crear:** `proyecto, torre, apartamento, cliente, fecha, hora,
correo_responsable, correos_cc, observaciones, items, cliente_id`.

**Firmar:** `token, aprobados, nombre_firmante, correo_firmante,
firma_base64`.

**Funciones globales:** `addItem(value)`, `crearFormulario()`,
`copiarEnlace()`, `compartirWhatsApp()`, `compartirGeneral()`,
`firmar()`, `limpiar()`.

## Diseño — decisiones

- **Mobile-first.** Layout base optimizado para iPhone/Android.
  Adapta a tablet (640px) y desktop (768px+) con ampliaciones.
- **Tap targets ≥ 48px** en todos los botones e inputs.
- **Inputs con `font-size: 16px`** en móvil (evita el zoom
  automático de iOS al enfocar).
- **Pointer Events** en el canvas: un solo set de handlers para
  mouse, touch y stylus. `setPointerCapture` para que el trazo
  no se corte al salir del canvas.
- **`touch-action: none`** en el canvas: evita que el dedo haga
  scroll mientras se firma.
- **`100dvh`** en lugar de `100vh`: respeta la barra dinámica de
  Safari móvil sin saltos.
- **Safe-area insets**: padding inferior y superior respetan el
  notch en iPhone X+.
- **Estado "ya firmado"** en el cliente: si el formulario ya
  fue firmado, no permite re-firmar y muestra el PDF.
- **`prefers-reduced-motion`**: respeta la preferencia del usuario.
