// ── HTML BUILDER — construye el HTML publicable de un artículo ───────────────
import { sj } from './utils.js?v=7';

export function buildHTML(r) {
  var tags = sj(r.tags, []);
  var fecha = new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
  var fc = sj(r.fuentes_con_links, []);
  var catExcl = ['entrevista', 'mercado', 'patrocinado'];
  var fechaFuente = r.fecha_fuente ? ' <span style="color:#94a3b8;font-weight:400">· ' + r.fecha_fuente + '</span>' : '';
  var srcBlock = (fc.length && !catExcl.includes(r.categoria))
    ? '<div class="srcs" style="margin-top:36px;padding-top:20px;border-top:1px solid #e2e8f0"><strong style="font-size:12px;color:#334155;display:block;margin-bottom:10px">Fuentes consultadas' + fechaFuente + '</strong><ul style="list-style:none;padding:0;margin:0">' + fc.map(function(f) { return '<li style="margin:7px 0;font-size:12px;display:flex;gap:6px;align-items:flex-start"><a href="' + f.url + '" target="_blank" rel="noopener" style="color:#7e22ce;font-weight:700;text-decoration:none;flex-shrink:0">' + f.nombre + '</a><span style="color:#94a3b8">↗</span>' + (f.descripcion ? '<span style="color:#64748b"> — ' + f.descripcion + '</span>' : '') + '</li>'; }).join('') + '</ul></div>'
    : '<div class="srcs"><strong>Fuentes consultadas' + fechaFuente + ':</strong><br>' + sj(r.fuentes_consultadas || r.fuentes, []).join(' · ') + '</div>';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${r.titulo_seo || r.titular}</title>
<meta name="description" content="${r.descripcion_seo || ''}">
<meta name="keywords" content="${tags.join(', ')}">
<meta property="og:title" content="${r.titulo_seo || r.titular}">
<meta property="og:description" content="${r.descripcion_seo || ''}">
<meta property="og:site_name" content="REDIA — Red de Inteligencia Acuícola">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Inter,system-ui,sans-serif;background:#f8fafc;color:#0f172a;font-size:15px}.wrap{max-width:780px;margin:0 auto;padding:40px 24px 80px}.cat{display:inline-flex;align-items:center;gap:6px;background:#f3e8ff;color:#7e22ce;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:4px 12px;border-radius:9999px;margin-bottom:14px}h1{font-size:2em;font-weight:900;letter-spacing:-.5px;line-height:1.25;color:#0f172a;margin-bottom:12px}.meta{font-size:11.5px;color:#94a3b8;margin-bottom:28px}.bajada{font-size:16px;font-weight:500;color:#7e22ce;border-left:4px solid #a855f7;padding-left:16px;line-height:1.7;margin-bottom:28px}h2{font-size:1.35em;font-weight:800;color:#0f172a;letter-spacing:-.3px;margin:32px 0 12px}h3{font-size:1.05em;font-weight:700;color:#7e22ce;margin:22px 0 8px}p{line-height:1.8;margin-bottom:16px;color:#334155}blockquote{border-left:4px solid #2dd4bf;background:#f0fdfa;padding:14px 18px;border-radius:0 10px 10px 0;margin:20px 0;font-style:italic;color:#475569}strong{color:#0f172a;font-weight:700}.insight{background:#0f172a;border-radius:20px;padding:28px;margin:32px 0}.ih{color:rgba(255,255,255,.9);font-size:14px;font-weight:700;margin:0 0 16px}.ig{display:grid;grid-template-columns:1fr 1fr;gap:12px}.ic{background:rgba(255,255,255,.07);border-radius:10px;padding:12px 14px}.icl{font-size:9px;text-transform:uppercase;letter-spacing:1.2px;color:rgba(255,255,255,.4);margin-bottom:6px}.icb{font-size:12.5px;line-height:1.55;color:rgba(255,255,255,.85)}.srcs{margin-top:36px;padding-top:20px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8}.tag{display:inline-block;background:#0f172a;color:white;font-size:11px;font-weight:700;padding:4px 12px;border-radius:9999px;margin:3px}footer{text-align:center;margin-top:48px;padding-top:20px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8}</style>
</head>
<body>
<div class="wrap">
<div class="cat">● ${r.categoria || 'Análisis REDIA'}</div>
<h1>${r.titular}</h1>
<div class="meta">REDIA · ${fecha} · ${r.tiempo_lectura || '5 min'} · ${tags.map(t => '<span class="tag">#' + t + '</span>').join('')}</div>
<div class="bajada">${r.bajada}</div>
${r.cuerpo_html}
<div class="insight">
<p class="ih">★ Análisis REDIA</p>
<div class="ig" style="grid-template-columns:1fr">
<div class="ic"><div class="icl">Lo que muestra este análisis</div><div class="icb">${r.analisis_muestra || sj(r.beneficios, []).map(b => '· ' + b).join('<br>') || ''}</div></div>
</div>
</div>
${srcBlock}
<footer><strong style="color:#9333ea">REDIA</strong> — Red de Inteligencia Acuícola · <a href="https://redia.pro" style="color:#9333ea">redia.pro</a></footer>
</div>
</body>
</html>`;
}
