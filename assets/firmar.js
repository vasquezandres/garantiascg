// ================================================================
// firmar.js — pantalla de firma
//
// Mantiene los IDs y nombres de funciones globales para
// compatibilidad con el HTML y backend actuales.
//
// Estados de UI gestionados:
//   1) loading      — tarjeta inicial mientras llega el formulario
//   2) ready        — formulario visible, botón deshabilitado hasta
//                     que TODO esté completo (checks + nombre + firma)
//   3) processing   — botón deshabilitado, formulario bloqueado,
//                     mensaje "Generando documento..."
//   4) success      — tarjeta verde, todo bloqueado
//   5) error        — mensaje rojo, botón se rehabilita si los datos
//                     siguen completos
// ================================================================

const state = {
  isProcessing: false,
  isSubmitted: false,
  hasSignature: false,
  isDrawing: false,
  token: ''
};

// ================================================================
// Utilidades
// ================================================================

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

// ================================================================
// Carga inicial
// ================================================================

async function cargarFormulario() {
  const params = new URLSearchParams(location.search);
  state.token = params.get('token') || '';

  const cont = document.getElementById('contenido');

  if (!state.token) {
    cont.innerHTML = renderErrorEstado('Enlace inválido: falta el token.');
    return;
  }

  const resp = await window.api('obtener', { token: state.token });

  if (!resp || !resp.ok) {
    cont.innerHTML = renderErrorEstado((resp && resp.message) || 'No se pudo cargar el formulario.');
    return;
  }

  renderFormulario(resp.data);
}

function renderErrorEstado(mensaje) {
  return '' +
    '<div class="msg error" style="display:flex;">' +
      '<i class="fa-solid fa-circle-xmark" aria-hidden="true"></i>' +
      '<div>' + escapeHtml(mensaje) + '</div>' +
    '</div>';
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

    // Acción principal + ayuda
    '<div class="actions">' +
      '<button id="btnFirmar" class="btn btn-success is-disabled" type="button" onclick="firmar()" disabled>' +
        '<i class="fa-solid fa-check" aria-hidden="true"></i>Firmar y enviar' +
      '</button>' +
    '</div>' +
    '<div id="helpText" class="help-text">' +
      '<i class="fa-solid fa-circle-info" aria-hidden="true"></i>' +
      '<span id="helpTextLabel">Marca todos los puntos, coloca tu nombre y firma para continuar.</span>' +
    '</div>' +

    // Mensaje de estado / procesamiento (oculto inicialmente)
    '<div id="msg" class="msg" role="status" aria-live="polite"></div>' +
    '<div id="processingState" class="processing-state" style="display:none;" aria-live="polite">' +
      '<div class="processing-spinner" aria-hidden="true"></div>' +
      '<div class="processing-text">' +
        '<div class="processing-title">Procesando firma...</div>' +
        '<div class="processing-subtitle">Estamos generando el documento firmado y enviando las notificaciones.</div>' +
      '</div>' +
    '</div>';

  bindCheckItems();
  bindNombreInput();
  initCanvas();
  updateButtonState(); // estado inicial
}

function metaLine(label, value) {
  if (value === undefined || value === null || value === '') return '';
  return '<div class="meta-line">' +
    '<span class="meta-label">' + escapeHtml(label) + '</span>' +
    '<span class="meta-value">' + escapeHtml(String(value)) + '</span>' +
    '</div>';
}

// ================================================================
// Validación reactiva
// ================================================================

/**
 * Evalúa si todas las condiciones para firmar se cumplen y
 * actualiza UI: botón habilitado/deshabilitado + texto de ayuda.
 *
 * Condiciones:
 *  1. Todos los checks marcados (al menos uno debe existir)
 *  2. Campo nombre con texto
 *  3. Firma dibujada en canvas
 *  4. No estar procesando ni ya enviado
 */
function updateButtonState() {
  const btn = document.getElementById('btnFirmar');
  const helpText = document.getElementById('helpText');
  const helpLabel = document.getElementById('helpTextLabel');
  if (!btn || !helpLabel) return;

  // Si ya estamos procesando o ya se envió, no tocamos nada aquí
  // (el control lo lleva firmar() y los estados de éxito/error).
  if (state.isProcessing || state.isSubmitted) return;

  const checks = Array.from(document.querySelectorAll('.chk'));
  const todosChecks = checks.length > 0 && checks.every(c => c.checked);

  const nombreEl = document.getElementById('nombre');
  const tieneNombre = !!(nombreEl && nombreEl.value.trim());

  const tieneFirma = state.hasSignature;

  const listo = todosChecks && tieneNombre && tieneFirma;

  if (listo) {
    btn.disabled = false;
    btn.classList.remove('is-disabled');
    helpText.classList.add('ready');
    helpLabel.textContent = 'Todo listo — puedes firmar y enviar.';
    const icon = helpText.querySelector('i');
    if (icon) {
      icon.className = 'fa-solid fa-circle-check';
      icon.style.color = 'var(--color-success)';
    }
  } else {
    btn.disabled = true;
    btn.classList.add('is-disabled');
    helpText.classList.remove('ready');

    // Mensaje específico según qué falta — ayuda al usuario a ver qué le queda
    let mensaje;
    if (!todosChecks && !tieneNombre && !tieneFirma) {
      mensaje = 'Marca todos los puntos, coloca tu nombre y firma para continuar.';
    } else if (!todosChecks) {
      const faltan = checks.filter(c => !c.checked).length;
      mensaje = faltan === 1
        ? 'Falta marcar 1 punto para continuar.'
        : 'Faltan marcar ' + faltan + ' puntos para continuar.';
    } else if (!tieneNombre && !tieneFirma) {
      mensaje = 'Coloca tu nombre y firma para continuar.';
    } else if (!tieneNombre) {
      mensaje = 'Coloca tu nombre para continuar.';
    } else {
      mensaje = 'Firma en el recuadro para continuar.';
    }

    helpLabel.textContent = mensaje;
    const icon = helpText.querySelector('i');
    if (icon) {
      icon.className = 'fa-solid fa-circle-info';
      icon.style.color = '';
    }
  }
}

function bindCheckItems() {
  // Reflejamos visualmente el estado checked y disparamos validación
  document.querySelectorAll('.check-item').forEach(label => {
    const input = label.querySelector('input.chk');
    if (!input) return;
    const sync = () => {
      label.classList.toggle('checked', input.checked);
      updateButtonState();
    };
    input.addEventListener('change', sync);
    sync();
  });
}

function bindNombreInput() {
  const nombreEl = document.getElementById('nombre');
  if (!nombreEl) return;
  nombreEl.addEventListener('input', updateButtonState);
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

    let prev = null;
    try {
      if (canvas.width && canvas.height && state.hasSignature) {
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
    if (state.isProcessing || state.isSubmitted) return;
    if (e.cancelable) e.preventDefault();
    state.isDrawing = true;
    if (!state.hasSignature) {
      state.hasSignature = true;
      wrap.classList.add('has-signature');
      updateButtonState();
    }
    const p = getPos(e);
    lastX = p.x; lastY = p.y;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(lastX + 0.01, lastY + 0.01);
    ctx.stroke();
  }

  function move(e) {
    if (!state.isDrawing) return;
    if (e.cancelable) e.preventDefault();
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastX = p.x; lastY = p.y;
  }

  function end() { state.isDrawing = false; }

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
  if (state.isProcessing || state.isSubmitted) return;
  const canvas = document.getElementById('firmaCanvas');
  const wrap = document.getElementById('signatureWrap');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  state.hasSignature = false;
  if (wrap) wrap.classList.remove('has-signature');
  updateButtonState();
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

// ================================================================
// Envío
// ================================================================

async function firmar() {
  // Doble seguro: si ya estamos procesando o enviamos, salir
  if (state.isProcessing || state.isSubmitted) return;

  // Validaciones de respaldo (en caso de que alguien fuerce el click)
  const checks = Array.from(document.querySelectorAll('.chk')).map(c => c.checked);
  const nombre = (document.getElementById('nombre').value || '').trim();
  const correo = (document.getElementById('correo').value || '').trim();

  hideMsg();

  if (!checks.length || checks.some(v => !v)) {
    showMsg('error', 'Debes aprobar todos los puntos antes de firmar.');
    scrollToEl('.checklist');
    return;
  }
  if (!nombre) {
    showMsg('error', 'Ingresa tu nombre.');
    document.getElementById('nombre').focus();
    return;
  }
  if (!state.hasSignature) {
    showMsg('error', 'La firma es obligatoria.');
    scrollToEl('#signatureWrap');
    return;
  }

  // Entrar a estado "processing"
  setProcessingState(true);

  const resp = await window.api('firmar', {
    token: state.token,
    aprobados: checks,
    nombre_firmante: nombre,
    correo_firmante: correo,
    firma_base64: getTrimmedSignatureDataURL()
  });

  // Salir de "processing" — la decisión de éxito/error la toma el flujo siguiente
  setProcessingState(false);

  if (!resp || !resp.ok) {
    // Estado: error. Dejamos que el usuario reintente.
    showMsg('error', (resp && resp.message) || 'No se pudo completar la firma. Intenta de nuevo.');
    // Re-evaluar habilitación: si los datos siguen completos, el botón vuelve a estar listo
    updateButtonState();
    return;
  }

  // Estado: éxito
  setSuccessState(resp);
}

function setProcessingState(isOn) {
  state.isProcessing = isOn;
  const btn = document.getElementById('btnFirmar');
  const helpText = document.getElementById('helpText');
  const procBox = document.getElementById('processingState');
  const limpiarBtn = document.getElementById('btnLimpiar');

  // Bloqueo del formulario completo (visual + interactivo)
  document.body.classList.toggle('form-locked', isOn);

  if (isOn) {
    // Botón con spinner
    if (btn) {
      btn.disabled = true;
      btn.classList.add('is-disabled');
      btn.innerHTML = '<span class="spinner-sm" aria-hidden="true"></span>Procesando firma...';
    }
    if (limpiarBtn) limpiarBtn.disabled = true;
    if (helpText) helpText.style.display = 'none';
    if (procBox) procBox.style.display = 'flex';
    hideMsg();
  } else {
    // Salimos del estado de procesando: restaurar texto del botón
    if (btn) {
      btn.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i>Firmar y enviar';
    }
    if (limpiarBtn) limpiarBtn.disabled = false;
    if (helpText) helpText.style.display = '';
    if (procBox) procBox.style.display = 'none';
  }
}

function setSuccessState(resp) {
  state.isSubmitted = true;

  // Ocultar UI de envío
  const helpText = document.getElementById('helpText');
  const btn = document.getElementById('btnFirmar');
  const limpiarBtn = document.getElementById('btnLimpiar');
  const procBox = document.getElementById('processingState');

  if (helpText) helpText.style.display = 'none';
  if (procBox) procBox.style.display = 'none';

  // Bloquear todos los controles
  document.body.classList.add('form-locked');
  document.querySelectorAll('input, textarea').forEach(el => el.disabled = true);

  if (btn) {
    btn.disabled = true;
    btn.classList.add('is-disabled');
    btn.innerHTML = '<i class="fa-solid fa-check-double" aria-hidden="true"></i>Firmado';
  }
  if (limpiarBtn) limpiarBtn.disabled = true;

  // Tarjeta de éxito grande
  const msg = document.getElementById('msg');
  if (msg) {
    msg.style.display = 'none';
    msg.innerHTML = '';
  }

  // Insertar tarjeta de éxito si no existe
  let card = document.getElementById('successCard');
  if (!card) {
    card = document.createElement('div');
    card.id = 'successCard';
    card.className = 'success-card';
    // La insertamos justo después del botón
    const actions = btn ? btn.closest('.actions') : null;
    if (actions && actions.parentNode) {
      actions.parentNode.insertBefore(card, actions.nextSibling);
    } else {
      document.getElementById('contenido').appendChild(card);
    }
  }

  const mensaje = (resp && resp.message) || 'Formulario firmado correctamente.';
  const pdfUrl = (resp && resp.pdf_url) || '';

  card.innerHTML =
    '<div class="success-icon"><i class="fa-solid fa-circle-check" aria-hidden="true"></i></div>' +
    '<h3>Formulario firmado correctamente</h3>' +
    '<p class="success-text">' + escapeHtml(mensaje) + '</p>' +
    (pdfUrl
      ? '<div class="success-actions">' +
          '<a class="btn btn-primary" href="' + escapeHtml(pdfUrl) + '" target="_blank" rel="noopener">' +
            '<i class="fa-solid fa-file-pdf" aria-hidden="true"></i>Ver PDF firmado' +
          '</a>' +
        '</div>'
      : '');

  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ================================================================
// Mensajes inline
// ================================================================

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

// ================================================================
// Bootstrap
// ================================================================

window.addEventListener('DOMContentLoaded', cargarFormulario);
