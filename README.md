# Frontend para Cloudflare Pages

Esta carpeta contiene la **versión externa** del frontend, lista para
desplegar en Cloudflare Pages bajo un subdominio propio (por ejemplo
`garantias.condadogardens.com`).

> **No es necesario usar esto ahora.** El sistema sigue funcionando
> 100% desde Apps Script con la versión del backend (carpeta `backend/`).
> Esta carpeta queda preparada para cuando quieras migrar.

## ¿Qué cambia respecto a la versión interna?

- Los HTML usan `fetch()` contra la URL pública del Web App de Apps
  Script en lugar de `google.script.run`.
- Las URLs son limpias: `/` para crear, `/f/TOKEN` para firmar.
- El HTML, CSS y JS están separados en archivos independientes
  (mejor caché, más mantenible).
- No depende del iframe de Apps Script — funciona en cualquier dominio.

## Pasos para desplegar (cuando llegue el momento)

1. **En Apps Script**: despliega como Web App (Implementar → Nueva
   implementación → Aplicación web → Ejecutar como: yo → Acceso:
   cualquier usuario). Copia la URL `/exec`.

2. **Edita `assets/config.js`** y pega esa URL en `API_URL`.

3. **Sube esta carpeta a un repo de GitHub**.

4. **En Cloudflare Pages**: Create → Connect to Git → selecciona el
   repo. Build command: vacío. Output directory: `/` (o el nombre
   de esta carpeta si subes el repo entero).

5. **Conecta el subdominio**: en Cloudflare Pages → Custom domains →
   añade `garantias.condadogardens.com`. El DNS se configura solo si
   el dominio ya está en tu cuenta de Cloudflare.

6. **En Apps Script**, configura la propiedad opcional:
   ```
   PUBLIC_FIRMA_BASE_URL = https://garantias.condadogardens.com
   ```
   Esto hace que los enlaces de firma generados sean del tipo
   `https://garantias.condadogardens.com/f/TOKEN` en lugar de la URL
   larga de Apps Script.

7. ¡Listo! La versión interna sigue funcionando en paralelo, no se
   rompe nada.

## Estructura

```
frontend-pages/
├── index.html        ← formulario de creación (ruta /)
├── firmar.html       ← formulario de firma (ruta /f/:token)
├── assets/
│   ├── config.js     ← API_URL aquí
│   ├── crear.js      ← lógica del formulario de creación
│   ├── firmar.js     ← lógica del formulario de firma
│   └── styles.css    ← estilos compartidos
├── _redirects        ← reglas /f/:token → firmar.html
└── README.md         ← este archivo
```

## Multi-cliente

El payload enviado al backend acepta `cliente_id`. Hoy se envía
vacío. Cuando tengas la hoja `clientes` configurada, puedes
detectar el cliente desde el `window.location.hostname` y mandar
el `cliente_id` correspondiente.
