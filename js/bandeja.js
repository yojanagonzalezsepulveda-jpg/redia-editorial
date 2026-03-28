// ── BANDEJA — renderizado de tarjetas y acciones ─────────────────────────────
import { state } from './state.js';
import { deduplicateRecs, localAddRec, gsActualizar, gsGuardar } from './storage.js';
import { esc, sj, cp, cpHTML, dlHTML } from './utils.js';
import { getAIKey, callGemini } from './ai.js';
import { generarImagenGemini, resizarImg820x400 } from './media.js';
import { sanitizeVocab } from './utils.js';

// Inyección de dependencias circulares
var _buildHTML;
export function _injectBandejaDeps(deps) {
  _buildHTML = deps.buildHTML;
}

export function getRec(uid) {
  return state.records.find(r => r._uid === uid || r.id === uid) || state.manualRec;
}

export function renderBandeja() {
  var records = state.records;
  var filtro = state.filtro;
  var lista = filtro === 'todos' ? records : records.filter(r => r.estado === filtro);
  var pend = records.filter(r => r.estado === 'pendiente').length;
  var apro = records.filter(r => r.estado === 'aprobado').length;
  var desc = records.filter(r => r.estado === 'descartado').length;
  document.getElementById('cP').textContent = pend;
  document.getElementById('cA').textContent = apro;
  document.getElementById('cD').textContent = desc;
  document.getElementById('cT').textContent = records.length;
  document.getElementById('fb0').textContent = records.length;
  document.getElementById('fb1').textContent = pend;
  document.getElementById('fb2').textContent = apro;
  document.getElementById('fb3').textContent = desc;
  var c = document.getElementById('bandejaContent');
  if (!records.length) {
    c.innerHTML = '<div class="empty"><div class="ering"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><h2 style="font-size:17px;font-weight:900">Sin informes aún</h2><p style="color:var(--s5);font-size:13px;max-width:340px;line-height:1.6">El worker genera informes a las 8am. También puedes usar "Búsqueda manual" para generar uno ahora mismo.</p></div>';
    return;
  }
  var fecha = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  lista = deduplicateRecs(lista);
  c.innerHTML = '<div class="cards-hd"><div><div class="cards-title">' + lista.length + ' informe' + (lista.length !== 1 ? 's' : '') + ' · ' + filtro + '</div><div class="cards-sub">' + fecha + '</div></div><div style="display:flex;gap:8px"><button id="autoGenBtn" class="rbtn" onclick="generarAutomatico(this)" style="background:var(--grad)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Generar ahora</button><button class="rbtn" onclick="cargarBandeja()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>Actualizar</button></div></div>' +
    lista.map(r => buildCard(r)).join('');
}

export function filtrar(f, btn) {
  state.filtro = f;
  document.querySelectorAll('.flt').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  renderBandeja();
}

export function buildCard(r) {
  var tags = sj(r.tags, []);
  var tl = (r.titulo_seo || '').length, dl = (r.descripcion_seo || '').length;
  var uid = r.id || ('m' + Date.now() + Math.random().toString(36).slice(2, 6));
  if (!r._uid) r._uid = uid;
  var spCls = r.estado === 'aprobado' ? 'sp-a' : r.estado === 'descartado' ? 'sp-d' : 'sp-p';
  var spLbl = r.estado === 'aprobado' ? 'Aprobado' : r.estado === 'descartado' ? 'Descartado' : 'Pendiente';
  var vfmt = (r.video_script || '').replace(/(\d{2}:\d{2})/g, '<span class="vts">$1</span>').replace(/\[([^\]]+)\]/g, '<span style="background:var(--t0);color:#0f766e;padding:1px 5px;border-radius:4px;font-size:10px;font-style:italic;">[$1]</span>').replace(/\n/g, '<br>');
  return `
<div class="card ${r.estado || 'pendiente'}" id="card-${uid}">
  <div class="card-hd" onclick="toggleCard('${uid}')" style="display:flex;gap:12px;align-items:flex-start">
    ${r.imagen_src ? `<img id="card-thumb-${uid}" src="${r.imagen_src}" style="width:90px;height:60px;object-fit:cover;border-radius:8px;flex-shrink:0;margin-top:2px">` : `<img id="card-thumb-${uid}" src="" style="display:none;width:90px;height:60px;object-fit:cover;border-radius:8px;flex-shrink:0;margin-top:2px">`}
    <div class="card-info" style="flex:1;min-width:0">
      <div class="card-cat">${r.categoria || 'Análisis REDIA'}</div>
      <div class="card-title">${esc(r.titular || r.titulo_seo || 'Sin título')}</div>
      <div class="card-bajada">${esc(r.bajada || '')}</div>
      <div class="card-meta">
        <span>${r.tiempo_lectura || '5 min'}</span>
        <span>${r.fuente_original || r.fecha || 'REDIA'}</span>
        ${tags.map(t => '<span>#' + t + '</span>').join('')}
      </div>
    </div></div>
    <div><div class="sp ${spCls}">${spLbl}</div></div>
  </div>
  <div class="card-body" id="body-${uid}">
    <div style="padding:0 18px">
      <div class="ctabs" id="ctabs-${uid}">
        <button class="ctab on" onclick="showCTab('${uid}','art',this)">Artículo</button>
        <button class="ctab" onclick="showCTab('${uid}','edit',this)">Editar</button>
        <button class="ctab" onclick="showCTab('${uid}','seo',this)">SEO</button>
        <button class="ctab" onclick="showCTab('${uid}','rrss',this)">RRSS</button>
        <button class="ctab" onclick="showCTab('${uid}','media',this)">Audio/Video</button>
        <button class="ctab" onclick="showCTab('${uid}','html',this)">HTML</button>
      </div>
    </div>
    <div class="cpanel on" id="cp-${uid}-art">
      <div class="art-prev">${r.cuerpo_html || '<p>Sin contenido</p>'}</div>
      <div class="ibox">
        <div class="ibox-t">Análisis REDIA</div>
        <div class="ibox-g" style="grid-template-columns:1fr">
          <div class="ibox-c"><div class="ibox-l">Lo que muestra este análisis</div><div class="ibox-v">${r.analisis_muestra || sj(r.beneficios, []).map(b => '· ' + b).join('<br>') || ''}</div></div>
        </div>
      </div>
      ${(()=>{var fc=sj(r.fuentes_con_links,[]);if(!fc.length||['entrevista','mercado','patrocinado'].includes(r.categoria)) return '';return '<div style="margin:16px 0 4px;padding:14px 16px;border-top:1px solid var(--s2)"><div style="font-size:11px;font-weight:700;color:var(--s6);text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px">Fuentes consultadas</div><ul style="list-style:none;padding:0;margin:0">'+fc.map(f=>'<li style="margin:6px 0;font-size:12.5px;display:flex;gap:5px;align-items:baseline"><a href="'+f.url+'" target="_blank" rel="noopener" style="color:var(--p6);font-weight:700;text-decoration:none">'+f.nombre+'</a><span style="color:var(--s4);font-size:10px">↗</span>'+(f.fecha?'<span style="color:var(--s4);font-size:10.5px">('+f.fecha+')</span>':'')+(f.descripcion?'<span style="color:var(--s5)"> — '+f.descripcion+'</span>':'')+'</li>').join('')+'</ul></div>';})()}
    </div>
    <div class="cpanel" id="cp-${uid}-edit">
      <div class="ef"><label class="efl">Titular</label><input type="text" class="efi" id="ef-${uid}-tit" value="${esc(r.titular || '')}" oninput="dirty('${uid}')"></div>
      <div class="ef"><label class="efl">Bajada</label><textarea class="efi" id="ef-${uid}-baj" oninput="dirty('${uid}')">${esc(r.bajada || '')}</textarea></div>
      <div class="ef"><label class="efl">Cuerpo del artículo (HTML)</label><textarea class="efi big" id="ef-${uid}-cpo" oninput="dirty('${uid}')">${esc(r.cuerpo_html || '')}</textarea></div>
      <div class="ef"><label class="efl">Coyuntura</label><textarea class="efi" id="ef-${uid}-coy" oninput="dirty('${uid}')">${esc(r.coyuntura || '')}</textarea></div>
      <div class="ef"><label class="efl">LinkedIn</label><textarea class="efi" id="ef-${uid}-li" oninput="dirty('${uid}')">${esc(r.linkedin || '')}</textarea></div>
      <div class="ef"><label class="efl">Facebook</label><textarea class="efi" id="ef-${uid}-fb" oninput="dirty('${uid}')">${esc(r.facebook || '')}</textarea></div>
    </div>
    <div class="cpanel" id="cp-${uid}-seo">
      <div class="ef">
        <label class="efl">Título SEO <span id="seo-tl-${uid}" class="${tl <= 60 ? 'cok' : 'cbad'}">${tl}/60</span></label>
        <input type="text" class="efi" id="ef-${uid}-tseo" value="${esc(r.titulo_seo || '')}" maxlength="80" oninput="dirty('${uid}');_seoCount('${uid}','t',this.value)">
      </div>
      <div class="ef">
        <label class="efl">Descripción SEO <span id="seo-dl-${uid}" class="${dl <= 140 ? 'cok' : 'cbad'}">${dl}/140</span></label>
        <textarea class="efi" id="ef-${uid}-dseo" rows="3" oninput="dirty('${uid}');_seoCount('${uid}','d',this.value)">${esc(r.descripcion_seo || '')}</textarea>
      </div>
      <div class="sgrid">
        <div class="sc"><div class="sl">Tags</div><div class="trow">${tags.map(t => '<div class="tpill">#' + t + '</div>').join('')}</div><button class="cpbtn" onclick="cp('${tags.map(t => '#' + t).join(' ')}',this)">Copiar tags</button></div>
        <div class="sc"><div class="sl">Vista previa Google</div><div class="gprev"><div class="gp-t" id="seo-prev-t-${uid}">${esc(r.titulo_seo || '')}</div><div class="gp-u">https://redia.pro/noticias/</div><div class="gp-d" id="seo-prev-d-${uid}">${esc(r.descripcion_seo || '')}</div></div></div>
      </div>
    </div>
    <div class="cpanel" id="cp-${uid}-rrss">
      <div class="sgrid">
        <div class="sc">
          <div class="sl">LinkedIn <button class="cpbtn" style="margin-left:6px" onclick="generarRedSocial('${uid}','linkedin',this)">↺ Generar</button><button class="cpbtn" onclick="cp(document.getElementById('rrss-li-${uid}').value,this)">Copiar</button><button id="savebtn-rrss-li-${uid}" class="cpbtn" style="background:#94a3b8;color:#fff;opacity:.5" disabled onclick="guardarRRSS('${uid}','linkedin')">Guardar</button></div>
          <textarea class="efi" id="rrss-li-${uid}" rows="6" oninput="dirtyRRSS('${uid}','linkedin')">${esc(r.linkedin || '')}</textarea>
        </div>
        <div class="sc">
          <div class="sl">Facebook <button class="cpbtn" style="margin-left:6px" onclick="generarRedSocial('${uid}','facebook',this)">↺ Generar</button><button class="cpbtn" onclick="cp(document.getElementById('rrss-fb-${uid}').value,this)">Copiar</button><button id="savebtn-rrss-fb-${uid}" class="cpbtn" style="background:#94a3b8;color:#fff;opacity:.5" disabled onclick="guardarRRSS('${uid}','facebook')">Guardar</button></div>
          <textarea class="efi" id="rrss-fb-${uid}" rows="4" oninput="dirtyRRSS('${uid}','facebook')">${esc(r.facebook || '')}</textarea>
        </div>
      </div>
    </div>
    <div class="cpanel" id="cp-${uid}-media">
      <div class="sgrid">
        <div class="sc">
          <div class="sl">Guión Audio / Podcast
            <button class="cpbtn" style="margin-left:6px" onclick="generarMedia('${uid}','audio',this)">↺ Generar</button>
            <button class="cpbtn" onclick="cp(document.getElementById('media-audio-${uid}').value,this)">Copiar</button>
            <button id="savebtn-media-audio-${uid}" class="cpbtn" style="background:#94a3b8;color:#fff;opacity:.5" disabled onclick="guardarMedia('${uid}','audio')">Guardar</button>
          </div>
          <textarea class="efi big" id="media-audio-${uid}" rows="10" oninput="dirtyMedia('${uid}','audio')">${esc(r.audio_script || '')}</textarea>
        </div>
        <div class="sc">
          <div class="sl">Guión YouTube
            <button class="cpbtn" style="margin-left:6px" onclick="generarMedia('${uid}','video',this)">↺ Generar</button>
            <button class="cpbtn" onclick="cp(document.getElementById('media-video-${uid}').value,this)">Copiar</button>
            <button id="savebtn-media-video-${uid}" class="cpbtn" style="background:#94a3b8;color:#fff;opacity:.5" disabled onclick="guardarMedia('${uid}','video')">Guardar</button>
          </div>
          <textarea class="efi big" id="media-video-${uid}" rows="10" oninput="dirtyMedia('${uid}','video')">${esc(r.video_script || '')}</textarea>
        </div>
        <div class="sc">
          <div class="sl">Imagen
            <button class="cpbtn" style="margin-left:6px" onclick="generarImgBandeja('${uid}',this)">↺ Generar imagen</button>
            <button class="cpbtn" onclick="cp('${esc(r.imagen_prompt || '')}',this)">Copiar prompt</button>
            <a id="dl-img-${uid}" style="display:none"><button class="cpbtn" style="background:#15803d;color:#fff">Descargar</button></a>
          </div>
          <div id="img-box-${uid}" style="margin:10px 0;border-radius:10px;overflow:hidden;background:var(--s1);min-height:80px;display:flex;align-items:center;justify-content:center">
            ${r.imagen_src ? `<img src="${r.imagen_src}" style="width:100%;border-radius:10px">` : `<span style="color:#94a3b8;font-size:12px">Sin imagen — haz clic en Generar imagen</span>`}
          </div>
          <div class="sbox" style="font-size:11px;color:#64748b">${esc(r.imagen_prompt || '')}</div>
        </div>
      </div>
    </div>
    <div class="cpanel" id="cp-${uid}-html">
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 14px;margin-bottom:12px;font-size:12px;color:#166534;line-height:1.7">
        <strong>Para pegar en redia.pro manualmente:</strong><br>
        <span style="color:#15803d">→ Título del artículo:</span> <strong>${esc(r.titular || r.titulo_seo || '')}</strong><br>
        <span style="color:#15803d">→ Descripción / extracto:</span> ${esc((r.bajada || r.descripcion_seo || '').substring(0, 120))}<br>
        <span style="color:#15803d">→ Cuerpo:</span> pega el HTML completo abajo
      </div>
      <div class="hcode">${esc((r.html_publicable || '').substring(0, 1800))}${(r.html_publicable || '').length > 1800 ? '\n...' : ''}</div>
      <div style="display:flex;gap:7px;margin-top:10px;flex-wrap:wrap">
        <button class="abtn ab-grad" onclick="dlHTML('${uid}')">Descargar HTML</button>
        <button class="abtn ab-out" onclick="cpHTML('${uid}',this)">Copiar HTML</button>
      </div>
    </div>
    <div class="abar">
      ${(r.estado || 'pendiente') !== 'aprobado'   ? `<button class="abtn ab-ok"   onclick="estado('${uid}','aprobado')">Aprobar</button>` : ''}
      ${(r.estado || 'pendiente') !== 'descartado' ? `<button class="abtn ab-disc" onclick="estado('${uid}','descartado')">Descartar</button>` : ''}
      ${(r.estado || 'pendiente') === 'descartado' ? `<button class="abtn ab-ok"   onclick="estado('${uid}','pendiente')">Restaurar</button>` : ''}
      ${(r.titular || r.articulo?.titular) && !(r.linkedin) ? `<button class="abtn ab-grad" id="distbtn-${uid}" onclick="generarDistribucion('${uid}')">Generar distribución</button>` : ''}
      <button class="abtn ab-save" id="savebtn-${uid}" onclick="guardarEdicion('${uid}')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13"/><polyline points="7 3 7 8 15 8"/></svg>
        Guardar edición
      </button>
      ${(r.estado) === 'aprobado' ? `<button class="abtn ab-pub" id="pubbtn-${uid}" onclick="abrirPublicar('${uid}')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>
        Publicar en redia.pro
      </button>` : ''}
      ${r._rediaId ? `<button class="abtn" id="updbtn-${uid}" onclick="actualizarEnRedia('${uid}')" style="background:#0369a1;color:#fff">↑ Actualizar en redia.pro</button>` : ''}
      <button class="abtn ab-grad" onclick="dlHTML('${uid}')">Descargar HTML</button>
      <button class="abtn ab-out" onclick="cpHTML('${uid}',this)">Copiar HTML</button>
    </div>
  </div>
</div>`;
}

export function toggleCard(uid) {
  var b = document.getElementById('body-' + uid);
  if (b) b.classList.toggle('open');
}

export function showCTab(uid, tab, btn) {
  ['art', 'edit', 'seo', 'rrss', 'media', 'html'].forEach(t => {
    var p = document.getElementById('cp-' + uid + '-' + t);
    if (p) p.classList.remove('on');
  });
  document.querySelectorAll('#ctabs-' + uid + ' .ctab').forEach(b => b.classList.remove('on'));
  var p = document.getElementById('cp-' + uid + '-' + tab);
  if (p) p.classList.add('on');
  btn.classList.add('on');
}

export function dirty(uid) {
  var btn = document.getElementById('savebtn-' + uid);
  if (btn) { btn.textContent = 'Guardar cambios *'; btn.style.background = '#d97706'; }
}

// Actualiza contadores de caracteres en el tab SEO (t=titulo, d=descripcion)
export function _seoCount(uid, field, val) {
  if (field === 't') {
    var span = document.getElementById('seo-tl-' + uid);
    var prev  = document.getElementById('seo-prev-t-' + uid);
    if (span) { span.textContent = val.length + '/60'; span.className = val.length <= 60 ? 'cok' : 'cbad'; }
    if (prev) prev.textContent = val;
  } else {
    var span = document.getElementById('seo-dl-' + uid);
    var prev  = document.getElementById('seo-prev-d-' + uid);
    if (span) { span.textContent = val.length + '/140'; span.className = val.length <= 140 ? 'cok' : 'cbad'; }
    if (prev) prev.textContent = val;
  }
}

export function toggleCollapse(sId, aId) {
  var s = document.getElementById(sId), a = document.getElementById(aId);
  if (!s) return;
  var open = s.style.display !== 'none';
  s.style.display = open ? 'none' : 'block';
  if (a) a.style.transform = open ? '' : 'rotate(180deg)';
}

export async function autoPublicarRedia(rec) {
  // ── Generar imagen automáticamente si no existe ──
  if (!rec.imagen_src && rec.imagen_prompt) {
    var gemKey = getAIKey('gem');
    if (gemKey) {
      try {
        var raw = await generarImagenGemini(rec.imagen_prompt, gemKey);
        if (raw) {
          rec.imagen_src = await resizarImg820x400(raw);
          await gsActualizar(rec.id, 'imagen_src', rec.imagen_src);
        }
      } catch(imgErr) { /* continuar sin imagen si falla */ }
    }
  }

  var pbUrl   = localStorage.getItem('cr_pb_url')   || 'https://publicar.redia.pro';
  var pbEmail = localStorage.getItem('cr_pb_email') || '';
  var pbPass  = localStorage.getItem('cr_pb_pass')  || '';
  if (!pbEmail || !pbPass) throw new Error('Configura las credenciales de redia.pro en Credenciales');
  var token = null;
  var authEndpoints = [
    pbUrl + '/api/collections/_superusers/auth-with-password',
    pbUrl + '/api/admins/auth-with-password',
    pbUrl + '/api/collections/users/auth-with-password'
  ];
  for (var i = 0; i < authEndpoints.length; i++) {
    var ar = await fetch(authEndpoints[i], {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: pbEmail, password: pbPass })
    });
    if (ar.ok) { var aj = await ar.json(); token = aj.token; break; }
  }
  if (!token) throw new Error('Credenciales de redia.pro incorrectas');
  var titulo = rec.titular || rec.titulo_seo || '';
  var desc   = rec.bajada  || rec.descripcion_seo || '';
  var cat    = (rec.categoria || '').toLowerCase();
  var tipo   = cat.includes('mercado') ? 'mercado' : cat.includes('entrevista') ? 'entrevista' : cat.includes('indicador') ? 'indicadores' : 'publicación';
  var slug   = titulo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').substring(0, 80);
  var fd = new FormData();
  fd.append('titulo', titulo);
  fd.append('descripcion_corta', desc.substring(0, 139));
  fd.append('contenido', rec.cuerpo_html || '');
  fd.append('tipo', tipo);
  fd.append('publicado', 'true');
  fd.append('slug', slug);
  fd.append('fecha_publicacion', new Date().toISOString().replace('T', ' ').substring(0, 19));
  fd.append('verificationLevel', '1');
  if (tipo === 'mercado') fd.append('Disponiblemercado', 'true');
  if (rec.imagen_src && rec.imagen_src.startsWith('data:')) {
    try {
      var arr = rec.imagen_src.split(','), mime = arr[0].match(/:(.*?);/)[1], bstr = atob(arr[1]);
      var u8 = new Uint8Array(bstr.length);
      for (var j = 0; j < bstr.length; j++) u8[j] = bstr.charCodeAt(j);
      fd.append('imagen', new Blob([u8], { type: mime }), 'redia-' + slug + '.jpg');
    } catch(e) { /* publicar sin imagen si falla */ }
  }
  var res = await fetch(pbUrl + '/api/collections/post/records', {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: fd
  });
  if (!res.ok) { var ed = await res.json().catch(() => ({})); throw new Error(ed.message || 'Error HTTP ' + res.status); }
  var data = await res.json();
  rec._rediaId   = data.id;
  rec._rediaSlug = slug;
}

export async function estado(uid, newEstado) {
  var rec = getRec(uid);
  if (!rec) return;
  rec.estado = newEstado;
  await gsActualizar(rec.id, 'estado', newEstado);
  if (newEstado === 'aprobado') {
    var btn = document.querySelector('.ab-ok[onclick*="' + uid + '"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Publicando...'; }
    try {
      await autoPublicarRedia(rec);
      await gsActualizar(rec.id, '_rediaId', rec._rediaId || '');
    } catch(e) {
      alert('Aprobado en bandeja, pero error al publicar en redia.pro:\n' + e.message + '\n\nPuedes publicarlo manualmente con el botón "Publicar en redia.pro".');
    }
  }
  renderBandeja();
  setTimeout(() => { var b = document.getElementById('body-' + uid); if (b) b.classList.add('open'); }, 50);
}

export async function guardarEdicion(uid) {
  var rec = getRec(uid); if (!rec) return;
  var campos = {
    titular:        document.getElementById('ef-' + uid + '-tit')?.value  || '',
    bajada:         document.getElementById('ef-' + uid + '-baj')?.value  || '',
    cuerpo_html:    document.getElementById('ef-' + uid + '-cpo')?.value  || '',
    coyuntura:      document.getElementById('ef-' + uid + '-coy')?.value  || '',
    linkedin:       document.getElementById('ef-' + uid + '-li')?.value   || '',
    facebook:       document.getElementById('ef-' + uid + '-fb')?.value   || '',
    titulo_seo:      (el => el ? el.value : rec.titulo_seo)(document.getElementById('ef-' + uid + '-tseo')) || '',
    descripcion_seo: (el => el ? el.value : rec.descripcion_seo)(document.getElementById('ef-' + uid + '-dseo')) || '',
  };
  Object.assign(rec, campos);
  if (rec.id) {
    await Promise.all(Object.entries(campos).map(([k, v]) => gsActualizar(rec.id, k, v)));
  }
  var btn = document.getElementById('savebtn-' + uid);
  if (btn) {
    btn.textContent = 'Guardado'; btn.style.background = 'var(--ok)';
    setTimeout(() => {
      btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13"/><polyline points="7 3 7 8 15 8"/></svg> Guardar edición';
      btn.style.background = 'var(--p6)';
    }, 2000);
  }
  if (rec._rediaId && typeof window.actualizarEnRedia === 'function') {
    window.actualizarEnRedia(uid);
  }
}
