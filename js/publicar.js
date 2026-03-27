// ── PUBLICAR — modal de publicación multi-plataforma ─────────────────────────
import { state } from './state.js';
import { gsActualizar } from './storage.js';
import { guardarHistorial } from './config.js';
import { cp } from './utils.js';

// Inyección de dependencias circulares
var _getRec, _renderBandeja;
export function _injectPublicarDeps(deps) {
  _getRec = deps.getRec;
  _renderBandeja = deps.renderBandeja;
}

export function abrirPublicar(uid) {
  var rec = _getRec(uid);
  if (!rec) return;
  state.pubUID = uid;
  document.getElementById('pubTitulo').value = rec.titular || rec.titulo_seo || '';
  document.getElementById('pubDesc').value   = rec.bajada  || rec.descripcion_seo || '';
  var cat  = (rec.categoria || '').toLowerCase();
  var tipo = cat.includes('mercado') ? 'mercado' : cat.includes('entrevista') ? 'entrevista' : cat.includes('indicador') ? 'indicadores' : 'publicación';
  document.getElementById('pubTipo').value = tipo;
  document.getElementById('pubStatus').style.display = 'none';
  // Reset toggles
  state.platState = { redia: true, li: !!localStorage.getItem('cr_li_token'), fb: !!localStorage.getItem('cr_fb_token'), yt: false };
  ['redia', 'li', 'fb', 'yt'].forEach(p => {
    var row = document.getElementById('pt-' + p);
    var tog = document.getElementById('ptg-' + p);
    if (row) row.classList.toggle('on', state.platState[p]);
    if (tog) tog.classList.toggle('on', state.platState[p]);
  });
  updatePlatBadges();
  document.getElementById('pubModal').style.display = 'flex';
}

export function cerrarPublicar() {
  document.getElementById('pubModal').style.display = 'none';
  state.pubUID = null;
}

export function mostrarPubStatus(msg, ok) {
  var el = document.getElementById('pubStatus');
  el.style.display = 'block';
  el.textContent = msg;
  el.className = 'pub-status ' + (ok === true ? 'pub-ok' : ok === false ? 'pub-err' : 'pub-info');
}

export function togglePlat(p) {
  state.platState[p] = !state.platState[p];
  var row = document.getElementById('pt-' + p);
  var tog = document.getElementById('ptg-' + p);
  if (row) row.classList.toggle('on', state.platState[p]);
  if (tog) tog.classList.toggle('on', state.platState[p]);
}

export function updatePlatBadges() {
  var hasLI = !!localStorage.getItem('cr_li_token');
  var hasFB = !!localStorage.getItem('cr_fb_token');
  var liBadge = document.getElementById('ptg-li-badge');
  var fbBadge = document.getElementById('ptg-fb-badge');
  if (liBadge) { liBadge.textContent = hasLI ? 'Listo' : 'Configurar primero'; liBadge.className = 'plat-badge' + (hasLI ? ' ok' : ''); }
  if (fbBadge) { fbBadge.textContent = hasFB ? 'Listo' : 'Configurar primero'; fbBadge.className = 'plat-badge' + (hasFB ? ' ok' : ''); }
}

export async function confirmarPublicar() {
  var rec    = _getRec(state.pubUID); if (!rec) return;
  var titulo = document.getElementById('pubTitulo').value.trim();
  var desc   = document.getElementById('pubDesc').value.trim();
  var tipo   = document.getElementById('pubTipo').value;
  if (!titulo) return mostrarPubStatus('Ingresa un título.', false);
  if (!Object.values(state.platState).some(Boolean)) return mostrarPubStatus('Selecciona al menos una plataforma.', false);

  var btn = document.getElementById('pubConfirm');
  btn.disabled = true; btn.innerHTML = '<div class="spnw"></div> Publicando...';

  var resultados = [];
  var errores    = [];

  // ── redia.pro ──
  if (state.platState.redia) {
    mostrarPubStatus('Publicando en redia.pro...', null);
    try {
      var pbUrl   = localStorage.getItem('cr_pb_url')   || 'https://publicar.redia.pro';
      var pbEmail = localStorage.getItem('cr_pb_email') || '';
      var pbPass  = localStorage.getItem('cr_pb_pass')  || '';
      if (!pbEmail || !pbPass) throw new Error('Configura las credenciales de redia.pro en la sección Credenciales');
      var token = null;
      var authEndpoints = [
        pbUrl + '/api/collections/_superusers/auth-with-password',
        pbUrl + '/api/admins/auth-with-password',
        pbUrl + '/api/collections/users/auth-with-password'
      ];
      for (var _ai = 0; _ai < authEndpoints.length; _ai++) {
        var _ar = await fetch(authEndpoints[_ai], {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity: pbEmail, password: pbPass })
        });
        if (_ar.ok) { var _aj = await _ar.json(); token = _aj.token || (_aj.record && _aj.token); break; }
      }
      if (!token) throw new Error('Credenciales de redia.pro incorrectas — verifica email y contraseña en la pestaña Credenciales');
      var slug = titulo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').substring(0, 80);
      var descCorta  = desc.substring(0, 139);
      var tipoFinal  = (['publicación', 'mercado', 'entrevista', 'indicadores'].indexOf(tipo) >= 0) ? tipo : 'publicación';
      var fd = new FormData();
      fd.append('titulo', titulo);
      fd.append('descripcion_corta', descCorta);
      fd.append('contenido', rec.cuerpo_html || '');
      fd.append('tipo', tipoFinal);
      fd.append('publicado', 'true');
      fd.append('slug', slug);
      fd.append('fecha_publicacion', new Date().toISOString().replace('T', ' ').substring(0, 19));
      fd.append('verificationLevel', '1');
      if (tipoFinal === 'mercado') fd.append('Disponiblemercado', 'true');
      if (rec.imagen_src && rec.imagen_src.startsWith('data:')) {
        try {
          var arr = rec.imagen_src.split(','), mime = arr[0].match(/:(.*?);/)[1], bstr = atob(arr[1]);
          var u8 = new Uint8Array(bstr.length);
          for (var i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
          fd.append('imagen', new Blob([u8], { type: mime }), 'redia-' + slug + '.jpg');
        } catch(imgErr) { /* publicar sin imagen si falla */ }
      }
      var pubRes = await fetch(pbUrl + '/api/collections/post/records', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: fd
      });
      if (!pubRes.ok) {
        var ed = await pubRes.json().catch(() => ({}));
        var edMsg = ed.message || '';
        if (ed.data) {
          var edFields = Object.keys(ed.data).map(function(k) { return k + ': ' + (ed.data[k].message || ed.data[k].code || '?'); }).join(', ');
          if (edFields) edMsg += ' [' + edFields + ']';
        }
        throw new Error(edMsg || 'Error HTTP ' + pubRes.status);
      }
      var pubData = await pubRes.json();
      rec._rediaId   = pubData.id;
      rec._rediaSlug = slug;
      resultados.push('redia.pro');
    } catch(e) { errores.push('redia.pro: ' + e.message); }
  }

  // ── LinkedIn ──
  if (state.platState.li) {
    mostrarPubStatus('Publicando en LinkedIn...', null);
    try {
      var liToken = localStorage.getItem('cr_li_token');
      var liOrg   = localStorage.getItem('cr_li_orgid');
      if (!liToken || !liOrg) throw new Error('Configura LinkedIn en la sección Credenciales');
      var rediaUrl = rec._rediaSlug ? 'https://redia.pro/noticias/' + rec._rediaSlug : 'https://redia.pro/noticias';
      var liText   = (rec.linkedin || titulo + '\n\n' + desc) + '\n\n' + rediaUrl;
      var liBody   = {
        author: 'urn:li:organization:' + liOrg,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: liText },
            shareMediaCategory: 'ARTICLE',
            media: [{ status: 'READY', originalUrl: rediaUrl, title: { text: titulo }, description: { text: desc } }]
          }
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
      };
      var liRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + liToken, 'X-Restli-Protocol-Version': '2.0.0' },
        body: JSON.stringify(liBody)
      });
      if (!liRes.ok) { var le = await liRes.json().catch(() => ({})); throw new Error(le.message || 'Error HTTP ' + liRes.status); }
      resultados.push('LinkedIn');
    } catch(e) { errores.push('LinkedIn: ' + e.message); }
  }

  // ── Facebook ──
  if (state.platState.fb) {
    mostrarPubStatus('Publicando en Facebook...', null);
    try {
      var fbToken  = localStorage.getItem('cr_fb_token');
      var fbPageId = localStorage.getItem('cr_fb_pageid');
      if (!fbToken || !fbPageId) throw new Error('Configura Facebook en la sección Credenciales');
      var rediaUrl2 = rec._rediaSlug ? 'https://redia.pro/noticias/' + rec._rediaSlug : 'https://redia.pro/noticias';
      var fbMsg = (rec.facebook || titulo + '\n\n' + desc) + '\n\n' + rediaUrl2;
      var fbRes = await fetch('https://graph.facebook.com/v19.0/' + fbPageId + '/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: fbMsg, link: rediaUrl2, access_token: fbToken })
      });
      if (!fbRes.ok) { var fe = await fbRes.json().catch(() => ({})); throw new Error(fe.error?.message || 'Error HTTP ' + fbRes.status); }
      resultados.push('Facebook');
    } catch(e) { errores.push('Facebook: ' + e.message); }
  }

  // ── YouTube ──
  if (state.platState.yt) {
    mostrarPubStatus('Preparando paquete YouTube...', null);
    mostrarYouTube(rec, titulo, desc);
  }

  // ── Guardar en historial ──
  if (resultados.length > 0) {
    guardarHistorial({ titulo, plataformas: resultados, fecha: new Date().toLocaleString('es-CL'), uid: state.pubUID });
    await gsActualizar(rec.id, 'estado', 'aprobado');
    if (rec) rec.estado = 'aprobado';
  }

  // ── Resultado final ──
  var msg = '';
  if (resultados.length) msg += '✓ Publicado en: ' + resultados.join(', ') + '.';
  if (errores.length)    msg += (msg ? '\n' : '') + '✗ Errores: ' + errores.join(' | ');
  mostrarPubStatus(msg, errores.length === 0);

  btn.disabled  = false;
  btn.innerHTML = resultados.length ? '✓ Publicado' : 'Reintentar';
  if (resultados.length) {
    btn.style.background = 'var(--ok)';
    setTimeout(() => { cerrarPublicar(); _renderBandeja(); }, 2500);
  }
}

export function mostrarYouTube(rec, titulo, desc) {
  var tags     = Array.isArray(rec.tags) ? rec.tags : (rec.tags || '').split(',').map(t => t.trim()).filter(Boolean);
  var rediaUrl = 'https://redia.pro/noticias';
  var ytDesc   = rec.audio_script
    ? rec.audio_script.substring(0, 400) + '...\n\n🔗 Artículo completo: ' + rediaUrl + '\n\n#acuicultura #REDIA #Chile\n\n' + tags.map(t => '#' + t).join(' ')
    : desc + '\n\n🔗 Lee el análisis completo en: ' + rediaUrl + '\n\n' + tags.map(t => '#' + t).join(' ');
  var ytTitle  = titulo.substring(0, 100);
  var ytTagStr = ['acuicultura', 'REDIA', 'Chile', 'salmón', 'pesca'].concat(tags).slice(0, 15).join(', ');
  document.getElementById('ytTitulo').textContent = ytTitle;
  document.getElementById('ytDesc').textContent   = ytDesc;
  document.getElementById('ytTags').textContent   = ytTagStr;
  document.getElementById('ytModal').style.display = 'flex';
}
