// ================================================================
// crear.js — lógica del formulario de creación (Cloudflare Pages)
// ================================================================

let ultimoEnlaceGenerado = '';

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
  btn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
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

  if (!data.proyecto || !data.cliente || !data.fecha || !data.hora || !data.correo_responsable || items.length === 0) {
    alert('Completa al menos proyecto, cliente, fecha, hora, correo del responsable y un ítem.');
    return;
  }

  setLoadingGenerar(true);

  const resp = await window.api('crear', data);

  setLoadingGenerar(false);

  const box = document.getElementById('resultado');
  const acciones = document.getElementById('accionesEnlace');
  const copiadoMsg = document.getElementById('copiadoMsg');
  copiadoMsg.style.display = 'none';

  if (!resp || !resp.ok) {
    box.style.display = 'block';
    box.innerHTML = '<strong><i class="fa-solid fa-circle-xmark" style="color:#dc2626;margin-right:6px;"></i>Error:</strong> ' +
      (resp && resp.message ? resp.message : 'No se pudo crear el formulario.');
    acciones.style.display = 'none';
    ultimoEnlaceGenerado = '';
    return;
  }

  ultimoEnlaceGenerado = resp.firmaUrl;

  box.style.display = 'block';
  box.innerHTML =
    '<strong><i class="fa-solid fa-circle-check" style="color:#16a34a;margin-right:6px;"></i>Formulario creado correctamente.</strong><br><br>' +
    '<strong>ID:</strong> ' + resp.id + '<br>' +
    '<strong>Enlace de firma:</strong><br>' +
    '<a href="' + resp.firmaUrl + '" target="_blank" rel="noopener">' + resp.firmaUrl + '</a>' +
    '<br><br><small style="color:#6b7280">Versión: ' + (resp.version || 'desconocida') + '</small>';
  acciones.style.display = 'flex';
}

async function copiarEnlace() {
  if (!ultimoEnlaceGenerado) { alert('Primero debes generar un enlace.'); return; }

  try {
    await navigator.clipboard.writeText(ultimoEnlaceGenerado);
    document.getElementById('copiadoMsg').style.display = 'block';
  } catch (error) {
    alert('No se pudo copiar automáticamente. Copia el enlace manualmente.');
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
    }).catch(() => {});
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
    btn.classList.add('loading');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>Generando enlace...';
  } else {
    btn.disabled = false;
    btn.classList.remove('loading');
    btn.innerHTML = '<i class="fa-solid fa-link"></i>Generar enlace de firma';
  }
}

window.addEventListener('DOMContentLoaded', function () {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  document.getElementById('fecha').value = local.toISOString().slice(0, 10);
  document.getElementById('hora').value = local.toTimeString().slice(0, 5);

  addItem('Revisión de pintura y acabados');
  addItem('Ajuste de puertas o ventanas');
  addItem('Corrección de filtración menor');
});
