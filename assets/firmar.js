// ================================================================
// firmar.js — pantalla de firma
// Mantiene los IDs y nombres de funciones para compatibilidad.
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

async function cargarFormulario() {
  const params = new URLSearchParams(location.search);
  token = params.get('token') || '';

  const cont = document.getElementById('contenido');

  if (!token) {
    cont.innerHTML =
      '<div class="msg error" style="display:flex;">' +
      '<i class="fa-solid fa-circle-xmark" aria-hidden="true"></i>' +
      '<div>Enlace inválido: falta el token.</div></div>';
    return;
  }

  const resp = await window.api('obtener', { token: token });

  if (!resp || !resp.ok) {
    cont.innerHTML =
      '<div class="msg error" style="display:flex;">' +
      '<i class="fa-solid fa-circle-xmark" aria-hidden="true"></i>' +
      '<div>' + escapeHtml((resp && resp.message) || 'No se pudo cargar el formulario.') + '</div></div>';
    return;
  }

  renderFormulario(resp.data);
}

function renderFormulario(data) {
  const cont = document.getElementById('contenido');

  // Si ya está firmado: vista de "ya firmado" sin posibilidad de re-firmar
  if (data.estado === 'firmado') {
    cont.innerHTML =
      '<div class="signed-state">' +
        '<div class="signed-icon"><i class="fa-solid fa-circle-check" aria-hidden="true"></i></div>' +
        '<h2>Este formulario ya fue firmado</h2>' +
        '<p>Firmado el <strong>' + escapeHtml(data.fecha_firma || '') + '</strong>' +
        (data.hora_firma ? ' a las <strong>' + escapeHtml(normalizarHora(data.hora_firma)) + '</strong>' : '') +
        '.</p>' +
        (data.pdf_url
          ? '<a class="btn btn-primary" href="' + escapeHtml(data.pdf_url) + '" target="_blank" rel="noopener">' +
            '<i class="fa-solid fa-file-pdf" aria-hidden="true"></i>Ver PDF firmado</a>'
          : '') +
      '</div>';
    return;
  }

  const itemsHtml = (data.items || []).map((item, i) =>
    '<label class="check-item" data-index="' + i + '">' +
      '<input type="checkbox" class="chk">' +
      '<span class="custom-check" aria-hidden="true"></span>' +
      '<span class="check-text">' + escapeHtml(item.texto || '') + '</span>' +
    '</label>'
  ).join('');

  cont.innerHTML =
    // Datos del formulario
    '<div class="box">' +
      '<div class="box-title"><i class="fa-solid fa-info-circle" aria-hidden="true"></i>Datos del formulario</div>' +
      '<div class="meta-grid">' +
        metaLine('Proyecto', data.proyecto) +
        metaLine('Cliente', data.cliente) +
        metaLine('Torre', data.torre) +
        metaLine('Apto', data.apartamento) +
        metaLine('Fecha', data.fecha_creacion) +
        metaLine('Hora', normalizarHora(data.hora_creacion)) +
      '</div>' +
    '</div>' +

    // Observaciones
    (data.observaciones
      ? '<div class="box">' +
          '<div class="box-title"><i class="fa-solid fa-comment-dots" aria-hidden="true"></i>Observaciones</div>' +
          '<div style="font-size:15px;line-height:1.5;color:#374151;">' + escapeHtml(data.observaciones) + '</div>' +
        '</div>'
      : '') +

    // Checklist
    '<div class="section">' +
      '<div class="section-title"><i class="fa-solid fa-list-check" aria-hidden="true"></i>Confirma todos los puntos</div>' +
      '<div class="checklist">' + itemsHtml + '</div>' +
    '</div>' +

    // Datos del firmante
    '<div class="section">' +
      '<div class="section-title"><i class="fa-solid fa-user-pen" aria-hidden="true"></i>Tus datos</div>' +
      '<div class="grid">' +
        '<div class="field">' +
          '<label for="nombre"><i class="fa-solid fa-user" aria-hidden="true"></i>Nombre completo</label>' +
          '<input id="nombre" type="text" placeholder="Tu nombre completo" autocomplete="name">' +
        '</div>' +
        '<div class="field">' +
          '<label for="correo"><i class="fa-solid fa-envelope" aria-hidden="true"></i>Correo' +
            ' <span class="optional">(opcional)</span></label>' +
          '<input id="correo" type="email" placeholder="correo@ejemplo.com" autocomplete="email" inputmode="email">' +
          '<div class="hint">Si lo indicas, recibirás copia del PDF firmado.</div>' +
        '</div>' +
      '</div>' +
    '</div>' +

    // Firma
    '<div class="section">' +
      '<div class="section-title"><i class="fa-solid fa-signature" aria-hidden="true"></i>Firma</div>' +
      '<div id="signatureWrap" class="signature-wrap">' +
        '<canvas id="firmaCanvas" aria-label="Área de firma"></canvas>' +
        '<div class="signature-placeholder" id="signaturePlaceholder">' +
          '<span><i class="fa-solid fa-pen" aria-hidden="true"></i>Firma aquí con tu dedo o ratón</span>' +
        '</div>' +
      '</div>' +
      '<div class="signature-actions">' +
        '<button id="btnLimpiar" class="btn btn-ghost" type="button" onclick="limpiar()">' +
          '<i class="fa-solid fa-eraser" aria-hidden="true"></i>Limpiar firma' +
        '</button>' +
      '</div>' +
    '</div>' +

    // Acción principal
    '<div class="actions">' +
      '<button id="btnFirmar" class="btn btn-success" type="button" onclick="firmar()">' +
        '<i class="fa-solid fa-check" aria-hidden="true"></i>Firmar y enviar' +
      '</button>' +
    '</div>' +

    // Mensaje de estado
    '<div id="msg" class="msg" role="status" aria-live="polite"></div>';

  bindCheckItems();
  initCanvas();
}

function metaLine(label, value) {
  if (value === undefined || value === null || value === '') return '';
  return '<div class="meta-line">' +
    '<span class="meta-label">' + escapeHtml(label) + '</span>' +
    '<span class="meta-value">' + escapeHtml(String(value)) + '</span>' +
    '</div>';
}

function bindCheckItems() {
  // Reflejamos visualmente el estado checked en la tarjeta
  document.querySelectorAll('.check-item').forEach(label => {
    const input = label.querySelector('input.chk');
    if (!input) return;
    const sync = () => label.classList.toggle('checked', input.checked);
    input.addEventListener('change', sync);
    sync();
  });
}

// ================================================================
// Canvas de firma — eventos unificados con Pointer Events
// ================================================================

function initCanvas() {
  const wrap = document.getElementById('signatureWrap');
  const canvas = document.getElementById('firmaCanvas');
  const ctx = canvas.getContext('2d');

  let lastX = 0, lastY = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);

    // Preservar trazo si ya existía
    let prev = null;
    try {
      if (canvas.width && canvas.height && hasSignature) {
        prev = canvas.toDataURL('image/png');
      }
    } catch (e) { /* canvas vacío */ }

    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';

    if (prev) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = prev;
    }
  }

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX !== undefined) ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const cy = (e.clientY !== undefined) ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    return { x: cx - rect.left, y: cy - rect.top };
  }

  function start(e) {
    if (e.cancelable) e.preventDefault();
    isDrawing = true;
    if (!hasSignature) {
      hasSignature = true;
      wrap.classList.add('has-signature');
    }
    const p = getPos(e);
    lastX = p.x; lastY = p.y;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    // Punto inicial visible aunque sea un toque sin movimiento
    ctx.lineTo(lastX + 0.01, lastY + 0.01);
    ctx.stroke();
  }

  function move(e) {
    if (!isDrawing) return;
    if (e.cancelable) e.preventDefault();
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastX = p.x; lastY = p.y;
  }

  function end() { isDrawing = false; }

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));

  if (window.PointerEvent) {
    canvas.addEventListener('pointerdown', e => {
      try { canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); } catch (err) {}
      start(e);
    });
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
  const wrap = document.getElementById('signatureWrap');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  hasSignature = false;
  if (wrap) wrap.classList.remove('has-signature');
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
  const nombre = (document.getElementById('nombre').value || '').trim();
  const correo = (document.getElementById('correo').value || '').trim();

  hideMsg();

  if (!checks.length) {
    showMsg('error', 'No hay puntos para aprobar.');
    return;
  }
  if (checks.some(v => !v)) {
    showMsg('error', 'Debes aprobar todos los puntos. Si no estás de acuerdo, contacta a la persona que te envió el formulario.');
    scrollToEl('.checklist');
    return;
  }
  if (!nombre) {
    showMsg('error', 'Ingresa tu nombre.');
    document.getElementById('nombre').focus();
    return;
  }
  if (!hasSignature) {
    showMsg('error', 'La firma es obligatoria.');
    scrollToEl('#signatureWrap');
    return;
  }

  setLoadingFirmar(true);

  const resp = await window.api('firmar', {
    token: token,
    aprobados: checks,
    nombre_firmante: nombre,
    correo_firmante: correo,
    firma_base64: getTrimmedSignatureDataURL()
  });

  setLoadingFirmar(false);

  if (!resp || !resp.ok) {
    showMsg('error', (resp && resp.message) || 'No se pudo completar la firma.');
    return;
  }

  showMsg('success', resp.message || 'Firmado correctamente.');

  // Bloquear UI para evitar doble firma
  document.querySelectorAll('input, textarea').forEach(el => el.disabled = true);
  document.querySelectorAll('.check-item').forEach(el => { el.style.pointerEvents = 'none'; });

  const btn = document.getElementById('btnFirmar');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-check-double" aria-hidden="true"></i>Firmado';
  }
  const btnL = document.getElementById('btnLimpiar');
  if (btnL) btnL.disabled = true;
}

function showMsg(kind, text) {
  const msg = document.getElementById('msg');
  if (!msg) return;
  msg.className = 'msg ' + kind;
  msg.style.display = 'flex';
  const icon = kind === 'success' ? 'fa-circle-check' : 'fa-circle-xmark';
  msg.innerHTML = '<i class="fa-solid ' + icon + '" aria-hidden="true"></i><div>' + escapeHtml(text) + '</div>';
  msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideMsg() {
  const msg = document.getElementById('msg');
  if (!msg) return;
  msg.style.display = 'none';
  msg.innerHTML = '';
}

function scrollToEl(selector) {
  const el = document.querySelector(selector);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function setLoadingFirmar(isLoading) {
  const btn = document.getElementById('btnFirmar');
  if (!btn) return;
  if (isLoading) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>Procesando...';
  } else {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i>Firmar y enviar';
  }
}

window.addEventListener('DOMContentLoaded', cargarFormulario);
