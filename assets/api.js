// ================================================================
// api.js — cliente para llamar al backend de Apps Script
// ================================================================
//
// CRÍTICO: Apps Script Web Apps NO responden a preflight CORS.
// Por eso enviamos el body como text/plain. Apps Script lo
// recibe igual y lo parsea con JSON.parse(e.postData.contents).
// Esto evita el preflight OPTIONS y todo funciona sin proxy.
// ================================================================

window.api = async function api(action, data) {
  const url = (window.APP_CONFIG && window.APP_CONFIG.API_URL) || '';
  if (!url || url.indexOf('REEMPLAZAR') !== -1) {
    return { ok: false, message: 'API_URL no configurada en assets/config.js' };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: action, data: data || {} }),
      redirect: 'follow'
    });
    if (!res.ok) {
      return { ok: false, message: 'HTTP ' + res.status };
    }
    return await res.json();
  } catch (err) {
    return { ok: false, message: (err && err.message) || String(err) };
  }
};
