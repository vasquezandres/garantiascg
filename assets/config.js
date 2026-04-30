// ================================================================
// config.js — configuración del frontend
// ================================================================
//
// Pega aquí la URL pública del Web App de Apps Script.
// La obtienes en Apps Script: Implementar → Administrar
// implementaciones → URL del Web App (termina en /exec).
//
// IMPORTANTE: la implementación debe estar configurada como:
//   - Ejecutar como: yo (tu cuenta)
//   - Quién tiene acceso: cualquier usuario
// ================================================================

window.APP_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/REEMPLAZAR_AQUI/exec',

  // Nombre del proyecto / cliente actual (sólo cosmético)
  // Cuando uses multi-cliente real, esto se puede leer desde
  // window.location.hostname y mapear al cliente_id correcto.
  CLIENTE_ID: '',
  CLIENTE_NOMBRE: 'Garantías'
};
