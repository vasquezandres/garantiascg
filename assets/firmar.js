// ================================================================
// firmar.js — lógica de la pantalla de firma (Cloudflare Pages)
// ================================================================

let isDrawing = false;
let hasSignature = false;
let token = '';

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizarHora(valor) {
  if (!valor) return '';
  if (String(valor).indexOf('1899-12-30') === 0) {
    return String(valor).replace('1899-12-30 ', '');
  }
  return valor;
}

function getTokenFromUrl() {
  // 1. query string
  const params = new URLSearchParams(window.location.search);
  const queryToken = params.get('token');

  if (queryToken) return queryToken.trim();

  // 2. path /f/TOKEN
  const parts = window.location.pathname.split('/').filter(Boolean);

  if (parts[0] === 'f' && parts[1]) {
    return decodeURIComponent(parts[1]).trim();
  }

  return '';
}

async function cargarFormulario() {
  token = getTokenFromUrl();

  console.log('pathname:', window.location.pathname);
  console.log('search:', window.location.search);
  console.log('token:', token);

  if (!token) {
    document.getElementById('contenido').innerHTML =
      '<div class="msg error"><i class="fa-solid fa-circle-xmark"></i>Token no proporcionado.</div>';
    return;
  }

  const resp = await window.api('obtener', { token: token });

  if (!resp || !resp.ok) {
    document.getElementById('contenido').innerHTML =
      '<div class="msg error"><i class="fa-solid fa-circle-xmark"></i>' +
      escapeHtml((resp && resp.message) || 'No se pudo cargar el formulario.') +
      '</div>';
    return;
  }

  renderFormulario(resp.data);
}

function renderFormulario(data) {
  // Si ya está firmado, mostramos un estado de "ya firmado" en lugar
  // del formulario.
  if (data.estado === 'firmado') {
    document.getElementById('contenido').innerHTML =
      '<div class="msg success"><i class="fa-solid fa-circle-check"></i>' +
      'Este formulario ya fue firmado el ' + escapeHtml(data.fecha_firma) +
      ' a las ' + escapeHtml(data.hora_firma) + '.</div>' +
      (data.pdf_url
        ? '<div style="margin-top:14px;text-align:center;"><a href="' +
          escapeHtml(data.pdf_url) + '" target="_blank" rel="noopener" ' +
          'style="color:#2563eb;font-weight:600;">Ver PDF firmado</a></div>'
        : '');
    return;
  }

  const itemsHtml = (data.items || []).map(item =>
    '<label class="check-item">' +
      '<input type="checkbox" class="chk">' +
      '<span class="custom-check"></span>' +
      '<span class="check-text">' + escapeHtml(item.texto || '') + '</span>' +
    '</label>'
  ).join('');

  document.getElementById('contenido').innerHTML =
    '<div class="box">' +
      '<div class="box-title"><i class="fa-solid fa-info-circle"></i>Datos del formulario</div>' +
      '<div class="meta-line"><i class="fa-solid fa-calendar"></i><strong>Fecha:</strong> ' + escapeHtml(data.fecha_creacion || '') + '</div>' +
      '<div class="meta-line"><i class="fa-solid fa-clock"></i><strong>Hora:</strong> ' + escapeHtml(normalizarHora(data.hora_creacion || '')) + '</div>' +
      '<div class="meta-line"><i class="fa-solid fa-building"></i><strong>Proyecto:</strong> ' + escapeHtml(data.proyecto || '') + '</div>' +
      '<div class="meta-line"><i class="fa-solid fa-tower-observation"></i><strong>Torre:</strong> ' + escapeHtml(data.torre || '') + '</div>' +
      '<div class="meta-line"><i class="fa-solid fa-door-open"></i><strong>Apto:</strong> ' + escapeHtml(data.apartamento || '') + '</div>' +
      '<div class="meta-line"><i class="fa-solid fa-user"></i><strong>Cliente:</strong> ' + escapeHtml(data.cliente || '') + '</div>' +
    '</div>' +

    '<div class="box">' +
      '<div class="section-title"><i class="fa-solid fa-comment-dots"></i>Observaciones</div>' +
      '<div class="meta-line">' + escapeHtml(data.observaciones || 'Sin observaciones') + '</div>' +
    '</div>' +

    '<div class="box">' +
      '<div class="section-title"><i class="fa-solid fa-list-check"></i>Confirma todos los puntos</div>' +
      '<div class="checklist">' + itemsHtml + '</div>' +
    '</div>' +

    '<div class="field">' +
      '<label for="nombre"><i class="fa-solid fa-user-pen"></i>Nombre</label>' +
      '<input id="nombre" type="text" placeholder="Tu nombre completo">' +
    '</div>' +

    '<div class="field">' +
      '<label for="correo"><i class="fa-solid fa-envelope"></i>Correo (opcional)</label>' +
      '<input id="correo" type="email" placeholder="correo@ejemplo.com">' +
    '</div>' +

    '<div class="field">' +
      '<label><i class="fa-solid fa-signature"></i>Firma</label>' +
      '<div class="canvas-wrap"><canvas id="firmaCanvas"></canvas></div>' +
      '<div class="canvas-actions">' +
        '<button class="btn-secondary" type="button" onclick="limpiar()"><i class="fa-solid fa-eraser"></i>Limpiar</button>' +
      '</div>' +
    '</div>' +

    '<div class="actions">' +
      '<button id="btnFirmar" class="btn-success" type="button" onclick="firmar()"><i class="fa-solid fa-check"></i>Firmar</button>' +
    '</div>' +

    '<div id="msg" class="msg" style="display:none;"></div>';

  initCanvas();
}

function initCanvas() {
  const canvas = document.getElementById('firmaCanvas');
  const ctx = canvas.getContext('2d');

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
  }

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX !== undefined ? e.clientX : e.touches[0].clientX) - rect.left,
      y: (e.clientY !== undefined ? e.clientY : e.touches[0].clientY) - rect.top
    };
  }

  function start(e) {
    e.preventDefault();
    isDrawing = true;
    hasSignature = true;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function end() { isDrawing = false; }

  resize();
  window.addEventListener('resize', resize);

  // Eventos unificados de puntero (mouse + touch)
  if (window.PointerEvent) {
    canvas.addEventListener('pointerdown', start);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointerleave', end);
    canvas.addEventListener('pointercancel', end);
  } else {
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);
  }
}

function limpiar() {
  const canvas = document.getElementById('firmaCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  hasSignature = false;
}

function getTrimmedSignatureDataURL() {
  const canvas = document.getElementById('firmaCanvas');
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let top = null, bottom = null, left = null, right = null;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];
      if (alpha > 0) {
        if (top === null) top = y;
        if (left === null || x < left) left = x;
        if (right === null || x > right) right = x;
        bottom = y;
      }
    }
  }

  if (top === null) return canvas.toDataURL('image/png');

  const padding = 10;
  top = Math.max(0, top - padding);
  left = Math.max(0, left - padding);
  right = Math.min(width - 1, right + padding);
  bottom = Math.min(height - 1, bottom + padding);

  const trimmedWidth = right - left + 1;
  const trimmedHeight = bottom - top + 1;
  const trimmedCanvas = document.createElement('canvas');
  trimmedCanvas.width = trimmedWidth;
  trimmedCanvas.height = trimmedHeight;
  const trimmedCtx = trimmedCanvas.getContext('2d');
  trimmedCtx.putImageData(ctx.getImageData(left, top, trimmedWidth, trimmedHeight), 0, 0);

  return trimmedCanvas.toDataURL('image/png');
}

async function firmar() {
  const checks = Array.from(document.querySelectorAll('.chk')).map(c => c.checked);
  const nombre = document.getElementById('nombre').value.trim();
  const correo = document.getElementById('correo').value.trim();
  const msg = document.getElementById('msg');

  msg.style.display = 'none';
  msg.className = 'msg';
  msg.innerHTML = '';

  if (!checks.length) { alert('No hay puntos para aprobar.'); return; }
  if (checks.some(v => !v)) {
    alert('Debes aprobar todos los puntos. Si no estás de acuerdo, contacta a la persona que te envió el formulario.');
    return;
  }
  if (!nombre) { alert('Ingresa tu nombre.'); return; }
  if (!hasSignature) { alert('La firma es obligatoria.'); return; }

  setLoadingFirmar(true);

  const resp = await window.api('firmar', {
    token: token,
    aprobados: checks,
    nombre_firmante: nombre,
    correo_firmante: correo,
    firma_base64: getTrimmedSignatureDataURL()
  });

  setLoadingFirmar(false);
  msg.style.display = 'block';

  if (!resp || !resp.ok) {
    msg.className = 'msg error';
    msg.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>' +
      escapeHtml((resp && resp.message) || 'No se pudo completar la firma.');
    return;
  }

  msg.className = 'msg success';
  msg.innerHTML = '<i class="fa-solid fa-circle-check"></i>' + escapeHtml(resp.message || 'Firmado correctamente.');

  // Deshabilitar botón para evitar doble firma
  const btn = document.getElementById('btnFirmar');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('loading');
  }
}

function setLoadingFirmar(isLoading) {
  const btn = document.getElementById('btnFirmar');
  if (!btn) return;
  if (isLoading) {
    btn.disabled = true;
    btn.classList.add('loading');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>Procesando firma...';
  } else {
    btn.disabled = false;
    btn.classList.remove('loading');
    btn.innerHTML = '<i class="fa-solid fa-check"></i>Firmar';
  }
}

window.addEventListener('DOMContentLoaded', cargarFormulario);
