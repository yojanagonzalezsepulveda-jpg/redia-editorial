// ── STORAGE — localStorage y Google Sheets ──────────────────────────────────
import { state, LOCAL_RECS_KEY } from './state.js?v=7';

export function deduplicateRecs(recs) {
  var seen = {}; var out = [];
  for (var r of recs) {
    // titulo_seo primero: mismo título = mismo artículo aunque el ID difiera
    var key = (r.titulo_seo || '').trim().toLowerCase() || r.id || r._uid || '';
    if (!key || !seen[key]) { seen[key] = true; out.push(r); }
  }
  return out;
}

export function localLoad() {
  try { return JSON.parse(localStorage.getItem(LOCAL_RECS_KEY) || '[]'); } catch(e) { return []; }
}

export function localSave(recs) {
  try { localStorage.setItem(LOCAL_RECS_KEY, JSON.stringify(deduplicateRecs(recs))); } catch(e) {}
}

export function localAddRec(rec) {
  var local = localLoad();
  var idx = local.findIndex(function(r) { return r.id === rec.id || r._uid === rec._uid; });
  if (idx >= 0) local[idx] = rec; else local.push(rec);
  localSave(local);
}

// Mezcla registros de GS con los locales: preserva imagen_src (no se guarda en GS por tamaño)
export function mergeConLocal(gsRecs) {
  var local = localLoad();
  return gsRecs.map(function(gr) {
    var lr = local.find(function(r) {
      return (r.id && r.id === gr.id) ||
             ((r.titulo_seo || '').trim().toLowerCase() === (gr.titulo_seo || '').trim().toLowerCase());
    });
    if (lr && lr.imagen_src && !gr.imagen_src) return Object.assign({}, gr, { imagen_src: lr.imagen_src });
    return gr;
  });
}

export async function gsCall(body) {
  var res = await fetch(state.GS_URL || (localStorage.getItem('gs_url') || ''), {
    method: 'POST',
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('Error HTTP ' + res.status);
  return await res.json();
}

export async function guardarGS() {
  var GS_URL = document.getElementById('gsUrl').value.trim();
  state.GS_URL = GS_URL;
  localStorage.setItem('gs_url', GS_URL);
  setGsStatus('Conectando...', 'cs-w');
  try {
    var d = await gsCall({ action: 'listar' });
    console.log('[GS listar response]', JSON.stringify(d).slice(0, 500));
    if (!d.ok) throw new Error(d.error || 'Respuesta sin ok:true — revisa el Apps Script');
    state.records = deduplicateRecs(mergeConLocal(d.records || []));
    localSave(state.records);
    renderBandeja();
    state._gsRetries = 0;
    setGsStatus('Conectado · ' + state.records.length + ' registro' + (state.records.length !== 1 ? 's' : ''), 'cs-ok');
  } catch(e) {
    setGsStatus('Error: ' + e.message, 'cs-err');
    console.error('[GS error]', e);
  }
}

export function limpiarDuplicados() {
  state.records = deduplicateRecs(state.records);
  localSave(state.records);
  renderBandeja();
}

export async function cargarBandeja() {
  var GS_URL = state.GS_URL || localStorage.getItem('gs_url') || '';
  if (!GS_URL) return;
  try {
    var d = await gsCall({ action: 'listar' });
    if (d.ok) { state.records = d.records || []; renderBandeja(); }
  } catch(e) { console.warn(e); }
}

export async function gsGuardar(rec) {
  var GS_URL = state.GS_URL || localStorage.getItem('gs_url') || '';
  if (!GS_URL) return null;
  try {
    var d = await gsCall({ action: 'guardar', record: rec });
    return d.id || null;
  } catch(e) { console.warn('GS save:', e.message); return null; }
}

export async function gsActualizar(id, campo, valor) {
  var GS_URL = state.GS_URL || localStorage.getItem('gs_url') || '';
  if (!GS_URL || !id) return;
  try { await gsCall({ action: 'actualizar', id, campo, valor }); }
  catch(e) { console.warn('GS update:', e.message); }
}

// Importación circular resuelta en app.js — estas funciones se inyectan en el módulo
var renderBandeja, setGsStatus;
export function _injectStorageDeps(deps) {
  renderBandeja = deps.renderBandeja;
  setGsStatus = deps.setGsStatus;
}
