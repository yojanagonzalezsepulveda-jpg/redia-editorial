// ── UTILS — funciones de utilidad pura ──────────────────────────────────────

export function esc(t) {
  return (t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function sj(v, d) {
  if (!v) return d;
  if (Array.isArray(v)) return v;
  try { return JSON.parse(v); } catch { return d; }
}

export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export async function cp(text, btn) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    if (btn) {
      var o = btn.textContent; btn.classList.add('ok'); btn.textContent = 'Copiado';
      setTimeout(() => { btn.textContent = o; btn.classList.remove('ok'); }, 2000);
    }
  } catch { alert('Usa Ctrl+C para copiar.'); }
}

export function cpRec(uid, campo, btn) {
  var rec = getRec(uid); if (!rec) return;
  cp(rec[campo] || '', btn);
}

export function dlHTML(uid) {
  var rec = getRec(uid); if (rec) dlRec(rec);
}

export function dlRec(rec) {
  var html = rec.html_publicable || buildHTML(rec);
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  a.download = 'redia-' + (rec.titulo_seo || 'informe').substring(0, 40).replace(/\s+/g, '-').toLowerCase() + '.html';
  a.click();
}

export function dlManual() {
  var manualRec = window._state && window._state.manualRec;
  if (manualRec) dlRec(manualRec);
}

export function cpHTML(uid, btn) {
  var rec = getRec(uid); if (!rec) return;
  cp(rec.html_publicable || buildHTML(rec), btn);
}

export function mdToHtml(s) {
  if (!s) return s;
  var lines = s.split('\n');
  var out = [];
  var inP = false;
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i].trim();
    if (!l) { if (inP) { out.push('</p>'); inP = false; } continue; }
    if (l.startsWith('### ')) { if (inP) { out.push('</p>'); inP = false; } out.push('<h3>' + inlineMd(l.slice(4)) + '</h3>'); continue; }
    if (l.startsWith('## ')) { if (inP) { out.push('</p>'); inP = false; } out.push('<h2>' + inlineMd(l.slice(3)) + '</h2>'); continue; }
    if (l.startsWith('# ')) { if (inP) { out.push('</p>'); inP = false; } out.push('<h2>' + inlineMd(l.slice(2)) + '</h2>'); continue; }
    if (!inP) { out.push('<p>'); inP = true; } else { out.push(' '); }
    out.push(inlineMd(l));
  }
  if (inP) out.push('</p>');
  return out.join('');
}

export function inlineMd(s) {
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

// Reemplazos automáticos de vocabulario prohibido — red de seguridad independiente del prompt
export function sanitizeVocab(s) {
  if (!s) return s;
  return s
    .replace(/\bla industria acuícola\b/gi, 'el sector acuícola')
    .replace(/\bla industria salmonera\b/gi, 'el sector salmonero')
    .replace(/\bla industria del salmón\b/gi, 'el sector del salmón')
    .replace(/\bla industria mitilicultora\b/gi, 'el sector mitilicultor')
    .replace(/\bla industria\b/gi, 'el sector')
    .replace(/\bsu industria\b/gi, 'su sector')
    .replace(/\besta industria\b/gi, 'este sector')
    .replace(/\bnuestra industria\b/gi, 'nuestro sector')
    .replace(/\bdicha industria\b/gi, 'dicho sector')
    .replace(/\bla misma industria\b/gi, 'el mismo sector')
    .replace(/\bindustria acuícola\b/gi, 'sector acuícola')
    .replace(/\bindustria salmonera\b/gi, 'sector salmonero')
    .replace(/\bindustria del salmón\b/gi, 'sector del salmón')
    .replace(/\bindustria\b/gi, 'sector')
    .replace(/[Cc]abe destacar(,?\s*que)?\s*/g, '')
    .replace(/[Cc]abe mencionar(,?\s*que)?\s*/g, '')
    .replace(/[Ee]s importante señalar(,?\s*que)?\s*/g, '')
    .replace(/[Rr]esulta relevante(,?\s*que)?\s*/g, '')
    .replace(/[Ee]s fundamental(,?\s*que)?\s*/g, '')
    .replace(/[Vv]ale la pena señalar(,?\s*que)?\s*/g, '')
    .replace(/[Ee]n este sentido,?\s*/g, '')
    .replace(/[Aa] modo de conclusión,?\s*/g, '')
    .replace(/[Ss]in lugar a dudas,?\s*/g, '')
    .replace(/\btrascendental(es)?\b/gi, 'relevante$1')
    .replace(/\bsin precedentes\b/gi, 'inédito')
    .replace(/\b[Pp]aradigma\b/g, 'modelo')
    .replace(/\b[Ss]inergia[s]?\b/gi, 'colaboración')
    .replace(/\b[Rr]obusto(s|a|as)?\b/gi, 'sólido$1')
    .replace(/\b[Tt]ransformador(a|es|as)?\b/gi, 'relevante')
    .replace(/\b[Tt]rascendental(es)?\b/gi, 'relevante$1')
    .replace(/\b[Pp]otenciar\b/gi, 'mejorar')
    .replace(/\b[Pp]otencia\b/gi, 'impulsa')
    .replace(/[Nn]oticia (clave|bomba|transformadora)\b/g, 'Informe')
    .replace(/\bun paso clave\b/gi, 'un avance')
    .replace(/\b[Bb]omba\b/g, 'dato')
    .replace(/\b[Ee]n el marco de\b/gi, 'en')
    .replace(/\b[Ee]n el contexto de\b/gi, 'en el contexto del');
}

export function normalizeRec(d) {
  var a = d.articulo || {};
  var uid = 'M' + Date.now();
  return {
    id: uid, _uid: uid,
    titulo_seo: (d.titulo_seo || '').substring(0, 60),
    descripcion_seo: (d.descripcion_seo || '').substring(0, 140),
    tags: d.tags || [],
    categoria: d.categoria || 'Análisis REDIA',
    tiempo_lectura: d.tiempo_lectura || '5 min',
    fuentes_consultadas: d.fuentes_consultadas || [],
    fuentes_con_links: d.fuentes_con_links || [],
    imagen_prompt: d.imagen_prompt || '',
    titular: sanitizeVocab(a.titular || ''),
    bajada: sanitizeVocab(a.bajada || ''),
    cuerpo_html: sanitizeVocab(mdToHtml(a.cuerpo || '')),
    analisis_muestra: sanitizeVocab(mdToHtml(a.analisis_muestra || '')),
    analisis_no_resuelve: sanitizeVocab(a.analisis_no_resuelve || ''),
    analisis_relevante_para: sanitizeVocab(a.analisis_relevante_para || ''),
    beneficios: a.beneficios || [],
    dolores: a.dolores || [],
    alcances: a.alcances || [],
    coyuntura: a.coyuntura || '',
    linkedin: d.linkedin || '',
    facebook: d.facebook || '',
    audio_script: d.audio_script || '',
    video_script: d.video_script || '',
    estado: 'pendiente',
    fuente_original: 'Búsqueda manual',
    fecha: new Date().toLocaleDateString('es-CL'),
    fecha_fuente: '',
    html_publicable: '',
  };
}

export function parseJSON(raw) {
  var clean = raw.split('```json').join('').split('```').join('').trim();
  // Try array first (multiple reports)
  try {
    var arrMatch = clean.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      var arr = JSON.parse(arrMatch[0]);
      if (Array.isArray(arr) && arr.length) return arr;
    }
  } catch(e) {}
  // Try single object
  try {
    var m = clean.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
  } catch(e) {
    // Try to fix truncated JSON
    var partial = clean.match(/\{[\s\S]*/);
    if (partial) {
      var fixed = partial[0];
      var opens = (fixed.match(/\[/g) || []).length - (fixed.match(/\]/g) || []).length;
      var openb = (fixed.match(/\{/g) || []).length - (fixed.match(/\}/g) || []).length;
      for (var i = 0; i < opens; i++) fixed += ']';
      for (var i = 0; i < openb; i++) fixed += '}';
      try { return JSON.parse(fixed); } catch(e2) {}
    }
  }
  throw new Error('No se pudo procesar la respuesta. Intenta de nuevo.');
}

// Inyección de dependencias circulares (getRec y buildHTML se inyectan desde app.js)
var getRec, buildHTML;
export function _injectUtilsDeps(deps) {
  getRec = deps.getRec;
  buildHTML = deps.buildHTML;
}
