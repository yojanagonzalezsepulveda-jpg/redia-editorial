// ── STATE — variables globales de la aplicación ──────────────────────────────
export var GS_URL = localStorage.getItem('gs_url') || '';
export var ANT_KEY = localStorage.getItem('ant_key') || '';
export var GEM_KEY_SEARCH = localStorage.getItem('gem_key_search') || '';
export var DEEP_KEY_SEARCH = localStorage.getItem('deep_key_search') || '';
export var TAVILY_KEY = localStorage.getItem('tavily_key') || '';
export var AI_PROV_SEARCH = localStorage.getItem('ai_prov_search') || 'auto';

export var LOCAL_RECS_KEY = 'redia_bandeja_local';

// Estado mutable — se exportan como objetos para permitir mutación desde otros módulos
export var state = {
  records: [],
  filtro: 'todos',
  CFG: {},
  manualRec: null,
  manualRecs: [],
  pubUID: null,
  platState: { redia: true, li: true, fb: true, yt: false },
  tipoActual: 'noticia',
  crearRec: null,
  _busquedaAbort: null,
  _gsRetries: 0,
  _gsTimer: null,
};
