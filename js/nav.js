// ── NAV — navegación entre páginas y secciones de config ─────────────────────
export function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('on');
    p.style.display = 'none';
  });
  document.querySelectorAll('.ntab').forEach(b => b.classList.remove('on'));
  var pg = document.getElementById('page-' + id);
  if (pg) {
    pg.classList.add('on');
    if (id === 'crear') pg.style.display = 'block';
    else pg.style.display = 'flex';
  }
  btn.classList.add('on');
}

export function showCfg(id, el) {
  document.querySelectorAll('.cpg').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.cni').forEach(b => b.classList.remove('on'));
  document.getElementById('cfg-' + id).classList.add('on');
  el.classList.add('on');
}
