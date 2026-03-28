// ── PUBLICAR — modal de publicación multi-plataforma ─────────────────────────
import { state } from './state.js?v=7';
import { gsActualizar, localAddRec } from './storage.js?v=7';
import { guardarHistorial } from './config.js?v=7';
import { cp, sj } from './utils.js?v=7';

// Inyección de dependencias circulares
var _getRec, _renderBandeja;
export function _injectPublicarDeps(deps) {
  _getRec = deps.getRec;
  _renderBandeja = deps.renderBandeja;
}

function buildContenidoPublicable(rec) {
  var analisisHtml = rec.analisis_muestra
    ? '<div style="background:#0f172a;border-radius:16px;padding:24px;margin:32px 0"><p style="color:rgba(255,255,255,.9);font-size:13px;font-weight:700;margin:0 0 12px">★ Análisis REDIA</p><div style="background:rgba(255,255,255,.07);border-radius:8px;padding:12px 14px"><p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,.4);margin:0 0 6px">Lo que muestra este análisis</p><p style="font-size:12px;line-height:1.6;color:rgba(255,255,255,.85);margin:0">' + rec.analisis_muestra + '</p></div></div>'
    : '';
  var fc = sj(rec.fuentes_con_links, []);
  var catExcl = ['entrevista', 'mercado', 'patrocinado'];
  var srcHtml = (fc.length && !catExcl.includes(rec.categoria))
    ? '<div style="margin-top:36px;padding-top:20px;border-top:1px solid #e2e8f0"><strong style="font-size:12px;color:#334155;display:block;margin-bottom:10px">Fuentes consultadas</strong><ul style="list-style:none;padding:0;margin:0">' +
      fc.map(function(f) { return '<li style="margin:7px 0;font-size:12px"><a href="' + f.url + '" target="_blank" rel="noopener" style="color:#7e22ce;font-weight:700">' + f.nombre + '</a>' + (f.descripcion ? '<span style="color:#64748b"> — ' + f.descripcion + '</span>' : '') + '</li>'; }).join('') +
      '</ul></div>'
    : '';
  return (rec.cuerpo_html || '') + analisisHtml + srcHtml;
}

async function pbAuth(pbUrl, pbEmail, pbPass) {
  var endpoints = [
    pbUrl + '/api/collections/_superusers/auth-with-password',
    pbUrl + '/api/admins/auth-with-password',
    pbUrl + '/api/collections/users/auth-with-password'
  ];
  for (var i = 0; i < endpoints.length; i++) {
    var r = await fetch(endpoints[i], {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: pbEmail, password: pbPass })
    });
    if (r.ok) { var j = await r.json(); return j.token || null; }
  }
  return null;
}

export function abrirPublicar(uid) {
  var rec = _getRec(uid);
  if (!rec) return;
  state.pubUID = uid;
  document.getElementById('pubTitulo').value = rec.titular || rec.titulo_seo || '';
  document.getElementById('pubDesc').value   = rec.descripcion_seo || rec.bajada || '';
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
      var token = await pbAuth(pbUrl, pbEmail, pbPass);
      if (!token) throw new Error('Credenciales de redia.pro incorrectas — verifica email y contraseña en la pestaña Credenciales');
      var slug = titulo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').substring(0, 80);
      var tipoFinal  = (['publicación', 'mercado', 'entrevista', 'indicadores'].indexOf(tipo) >= 0) ? tipo : 'publicación';
      var recTags = sj(rec.tags, []);
      var fd = new FormData();
      fd.append('titulo', titulo);
      fd.append('descripcion_corta', desc);
      fd.append('contenido', buildContenidoPublicable(rec));
      fd.append('tipo', tipoFinal);
      fd.append('publicado', 'true');
      fd.append('slug', slug);
      fd.append('fecha_publicacion', new Date().toISOString().replace('T', ' ').substring(0, 19));
      fd.append('verificationLevel', '1');
      if (recTags.length) fd.append('Tags', JSON.stringify(recTags));
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
      localAddRec(rec);
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

export async function actualizarEnRedia(uid) {
  var rec = _getRec(uid);
  if (!rec) return;
  if (!rec._rediaId) { alert('Este artículo no fue publicado desde esta herramienta o el ID no está guardado. Usa "Publicar en redia.pro" para publicarlo primero.'); return; }
  var pbUrl   = localStorage.getItem('cr_pb_url')   || 'https://publicar.redia.pro';
  var pbEmail = localStorage.getItem('cr_pb_email') || '';
  var pbPass  = localStorage.getItem('cr_pb_pass')  || '';
  if (!pbEmail || !pbPass) { alert('Configura las credenciales de redia.pro en la sección Credenciales'); return; }
  var btn = document.getElementById('updbtn-' + uid);
  if (btn) { btn.disabled = true; btn.textContent = 'Actualizando...'; }
  try {
    var token = await pbAuth(pbUrl, pbEmail, pbPass);
    if (!token) throw new Error('Credenciales incorrectas');
    var updTags = sj(rec.tags, []);
    var fd = new FormData();
    fd.append('titulo', rec.titular || rec.titulo_seo || '');
    fd.append('descripcion_corta', rec.descripcion_seo || rec.bajada || '');
    fd.append('contenido', buildContenidoPublicable(rec));
    if (updTags.length) fd.append('Tags', JSON.stringify(updTags));
    if (rec.imagen_src && rec.imagen_src.startsWith('data:')) {
      try {
        var arr = rec.imagen_src.split(','), mime = arr[0].match(/:(.*?);/)[1], bstr = atob(arr[1]);
        var u8 = new Uint8Array(bstr.length);
        for (var i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
        fd.append('imagen', new Blob([u8], { type: mime }), 'redia-' + rec._rediaId + '.jpg');
      } catch(e) {}
    }
    var res = await fetch(pbUrl + '/api/collections/post/records/' + rec._rediaId, {
      method: 'PATCH', headers: { 'Authorization': 'Bearer ' + token }, body: fd
    });
    if (!res.ok) { var ed = await res.json().catch(() => ({})); throw new Error(ed.message || 'HTTP ' + res.status); }
    if (btn) { btn.disabled = false; btn.textContent = '✓ Actualizado'; setTimeout(() => { if (btn) btn.textContent = '↑ Actualizar en redia.pro'; }, 3000); }
  } catch(e) {
    alert('Error al actualizar: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = '↑ Actualizar en redia.pro'; }
  }
}

export async function eliminarDeRedia(uid) {
  var rec = _getRec(uid);
  if (!rec || !rec._rediaId) return;
  if (!confirm('¿Eliminar esta publicación de redia.pro? Esta acción no se puede deshacer.')) return;
  var pbUrl   = localStorage.getItem('cr_pb_url')   || 'https://publicar.redia.pro';
  var pbEmail = localStorage.getItem('cr_pb_email') || '';
  var pbPass  = localStorage.getItem('cr_pb_pass')  || '';
  if (!pbEmail || !pbPass) { alert('Configura las credenciales de redia.pro en la sección Credenciales'); return; }
  try {
    var token = await pbAuth(pbUrl, pbEmail, pbPass);
    if (!token) throw new Error('Credenciales incorrectas');
    var res = await fetch(pbUrl + '/api/collections/post/records/' + rec._rediaId, {
      method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok && res.status !== 404) { var ed = await res.json().catch(() => ({})); throw new Error(ed.message || 'HTTP ' + res.status); }
    delete rec._rediaId;
    localAddRec(rec);
    _renderBandeja();
    alert('Publicación eliminada de redia.pro.');
  } catch(e) {
    alert('Error al eliminar: ' + e.message);
  }
}
