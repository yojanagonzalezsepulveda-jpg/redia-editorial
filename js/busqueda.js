// ── BÚSQUEDA — búsqueda manual y generación automática ───────────────────────
import { state } from './state.js?v=7';
import { localLoad, localAddRec, localSave, deduplicateRecs, mergeConLocal, gsCall, gsGuardar } from './storage.js?v=7';
import { esc, sleep, parseJSON, normalizeRec } from './utils.js?v=7';
import { getAIKey, buildProvOrder, callGemini, callAI } from './ai.js?v=7';
import { buildPromptInvestigar, buildPromptRedactar, buildPromptDistribuir } from './prompts.js?v=7';

// Inyección de dependencias circulares
var _buildHTML, _renderBandeja, _generarImagenGemini, _resizarImg820x400;
export function _injectBusquedaDeps(deps) {
  _buildHTML = deps.buildHTML;
  _renderBandeja = deps.renderBandeja;
  _generarImagenGemini = deps.generarImagenGemini;
  _resizarImg820x400 = deps.resizarImg820x400;
}

// ── CHIPS / TAGS ──────────────────────────────────────────────────────────────
export function updEsp() {
  var sel = [...document.querySelectorAll('#eGrid .chip.on')].map(e => e.textContent.trim());
  var lbl = document.getElementById('eLabel');
  if (!lbl) return;
  lbl.textContent = sel.length ? 'Especies — ' + sel.join(', ') : 'Especies (opcional) — Todas';
}

export function updFoc() {
  var n = document.querySelectorAll('#fGrid .ftag.on').length;
  var lbl = document.getElementById('fLabel');
  if (!lbl) return;
  lbl.textContent = n ? 'Focos — ' + n + ' seleccionado' + (n > 1 ? 's' : '') : 'Focos temáticos (opcional) — Todos';
}

// ── ESTADO GS ─────────────────────────────────────────────────────────────────
export function setGsStatus(text, cls) {
  var st  = document.getElementById('gsSt');
  var nav = document.getElementById('gsNavSt');
  if (st) { st.textContent = text; st.className = 'cst ' + (cls || 'cs-w'); }
  if (nav) {
    nav.textContent = cls === 'cs-ok' ? '● GS' : cls === 'cs-err' ? '⚠ GS' : '○ GS';
    nav.style.display = 'inline';
    nav.style.background = cls === 'cs-ok' ? '#dcfce7' : cls === 'cs-err' ? '#fee2e2' : '#fef9c3';
    nav.style.color = cls === 'cs-ok' ? '#15803d' : cls === 'cs-err' ? '#dc2626' : '#854d0e';
  }
}

// ── AUTO-CONECTAR GS ──────────────────────────────────────────────────────────
export async function autoConectarGS() {
  if (!state.GS_URL) return;
  if (state._gsTimer) { clearTimeout(state._gsTimer); state._gsTimer = null; }
  try {
    var d = await gsCall({ action: 'listar' });
    if (d.ok) {
      state.records = deduplicateRecs(mergeConLocal(d.records || []));
      localSave(state.records);
      setGsStatus('Conectado · ' + state.records.length + ' registro' + (state.records.length !== 1 ? 's' : ''), 'cs-ok');
      _renderBandeja();
      state._gsRetries = 0;
      state._gsTimer = setTimeout(autoConectarGS, 5 * 60 * 1000);
    } else {
      throw new Error(d.error || 'Sin ok');
    }
  } catch(e) {
    state._gsRetries++;
    var delay = Math.min(state._gsRetries * 5000, 30000);
    setGsStatus('Reconectando...', 'cs-w');
    state._gsTimer = setTimeout(autoConectarGS, delay);
  }
}

// ── BÚSQUEDA MANUAL ───────────────────────────────────────────────────────────
export function cancelarBusqueda() {
  if (state._busquedaAbort) state._busquedaAbort.abort();
}

export async function buscarManual() {
  var esp = [...document.querySelectorAll('#eGrid .chip.on')].map(e => e.dataset.v);
  var foc = [...document.querySelectorAll('#fGrid .ftag.on')].map(e => e.dataset.v);
  var kw  = document.getElementById('kwIn').value.trim();
  var km  = document.getElementById('keyMissing');
  var avail = buildProvOrder(state.AI_PROV_SEARCH || localStorage.getItem('ai_prov_search') || 'auto').filter(function(p) { return !!getAIKey(p); });
  if (!avail.length) { if (km) km.style.display = 'block'; return; }
  if (km) km.style.display = 'none';
  var btn = document.getElementById('genBtn');
  btn.disabled = true; btn.innerHTML = '<div class="spnw"></div> Generando...';
  document.getElementById('searchEmpty').style.display   = 'none';
  document.getElementById('searchResult').style.display  = 'none';
  document.getElementById('searchLoading').style.display = 'block';
  var CFG  = state.CFG;
  var minW = parseInt(CFG.words || '600');

  function sp(pct, txt) { document.getElementById('pFill').style.width = pct + '%'; document.getElementById('lStep').innerHTML = txt; }
  function err(msg) {
    document.getElementById('searchLoading').style.display = 'none';
    document.getElementById('searchEmpty').style.display   = 'flex';
    document.getElementById('searchEmpty').innerHTML = '<div style="background:var(--errb);border:1px solid var(--errbr);border-radius:14px;padding:20px;max-width:400px;color:var(--err);font-size:13px;line-height:1.6"><strong>Error:</strong><br>' + msg + '</div>';
  }
  function na(ms) { state._busquedaAbort = new AbortController(); return setTimeout(() => state._busquedaAbort.abort(), ms); }
  function rb() { btn.disabled = false; btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> Generar informe ahora'; }
  function isRL(e) { return e.message && e.message.startsWith('RATE_LIMIT'); }
  function errMsg(e) { return e.message && e.message.startsWith('RATE_LIMIT') ? 'Límite de tokens/minuto. Espera 60s e intenta de nuevo.' : (e.name === 'AbortError' ? 'Tiempo agotado.' : e.message); }

  function cleanTrackingUrl(s) {
    if (!s) return s;
    if (/utm_|mailchimp|mc_eid|mc_cid|EMAIL_CAMPAIGN/i.test(s)) {
      var urlMatch = s.match(/https?:\/\/[^\s?&]+/);
      if (urlMatch) return urlMatch[0];
      return s.replace(/[?&]?(utm_\w+|mc_eid|mc_cid|EMAIL_CAMPAIGN)[^&]*/g, '').replace(/^[?&]/, '').trim();
    }
    return s;
  }
  kw = cleanTrackingUrl(kw);
  var searchQ = ((kw || '') + ' ' + (esp.join(' ')) + ' ' + (foc.join(' '))).trim();

  // ── PASO 1: Investigar (con fallback automático entre proveedores) ──
  var avail1 = avail.filter(function(p) {
    if (p === 'gem' || p === 'ant') return true;
    if (p === 'deep') return !!(state.CFG && state.CFG.tavilyKey);
    return false;
  });
  if (!avail1.length) { err('Paso 1 requiere búsqueda web. Configura Gemini, Claude o DeepSeek+Tavily en Credenciales → API Keys IA.'); rb(); return; }
  var provLabel = avail1[0] === 'gem' ? 'Gemini + Google Search' : avail1[0] === 'ant' ? 'Claude + Web Search' : 'DeepSeek + Tavily';
  sp(5, 'Paso 1/3 — Investigando con ' + provLabel + '...');
  var t1 = na(90000); var r1;
  var temasCubiertos = (state.records || []).map(function(r) { return r.titular || r.titulo_seo || ''; }).filter(Boolean);

  var SALMON_KW    = /salm[oó]n|salmonicultura|salmón|trucha|acuicultura.*salm|salm.*acuicultura/i;
  var ultimosRecs  = (state.records || []).slice(-5);
  var ultimosSalmones = ultimosRecs.filter(function(r) { return SALMON_KW.test(r.titular || r.titulo_seo || ''); }).length;
  var forzarRotacion  = (!kw && !esp.length && ultimosSalmones >= 2);
  var especiesForzar  = '';
  if (forzarRotacion) {
    var cubiertas  = temasCubiertos.join(' ').toLowerCase();
    var candidatas = [
      { e: 'mitilicultura y mejillones (choritos)', k: 'mitilicultura|mejillón|chorito' },
      { e: 'ostiones y pectinicultura',             k: 'ostión|pectinicultura' },
      { e: 'ostras',                                k: 'ostra' },
      { e: 'algas marinas (pelillo, luga, huiro)',  k: 'alga|pelillo|luga|huiro' },
      { e: 'erizo de mar',                          k: 'erizo' },
      { e: 'abalón',                                k: 'abalón|abalon' }
    ];
    var elegida    = candidatas.find(function(c) { return !new RegExp(c.k, 'i').test(cubiertas); }) || candidatas[0];
    especiesForzar = elegida.e;
  }

  try { r1 = await callAI(buildPromptInvestigar(esp, foc, kw, temasCubiertos, especiesForzar), true, null, null, state._busquedaAbort.signal, searchQ || 'acuicultura Chile noticias'); clearTimeout(t1); }
  catch(e) { clearTimeout(t1); state._busquedaAbort = null; err('Error en investigación: ' + errMsg(e)); rb(); return; }

  if (!r1 || r1.trim().length < 30) {
    var preview = r1 ? r1.trim().substring(0, 200) : '(respuesta vacía)';
    err('La investigación no devolvió datos.<br><small style="opacity:.7">Respuesta del AI: ' + esc(preview) + '</small><br><small>Verifica que las API keys estén configuradas en <b>Credenciales → API Keys IA</b>.</small>');
    rb(); return;
  }

  function p1Field(text, key) { var m = text.match(new RegExp(key + ':\\s*(.+)', 'i')); return m ? m[1].trim() : ''; }
  function p1List(text, key) {
    var m = text.match(new RegExp(key + ':\\s*\\n((?:\\s*-[^\\n]+\\n?)+)', 'i'));
    if (!m) return [];
    return m[1].split('\n').map(function(l) { return l.replace(/^\s*-\s*/, '').trim(); }).filter(Boolean);
  }
  var inv = {
    titulo:  p1Field(r1, 'TITULO'),
    url:     p1Field(r1, 'URL'),
    fuente:  p1Field(r1, 'FUENTE'),
    fecha:   p1Field(r1, 'FECHA'),
    angulo:  p1Field(r1, 'ANGULO'),
    contexto: p1Field(r1, 'CONTEXTO'),
    hechos:  p1List(r1, 'HECHOS'),
    noticias_recientes: p1List(r1, 'NOTICIAS_RECIENTES'),
    fuentes_adicionales: p1List(r1, 'OTRAS_FUENTES').map(function(l) {
      var nm = l.match(/Nombre:\s*([^|]+)/i), ul = l.match(/URL:\s*([^|]+)/i), ap = l.match(/Aporte:\s*(.+)/i);
      return { nombre: (nm ? nm[1].trim() : ''), url: (ul ? ul[1].trim() : ''), aporte: (ap ? ap[1].trim() : '') };
    })
  };
  if (!inv.titulo) {
    err('La investigación no encontró una noticia. Intenta con un tema más específico o una URL directa.<br><pre style="font-size:10px;white-space:pre-wrap;margin-top:8px;max-height:100px;overflow:auto;background:rgba(0,0,0,.15);padding:6px;border-radius:6px">' + esc(r1.substring(0, 400)) + '</pre>');
    rb(); return;
  }

  // ── PASO 2: Redactar ──
  sp(38, 'Paso 2/3 — Redactando: <em>' + esc((inv.titulo || '').substring(0, 55)) + '</em>...');
  var t2 = na(90000); var r2;
  try { r2 = await callAI(buildPromptRedactar(inv, minW), false, null, 12000, state._busquedaAbort.signal); clearTimeout(t2); }
  catch(e) { clearTimeout(t2); state._busquedaAbort = null; err('Error en redacción: ' + errMsg(e)); rb(); return; }

  var rec;
  try { rec = normalizeRec(parseJSON(r2)); }
  catch(e) {
    if (r2 && r2.length > 20) {
      sp(60, 'Reparando formato del artículo...');
      try {
        var t2b = na(40000); var r2b;
        r2b = await callAI('El siguiente JSON tiene errores (posiblemente comillas sin escapar en el HTML del campo "cuerpo"). Corrígelo y devuelve SOLO el JSON válido sin texto adicional. Usa comillas simples en atributos HTML dentro de strings JSON:\n\n' + r2.substring(0, 4000), false, null, 3000, state._busquedaAbort.signal);
        clearTimeout(t2b);
        rec = normalizeRec(parseJSON(r2b));
      } catch(e2) {
        err('No se pudo procesar el artículo.<br><pre style="font-size:10px;white-space:pre-wrap;margin-top:8px;max-height:100px;overflow:auto;background:rgba(0,0,0,.15);padding:6px;border-radius:6px">' + esc((r2 || '(vacío)').substring(0, 400)) + '</pre>');
        rb(); return;
      }
    } else {
      err('El artículo no pudo generarse. Intenta de nuevo.<br><pre style="font-size:10px;white-space:pre-wrap;margin-top:8px;max-height:80px;overflow:auto;background:rgba(0,0,0,.15);padding:6px;border-radius:6px">' + esc((r2 || '(sin respuesta)').substring(0, 400)) + '</pre>');
      rb(); return;
    }
  }

  // Validar que el artículo tiene contenido
  if (!rec.cuerpo_html || rec.cuerpo_html.length < 100) {
    err('El artículo se generó sin contenido. Intenta de nuevo o cambia el proveedor IA.');
    rb(); return;
  }

  // ── PASO 3: Distribución ──
  sp(72, 'Paso 3/3 — Generando LinkedIn, Facebook y guiones...');
  var t3 = na(60000); var r3;
  try { r3 = await callAI(buildPromptDistribuir(rec.titular, rec.bajada, rec.analisis_muestra), false, (CFG && CFG.antModel2) || 'claude-haiku-4-5-20251001', 2000, state._busquedaAbort.signal); clearTimeout(t3); }
  catch(e) { clearTimeout(t3); r3 = null; }

  if (r3) { try { var dist = parseJSON(r3); rec.linkedin = dist.linkedin || ''; rec.facebook = dist.facebook || ''; rec.audio_script = dist.audio_script || ''; rec.video_script = dist.video_script || ''; } catch(e) {} }

  // ── Imagen (automática, no bloquea si falla) ──
  if (rec.imagen_prompt && _generarImagenGemini && _resizarImg820x400) {
    sp(90, 'Generando imagen...');
    try {
      var imgKey = getAIKey('gem');
      if (imgKey) {
        var imgRaw = await _generarImagenGemini(rec.imagen_prompt, imgKey);
        if (imgRaw) rec.imagen_src = await _resizarImg820x400(imgRaw);
      }
    } catch(e) { /* imagen no crítica — continúa sin ella */ }
  }

  rec.fecha_fuente     = inv.fecha || '';
  rec.html_publicable  = _buildHTML(rec);
  rec._uid             = rec.id;
  state.manualRec  = rec;
  state.manualRecs = [rec];

  sp(100, 'Listo');
  await sleep(200);
  document.getElementById('searchLoading').style.display = 'none';

  // Importar buildCard dinámicamente para evitar circular
  var { buildCard } = await import('./bandeja.js');

  var res = document.getElementById('searchResult');
  res.style.display = 'block';
  var srcUrl  = inv.url   || '';
  var srcName = inv.fuente || 'la fuente original';
  res.innerHTML =
    '<div class="cards-hd"><div><div class="cards-title">Informe generado</div><div class="cards-sub">Revisa, edita y publica cuando esté listo</div></div>' +
    '<div style="display:flex;gap:7px"><button class="rbtn" style="background:linear-gradient(135deg,var(--ok),var(--t5))" onclick="guardarTodosEnGS()">Guardar en bandeja</button>' +
    '</div></div>' +
    '<div style="background:#fefce8;border:1px solid #fde047;border-radius:10px;padding:12px 16px;margin-bottom:14px;font-size:12px;color:#713f12;line-height:1.6">' +
    '<strong>Verificar antes de publicar:</strong> Este borrador es un análisis editorial generado por IA a partir de hechos y datos. ' +
    'Verifica cifras y datos clave contra ' + (srcUrl ? '<a href="' + esc(srcUrl) + '" target="_blank" style="color:#92400e;font-weight:700">' + esc(srcName) + '</a>' : esc(srcName)) +
    ' antes de publicar.</div>' +
    buildCard(rec);
  setTimeout(() => { var b = document.getElementById('body-' + rec.id); if (b) b.classList.add('open'); }, 100);
  rb();
}

export async function guardarManualEnGS() {
  if (!state.manualRec) return;
  var id = await gsGuardar(state.manualRec);
  if (id) { state.manualRec.id = id; alert('Guardado en la bandeja editorial.'); }
  else alert('No se pudo guardar. Verifica la conexión con Google Sheets.');
}

export async function guardarTodosEnGS() {
  var recs = state.manualRecs || [state.manualRec];
  if (!recs.length) return;
  for (var r of recs) localAddRec(r);
  state.records = localLoad();
  _renderBandeja();
  var gsOk = 0;
  if (state.GS_URL) {
    for (var r of recs) {
      var id = await gsGuardar(r);
      if (id) { r.id = id; gsOk++; }
    }
    if (gsOk) {
      try {
        var d = await gsCall({ action: 'listar' });
        if (d.ok) { state.records = deduplicateRecs(mergeConLocal(d.records || [])); localSave(state.records); _renderBandeja(); }
      } catch(e) {}
    }
  }
  alert(recs.length + ' informe' + (recs.length !== 1 ? 's guardados' : ' guardado') + ' en la bandeja editorial.' + (state.GS_URL && !gsOk ? ' (solo local — verifica conexión GS)' : ''));
}

// ── GENERAR AUTOMÁTICO ────────────────────────────────────────────────────────
export async function generarAutomatico(btn) {
  var gemKey = getAIKey('gem');
  if (!gemKey) { alert('Configura la API key de Gemini en Credenciales → API Keys IA'); return; }

  var origTxt = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spnw"></div> Generando...'; }

  function setNotif(txt) {
    var n = document.getElementById('autoGenNotif');
    if (!n) {
      n = document.createElement('div'); n.id = 'autoGenNotif';
      n.style.cssText = 'background:#fef9c3;border:1px solid #fde047;border-radius:10px;padding:10px 14px;font-size:12px;color:#713f12;margin-bottom:10px;display:flex;gap:8px;align-items:center';
      var c = document.getElementById('bandejaContent');
      if (c) c.insertAdjacentElement('afterbegin', n);
    }
    n.innerHTML = '<div class="spnw" style="border-top-color:#713f12"></div> ' + txt;
  }
  function clearNotif() { var n = document.getElementById('autoGenNotif'); if (n) n.remove(); }

  try {
    var temasCubiertos  = (state.records || []).map(function(r) { return r.titular || r.titulo_seo || ''; }).filter(Boolean);
    var SALMON_KW2      = /salm[oó]n|salmonicultura|salmón|trucha|acuicultura.*salm|salm.*acuicultura/i;
    var ultimosSalmones2 = (state.records || []).slice(-5).filter(function(r) { return SALMON_KW2.test(r.titular || r.titulo_seo || ''); }).length;
    var especiesForzar2  = '';
    if (ultimosSalmones2 >= 2) {
      var cubiertas2 = temasCubiertos.join(' ').toLowerCase();
      var candidatas2 = [
        { e: 'mitilicultura y mejillones (choritos)', k: 'mitilicultura|mejillón|chorito' },
        { e: 'ostiones y pectinicultura',             k: 'ostión|pectinicultura' },
        { e: 'ostras',                                k: 'ostra' },
        { e: 'algas marinas (pelillo, luga, huiro)',  k: 'alga|pelillo|luga|huiro' },
        { e: 'erizo de mar',                          k: 'erizo' },
        { e: 'abalón',                                k: 'abalón|abalon' }
      ];
      var elegida2    = candidatas2.find(function(c) { return !new RegExp(c.k, 'i').test(cubiertas2); }) || candidatas2[0];
      especiesForzar2 = elegida2.e;
    }

    setNotif('Paso 1/3 — Investigando con Gemini + Google Search...');
    var r1 = await callGemini(buildPromptInvestigar([], [], null, temasCubiertos, especiesForzar2), gemKey, null, true, null);
    if (!r1 || r1.trim().length < 30) throw new Error('La investigación no devolvió datos. Intenta de nuevo.');

    function p1f(text, key) { var m = text.match(new RegExp(key + ':\\s*(.+)', 'i')); return m ? m[1].trim() : ''; }
    function p1l(text, key) {
      var m = text.match(new RegExp(key + ':\\s*\\n((?:\\s*-[^\\n]+\\n?)+)', 'i'));
      if (!m) return [];
      return m[1].split('\n').map(function(l) { return l.replace(/^\s*-\s*/, '').trim(); }).filter(Boolean);
    }
    var inv2 = {
      titulo: p1f(r1, 'TITULO'), url: p1f(r1, 'URL'), fuente: p1f(r1, 'FUENTE'),
      fecha: p1f(r1, 'FECHA'), angulo: p1f(r1, 'ANGULO'), contexto: p1f(r1, 'CONTEXTO'),
      hechos: p1l(r1, 'HECHOS'), noticias_recientes: p1l(r1, 'NOTICIAS_RECIENTES'),
      fuentes_adicionales: p1l(r1, 'OTRAS_FUENTES').map(function(l) {
        var nm = l.match(/Nombre:\s*([^|]+)/i), ul = l.match(/URL:\s*([^|]+)/i), ap = l.match(/Aporte:\s*(.+)/i);
        return { nombre: (nm ? nm[1].trim() : ''), url: (ul ? ul[1].trim() : ''), aporte: (ap ? ap[1].trim() : '') };
      })
    };
    if (!inv2.titulo) throw new Error('No se encontró una noticia. Intenta de nuevo.');

    setNotif('Paso 2/3 — Redactando: <em>' + inv2.titulo.substring(0, 55) + '</em>...');
    var CFG2 = state.CFG;
    var minW2 = parseInt(CFG2.words || '600');
    var r2 = await callGemini(buildPromptRedactar(inv2, minW2), gemKey, null, false, 6000);
    var rec2;
    try { rec2 = normalizeRec(parseJSON(r2)); }
    catch(e) {
      var r2b = await callGemini('El siguiente JSON tiene errores. Corrígelo devolviendo SOLO el JSON válido:\n\n' + r2.substring(0, 4000), gemKey, null, false, 3000);
      rec2 = normalizeRec(parseJSON(r2b));
    }

    setNotif('Paso 3/3 — Generando LinkedIn, Facebook y guiones...');
    try {
      var r3 = await callAI(buildPromptDistribuir(rec2.titular, rec2.bajada, rec2.analisis_muestra), false, (CFG2 && CFG2.antModel2) || 'claude-haiku-4-5-20251001', 2000, null);
      if (r3) { var dist2 = parseJSON(r3); rec2.linkedin = dist2.linkedin || ''; rec2.facebook = dist2.facebook || ''; rec2.audio_script = dist2.audio_script || ''; rec2.video_script = dist2.video_script || ''; }
    } catch(e) {}

    rec2.fecha_fuente    = inv2.fecha || '';
    rec2.html_publicable = _buildHTML(rec2);
    rec2._uid            = rec2.id;

    setNotif('Guardando en bandeja...');
    localAddRec(rec2);
    state.records = localLoad();
    if (state.GS_URL) { var id = await gsGuardar(rec2); if (id) rec2.id = id; }

    clearNotif();
    _renderBandeja();
    setTimeout(function() { var b = document.getElementById('body-' + rec2._uid); if (b) b.classList.add('open'); }, 200);

  } catch(e) {
    clearNotif();
    var n = document.getElementById('autoGenNotif') || document.createElement('div');
    n.id = 'autoGenNotif';
    n.style.cssText = 'background:#fff1f2;border:1px solid #fecdd3;border-radius:10px;padding:10px 14px;font-size:12px;color:#be123c;margin-bottom:10px';
    n.textContent = 'Error al generar: ' + e.message;
    var c = document.getElementById('bandejaContent'); if (c) c.insertAdjacentElement('afterbegin', n);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = origTxt; }
  }
}
