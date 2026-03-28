// ── APP — punto de entrada, inyección de dependencias y exposición global ─────
import { state } from './state.js';
import { localLoad, localSave, _injectStorageDeps } from './storage.js';
import { loadCFG, saveCFG, applyCFG, guardarCfg, cargarCredenciales, guardarCredPB, guardarCredLI, guardarCredFB, probarPB, showCredSec, renderFuentesPills, getFuentesActivas, agregarFuente, renderHistorial, borrarHistorial, guardarHistorial, updatePlatBadges } from './config.js';
import { showPage, showCfg } from './nav.js';
import { esc, sj, sleep, cp, cpRec, dlHTML, dlRec, dlManual, cpHTML, _injectUtilsDeps } from './utils.js';
import { getAIKey, buildProvOrder, callAI, callGemini, callDeepSeek, callClaude, searchTavily, listarModelosGemini, selProvSearch } from './ai.js';
import { buildHTML } from './html-builder.js';
import { renderBandeja, filtrar, buildCard, toggleCard, showCTab, dirty, getRec, autoPublicarRedia, estado, guardarEdicion, toggleCollapse, _injectBandejaDeps } from './bandeja.js';
import { generarImgBandeja, dirtyMedia, guardarMedia, generarMedia, dirtyRRSS, guardarRRSS, generarRedSocial, generarDistribucion, resizarImg820x400, generarImagenGemini, generarImgManual, previsualizarImg, previsualizarMulti, leerImagen64, leerImagenes64Multi, injectMediaIntoHTML, leerArchivoAdjunto, _injectMediaDeps } from './media.js';
import { abrirPublicar, cerrarPublicar, confirmarPublicar, mostrarPubStatus, togglePlat, mostrarYouTube, _injectPublicarDeps } from './publicar.js';
import { updEsp, updFoc, buscarManual, guardarManualEnGS, generarAutomatico, guardarTodosEnGS, cancelarBusqueda, setGsStatus, autoConectarGS, _injectBusquedaDeps } from './busqueda.js';
import { selTipo, generarCrear, buildCrearPrompt, guardarCrearEnGS, dlCrear, copiarHTMLCrear, aplicarEdicionManual, corregirConIA, selAll, clearAll, _injectCrearDeps } from './crear.js';
import { deduplicateRecs, mergeConLocal, localAddRec, gsCall, guardarGS, limpiarDuplicados, cargarBandeja, gsGuardar, gsActualizar } from './storage.js';

// ── INYECCIÓN DE DEPENDENCIAS CIRCULARES ──────────────────────────────────────
_injectStorageDeps({ renderBandeja, setGsStatus });
_injectUtilsDeps({ getRec, buildHTML });
_injectBandejaDeps({ buildHTML });
_injectMediaDeps({ getRec, buildHTML, renderBandeja });
_injectPublicarDeps({ getRec, renderBandeja });
_injectBusquedaDeps({ buildHTML, renderBandeja });
_injectCrearDeps({ buildHTML });

// ── INICIALIZACIÓN ─────────────────────────────────────────────────────────────
state.CFG = loadCFG();

// Migrar modelos obsoletos
(function migrarModelos() {
  var CFG = state.CFG;
  var obsoletos = ['gemini-2.0-flash-001', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.0-flash-lite-latest', 'gemini-1.5-flash', 'gemini-1.5-pro'];
  if (obsoletos.includes(CFG.geminiModel)) { CFG.geminiModel = 'gemini-2.5-flash'; saveCFG({ geminiModel: 'gemini-2.5-flash' }); }
})();

// Prefill GS URL
if (state.GS_URL) {
  var gsUrlEl = document.getElementById('gsUrl');
  if (gsUrlEl) gsUrlEl.value = state.GS_URL;
}

// Proveedor IA seleccionado
var aiProvInit = state.AI_PROV_SEARCH || localStorage.getItem('ai_prov_search') || 'auto';
state.AI_PROV_SEARCH = aiProvInit;
selProvSearch(aiProvInit, true);

// Fecha en nav
var ndateEl = document.getElementById('ndate');
if (ndateEl) ndateEl.textContent = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });

// Aplicar configuración editorial
applyCFG();

// Iniciar credenciales
cargarCredenciales();

// Mostrar registros locales de inmediato
state.records = localLoad();
if (state.records.length) renderBandeja();

// Conectar a GS automáticamente
autoConectarGS();

// Listeners de chips (búsqueda manual) — addEventListener para que no pueda ser sobreescrito
document.getElementById('eGrid').addEventListener('click', function(e) {
  var c = e.target.closest('.chip'); if (c) { c.classList.toggle('on'); try { updEsp(); } catch(e2) {} }
});
document.getElementById('fGrid').addEventListener('click', function(e) {
  var c = e.target.closest('.ftag'); if (c) { c.classList.toggle('on'); try { updFoc(); } catch(e2) {} }
});

// Listeners de tone/audiencia (config)
document.querySelectorAll('#toneGrid .tone-o').forEach(el => el.onclick = () => {
  document.querySelectorAll('#toneGrid .tone-o').forEach(e => e.classList.remove('on'));
  el.classList.add('on');
});
document.querySelectorAll('#audGrid .aud-o').forEach(el => el.onclick = () => el.classList.toggle('on'));

// ── EXPONER AL SCOPE GLOBAL (requerido por onclick= en HTML) ──────────────────

// nav
window.showPage            = showPage;
window.showCfg             = showCfg;

// config / credenciales
window.applyCFG            = applyCFG;
window.guardarCfg          = guardarCfg;
window.saveCFG             = saveCFG;
window.cargarCredenciales  = cargarCredenciales;
window.guardarCredPB       = guardarCredPB;
window.guardarCredLI       = guardarCredLI;
window.guardarCredFB       = guardarCredFB;
window.probarPB            = probarPB;
window.showCredSec         = showCredSec;
window.renderFuentesPills  = renderFuentesPills;
window.getFuentesActivas   = getFuentesActivas;
window.agregarFuente       = agregarFuente;
window.renderHistorial     = renderHistorial;
window.borrarHistorial     = borrarHistorial;
window.guardarHistorial    = guardarHistorial;
window.updatePlatBadges    = updatePlatBadges;

// bandeja
window.renderBandeja       = renderBandeja;
window.filtrar             = filtrar;
window.buildCard           = buildCard;
window.toggleCard          = toggleCard;
window.showCTab            = showCTab;
window.dirty               = dirty;
window.getRec              = getRec;
window.autoPublicarRedia   = autoPublicarRedia;
window.estado              = estado;
window.guardarEdicion      = guardarEdicion;
window.toggleCollapse      = toggleCollapse;

// media
window.generarImgBandeja   = generarImgBandeja;
window.dirtyMedia          = dirtyMedia;
window.guardarMedia        = guardarMedia;
window.generarMedia        = generarMedia;
window.dirtyRRSS           = dirtyRRSS;
window.guardarRRSS         = guardarRRSS;
window.generarRedSocial    = generarRedSocial;
window.generarDistribucion = generarDistribucion;
window.resizarImg820x400   = resizarImg820x400;
window.generarImagenGemini = generarImagenGemini;
window.generarImgManual    = generarImgManual;
window.previsualizarImg    = previsualizarImg;
window.previsualizarMulti  = previsualizarMulti;
window.leerImagen64        = leerImagen64;
window.leerImagenes64Multi = leerImagenes64Multi;
window.injectMediaIntoHTML = injectMediaIntoHTML;
window.leerArchivoAdjunto  = leerArchivoAdjunto;

// publicar
window.abrirPublicar       = abrirPublicar;
window.cerrarPublicar      = cerrarPublicar;
window.confirmarPublicar   = confirmarPublicar;
window.mostrarPubStatus    = mostrarPubStatus;
window.togglePlat          = togglePlat;
window.mostrarYouTube      = mostrarYouTube;

// busqueda
window.updEsp              = updEsp;
window.updFoc              = updFoc;
window.buscarManual        = buscarManual;
window.guardarManualEnGS   = guardarManualEnGS;
window.generarAutomatico   = generarAutomatico;
window.guardarTodosEnGS    = guardarTodosEnGS;
window.cancelarBusqueda    = cancelarBusqueda;
window.setGsStatus         = setGsStatus;
window.autoConectarGS      = autoConectarGS;

// crear
window.selTipo             = selTipo;
window.generarCrear        = generarCrear;
window.buildCrearPrompt    = buildCrearPrompt;
window.guardarCrearEnGS    = guardarCrearEnGS;
window.dlCrear             = dlCrear;
window.copiarHTMLCrear     = copiarHTMLCrear;
window.aplicarEdicionManual = aplicarEdicionManual;
window.corregirConIA       = corregirConIA;
window.selAll              = selAll;
window.clearAll            = clearAll;

// storage / gs
window.guardarGS           = guardarGS;
window.limpiarDuplicados   = limpiarDuplicados;
window.cargarBandeja       = cargarBandeja;

// utils
window.cp                  = cp;
window.cpRec               = cpRec;
window.dlHTML              = dlHTML;
window.dlRec               = dlRec;
window.dlManual            = dlManual;
window.cpHTML              = cpHTML;
window.esc                 = esc;
window.sj                  = sj;
window.sleep               = sleep;

// ai
window.getAIKey            = getAIKey;
window.buildProvOrder      = buildProvOrder;
window.callAI              = callAI;
window.callGemini          = callGemini;
window.callDeepSeek        = callDeepSeek;
window.callClaude          = callClaude;
window.searchTavily        = searchTavily;
window.listarModelosGemini = listarModelosGemini;
window.selProvSearch       = selProvSearch;

// html-builder
window.buildHTML           = buildHTML;

// Exponer state para compatibilidad con código que lo accede via window._state
window._state = state;
