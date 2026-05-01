// ================================================================
// crear.js — formulario de creación
// Mantiene los IDs y nombres de funciones para compatibilidad.
// ================================================================

let ultimoEnlaceGenerado = '';

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function addItem(value) {
  const container = document.getElementById('itemsContainer');
  const row = document.createElement('div');
  row.className = 'item-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'item-input';
  input.placeholder = 'Escribe un punto de garantía';
  input.value = value || '';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-delete';
  btn.setAttribute('aria-label', 'Eliminar ítem');
  btn.innerHTML = '<i class="fa-solid fa-trash-can" aria-hidden="true"></i>';
  btn.onclick = function () { row.remove(); };

  row.appendChild(input);
  row.appendChild(btn);
  container.appendChild(row);
}

async function crearFormulario() {
  const itemInputs = Array.from(document.querySelectorAll('.item-input'));
  const items = itemInputs
    .map(input => ({ texto: input.value.trim() }))
    .filter(item => item.texto);

  const data = {
    proyecto: document.getElementById('proyecto').value.trim(),
    torre: document.getElementById('torre').value.trim(),
    apartamento: document.getElementById('apartamento').value.trim(),
    cliente: document.getElementById('cliente').value.trim(),
    fecha: document.getElementById('fecha').value.trim(),
    hora: document.getElementById('hora').value.trim(),
    correo_responsable: document.getElementById('correo_responsable').value.trim(),
    correos_cc: document.getElementById('correos_cc').value.trim(),
    observaciones: document.getElementById('observaciones').value.trim(),
    items: items,
    cliente_id: (window.APP_CONFIG && window.APP_CONFIG.CLIENTE_ID) || ''
  };

  // Validación amigable: enfoca el primer campo faltante
  const required = [
    { id: 'proyecto', label: 'el proyecto' },
    { id: 'cliente', label: 'el cliente' },
    { id: 'fecha', label: 'la fecha' },
    { id: 'hora', label: 'la hora' },
    { id: 'correo_responsable', label: 'el correo del responsable' }
  ];
  for (const r of required) {
    if (!data[r.id]) {
      mostrarResultadoError('Por favor completa ' + r.label + '.');
      const el = document.getElementById(r.id);
      if (el) { el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      return;
    }
  }
  if (items.length === 0) {
    mostrarResultadoError('Debes agregar al menos un ítem de garantía.');
    return;
  }

  setLoadingGenerar(true);

  const resp = await window.api('crear', data);

  setLoadingGenerar(false);

  const copiadoMsg = document.getElementById('copiadoMsg');
  if (copiadoMsg) copiadoMsg.style.display = 'none';

  if (!resp || !resp.ok) {
    mostrarResultadoError((resp && resp.message) || 'No se pudo crear el formulario.');
    document.getElementById('accionesEnlace').style.display = 'none';
    ultimoEnlaceGenerado = '';
    return;
  }

  ultimoEnlaceGenerado = resp.firmaUrl;
  mostrarResultadoExito(resp);

  document.getElementById('accionesEnlace').style.display = 'flex';
  document.getElementById('resultado').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function mostrarResultadoExito(resp) {
  const box = document.getElementById('resultado');
  box.className = 'result success';
  box.style.display = 'block';
  box.innerHTML =
    '<div class="result-title success">' +
      '<i class="fa-solid fa-circle-check" aria-hidden="true"></i>' +
      'Formulario creado correctamente' +
    '</div>' +
    '<div class="result-id">' + escapeHtml(resp.id) + '</div>' +
    '<div style="margin-top:8px;font-size:13px;color:#374151;font-weight:600;">Enlace de firma:</div>' +
    '<div class="result-link">' +
      '<a href="' + escapeHtml(resp.firmaUrl) + '" target="_blank" rel="noopener">' +
        escapeHtml(resp.firmaUrl) +
      '</a>' +
    '</div>';
}

function mostrarResultadoError(mensaje) {
  const box = document.getElementById('resultado');
  box.className = 'result error';
  box.style.display = 'block';
  box.innerHTML =
    '<div class="result-title error">' +
      '<i class="fa-solid fa-circle-xmark" aria-hidden="true"></i>' +
      escapeHtml(mensaje) +
    '</div>';
}

async function copiarEnlace() {
  if (!ultimoEnlaceGenerado) {
    alert('Primero debes generar un enlace.');
    return;
  }

  try {
    await navigator.clipboard.writeText(ultimoEnlaceGenerado);
    const note = document.getElementById('copiadoMsg');
    note.style.display = 'block';
    setTimeout(() => { note.style.display = 'none'; }, 2500);
  } catch (error) {
    // Fallback: prompt para copia manual
    window.prompt('Copia el enlace:', ultimoEnlaceGenerado);
  }
}

function compartirWhatsApp() {
  if (!ultimoEnlaceGenerado) { alert('Primero debes generar un enlace.'); return; }

  const cliente = document.getElementById('cliente').value.trim();
  const mensaje =
    'Hola' + (cliente ? ' ' + cliente : '') +
    ', te compartimos el enlace para revisar y firmar el formulario de garantía:\n\n' +
    ultimoEnlaceGenerado;

  window.open('https://wa.me/?text=' + encodeURIComponent(mensaje), '_blank');
}

function compartirGeneral() {
  if (!ultimoEnlaceGenerado) { alert('Primero debes generar un enlace.'); return; }

  const cliente = document.getElementById('cliente').value.trim();
  const texto =
    'Hola' + (cliente ? ' ' + cliente : '') +
    ', te compartimos el enlace para revisar y firmar el formulario de garantía:';

  if (navigator.share) {
    navigator.share({
      title: 'Formulario de Garantía',
      text: texto,
      url: ultimoEnlaceGenerado
    }).catch(() => { /* el usuario canceló */ });
  } else {
    const subject = encodeURIComponent('Formulario de Garantía');
    const body = encodeURIComponent(texto + '\n\n' + ultimoEnlaceGenerado);
    window.open('mailto:?subject=' + subject + '&body=' + body, '_blank');
  }
}

function setLoadingGenerar(isLoading) {
  const btn = document.getElementById('btnGenerar');
  if (!btn) return;
  if (isLoading) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>Generando enlace...';
  } else {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-link" aria-hidden="true"></i>Generar enlace de firma';
  }
}

window.addEventListener('DOMContentLoaded', function () {
  // Pre-llenar fecha y hora locales
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  const fechaEl = document.getElementById('fecha');
  const horaEl = document.getElementById('hora');
  if (fechaEl) fechaEl.value = local.toISOString().slice(0, 10);
  if (horaEl) horaEl.value = local.toTimeString().slice(0, 5);

  // Ítems por defecto
  addItem('Revisión de pintura y acabados');
  addItem('Ajuste de puertas o ventanas');
  addItem('Corrección de filtración menor');
});
