// ── CREAR — generación de contenido editorial por tipo ───────────────────────
import { state } from './state.js';
import { gsGuardar } from './storage.js';
import { esc, parseJSON, normalizeRec, sleep } from './utils.js';
import { callAI } from './ai.js';
import { buildPromptByTipo } from './prompts.js';
import { leerArchivoAdjunto, leerImagen64, leerImagenes64Multi, generarImagenGemini, resizarImg820x400, injectMediaIntoHTML } from './media.js';
import { renderBandeja, buildCard } from './bandeja.js';

// Inyección de dependencias circulares
var _buildHTML;
export function _injectCrearDeps(deps) {
  _buildHTML = deps.buildHTML;
}

var TIPO_LABELS = { noticia: 'Análisis / Redacción propia', entrevista: 'Entrevista', mercado: 'Aviso de Mercado', patrocinado: 'Contenido patrocinado' };

var CREAR_STEPS = {
  noticia:     ['Analizando tus notas...', 'Estructurando el artículo...', 'Redactando con voz REDIA...', 'Generando SEO y RRSS...', 'Generando imagen...'],
  entrevista:  ['Procesando la entrevista...', 'Redactando introducción...', 'Editando preguntas y respuestas...', 'Generando SEO y RRSS...', 'Generando imagen...'],
  mercado:     ['Analizando el aviso...', 'Redactando con tono editorial...', 'Estructurando la oferta...', 'Generando SEO...', 'Generando imagen...'],
  patrocinado: ['Procesando el mensaje del cliente...', 'Redactando con tono editorial...', 'Sin lenguaje publicitario...', 'Generando SEO y RRSS...', 'Generando imagen...'],
};

export function selTipo(tipo, el) {
  state.tipoActual = tipo;
  document.querySelectorAll('.tipo-card').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  ['noticia', 'entrevista', 'mercado', 'patrocinado'].forEach(t => {
    var f = document.getElementById('form-' + t);
    if (f) f.style.display = t === tipo ? 'block' : 'none';
  });
  document.getElementById('crear-result').style.display  = 'none';
  document.getElementById('crear-loading').style.display = 'none';
  var tabBtn = document.querySelector('button.ntab[onclick*="\'crear\'"]');
  if (tabBtn) {
    var tn = [...tabBtn.childNodes].filter(n => n.nodeType === 3).pop();
    if (tn) tn.textContent = '\n      ' + (TIPO_LABELS[tipo] || 'Crear contenido') + '\n    ';
  }
}

export async function generarCrear(tipo) {
  var CFG    = state.CFG;
  var gemKey = (CFG && CFG.gemKey) || '';

  document.getElementById('form-' + tipo).style.display  = 'none';
  document.getElementById('crear-result').style.display  = 'none';
  document.getElementById('crear-loading').style.display = 'block';
  document.getElementById('crear-pfill').style.width     = '0%';

  var steps = CREAR_STEPS[tipo] || CREAR_STEPS.noticia;
  var si = 0;
  var st = setInterval(() => {
    if (si < steps.length) {
      document.getElementById('crear-step').textContent = steps[si];
      document.getElementById('crear-pfill').style.width = ((si + 1) / steps.length * 85) + '%';
      si++;
    }
  }, 40000 / steps.length);

  try {
    var adjunto       = await leerArchivoAdjunto(tipo[0] + '-archivo');
    var logoData      = tipo === 'patrocinado' ? await leerImagen64('p-logo') : null;
    var productImages = [];
    if (tipo === 'patrocinado') {
      productImages = await leerImagenes64Multi('p-imagenes', 3);
    } else if (tipo === 'mercado') {
      var mImg = await leerImagen64('m-imagen-prod');
      if (mImg) productImages = [mImg.dataUrl];
    }
    var prompt  = buildPromptByTipo(tipo);
    var searchQ = document.getElementById(tipo[0] + '-titulo')?.value.trim() || document.getElementById(tipo[0] + '-persona')?.value.trim() || '';
    var raw;
    if (logoData) {
      var logoTxt = prompt + '\n\nLogo del cliente adjunto como imagen. Analízalo para describir mejor la identidad visual de la empresa en el contenido.';
      if (adjunto && adjunto.text) logoTxt += '\n\nDOCUMENTO ADJUNTO:\n' + adjunto.text.substring(0, 8000);
      raw = await callAI(null, false, (CFG && CFG.antModel1) || 'claude-sonnet-4-20250514', null, null, null, [
        { type: 'image', source: { type: 'base64', media_type: logoData.mimeType, data: logoData.base64 } },
        { type: 'text', text: logoTxt }
      ]);
    } else if (adjunto && adjunto.imageBase64) {
      raw = await callAI(null, true, (CFG && CFG.antModel1) || 'claude-sonnet-4-20250514', null, null, searchQ, [
        { type: 'image', source: { type: 'base64', media_type: adjunto.mimeType, data: adjunto.imageBase64 } },
        { type: 'text', text: prompt + '\n\nDOCUMENTO ADJUNTO: imagen proporcionada arriba. Analízala, extrae la información relevante y úsala como fuente primaria para el informe.' }
      ]);
    } else {
      if (adjunto && adjunto.text) prompt += '\n\nDOCUMENTO ADJUNTO:\n' + adjunto.text.substring(0, 8000) + '\n\nAnaliza este documento, extrae la información relevante y úsala como fuente primaria para el informe.';
      raw = await callAI(prompt, true, (CFG && CFG.antModel1) || 'claude-sonnet-4-20250514', null, null, searchQ);
    }
    clearInterval(st);
    document.getElementById('crear-pfill').style.width = '90%';

    var data     = parseJSON(raw);
    var crearRec = normalizeRec(data);
    state.crearRec = crearRec;
    if (logoData)           crearRec._logoSrc      = logoData.dataUrl;
    if (productImages.length) crearRec._productImages = productImages;
    crearRec.html_publicable = _buildHTML(crearRec);
    if (crearRec._logoSrc || crearRec._productImages) {
      crearRec.html_publicable = injectMediaIntoHTML(crearRec.html_publicable, crearRec._logoSrc, crearRec._productImages);
    }

    // Generar imagen
    if (gemKey && crearRec.imagen_prompt) {
      document.getElementById('crear-step').textContent = 'Generando imagen con Gemini...';
      var imgRaw = await generarImagenGemini(crearRec.imagen_prompt, gemKey);
      if (imgRaw) crearRec._imagenSrc = await resizarImg820x400(imgRaw);
    }

    document.getElementById('crear-pfill').style.width = '100%';
    await sleep(300);
    document.getElementById('crear-loading').style.display = 'none';

    var res = document.getElementById('crear-result');
    res.style.display = 'block';

    var imgBlock = crearRec._imagenSrc
      ? `<div style="width:100%;height:240px;border-radius:14px;overflow:hidden;margin-bottom:20px;position:relative"><img src="${crearRec._imagenSrc}" style="width:100%;height:100%;object-fit:cover;border-radius:14px"></div>`
      : `<div style="background:linear-gradient(135deg,var(--p1),var(--t0));border-radius:14px;padding:20px;margin-bottom:20px;font-size:12px;color:var(--s5);line-height:1.5"><strong style="color:var(--s7)">Prompt de imagen:</strong><br>${esc(crearRec.imagen_prompt || '')}<br><br><button class="img-gen-btn" onclick="generarImgManual()" style="margin-top:4px">Generar imagen ahora</button></div>`;

    res.innerHTML =
      '<div class="cards-hd"><div><div class="cards-title">Publicación generada</div><div class="cards-sub">Revisa, edita si necesitas, luego publica</div></div>' +
      '<div style="display:flex;gap:7px;flex-wrap:wrap">' +
      '<button class="rbtn" onclick="dlCrear()">Descargar HTML</button>' +
      '<button class="rbtn" onclick="copiarHTMLCrear(this)">Copiar HTML</button>' +
      (state.GS_URL ? '<button class="rbtn" style="background:linear-gradient(135deg,var(--ok),var(--t5))" onclick="guardarCrearEnGS()">Guardar en bandeja</button>' : '') +
      '</div></div>' +
      '<div style="background:var(--s1);border:1px solid var(--s2);border-radius:12px;padding:16px;margin-bottom:16px">' +
      '<div style="font-size:12px;font-weight:700;color:var(--s7);margin-bottom:10px">Editar antes de publicar</div>' +
      '<label style="font-size:11px;color:var(--s5);display:block;margin-bottom:4px">Titular</label>' +
      '<input id="edit-titular" value="' + esc(crearRec.articulo?.titular || '') + '" style="width:100%;padding:8px 10px;border:1px solid var(--s3);border-radius:8px;font-size:13px;font-weight:600;background:var(--s0);color:var(--s8);box-sizing:border-box;margin-bottom:8px">' +
      '<label style="font-size:11px;color:var(--s5);display:block;margin-bottom:4px">Bajada</label>' +
      '<textarea id="edit-bajada" rows="2" style="width:100%;padding:8px 10px;border:1px solid var(--s3);border-radius:8px;font-size:12px;background:var(--s0);color:var(--s8);box-sizing:border-box;resize:vertical;margin-bottom:10px">' + esc(crearRec.articulo?.bajada || '') + '</textarea>' +
      '<button onclick="aplicarEdicionManual()" style="padding:7px 14px;background:var(--p6);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;margin-right:8px">Aplicar cambios</button>' +
      '<span style="font-size:11px;color:var(--s4)">— o —</span>' +
      '<div style="margin-top:10px"><label style="font-size:11px;color:var(--s5);display:block;margin-bottom:4px">Pedir corrección a la IA</label>' +
      '<div style="display:flex;gap:8px"><input id="edit-ia-instruccion" placeholder="Ej: acorta el titular, cambia el tono a más formal, agrega contexto sobre Chile..." style="flex:1;padding:8px 10px;border:1px solid var(--s3);border-radius:8px;font-size:12px;background:var(--s0);color:var(--s8)">' +
      '<button onclick="corregirConIA()" style="padding:7px 14px;background:var(--t5);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap">Corregir con IA</button></div></div>' +
      '</div>' +
      imgBlock +
      buildCard(crearRec);

    setTimeout(() => {
      var b = document.getElementById('body-' + crearRec.id);
      if (b) b.classList.add('open');
    }, 100);

  } catch(e) {
    clearInterval(st);
    document.getElementById('crear-loading').style.display = 'none';
    document.getElementById('form-' + tipo).style.display  = 'block';
    alert('Error: ' + e.message);
  }
}

// Función legacy — se mantiene para compatibilidad; la real está en prompts.js
export function buildCrearPrompt(tipo) {
  return buildPromptByTipo(tipo);
}

export async function guardarCrearEnGS() {
  var crearRec = state.crearRec;
  if (!crearRec || !state.GS_URL) return;
  var id = await gsGuardar(crearRec);
  if (id) {
    crearRec.id = id;
    state.records.unshift(crearRec);
    renderBandeja();
    alert('Guardado en la bandeja editorial.');
  } else {
    alert('Error al guardar. Verifica la conexión con Google Sheets.');
  }
}

export function dlCrear() {
  var crearRec = state.crearRec;
  if (crearRec) {
    // importar dlRec dinámicamente para evitar circular en el arranque
    import('./utils.js').then(({ dlRec }) => dlRec(crearRec));
  }
}

export function copiarHTMLCrear(btn) {
  var crearRec = state.crearRec;
  if (!crearRec) return;
  navigator.clipboard.writeText(crearRec.html_publicable || '').then(function() {
    var orig = btn.textContent; btn.textContent = 'Copiado!';
    setTimeout(function() { btn.textContent = orig; }, 2000);
  });
}

export function aplicarEdicionManual() {
  var crearRec = state.crearRec;
  if (!crearRec) return;
  var t = document.getElementById('edit-titular');
  var b = document.getElementById('edit-bajada');
  if (t && crearRec.articulo) crearRec.articulo.titular = t.value;
  if (b && crearRec.articulo) crearRec.articulo.bajada  = b.value;
  crearRec.html_publicable = _buildHTML(crearRec);
  var tEl = document.querySelector('#body-' + crearRec.id + ' .art-titular, #card-' + crearRec.id + ' .art-titular');
  if (tEl) tEl.textContent = crearRec.articulo.titular;
  var bEl = document.querySelector('#body-' + crearRec.id + ' .art-bajada, #card-' + crearRec.id + ' .art-bajada');
  if (bEl) bEl.textContent = crearRec.articulo.bajada;
  alert('Cambios aplicados. El HTML descargable está actualizado.');
}

export async function corregirConIA() {
  var crearRec = state.crearRec;
  var instruccion = document.getElementById('edit-ia-instruccion');
  if (!instruccion || !instruccion.value.trim()) return alert('Escribe qué quieres corregir.');
  if (!crearRec) return;
  var btn = document.querySelector('[onclick="corregirConIA()"]');
  if (btn) { btn.textContent = 'Corrigiendo...'; btn.disabled = true; }
  try {
    var prompt = 'Eres el editor de REDIA. Tienes este contenido ya generado:\n\nTITULAR: ' + (crearRec.articulo?.titular || '') + '\nBAJADA: ' + (crearRec.articulo?.bajada || '') + '\nCUERPO:\n' + (crearRec.articulo?.cuerpo || '').replace(/<[^>]+>/g, ' ').substring(0, 3000) +
      '\n\nINSTRUCCIÓN DE CORRECCIÓN: ' + instruccion.value.trim() +
      '\n\nResponde SOLO con JSON válido sin markdown con los campos que deban cambiar. Ejemplo: {"titular":"nuevo titular","bajada":"nueva bajada"} o {"cuerpo":"<p>nuevo cuerpo html</p>"}. Solo incluye los campos que cambian.';
    var CFG = state.CFG;
    var raw  = await callAI(prompt, false, (CFG && CFG.antModel2) || 'claude-haiku-4-5-20251001', 4000, null);
    var data = parseJSON(raw);
    if (data.titular && crearRec.articulo) { crearRec.articulo.titular = data.titular; var t = document.getElementById('edit-titular'); if (t) t.value = data.titular; }
    if (data.bajada  && crearRec.articulo) { crearRec.articulo.bajada  = data.bajada;  var b = document.getElementById('edit-bajada');  if (b) b.value = data.bajada; }
    if (data.cuerpo  && crearRec.articulo) crearRec.articulo.cuerpo = data.cuerpo;
    crearRec.html_publicable = _buildHTML(crearRec);
    instruccion.value = '';
    alert('Corrección aplicada.');
  } catch(e) {
    alert('Error: ' + e.message);
  } finally {
    if (btn) { btn.textContent = 'Corregir con IA'; btn.disabled = false; }
  }
}

export function selAll(gridId, cls) {
  document.querySelectorAll('#' + gridId + ' .' + cls).forEach(el => el.classList.add('on'));
}

export function clearAll(gridId, cls) {
  document.querySelectorAll('#' + gridId + ' .' + cls).forEach(el => el.classList.remove('on'));
}
