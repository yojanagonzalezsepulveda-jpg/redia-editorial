// ── AI — proveedores de inteligencia artificial ──────────────────────────────
import { state } from './state.js?v=7';

export function getAIKey(p) {
  var CFG = state.CFG;
  return p === 'gem' ? (CFG.gemKey || '') : p === 'deep' ? (CFG.deepKey || '') : (CFG.antKey || '');
}

export function buildProvOrder(pref) {
  var all = ['gem', 'deep', 'ant']; // orden: Gemini → DeepSeek → Claude (Claude último por costo)
  if (pref === 'auto') return all.filter(function(p) { return !!getAIKey(p); });
  return [pref].concat(all.filter(function(p) { return p !== pref; }));
}

export async function callAI(prompt, useSearch, antModel, maxTok, signal, searchQ, contentOverride) {
  var AI_PROV_SEARCH = state.AI_PROV_SEARCH || localStorage.getItem('ai_prov_search') || 'auto';
  var order = buildProvOrder(AI_PROV_SEARCH);
  if (!order.length) throw new Error('Sin proveedores disponibles — configura una API key en Credenciales → API Keys IA.');
  var lastErr;
  for (var i = 0; i < order.length; i++) {
    var p = order[i]; var key = getAIKey(p);
    if (!key) continue;
    try {
      if (p === 'gem') return await callGemini(prompt, key, signal, useSearch, maxTok, contentOverride);
      if (p === 'deep') {
        if (contentOverride) { lastErr = new Error('DeepSeek no soporta imágenes'); continue; }
        if (useSearch) {
          var tKey = state.CFG.tavilyKey || ''; if (!tKey) { lastErr = new Error('Sin key Tavily'); continue; }
          var ctx = await searchTavily(searchQ || prompt.substring(0, 200), tKey);
          return await callDeepSeek(prompt + '\n\nRESULTADOS DE BÚSQUEDA WEB:\n' + ctx, key, signal, maxTok || 4000);
        }
        return await callDeepSeek(prompt, key, signal, maxTok || 6000);
      }
      if (p === 'ant') return await callClaude(prompt, key, contentOverride || null, signal, useSearch, antModel, maxTok);
    } catch(e) { lastErr = e; /* continúa al siguiente proveedor */ }
  }
  throw lastErr || new Error('Todos los proveedores fallaron.');
}

export async function callGemini(prompt, key, signal, useSearch, maxTok, contentOverride) {
  var gemModel = (state.CFG && state.CFG.geminiModel) || 'gemini-2.5-flash';
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + gemModel + ':generateContent?key=' + key;
  var parts;
  if (contentOverride && Array.isArray(contentOverride)) {
    parts = contentOverride.map(function(b) {
      if (b.type === 'image') return { inline_data: { mime_type: b.source.media_type, data: b.source.data } };
      if (b.type === 'text') return { text: b.text };
      return { text: '' };
    });
  } else {
    parts = [{ text: prompt }];
  }
  var bodyObj = {
    contents: [{ role: 'user', parts: parts }],
    generationConfig: { maxOutputTokens: maxTok || 8192 }
  };
  if (useSearch !== false && !contentOverride) bodyObj.tools = [{ google_search: {} }];
  var res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyObj),
    signal: signal || undefined
  });
  if (!res.ok) { var e = await res.json().catch(() => ({})); throw new Error(e.error?.message || 'Error HTTP ' + res.status); }
  var d = await res.json();
  // Verificar si fue bloqueado por safety
  var finishReason = d.candidates?.[0]?.finishReason;
  if (finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
    throw new Error('Gemini bloqueó la respuesta: ' + finishReason);
  }
  if (!d.candidates || d.candidates.length === 0) {
    var blocked = d.promptFeedback?.blockReason;
    throw new Error(blocked ? 'Prompt bloqueado por Gemini: ' + blocked : 'Gemini no devolvió candidatos');
  }
  var allParts = d.candidates[0]?.content?.parts || [];
  var textParts = allParts.filter(p => p.text && !p.thought);
  if (textParts.length > 0) return textParts.map(p => p.text).join('');
  var anyText = allParts.filter(p => p.text).map(p => p.text).join('');
  if (anyText) return anyText;
  // Sin texto — mostrar qué tipos de partes devolvió para diagnóstico
  var tipos = allParts.map(p => Object.keys(p).join('+')).join(' | ') || 'ninguna parte';
  throw new Error('Gemini devolvió respuesta sin texto. Partes: ' + tipos);
}

export async function callDeepSeek(prompt, key, signal, maxTok) {
  var res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify({ model: (state.CFG && state.CFG.deepModel) || 'deepseek-chat', max_tokens: maxTok || 6000, messages: [{ role: 'user', content: prompt }] }),
    signal: signal || undefined
  });
  if (!res.ok) { var e = await res.json().catch(() => ({})); throw new Error(e.error?.message || 'Error HTTP ' + res.status); }
  var d = await res.json();
  return d.choices?.[0]?.message?.content || '';
}

export async function callClaude(prompt, key, contentOverride, signal, useSearch, model, maxTok) {
  var bodyObj = { model: model || (state.CFG && state.CFG.antModel1) || 'claude-sonnet-4-20250514', max_tokens: maxTok || 8096, messages: [{ role: 'user', content: contentOverride || prompt }] };
  if (useSearch !== false) bodyObj.tools = [{ type: 'web_search_20250305', name: 'web_search' }];
  var res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify(bodyObj),
    signal: signal || undefined
  });
  if (!res.ok) { var e = await res.json().catch(() => ({})); var em = e.error?.message || 'Error HTTP ' + res.status; if (res.status === 429) em = 'RATE_LIMIT:' + em; throw new Error(em); }
  var d = await res.json();
  return d.content.filter(b => b.type === 'text').map(b => b.text).join('');
}

export async function searchTavily(query, key) {
  var res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: key, query: query, search_depth: 'advanced', max_results: 6, include_answer: true })
  });
  if (!res.ok) throw new Error('Tavily error HTTP ' + res.status);
  var d = await res.json();
  var lines = [];
  if (d.answer) lines.push('RESUMEN: ' + d.answer);
  (d.results || []).forEach(function(r, i) { lines.push((i + 1) + '. ' + r.title + '\nURL: ' + r.url + '\n' + r.content.substring(0, 600)); });
  return lines.join('\n\n');
}

export async function listarModelosGemini() {
  var key = (state.CFG && state.CFG.gemKey) || '';
  var div = document.getElementById('geminiModelList');
  if (!key) { div.textContent = 'Sin key Gemini configurada.'; return; }
  div.textContent = 'Consultando...';
  try {
    var res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + key);
    var d = await res.json();
    var models = (d.models || [])
      .filter(function(m) { return m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'); })
      .map(function(m) { return m.name.replace('models/', ''); });
    div.innerHTML = models.length
      ? '<strong>Disponibles:</strong><br>' + models.map(function(n) { return '<span style="cursor:pointer;color:var(--p6)" onclick="document.getElementById(\'cfGeminiModel\').value=\'' + n + '\'">' + n + '</span>'; }).join('<br>')
      : 'No se encontraron modelos.';
  } catch(e) { div.textContent = 'Error: ' + e.message; }
}

export function selProvSearch(p, init) {
  state.AI_PROV_SEARCH = p;
  if (!init) localStorage.setItem('ai_prov_search', p);
  var btns = { auto: 'provBtnAuto', gem: 'provBtnGem', deep: 'provBtnDp', ant: 'provBtnAnt' };
  Object.keys(btns).forEach(function(id) {
    var b = document.getElementById(btns[id]);
    var on = id === p;
    if (b) { b.style.background = on ? 'var(--p)' : 'transparent'; b.style.color = on ? '#fff' : 'var(--s5)'; b.style.borderColor = on ? 'var(--p)' : 'var(--s2)'; }
  });
}
