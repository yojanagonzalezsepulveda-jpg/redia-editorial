// ── CONFIG — configuración editorial y credenciales ──────────────────────────
import { state } from './state.js';

export var DEFAULT_FUENTES = ['Aqua.cl','MundoAcuícola','Intesal','SalmonExpert','Diario Acuícola','Mundo Marítimo','Portal Acuícola','Revista Aqua','SERNAPESCA','SUBPESCA','INDESPA','CORFO','SERCOTEC','ANID','FIC','FONDECYT','ProChile','SNA','SENCE','Ministerio de Economía','Ministerio del Medio Ambiente','Ministerio de Salud','Ministerio de Trabajo','Subsecretaría de Pesca','Dirección del Trabajo','SEREMI de Salud Los Lagos','SEREMI de Salud Aysén','SMA (Superintendencia del Medio Ambiente)','Contraloría General de la República','FIMA (Fiscalía del Medio Ambiente)','CONAF','DIRECTEMAR (Armada de Chile)','Gobierno Regional Los Lagos','Gobierno Regional Aysén','Gobierno Regional Magallanes','Gobierno Regional Los Ríos','Gobierno Regional Biobío','Gobierno Regional Araucanía','SalmonChile','Consejo del Salmón','Asociación de Mitilicultores','Asociación de Piscicultores','AquaPacífico','Federación de Pescadores','UACH','UCT','UCSC','PUCV','UdeC','UFRO','IFOP','Centro INCAR','Centro FONDAP','Fundación Chinquihue','ULAM','Centros de Innovación Regional Los Lagos','Centros de Innovación Regional Aysén','El Llanquihue','Diario de Aysén','La Discusión','MiradaSur','Diario Chiloé','El Sureño','IntraFish','SalmonBusiness','Fish Farmer','Undercurrent News','Eurofish','Globefish','FAO','OCDE','Banco Mundial','IUCN','OIE/OMSA','WorldFish','Nofima','Institute of Marine Research Noruega','CSIRO Australia','Cámara de Diputadas y Diputados','Senado de la República','Comisión de Pesca y Acuicultura Cámara','Comisión de Pesca y Acuicultura Senado','Comisión de Medio Ambiente Cámara','Comisión de Medio Ambiente Senado','Comisión de Trabajo Cámara','Comisión de Trabajo Senado','Comisión de Salud Cámara','Comisión de Salud Senado','Comisión de Transporte Cámara','Comisión de Hacienda Cámara','Comisión de Hacienda Senado','Comisión de Economía Cámara','Comisión de Economía Senado','Biblioteca del Congreso Nacional BCN'];

export function loadCFG() {
  try { return JSON.parse(localStorage.getItem('redia_cfg') || '{}'); } catch { return {}; }
}

export function saveCFG(obj) {
  Object.assign(state.CFG, obj);
  localStorage.setItem('redia_cfg', JSON.stringify(state.CFG));
}

export function applyCFG() {
  var CFG = state.CFG;
  if (CFG.tono) document.querySelectorAll('#toneGrid .tone-o').forEach(el => el.classList.toggle('on', el.dataset.t === CFG.tono));
  if (CFG.audiencias) document.querySelectorAll('#audGrid .aud-o').forEach(el => el.classList.toggle('on', (CFG.audiencias || []).includes(el.dataset.a)));
  var m = { cfVoz: 'voz', cfSensible: 'sensible', cfAud: 'aud', cfWords: 'words', cfSecc: 'secc', cfEstr: 'estr', cfDim: 'dim', cfAnal: 'anal', cfProh: 'proh', cfGeminiModel: 'geminiModel', cfImagenModel: 'imagenModel', cfAntModel1: 'antModel1', cfAntModel2: 'antModel2', cfDeepModel: 'deepModel', cfGemKey: 'gemKey', cfDeepKey: 'deepKey', cfTavilyKey: 'tavilyKey', cfAntKey: 'antKey' };
  Object.entries(m).forEach(([elId, key]) => { var el = document.getElementById(elId); if (el && CFG[key]) el.value = CFG[key]; });
  var fuentesGuardadas = CFG.fuentes ? CFG.fuentes.split('\n').filter(Boolean) : DEFAULT_FUENTES;
  renderFuentesPills(fuentesGuardadas);
}

export function guardarCfg(sec, btn) {
  var d = {};
  if (sec === 'voz') { d.voz = document.getElementById('cfVoz').value; d.sensible = document.getElementById('cfSensible').value; }
  else if (sec === 'audiencia') { d.audiencias = [...document.querySelectorAll('#audGrid .aud-o.on')].map(e => e.dataset.a); d.aud = document.getElementById('cfAud').value; }
  else if (sec === 'estructura') { d.words = document.getElementById('cfWords').value; d.secc = document.getElementById('cfSecc').value; d.estr = document.getElementById('cfEstr').value; }
  else if (sec === 'analisis') { d.dim = document.getElementById('cfDim').value; d.anal = document.getElementById('cfAnal').value; }
  else if (sec === 'fuentes') { d.fuentes = getFuentesActivas().join('\n'); }
  else if (sec === 'prohibido') { d.proh = document.getElementById('cfProh').value; }
  else if (sec === 'modelos') { d.geminiModel = document.getElementById('cfGeminiModel').value.trim(); d.imagenModel = document.getElementById('cfImagenModel').value.trim(); d.antModel1 = document.getElementById('cfAntModel1').value.trim(); d.antModel2 = document.getElementById('cfAntModel2').value.trim(); d.deepModel = document.getElementById('cfDeepModel').value.trim(); }
  else if (sec === 'apikeys') { d.gemKey = document.getElementById('cfGemKey').value.trim(); d.deepKey = document.getElementById('cfDeepKey').value.trim(); d.tavilyKey = document.getElementById('cfTavilyKey').value.trim(); d.antKey = document.getElementById('cfAntKey').value.trim(); }
  saveCFG(d);
  var orig = btn.textContent; btn.textContent = 'Guardado'; btn.classList.add('ok');
  setTimeout(() => { btn.textContent = orig; btn.classList.remove('ok'); }, 2000);
}

export function cargarCredenciales() {
  var pbUrl   = localStorage.getItem('cr_pb_url')   || 'https://publicar.redia.pro';
  var pbEmail = localStorage.getItem('cr_pb_email') || '';
  var pbPass  = localStorage.getItem('cr_pb_pass')  || '';
  var liToken = localStorage.getItem('cr_li_token') || '';
  var liOrg   = localStorage.getItem('cr_li_orgid') || '';
  var fbToken = localStorage.getItem('cr_fb_token') || '';
  var fbPage  = localStorage.getItem('cr_fb_pageid') || '';

  if (document.getElementById('cr-pb-url'))    document.getElementById('cr-pb-url').value    = pbUrl;
  if (document.getElementById('cr-pb-email'))  document.getElementById('cr-pb-email').value  = pbEmail;
  if (document.getElementById('cr-pb-pass'))   document.getElementById('cr-pb-pass').value   = pbPass;
  if (document.getElementById('cr-li-token'))  document.getElementById('cr-li-token').value  = liToken;
  if (document.getElementById('cr-li-orgid'))  document.getElementById('cr-li-orgid').value  = liOrg;
  if (document.getElementById('cr-fb-token'))  document.getElementById('cr-fb-token').value  = fbToken;
  if (document.getElementById('cr-fb-pageid')) document.getElementById('cr-fb-pageid').value = fbPage;

  updatePlatBadges();
}

export function updatePlatBadges() {
  var hasLI = !!localStorage.getItem('cr_li_token');
  var hasFB = !!localStorage.getItem('cr_fb_token');
  var liBadge = document.getElementById('ptg-li-badge');
  var fbBadge = document.getElementById('ptg-fb-badge');
  if (liBadge) { liBadge.textContent = hasLI ? 'Listo' : 'Configurar primero'; liBadge.className = 'plat-badge' + (hasLI ? ' ok' : ''); }
  if (fbBadge) { fbBadge.textContent = hasFB ? 'Listo' : 'Configurar primero'; fbBadge.className = 'plat-badge' + (hasFB ? ' ok' : ''); }
}

export async function probarPB() {
  var url   = document.getElementById('cr-pb-url').value.trim();
  var email = document.getElementById('cr-pb-email').value.trim();
  var pass  = document.getElementById('cr-pb-pass').value;
  var st    = document.getElementById('cr-pb-status');
  st.textContent = 'Probando...'; st.style.color = 'var(--s4)';
  try {
    var res = await fetch(url + '/api/admins/auth-with-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: email, password: pass })
    });
    if (!res.ok) throw new Error('Credenciales incorrectas');
    st.textContent = '✓ Conexión exitosa'; st.style.color = 'var(--ok)';
  } catch(e) {
    st.textContent = '✗ ' + e.message; st.style.color = 'var(--err)';
  }
}

export function guardarCredPB() {
  localStorage.setItem('cr_pb_url',   document.getElementById('cr-pb-url').value.trim());
  localStorage.setItem('cr_pb_email', document.getElementById('cr-pb-email').value.trim());
  localStorage.setItem('cr_pb_pass',  document.getElementById('cr-pb-pass').value);
  document.getElementById('cr-pb-status').textContent = '✓ Guardado';
  document.getElementById('cr-pb-status').style.color = 'var(--ok)';
}

export function guardarCredLI() {
  localStorage.setItem('cr_li_token', document.getElementById('cr-li-token').value.trim());
  localStorage.setItem('cr_li_orgid', document.getElementById('cr-li-orgid').value.trim());
  document.getElementById('cr-li-status').textContent = '✓ Guardado';
  document.getElementById('cr-li-status').style.color = 'var(--ok)';
  updatePlatBadges();
}

export function guardarCredFB() {
  localStorage.setItem('cr_fb_token',  document.getElementById('cr-fb-token').value.trim());
  localStorage.setItem('cr_fb_pageid', document.getElementById('cr-fb-pageid').value.trim());
  document.getElementById('cr-fb-status').textContent = '✓ Guardado';
  document.getElementById('cr-fb-status').style.color = 'var(--ok)';
  updatePlatBadges();
}

export function showCredSec(id, el) {
  document.querySelectorAll('#page-credenciales .cpg').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('#page-credenciales .cni').forEach(b => b.classList.remove('on'));
  document.getElementById('cred-' + id).classList.add('on');
  el.classList.add('on');
  if (id === 'historial') renderHistorial();
}

export function renderFuentesPills(fuentes) {
  var c = document.getElementById('fuentesPills'); if (!c) return;
  c.innerHTML = fuentes.map(f => `<span data-fuente="${f.replace(/"/g,'&quot;')}" style="display:inline-flex;align-items:center;gap:4px;background:var(--p1);color:var(--p6);border:1px solid var(--p3);border-radius:20px;padding:3px 10px;font-size:12px;font-weight:500">${f}<button onclick="this.parentElement.remove()" title="Eliminar" style="background:none;border:none;cursor:pointer;color:var(--s5);font-size:15px;line-height:1;padding:0 0 1px 3px">&times;</button></span>`).join('');
}

export function getFuentesActivas() {
  var c = document.getElementById('fuentesPills'); if (!c) return [];
  return [...c.querySelectorAll('span')].map(s => s.dataset.fuente);
}

export function agregarFuente() {
  var input = document.getElementById('fuentesInput');
  var val = input.value.trim(); if (!val) return;
  var activas = getFuentesActivas();
  if (!activas.includes(val)) { activas.push(val); renderFuentesPills(activas); }
  input.value = '';
}

export function renderHistorial() {
  var hist = JSON.parse(localStorage.getItem('redia_historial') || '[]');
  var el = document.getElementById('historialList');
  if (!el) return;
  if (!hist.length) { el.innerHTML = '<div style="color:var(--s4);font-size:13px;padding:20px 0;text-align:center">Sin publicaciones aún</div>'; return; }
  var platColors = { 'redia.pro': '#9333ea', 'LinkedIn': '#0077B5', 'Facebook': '#1877F2', 'YouTube': '#FF0000' };
  el.innerHTML = hist.map(h => `
    <div class="hist-row">
      <div class="hist-title">${h.titulo.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
      <div class="hist-plats">${(h.plataformas || []).map(p => `<div class="hist-dot" style="background:${platColors[p] || '#888'}">${p[0]}</div>`).join('')}</div>
      <div class="hist-date">${h.fecha}</div>
    </div>`).join('');
}

export function borrarHistorial() {
  if (confirm('¿Borrar todo el historial?')) { localStorage.removeItem('redia_historial'); renderHistorial(); }
}

export function guardarHistorial(entry) {
  var hist = JSON.parse(localStorage.getItem('redia_historial') || '[]');
  hist.unshift(entry);
  if (hist.length > 100) hist = hist.slice(0, 100);
  localStorage.setItem('redia_historial', JSON.stringify(hist));
}
