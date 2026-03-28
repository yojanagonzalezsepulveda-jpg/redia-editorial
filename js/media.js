// ── MEDIA — imagen, audio, video, RRSS ───────────────────────────────────────
import { state } from './state.js';
import { localAddRec, gsActualizar } from './storage.js';
import { sanitizeVocab } from './utils.js';
import { getAIKey, callGemini } from './ai.js';

// Inyección de dependencias circulares
var _getRec, _buildHTML, _renderBandeja;
export function _injectMediaDeps(deps) {
  _getRec = deps.getRec;
  _buildHTML = deps.buildHTML;
  _renderBandeja = deps.renderBandeja;
}

// ── IMAGEN BANDEJA ────────────────────────────────────────────────────────────
export async function generarImgBandeja(uid, btn) {
  var rec = _getRec(uid); if (!rec) return;
  var gemKey = getAIKey('gem');
  if (!gemKey) { alert('Configura la API key de Gemini en Credenciales → API Keys IA'); return; }
  if (!rec.imagen_prompt) { alert('Este artículo no tiene prompt de imagen generado.'); return; }
  var orig = btn.textContent; btn.textContent = 'Generando...'; btn.disabled = true;
  var box = document.getElementById('img-box-' + uid);
  if (box) box.innerHTML = '<span style="color:#94a3b8;font-size:12px">Generando imagen...</span>';
  try {
    var raw = await generarImagenGemini(rec.imagen_prompt, gemKey);
    if (!raw) throw new Error('No se pudo generar la imagen. Intenta de nuevo.');
    var src = await resizarImg820x400(raw);
    rec.imagen_src = src;
    localAddRec(rec);
    if (box) box.innerHTML = '<img src="' + src + '" style="width:100%;border-radius:10px">';
    var dl = document.getElementById('dl-img-' + uid);
    if (dl) { dl.href = src; dl.download = 'redia-imagen-' + uid + '.png'; dl.style.display = 'inline'; }
    var thumb = document.getElementById('card-thumb-' + uid);
    if (thumb) { thumb.src = src; thumb.style.display = 'block'; }
    btn.textContent = orig; btn.disabled = false;
  } catch(e) {
    if (box) box.innerHTML = '<span style="color:#ef4444;font-size:12px">' + e.message + '</span>';
    btn.textContent = orig; btn.disabled = false;
  }
}

// ── AUDIO / VIDEO ─────────────────────────────────────────────────────────────
export function dirtyMedia(uid, tipo) {
  var btn = document.getElementById('savebtn-media-' + tipo + '-' + uid);
  if (btn) { btn.textContent = 'Guardar'; btn.style.background = '#d97706'; btn.style.opacity = '1'; btn.disabled = false; }
}

export async function guardarMedia(uid, tipo) {
  var rec = _getRec(uid); if (!rec) return;
  var campo = tipo === 'audio' ? 'audio_script' : 'video_script';
  var btn = document.getElementById('savebtn-media-' + tipo + '-' + uid);
  var texto = (document.getElementById('media-' + tipo + '-' + uid)?.value || '').trim();
  rec[campo] = texto;
  localAddRec(rec);
  if (rec.id) await gsActualizar(rec.id, campo, texto);
  if (btn) {
    btn.textContent = 'Guardado ✓'; btn.style.background = '#15803d'; btn.style.opacity = '1';
    setTimeout(function() { btn.textContent = 'Guardar'; btn.style.background = '#94a3b8'; btn.style.opacity = '.5'; btn.disabled = true; }, 2000);
  }
}

export async function generarMedia(uid, tipo, btn) {
  var rec = _getRec(uid); if (!rec) return;
  var gemKey = getAIKey('gem');
  if (!gemKey) { alert('Configura la API key de Gemini en Credenciales → API Keys IA'); return; }
  var orig = btn.textContent; btn.textContent = '...'; btn.disabled = true;
  try {
    var titular = rec.titular || '';
    var bajada  = rec.bajada  || '';
    var cuerpo  = (rec.cuerpo_html || '').replace(/<[^>]+>/g, ' ').substring(0, 2000);
    var prompt = tipo === 'audio'
      ? `Eres el editor de contenidos de REDIA — Red de Inteligencia Acuícola de Chile.

Escribe un guión de narración en audio para este informe. Será leído en voz alta como podcast o nota de voz.

TITULAR: ${titular}
BAJADA: ${bajada}
CONTENIDO: ${cuerpo}

REGLAS:
- Tono informativo, cercano y directo — como si le hablaras a un profesional del sector
- Sin exclamaciones ni lenguaje alarmista
- Escribe como se habla, no como se lee
- Mín 300 palabras
- Abre con el hecho central sin rodeos
- Cierra mencionando REDIA como fuente de inteligencia acuícola

Responde SOLO con el guión, sin títulos ni etiquetas.`
      : `Eres el editor de contenidos de REDIA — Red de Inteligencia Acuícola de Chile.

Escribe un guión para video YouTube sobre este informe.

TITULAR: ${titular}
BAJADA: ${bajada}
CONTENIDO: ${cuerpo}

REGLAS:
- Usa timecodes en formato 00:00 al inicio de cada sección
- Indica descripción visual entre [corchetes] cuando sea relevante
- Tono informativo y directo, sin sensacionalismo
- Mín 300 palabras
- Cierra con CTA: suscribirse a REDIA en redia.pro

Responde SOLO con el guión, sin explicaciones adicionales.`;

    var raw = await callGemini(prompt, gemKey, null, false, 3000);
    if (!raw || raw.trim().length < 20) throw new Error('Respuesta vacía');
    var campo = tipo === 'audio' ? 'audio_script' : 'video_script';
    var texto = sanitizeVocab(raw.trim());
    rec[campo] = texto;
    localAddRec(rec);
    if (rec.id) await gsActualizar(rec.id, campo, texto);
    var box = document.getElementById('media-' + tipo + '-' + uid);
    if (box) box.value = texto;
    btn.textContent = orig; btn.disabled = false;
    dirtyMedia(uid, tipo);
  } catch(e) {
    btn.textContent = orig; btn.disabled = false;
    alert('Error: ' + e.message);
  }
}

export function dirtyRRSS(uid, red) {
  var key = red === 'linkedin' ? 'li' : 'fb';
  var btn = document.getElementById('savebtn-rrss-' + key + '-' + uid);
  if (btn) { btn.textContent = 'Guardar'; btn.style.background = '#d97706'; btn.style.opacity = '1'; btn.disabled = false; }
}

export async function guardarRRSS(uid, red) {
  var rec = _getRec(uid); if (!rec) return;
  var key = red === 'linkedin' ? 'li' : 'fb';
  var btn = document.getElementById('savebtn-rrss-' + key + '-' + uid);
  var texto = (document.getElementById('rrss-' + key + '-' + uid)?.value || '').trim();
  rec[red] = texto;
  localAddRec(rec);
  if (rec.id) await gsActualizar(rec.id, red, texto);
  if (btn) {
    btn.textContent = 'Guardado ✓'; btn.style.background = '#15803d'; btn.style.opacity = '1';
    setTimeout(function() { btn.textContent = 'Guardar'; btn.style.background = '#94a3b8'; btn.style.opacity = '.5'; btn.disabled = true; }, 2000);
  }
}

export async function generarRedSocial(uid, red, btn) {
  var rec = _getRec(uid); if (!rec) return;
  var gemKey = getAIKey('gem');
  if (!gemKey) { alert('Configura la API key de Gemini en Credenciales → API Keys IA'); return; }
  var orig = btn.textContent; btn.textContent = '...'; btn.disabled = true;
  try {
    var titular = rec.titular || '';
    var bajada  = rec.bajada  || '';
    var cuerpo  = (rec.cuerpo_html || '').replace(/<[^>]+>/g, ' ').substring(0, 1500);
    var esLI = red === 'linkedin';
    var prompt = `Eres el editor de distribución de REDIA — Red de Inteligencia Acuícola de Chile.

TITULAR: ${titular}
BAJADA: ${bajada}
RESUMEN: ${cuerpo}

Genera SOLO el post de ${esLI ? 'LinkedIn' : 'Facebook'} para este informe.

${esLI ? `Estilo LinkedIn REDIA — ejemplos de apertura correcta:
"Chile autorizó 47 nuevas concesiones de mitilicultura en la Región de Los Lagos."
"El IFOP publicó su informe anual de biomasa de merluza: las cifras muestran recuperación en tres zonas."
"SUBPESCA abrió consulta pública sobre el nuevo reglamento de acuicultura offshore."

Abre con el hecho concreto del artículo, igual de directo. Sin exclamaciones. Sin adjetivos grandilocuentes. Tono: analista sectorial, no comunicado de prensa.
- 1-2 emojis máximo si son relevantes al tema
- Incluye link https://redia.pro al final
- Entre 500 y 900 caracteres` : `Estilo Facebook REDIA — ejemplos de apertura correcta:
"Chile aprobó más de 200 proyectos salmoneros que estaban detenidos."
"El IFOP confirma recuperación de biomasa en tres zonas pesqueras del sur."

Abre igual de directo. Sin exclamaciones. Sin exageración.
- Máx 350 caracteres
- Incluye link https://redia.pro al final`}

Responde SOLO con el texto del post completo, sin explicaciones ni etiquetas. Termina con oración completa y el link. NUNCA cortes a mitad.`;

    var raw = await callGemini(prompt, gemKey, null, false, 2000);
    if (!raw || raw.trim().length < 10) throw new Error('Respuesta vacía');
    var texto = sanitizeVocab(raw.trim());
    rec[red] = texto;
    localAddRec(rec);
    if (rec.id) await gsActualizar(rec.id, red, texto);
    var box = document.getElementById('rrss-' + (esLI ? 'li' : 'fb') + '-' + uid);
    if (box) box.value = texto;
    btn.textContent = '↺ Generar'; btn.disabled = false;
    dirtyRRSS(uid, red);
  } catch(e) {
    btn.textContent = orig; btn.disabled = false;
    alert('Error: ' + e.message);
  }
}

export async function generarDistribucion(uid) {
  var rec = _getRec(uid); if (!rec) return;
  var btn = document.getElementById('distbtn-' + uid);
  if (btn) { btn.textContent = 'Generando...'; btn.disabled = true; }
  try {
    var gemKey = getAIKey('gem');
    if (!gemKey) throw new Error('Configura la API key de Gemini en Credenciales → API Keys IA');
    var titular = rec.titular || '';
    var bajada  = rec.bajada  || '';
    var cuerpo  = (rec.cuerpo_html || '').replace(/<[^>]+>/g, ' ').substring(0, 2000);
    var prompt = `Eres el editor de distribución de REDIA — Red de Inteligencia Acuícola de Chile.

Genera los textos de distribución para este informe:

TITULAR: ${titular}
BAJADA: ${bajada}
RESUMEN: ${cuerpo}

Responde en este formato exacto (sin JSON, sin markdown, sin explicaciones):

LINKEDIN:
[post LinkedIn informativo, profesional, con emojis sectoriales 🐟🌊, incluye el link https://redia.pro al final, máx 1200 caracteres]

FACEBOOK:
[post Facebook más conversacional y breve, incluye link https://redia.pro, máx 500 caracteres]`;

    var raw = await callGemini(prompt, gemKey, null, false, 1500);
    if (!raw || raw.trim().length < 10) throw new Error('Respuesta vacía de Gemini');

    var liMatch = raw.match(/LINKEDIN[:\s]+\n?([\s\S]*?)(?=\n\s*FACEBOOK[:\s]|$)/i);
    var fbMatch = raw.match(/FACEBOOK[:\s]+\n?([\s\S]*?)$/i);
    var li = (liMatch?.[1] || '').trim().replace(/^\[|\]$/g, '');
    var fb = (fbMatch?.[1] || '').trim().replace(/^\[|\]$/g, '');
    if (!li) throw new Error('No se encontró el post de LinkedIn en la respuesta');

    rec.linkedin = li;
    rec.facebook = fb;
    localAddRec(rec);
    if (rec.id) {
      if (li) await gsActualizar(rec.id, 'linkedin', li);
      if (fb) await gsActualizar(rec.id, 'facebook', fb);
    }
    _renderBandeja();
    setTimeout(() => { var b = document.getElementById('body-' + uid); if (b) b.classList.add('open'); }, 50);
  } catch(e) {
    alert('Error generando distribución: ' + e.message);
    if (btn) { btn.textContent = 'Generar distribución'; btn.disabled = false; }
  }
}

// ── IMAGEN GEMINI / POLLINATIONS ──────────────────────────────────────────────
export function resizarImg820x400(dataUrl) {
  return new Promise(function(resolve) {
    var img = new Image();
    img.onload = function() {
      var W = 820, H = 400;
      var canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      var ctx = canvas.getContext('2d');
      var scale = Math.max(W / img.width, H / img.height);
      var sw = W / scale, sh = H / scale;
      var sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = function() { resolve(dataUrl); };
    img.src = dataUrl;
  });
}

export async function generarImagenPollinations(prompt) {
  var polUrl = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt.substring(0, 500)) +
               '?model=flux&width=820&height=400&nologo=true&seed=' + Math.floor(Math.random() * 99999);
  var polRes = await fetch(polUrl);
  if (!polRes.ok) throw new Error('Pollinations HTTP ' + polRes.status);
  var blob = await polRes.blob();
  return await new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onloadend = function() { resolve(reader.result); };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function generarImagenGemini(prompt, key) {
  var CFG = state.CFG;
  // Pollinations primero (gratis). Solo usar Gemini si Pollinations falla O si el usuario
  // explícitamente configuró un modelo de imagen de Gemini/Imagen 3.
  var modeloExplicito = CFG && CFG.imagenModel && CFG.imagenModel.trim();
  if (!modeloExplicito) {
    try { return await generarImagenPollinations(prompt); } catch(e) { /* fallback a Gemini */ }
  }
  var model = (CFG && CFG.imagenModel) || '';
  var IMG_MODELS = [
    { m: 'gemini-2.0-flash-exp',                      mod: ['IMAGE'] },
    { m: 'gemini-2.0-flash-exp',                      mod: ['TEXT', 'IMAGE'] },
    { m: 'gemini-2.0-flash-preview-image-generation', mod: ['IMAGE'] },
    { m: 'gemini-2.0-flash-preview-image-generation', mod: ['TEXT', 'IMAGE'] },
  ];
  var customOk = model && (model.includes('image') || model.includes('imagen') || model.includes('imgen'))
                       && !model.startsWith('imagen');
  var GEMINI_TRIES = model.startsWith('imagen') ? [] :
    (customOk
      ? [{ m: model, mod: ['IMAGE'] }, { m: model, mod: ['TEXT', 'IMAGE'] }].concat(IMG_MODELS)
      : IMG_MODELS);
  try {
    if (!model.startsWith('imagen')) {
      var allErrs = [];
      for (var mi = 0; mi < GEMINI_TRIES.length; mi++) {
        var tryModel   = GEMINI_TRIES[mi].m;
        var modalities = GEMINI_TRIES[mi].mod;
        try {
          var apiVer = GEMINI_TRIES[mi].api || 'v1beta';
          var res = await fetch('https://generativelanguage.googleapis.com/' + apiVer + '/models/' + tryModel + ':generateContent?key=' + key, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseModalities: modalities }
            })
          });
          var respTxt = await res.text();
          if (!res.ok) {
            allErrs.push(tryModel + '[' + modalities.join('+') + '/' + apiVer + ']: HTTP ' + res.status + ' — ' + respTxt.slice(0, 100));
            continue;
          }
          var d = JSON.parse(respTxt);
          var parts = d.candidates?.[0]?.content?.parts || [];
          var imgPart = parts.find(function(p) { return p.inlineData; });
          if (!imgPart) {
            allErrs.push(tryModel + '[' + modalities.join('+') + ']: sin imagen — ' + JSON.stringify(d).slice(0, 100));
            continue;
          }
          return 'data:' + imgPart.inlineData.mimeType + ';base64,' + imgPart.inlineData.data;
        } catch(ex) {
          allErrs.push(tryModel + ': ' + ex.message);
        }
      }
      // Fallback: Pollinations.ai
      try {
        var polUrl = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt.substring(0, 500)) +
                     '?model=flux&width=820&height=400&nologo=true&seed=' + Math.floor(Math.random() * 99999);
        var polRes = await fetch(polUrl);
        if (polRes.ok) {
          var blob = await polRes.blob();
          return await new Promise(function(resolve, reject) {
            var reader = new FileReader();
            reader.onloadend = function() { resolve(reader.result); };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } else {
          allErrs.push('pollinations: HTTP ' + polRes.status);
        }
      } catch(pe) { allErrs.push('pollinations: ' + pe.message); }
      throw new Error('Sin modelos disponibles. Errores:\n' + allErrs.join('\n'));
    } else {
      // Imagen 3 (predict)
      var res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':predict?key=' + key, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: '16:9' } })
      });
      if (!res.ok) {
        var errTxt = await res.text().catch(function() { return res.status + ''; });
        throw new Error('API ' + res.status + ': ' + errTxt.slice(0, 200));
      }
      var d = await res.json();
      var b64 = d.predictions?.[0]?.bytesBase64Encoded;
      if (!b64) throw new Error('Sin imagen en respuesta de Imagen 3: ' + JSON.stringify(d).slice(0, 200));
      return 'data:' + (d.predictions[0].mimeType || 'image/png') + ';base64,' + b64;
    }
  } catch(e) { throw e; }
}

export async function generarImgManual() {
  var crearRec = state.crearRec;
  if (!crearRec) return;
  var gemKey = (state.CFG && state.CFG.gemKey) || '';
  if (!gemKey) return alert('Ingresa tu API key de Gemini en Credenciales → API Keys IA.');
  var raw = await generarImagenGemini(crearRec.imagen_prompt, gemKey);
  var src = raw ? await resizarImg820x400(raw) : null;
  if (src) {
    crearRec._imagenSrc = src;
    crearRec.html_publicable = _buildHTML(crearRec);
    var res = document.getElementById('crear-result');
    if (res) {
      var old = res.querySelector('.img-gen-btn')?.closest('div');
      if (old) old.outerHTML = `<div style="width:100%;height:240px;border-radius:14px;overflow:hidden;margin-bottom:20px;position:relative"><img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:14px"></div>`;
    }
  } else {
    alert('No se pudo generar la imagen. Verifica tu API key de Gemini.');
  }
}

// ── ARCHIVOS ADJUNTOS ─────────────────────────────────────────────────────────
export function previsualizarImg(input, imgId) {
  var nmEl = document.getElementById(input.id + '-nm');
  var file = input.files[0]; if (!file) return;
  if (nmEl) nmEl.textContent = file.name;
  var img = document.getElementById(imgId); if (!img) return;
  var reader = new FileReader();
  reader.onload = e => { img.src = e.target.result; img.style.display = 'block'; };
  reader.readAsDataURL(file);
}

export function previsualizarMulti(input, containerId) {
  var container = document.getElementById(containerId); if (!container) return;
  var nmEl = document.getElementById(input.id + '-nm');
  var files = [...input.files].slice(0, 3);
  if (nmEl) nmEl.textContent = files.length ? files.length + ' archivo' + (files.length > 1 ? 's' : '') + ' seleccionado' + (files.length > 1 ? 's' : '') : 'Sin archivos';
  container.innerHTML = '';
  files.forEach(file => {
    var reader = new FileReader();
    reader.onload = e => {
      var img = document.createElement('img');
      img.src = e.target.result;
      img.style.cssText = 'height:60px;width:90px;object-fit:cover;border-radius:6px;border:1px solid var(--s2)';
      container.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
}

export function leerImagen64(inputId) {
  return new Promise(resolve => {
    var input = document.getElementById(inputId);
    if (!input || !input.files || !input.files[0]) return resolve(null);
    var file = input.files[0];
    var reader = new FileReader();
    reader.onload = e => {
      var dataUrl = e.target.result;
      resolve({ dataUrl, base64: dataUrl.split(',')[1], mimeType: file.type || 'image/png' });
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export function leerImagenes64Multi(inputId, max) {
  var input = document.getElementById(inputId);
  if (!input || !input.files || !input.files.length) return Promise.resolve([]);
  var files = [...input.files].slice(0, max);
  return Promise.all(files.map(file => new Promise(resolve => {
    var reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  }))).then(r => r.filter(Boolean));
}

export function injectMediaIntoHTML(html, logoSrc, productImages) {
  if (logoSrc) {
    html = html.replace('<div class="cat">', '<div style="margin-bottom:18px"><img src="' + logoSrc + '" style="height:52px;object-fit:contain;display:block"></div><div class="cat">');
  }
  if (productImages && productImages.length) {
    var cols = productImages.length === 1 ? '1fr' : productImages.length === 2 ? '1fr 1fr' : '1fr 1fr 1fr';
    var gallery = '<div style="display:grid;grid-template-columns:' + cols + ';gap:12px;margin:28px 0">' +
      productImages.map(s => '<img src="' + s + '" style="width:100%;border-radius:10px;object-fit:cover;aspect-ratio:16/9">').join('') +
      '</div>';
    html = html.replace('<div class="insight">', gallery + '<div class="insight">');
  }
  return html;
}

export function leerArchivoAdjunto(inputId) {
  return new Promise(resolve => {
    var input = document.getElementById(inputId);
    if (!input || !input.files || !input.files[0]) return resolve(null);
    var file = input.files[0];
    var name = file.name.toLowerCase();
    var reader = new FileReader();
    if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg')) {
      reader.onload = e => {
        var b64 = e.target.result.split(',')[1];
        resolve({ imageBase64: b64, mimeType: name.endsWith('.png') ? 'image/png' : 'image/jpeg' });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    } else {
      reader.onload = e => resolve({ text: e.target.result });
      reader.onerror = () => resolve(null);
      reader.readAsText(file, 'UTF-8');
    }
  });
}
