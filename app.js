/* Weitblick: Fragen mit Quellen + Nachrichten-Feed mit Abschalten. Zugaenge nur verschluesselt im Browser. */
var APP_VERSION = 'v2';
var $ = function (id) { return document.getElementById(id); };
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function ss(s) { return String(s || '').replace(/ß/g, 'ss'); }
function safeUrl(u) { return /^https:\/\//i.test(u || '') ? u : '#'; }

/* ================= Filter ================= */
var TOPICS = ['Schweiz', 'Welt', 'Wirtschaft', 'Tech', 'Wissenschaft', 'Sport'];
function F() { try { var f = JSON.parse(lsGet('wb.filter') || 'null'); if (f) return f; } catch (e) {} return { topics: [], sources: [], words: [], hidden: [] }; }
function saveF(f) { lsSet('wb.filter', JSON.stringify(f)); }
var HIDDEN_INFO = function () { try { return JSON.parse(lsGet('wb.hiddenInfo') || '{}'); } catch (e) { return {}; } };
function visible(x, f) {
  if (f.topics.indexOf(x.topic) > -1 || f.sources.indexOf(x.source) > -1 || f.hidden.indexOf(x.id) > -1) return false;
  var t = (x.title + ' ' + (x.sum || '')).toLowerCase();
  return !f.words.some(function (w) { return w && t.indexOf(w.toLowerCase()) > -1; });
}
var undoFn = null, toastT = null;
function toast(msg, undo) {
  $('toastTxt').textContent = msg; undoFn = undo; $('toastUndo').style.display = undo ? 'block' : 'none';
  $('toast').style.display = 'flex'; clearTimeout(toastT); toastT = setTimeout(function () { $('toast').style.display = 'none'; undoFn = null; }, 7000);
}
$('toastUndo').addEventListener('click', function () { if (undoFn) undoFn(); undoFn = null; $('toast').style.display = 'none'; });
function mute(kind, val, label) {
  var f = F(); if (f[kind].indexOf(val) === -1) f[kind].push(val); saveF(f);
  renderFeed(); renderFilters();
  toast(label, function () { var g = F(); g[kind] = g[kind].filter(function (v) { return v !== val; }); saveF(g); renderFeed(); renderFilters(); });
}
function unmute(kind, val) { var f = F(); f[kind] = f[kind].filter(function (v) { return v !== val; }); saveF(f); renderFilters(); renderFeed(); }

/* ================= Feed ================= */
var FEED = { items: [] }, CUR_TOPIC = 'Alle';
function agoText(iso) {
  if (!iso) return ''; var m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 60) return 'vor ' + Math.max(m, 1) + ' Min.'; var h = Math.round(m / 60); if (h < 24) return 'vor ' + h + ' Std.'; return 'vor ' + Math.round(h / 24) + ' Tagen';
}
function loadFeed() {
  $('feedInfo').textContent = '⏳ Lade Nachrichten …';
  return fetch('data/feed.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
    FEED = j; lsSet('wb.feedCache', JSON.stringify(j)); renderFeed();
  }).catch(function () {
    try { FEED = JSON.parse(lsGet('wb.feedCache') || '{"items":[]}'); } catch (e) {}
    renderFeed(); $('feedInfo').textContent = FEED.items.length ? '📴 Offline: letzte gespeicherte Nachrichten.' : '❌ Nachrichten konnten nicht geladen werden.';
  });
}
function renderChips() {
  var f = F();
  $('chips').innerHTML = ['Alle'].concat(TOPICS).filter(function (t) { return f.topics.indexOf(t) === -1; }).map(function (t) {
    return '<button data-t="' + t + '" class="' + (t === CUR_TOPIC ? 'on' : '') + '">' + t + '</button>';
  }).join('');
}
function renderFeed() {
  renderChips(); var f = F();
  if (f.topics.indexOf(CUR_TOPIC) > -1) CUR_TOPIC = 'Alle';
  var list = (FEED.items || []).filter(function (x) { return visible(x, f) && (CUR_TOPIC === 'Alle' || x.topic === CUR_TOPIC); });
  var hiddenN = (FEED.items || []).length - (FEED.items || []).filter(function (x) { return visible(x, f); }).length;
  $('feedInfo').textContent = FEED.updated ? ('Stand ' + new Date(FEED.updated).toLocaleString('de-CH', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) + ' · ' + list.length + ' Meldungen' + (hiddenN ? ' · ' + hiddenN + ' abgeschaltet' : '')) : '';
  $('feed').innerHTML = list.slice(0, 80).map(function (x) {
    return '<article class="card news" data-id="' + esc(x.id) + '">' +
      (x.img ? '<img loading="lazy" alt="" src="' + esc(safeUrl(x.img)) + '" onerror="this.remove()">' : '') +
      '<div class="mut">' + esc(x.topic) + ' · ' + esc(x.source) + ' · ' + agoText(x.date) + '</div>' +
      '<h3 data-a="open">' + esc(x.title) + '</h3>' + (x.sum ? '<p data-a="open">' + esc(x.sum) + '</p>' : '') +
      '<div class="acts"><button data-a="open" class="main">Lesen</button><button data-a="hide">🙈 Nicht mehr zeigen</button>' +
      '<button data-a="topic">🔕 ' + esc(x.topic) + '</button><button data-a="source">🔕 ' + esc(x.source) + '</button></div></article>';
  }).join('') || '<div class="card">Keine Meldungen. Vielleicht ist zu viel abgeschaltet? Unter ⚙️ kannst du es rückgängig machen.</div>';
}
$('chips').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; CUR_TOPIC = b.dataset.t; renderFeed(); $('v-feed').scrollIntoView(); });
function byId(id) { return (FEED.items || []).find(function (x) { return x.id === id; }); }
$('feed').addEventListener('click', function (e) {
  var a = e.target.closest('[data-a]'), c = e.target.closest('[data-id]'); if (!a || !c) return;
  var x = byId(c.dataset.id); if (!x) return;
  if (a.dataset.a === 'open') openArticle(x);
  if (a.dataset.a === 'hide') { var hi = HIDDEN_INFO(); hi[x.id] = x.title; lsSet('wb.hiddenInfo', JSON.stringify(hi)); mute('hidden', x.id, 'Meldung ausgeblendet.'); }
  if (a.dataset.a === 'topic') mute('topics', x.topic, 'Thema „' + x.topic + '“ abgeschaltet.');
  if (a.dataset.a === 'source') mute('sources', x.source, 'Quelle „' + x.source + '“ abgeschaltet.');
});
var ART = null;
function openArticle(x) {
  ART = x;
  $('v-art').innerHTML = '<button id="artBack">← Zurück</button><article class="card news">' +
    (x.img ? '<img alt="" src="' + esc(safeUrl(x.img)) + '" onerror="this.remove()">' : '') +
    '<div class="mut">' + esc(x.topic) + ' · ' + esc(x.source) + ' · ' + agoText(x.date) + '</div><h3>' + esc(x.title) + '</h3>' +
    '<p>' + esc(x.sum || x.text || '') + '</p>' + (x.ai ? '<div class="mut">Zusammenfassung von einer KI, nur aus dem Text der Quelle.</div>' : '<div class="mut">Kurztext der Quelle.</div>') +
    '<div class="row"><a href="' + esc(safeUrl(x.link)) + '" target="_blank" rel="noopener"><button class="main">Ganzen Artikel bei ' + esc(x.source) + ' lesen ↗</button></a></div></article>' +
    '<div class="card"><b>Frage zu dieser Meldung</b><div class="follow">' +
    ['Worum geht es genau, und was ist der Hintergrund?', 'Was bedeutet das für die Schweiz?', 'Was sagen andere Quellen dazu?'].map(function (q) { return '<button data-q="' + esc(q) + '">' + esc(q) + '</button>'; }).join('') +
    '</div><div class="row"><input id="artQ" placeholder="Eigene Frage …"><button id="artAsk" class="main">Fragen</button></div></div>';
  go('art'); $('main').scrollTop = 0;
}
document.querySelector('main').id = 'main';
$('v-art').addEventListener('click', function (e) {
  if (e.target.id === 'artBack') { go('feed'); return; }
  var b = e.target.closest('button[data-q]'); if (b) return askAbout(b.dataset.q);
  if (e.target.id === 'artAsk') { var q = $('artQ').value.trim(); if (q) askAbout(q); }
});
function askAbout(q) { var x = ART; S = { turns: [], ctx: x }; $('thread').innerHTML = ''; go('ask'); ask(q); }

/* ================= Einstellungen: Filter-Liste ================= */
function renderFilters() {
  var f = F(), hi = HIDDEN_INFO();
  function rows(kind, arr, lab) {
    return arr.length ? arr.map(function (v) { return '<div class="line"><span>' + esc(lab ? lab(v) : v) + '</span><button data-k="' + kind + '" data-v="' + esc(v) + '">Wieder zeigen</button></div>'; }).join('') : '<div class="mut">Nichts abgeschaltet.</div>';
  }
  var allSources = {}; (FEED.items || []).forEach(function (x) { allSources[x.source] = 1; });
  $('fTopics').innerHTML = rows('topics', f.topics) + '<div class="row">' + TOPICS.filter(function (t) { return f.topics.indexOf(t) === -1; }).map(function (t) { return '<button data-m="topics" data-v="' + t + '">🔕 ' + t + '</button>'; }).join('') + '</div>';
  $('fSources').innerHTML = rows('sources', f.sources) + '<div class="row">' + Object.keys(allSources).filter(function (s) { return f.sources.indexOf(s) === -1; }).map(function (s) { return '<button data-m="sources" data-v="' + esc(s) + '">🔕 ' + esc(s) + '</button>'; }).join('') + '</div>';
  $('fWords').innerHTML = rows('words', f.words);
  $('fHidden').innerHTML = rows('hidden', f.hidden, function (id) { return hi[id] || 'Meldung ' + id; });
}
$('v-set').addEventListener('click', function (e) {
  var b = e.target.closest('button'); if (!b) return;
  if (b.dataset.k) unmute(b.dataset.k, b.dataset.v);
  if (b.dataset.m) mute(b.dataset.m, b.dataset.v, (b.dataset.m === 'topics' ? 'Thema „' : 'Quelle „') + b.dataset.v + '“ abgeschaltet.');
});
$('wordAdd').addEventListener('click', function () { var w = $('wordInp').value.trim(); if (!w) return; $('wordInp').value = ''; mute('words', w, 'Wort „' + w + '“ abgeschaltet.'); });

/* ================= KI-Anbieter ================= */
var PROVIDERS = {
  gemini: { name: 'Google Gemini', link: 'https://aistudio.google.com/apikey', hint: 'Mit Google-Konto anmelden, dort auf „Create API key“ tippen. Nur Gemini kann direkt bei Google suchen.' },
  groq: { name: 'Groq', link: 'https://console.groq.com/keys', base: 'https://api.groq.com/openai/v1', hint: 'Gratis-Konto erstellen, dort „Create API Key“ tippen.' },
  mistral: { name: 'Mistral', link: 'https://console.mistral.ai/api-keys', base: 'https://api.mistral.ai/v1', hint: 'Gratis-Plan „Experiment“ wählen, dann einen Zugang erstellen.' },
  frei: { name: 'Gratis-KI ohne Anmeldung', free: true, base: 'https://text.pollinations.ai/openai' },
  openrouter: { name: 'OpenRouter (optional)', link: 'https://openrouter.ai/keys', base: 'https://openrouter.ai/api/v1', hint: 'Nur Modelle mit „:free“ sind gratis.' }
};
var CHAIN = [
  { provider: 'gemini', model: 'gemini-flash-latest' }, { provider: 'gemini', model: 'gemini-flash-lite-latest' },
  { provider: 'groq', model: 'llama-3.3-70b-versatile' }, { provider: 'groq', model: 'openai/gpt-oss-120b' },
  { provider: 'mistral', model: 'mistral-small-latest' }, { provider: 'openrouter', model: 'openrouter/free' }
];
var COOL = {};
function keyOf(p) { return KEYS[p] || ''; }
function pname(p) { return PROVIDERS[p].name.replace(' (optional)', ''); }
function httpErr(status, msg) { var e = new Error(msg || ('HTTP ' + status)); e.status = status; return e; }
/* opts.grounded: Gemini mit Google-Suche; messages: [{role:'user'|'assistant', text}] */
function callOne(item, system, messages, opts, keyOverride) {
  opts = opts || {};
  var p = item.provider, key = keyOverride || keyOf(p), ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 60000), req;
  if (p === 'gemini') {
    var body = { systemInstruction: { parts: [{ text: system }] }, contents: messages.map(function (m) { return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }] }; }), generationConfig: { temperature: 0.3 } };
    if (opts.grounded) body.tools = [{ google_search: {} }];
    req = fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(item.model) + ':generateContent', { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body) });
  } else {
    var hd = { 'content-type': 'application/json' }; if (!PROVIDERS[p].free) hd.authorization = 'Bearer ' + key;
    req = fetch(PROVIDERS[p].base + (PROVIDERS[p].free ? '' : '/chat/completions'), { method: 'POST', signal: ctl.signal, headers: hd,
      body: JSON.stringify({ model: item.model, temperature: 0.3, messages: [{ role: 'system', content: system }].concat(messages.map(function (m) { return { role: m.role, content: m.text }; })) }) });
  }
  return req.then(function (r) {
    clearTimeout(t);
    if (!r.ok) return r.text().then(function (b) { var e = httpErr(r.status, 'HTTP ' + r.status + ' ' + b.slice(0, 160)); e.retry = parseInt(r.headers.get('retry-after') || '0', 10) || 0; throw e; });
    return r.json();
  }, function () { clearTimeout(t); var x = new Error('Netzwerk/Zeitüberschreitung'); x.status = 0; throw x; }).then(function (j) {
    if (p === 'gemini') {
      var c = (j.candidates || [])[0] || {}, txt = ((c.content || {}).parts || []).map(function (x) { return x.text || ''; }).join('');
      if (!txt) throw httpErr(502, 'Leere Antwort');
      return { text: txt, meta: c.groundingMetadata || null };
    }
    var t2 = (((j.choices || [])[0] || {}).message || {}).content || '';
    if (!t2) throw httpErr(502, 'Leere Antwort');
    return { text: t2, meta: null };
  });
}

/* ================= Zugaenge: verschluesselt mit PIN ================= */
var KEYS = {}, UNLOCKED = false, PIN_KEY = null, PIN_SALT = null, ITER = 600000;
function vault() { try { return JSON.parse(lsGet('wb.vault') || 'null'); } catch (e) { return null; } }
function conn() { try { return JSON.parse(lsGet('wb.conn') || '{}'); } catch (e) { return {}; } }
function setConn(p, v) { var c = conn(); if (v) c[p] = v; else delete c[p]; lsSet('wb.conn', JSON.stringify(c)); }
var b64 = function (u) { return btoa(String.fromCharCode.apply(null, new Uint8Array(u))); };
var unb64 = function (s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); };
function derive(pin, salt) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']).then(function (k) {
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: ITER, hash: 'SHA-256' }, k, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  });
}
function persist() {
  var iv = crypto.getRandomValues(new Uint8Array(12));
  return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, PIN_KEY, new TextEncoder().encode(JSON.stringify(KEYS))).then(function (ct) {
    lsSet('wb.vault', JSON.stringify({ v: 1, iter: ITER, salt: b64(PIN_SALT), iv: b64(iv), ct: b64(ct) }));
  });
}
function unlock(pin) {
  var v = vault(); if (!v) return Promise.reject(new Error('none'));
  return derive(pin, unb64(v.salt)).then(function (k) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(v.iv) }, k, unb64(v.ct)).then(function (pt) {
      KEYS = JSON.parse(new TextDecoder().decode(pt)); PIN_KEY = k; PIN_SALT = unb64(v.salt); UNLOCKED = true;
    });
  });
}
function setPin(pin) { PIN_SALT = crypto.getRandomValues(new Uint8Array(16)); return derive(pin, PIN_SALT).then(function (k) { PIN_KEY = k; UNLOCKED = true; return persist(); }); }
function wipe() { KEYS = {}; UNLOCKED = false; PIN_KEY = null; try { localStorage.removeItem('wb.vault'); localStorage.removeItem('wb.conn'); } catch (e) {} }
function needsPin() { return !!vault() && !UNLOCKED; }
function hasAny() { return Object.keys(KEYS).length > 0 || Object.keys(conn()).some(function (p) { return conn()[p] === 'ok'; }); }
function askPin(mode, why) {
  return new Promise(function (resolve) {
    var o = $('pinBox'), i1 = $('pin1'), i2 = $('pin2'), msg = $('pinMsg');
    $('pinTitle').textContent = mode === 'set' ? 'PIN festlegen (4–6 Ziffern)' : 'PIN eingeben';
    $('pinWhy').textContent = why || (mode === 'set' ? 'Damit niemand sonst deine KI-Verbindung benutzen kann.' : 'Zum Entsperren der KI-Verbindung.');
    i1.value = ''; i2.value = ''; i2.style.display = mode === 'set' ? 'block' : 'none'; $('pinForgot').style.display = mode === 'set' ? 'none' : 'inline-block';
    msg.textContent = ''; o.style.display = 'flex'; setTimeout(function () { i1.focus(); }, 50);
    function done(r) { o.style.display = 'none'; $('pinOk').onclick = $('pinCancel').onclick = $('pinForgot').onclick = null; resolve(r); }
    $('pinCancel').onclick = function () { done(false); };
    $('pinForgot').onclick = function () { if (confirm('PIN vergessen? Dann werden alle KI-Verbindungen auf diesem Handy gelöscht und du musst sie neu einfügen.')) { wipe(); renderKeys(); done('wiped'); } };
    $('pinOk').onclick = function () {
      var a = i1.value.trim();
      if (!/^\d{4,6}$/.test(a)) { msg.textContent = 'Bitte 4 bis 6 Ziffern.'; return; }
      if (mode === 'set') {
        if (a !== i2.value.trim()) { msg.textContent = 'Die beiden PINs sind nicht gleich.'; return; }
        msg.textContent = '⏳ …'; setPin(a).then(function () { done(true); });
      } else { msg.textContent = '⏳ prüfe …'; unlock(a).then(function () { done(true); }, function () { msg.textContent = '❌ Falscher PIN.'; i1.value = ''; }); }
    };
  });
}
function ensureUnlocked(why) { return needsPin() ? askPin('unlock', why) : Promise.resolve(true); }
function markBad(p) { delete KEYS[p]; setConn(p, 'bad'); if (PIN_KEY) persist(); renderKeys(); }
function renderKeys() {
  var c = conn();
  $('keyList').innerHTML = Object.keys(PROVIDERS).filter(function (p) { return !PROVIDERS[p].free; }).map(function (p) {
    var P = PROVIDERS[p], name = esc(P.name);
    if (KEYS[p] || (c[p] === 'ok' && needsPin())) return '<div class="line" data-p="' + p + '"><span>' + name + ' <span style="color:#3ccf91">✓ verbunden</span></span><button data-a="del">Trennen</button></div>';
    return '<div class="card" data-p="' + p + '"><b>' + name + '</b>' +
      (c[p] === 'bad' ? '<div class="warnline">Der Zugang funktioniert nicht mehr (abgelaufen oder ungültig). Bitte neu einfügen.</div>' : '') +
      '<div class="mut">Gratis-Zugang holen: <a href="' + P.link + '" target="_blank" rel="noopener">' + P.link.replace('https://', '') + '</a> · ' + P.hint + '</div>' +
      '<input type="password" name="wb-' + p + '-' + Date.now() + '" autocomplete="new-password" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore placeholder="Zugang hier einfügen">' +
      '<div class="row"><button class="main" data-a="add">Verbinden</button></div><div class="mut res"></div></div>';
  }).join('');
  $('keyList').querySelectorAll('input').forEach(function (i) { ['copy', 'cut', 'dragstart', 'contextmenu'].forEach(function (ev) { i.addEventListener(ev, function (e) { e.preventDefault(); }); }); });
}
$('keyList').addEventListener('click', function (e) {
  var b = e.target.closest('button'), c = e.target.closest('[data-p]'); if (!b || !c) return;
  var p = c.dataset.p;
  if (b.dataset.a === 'del') {
    if (!confirm(PROVIDERS[p].name + ' trennen? Der Zugang wird von diesem Handy gelöscht.')) return;
    delete KEYS[p]; setConn(p, null); (PIN_KEY ? persist() : Promise.resolve()).then(renderKeys); return;
  }
  if (b.dataset.a !== 'add') return;
  var inp = c.querySelector('input'), res = c.querySelector('.res'), k = inp.value.trim();
  if (!k) { res.textContent = 'Zuerst einen Zugang einfügen.'; return; }
  inp.value = ''; b.disabled = true; res.textContent = '⏳ prüfe Verbindung …';
  var item = CHAIN.find(function (x) { return x.provider === p; });
  callOne(item, 'Antworte nur mit OK.', [{ role: 'user', text: 'Test' }], {}, k).then(function () { return 'ok'; }, function (er) {
    if (er.status === 429) return 'ok'; return er.status === 0 ? 'net' : 'bad';
  }).then(function (r) {
    b.disabled = false;
    if (r === 'net') { res.textContent = '❌ Keine Verbindung, bitte später nochmals.'; k = ''; return; }
    if (r === 'bad') { res.textContent = '❌ Zugang nicht akzeptiert. Bitte prüfen und neu einfügen.'; k = ''; return; }
    var key = k; k = '';
    (PIN_KEY ? Promise.resolve(true) : askPin('set')).then(function (ok) {
      if (!ok) { res.textContent = 'Ohne PIN wird nichts gespeichert.'; return; }
      KEYS[p] = key; key = ''; setConn(p, 'ok');
      return persist().then(renderKeys);
    });
  });
});

/* ================= Fragen-Suche ================= */
var S = { turns: [], ctx: null };
var SYS = 'Du bist Weitblick, eine Such-Assistenz wie Perplexity für Ayoub in der Schweiz. Antworte auf Deutsch in Schweizer Schreibweise ("ss" statt "ß"), ' +
  'in klaren, vollständigen Sätzen, kurz und informativ (höchstens etwa 180 Wörter, gerne kurze Absätze, keine Tabellen). Erfinde nichts. Wenn die Quellen etwas nicht hergeben, sag das ehrlich. ' +
  'Schreibe am Schluss eine eigene Zeile, die mit "FOLGEFRAGEN:" beginnt, gefolgt von genau drei kurzen sinnvollen Anschlussfragen, getrennt durch " | ".';
function splitFollow(t) {
  var m = t.match(/\n?\s*\**FOLGEFRAGEN:?\**\s*(.*)$/is), f = [];
  if (m) { f = m[1].split(/\s*\|\s*|\n+/).map(function (s) { return s.replace(/^[-*\d.\s]+/, '').trim(); }).filter(Boolean).slice(0, 3); t = t.slice(0, m.index); }
  return { text: t.trim(), follow: f };
}
var STOP = /^(was|wer|wie|wo|wann|warum|wieso|weshalb|welche[rsnm]?|ist|sind|war|hat|haben|gibt|es|der|die|das|den|dem|des|ein|eine[rnms]?|und|oder|in|im|am|an|auf|zu|zum|zur|von|vom|mit|für|über|bei|heute|gestern|morgen|aktuell|neu|neues|passiert|genau|bitte|mir|mich|ich|du|man|sich|sagen|sagt|bedeutet|dazu|noch|mehr|erkläre?|erklär|kurz|macht|machen|tut|einfach|erzähl|erzähle|sag|zeig|weisst|kannst|könntest|bitte|eigentlich|so|denn|mal)$/i;
function keywords(q) { return q.split(/[^A-Za-zÄÖÜäöüéèàç0-9-]+/).filter(function (w) { return w.length > 1 && !STOP.test(w); }).join(' ') || q; }
function wikiSources(q) {
  q = keywords(q);
  var api = 'https://de.wikipedia.org/w/api.php?format=json&origin=*&';
  return fetch(api + 'action=query&list=search&srlimit=3&srsearch=' + encodeURIComponent(q)).then(function (r) { return r.json(); }).then(function (j) {
    var ids = ((j.query || {}).search || []).map(function (x) { return x.pageid; });
    if (!ids.length) return [];
    return fetch(api + 'action=query&prop=extracts|info&inprop=url&exintro=1&explaintext=1&exchars=1200&pageids=' + ids.join('|')).then(function (r) { return r.json(); }).then(function (k) {
      return ids.map(function (id) { var p = k.query.pages[id]; return p && { title: p.title + ' – Wikipedia', url: p.fullurl, text: p.extract || '' }; }).filter(Boolean);
    });
  }).catch(function () { return []; });
}
function ddgSource(q) {
  return fetch('https://api.duckduckgo.com/?format=json&no_html=1&skip_disambig=1&kl=ch-de&q=' + encodeURIComponent(keywords(q))).then(function (r) { return r.json(); }).then(function (j) {
    return j.AbstractText && j.AbstractURL ? [{ title: (j.Heading || 'DuckDuckGo') + ' – ' + (j.AbstractSource || 'DuckDuckGo'), url: j.AbstractURL, text: j.AbstractText }] : [];
  }).catch(function () { return []; });
}
function feedSources(q) {
  var f0 = F(), news = /\b(heute|aktuell|neu\w*|news|nachrichten|passiert|lage|woche)\b/i.test(q);
  if (news) {
    var tp = TOPICS.filter(function (t) { return new RegExp(t, 'i').test(q); })[0];
    var rec = (FEED.items || []).filter(function (x) { return visible(x, f0) && (!tp || x.topic === tp); }).slice(0, 6);
    if (rec.length) return rec.map(function (x) { return { title: x.title + ' – ' + x.source, url: x.link, text: x.sum || x.text }; });
  }
  var words = keywords(q).toLowerCase().split(' ').filter(function (w) { return w.length > 3; });
  if (!words.length) return [];
  var f = F(); return (FEED.items || []).filter(function (x) { return visible(x, f); }).map(function (x) { var t = (x.title + ' ' + x.text).toLowerCase(); return { x: x, s: words.filter(function (w) { return t.indexOf(w) > -1; }).length }; })
    .filter(function (o) { return o.s >= Math.min(words.length > 2 ? 2 : 1, words.length); }).sort(function (a, b) { return b.s - a.s; }).slice(0, 4)
    .map(function (o) { return { title: o.x.title + ' – ' + o.x.source, url: o.x.link, text: o.x.text }; });
}
function ctxText() {
  return S.ctx ? ('Es geht um diese Nachrichten-Meldung: "' + S.ctx.title + '" (' + S.ctx.source + ', ' + S.ctx.link + '). Kurztext: ' + (S.ctx.sum || S.ctx.text) + '\n\n') : '';
}
function history(q) {
  var m = []; S.turns.slice(-3).forEach(function (t) { m.push({ role: 'user', text: t.q }); m.push({ role: 'assistant', text: t.a }); });
  m.push({ role: 'user', text: ctxText() + q }); return m;
}
function groundedResult(r) {
  var sp = splitFollow(r.text), meta = r.meta || {}, chunks = meta.groundingChunks || [], srcs = [], map = {};
  chunks.forEach(function (c, i) { var w = c.web || {}; if (!w.uri) return; var key = w.title + '|' + w.uri; if (!(key in map)) { map[key] = srcs.length; srcs.push({ title: w.title || w.uri, url: w.uri }); } map['i' + i] = map[key]; });
  var text = sp.text;
  (meta.groundingSupports || []).slice().sort(function (a, b) { return (b.segment.text || '').length - (a.segment.text || '').length; }).forEach(function (s) {
    var seg = (s.segment || {}).text; if (!seg) return;
    var nums = (s.groundingChunkIndices || []).map(function (i) { return map['i' + i]; }).filter(function (n) { return n != null; });
    nums = nums.filter(function (n, i) { return nums.indexOf(n) === i; }).slice(0, 3);
    var pos = text.indexOf(seg); if (pos < 0 || !nums.length) return;
    var end = pos + seg.length; if (text.slice(end, end + 1) === '[') return;
    text = text.slice(0, end) + nums.map(function (n) { return '[' + (n + 1) + ']'; }).join('') + text.slice(end);
  });
  return { text: ss(text), follow: sp.follow.map(ss), sources: srcs, web: true };
}
var FREE_ITEM = { provider: 'frei', model: 'openai' }, LAST_FREE = +(lsGet('wb.lastFree') || 0);
function wait(ms, out, why) {
  return new Promise(function (res) {
    var end = Date.now() + ms;
    (function tick() { var s = Math.ceil((end - Date.now()) / 1000); if (s <= 0) return res(); out.innerHTML = '⏳ ' + why + ' Noch ' + s + ' Sekunden …'; setTimeout(tick, 1000); })();
  });
}
function callFree(sys, msgs, out) {
  var gap = LAST_FREE + 31000 - Date.now();
  var pre = gap > 0 ? wait(gap, out, 'Die Gratis-KI erlaubt eine Frage alle 30 Sekunden.') : Promise.resolve();
  function go1() { out.innerHTML = '⏳ Ich lese die Quellen und schreibe die Antwort …'; LAST_FREE = Date.now(); lsSet('wb.lastFree', String(LAST_FREE)); return callOne(FREE_ITEM, sys, msgs); }
  return pre.then(go1).catch(function (e) {
    if ((e.status === 402 || e.status === 429) && e.retry && e.retry <= 60) return wait(e.retry * 1000 + 500, out, 'Die Gratis-KI ist kurz besetzt.').then(go1);
    throw e;
  });
}
function ask(q) {
  q = q.trim(); if (!q) return;
  var box = document.createElement('div'); box.className = 'turn';
  box.innerHTML = '<div class="q">' + esc(q) + '</div><div class="card ans">⏳ Ich suche …</div>';
  $('thread').appendChild(box); box.scrollIntoView();
  var out = box.querySelector('.ans');
  ensureUnlocked('Zum Fragen brauche ich deine PIN.').then(function () {
    var list = CHAIN.filter(function (x) { return keyOf(x.provider); }).concat([FREE_ITEM]), now = Date.now();
    var ready = list.filter(function (x) { return !(COOL[x.provider + '/' + x.model] > now); }); if (!ready.length) ready = list;
    var fails = [], i = 0, srcPromise = null;
    function freeSources() { if (!srcPromise) srcPromise = Promise.all([wikiSources(q), ddgSource(q)]).then(function (a) { return feedSources(q + ' ' + (S.ctx ? S.ctx.title : '')).concat(a[0].slice(0, 2), a[1], a[0].slice(2)).slice(0, 8); }); return srcPromise; }
    function next() {
      if (i >= ready.length) {
        return freeSources().then(function (src) {
          var m = '<div class="err">Gerade antwortet keine KI: ' + esc(fails.join(' · ')) + '. Bitte in einer Minute nochmals.</div>';
          out.innerHTML = m + (src.length ? '<b>Diese Quellen habe ich ohne KI gefunden:</b>' + srcList(src) : '<div class="mut">Ohne KI habe ich auch keine passenden Quellen gefunden.</div>');
        });
      }
      var item = ready[i++], label = item.provider === 'frei' ? 'Gratis-KI ohne Anmeldung (Pollinations · GPT-OSS 20B)' : pname(item.provider) + ' · ' + item.model;
      out.innerHTML = '⏳ ' + (item.provider === 'gemini' ? 'Ich suche bei Google …' : 'Ich suche bei Wikipedia, DuckDuckGo und im Nachrichten-Feed …') + (fails.length ? '<div class="mut">Gewechselt zu ' + esc(label) + '</div>' : '');
      var job = item.provider === 'gemini'
        ? callOne(item, SYS, history(q), { grounded: true }).then(groundedResult)
        : freeSources().then(function (src) {
            if (!src.length) throw httpErr(-1, 'keine Quellen');
            var sys = SYS + ' Benutze NUR die nummerierten Quellen unten und setze nach jeder Aussage die Nummer der Quelle in eckigen Klammern, z. B. [1]. Ohne Quelle keine Aussage. Englische Quellen übersetzt du ins Deutsche. Wenn die Quellen die Frage nicht beantworten, sag das in einem Satz ehrlich. Bei Fragen nach aktuellen Nachrichten fasse die wichtigsten 3 bis 5 Meldungen aus den Quellen in je einem ganzen Satz zusammen, jeweils mit Quellennummer.\n\nQUELLEN:\n' +
              src.map(function (s, n) { return '[' + (n + 1) + '] ' + s.title + ': ' + s.text.slice(0, 900); }).join('\n');
            return (item.provider === 'frei' ? callFree(sys, history(q), out) : callOne(item, sys, history(q))).then(function (r) { var sp = splitFollow(r.text); return { text: ss(sp.text), follow: sp.follow.map(ss), sources: src, web: false }; });
          });
      return job.then(function (res) {
        S.turns.push({ q: q, a: res.text }); render(out, res, label); box.scrollIntoView();
      }, function (e) {
        var s = e.status || 0;
        if (s === 429) COOL[item.provider + '/' + item.model] = Date.now() + 60000;
        if (s === 401 || s === 403 || (s === 400 && /API_KEY_INVALID|api key|expired/i.test(e.message))) { markBad(item.provider); s = 401; }
        fails.push(label + ': ' + (s === 429 || s === 402 ? 'Limit erreicht' : s >= 500 ? 'Server-Fehler' : s === 0 ? 'keine Verbindung' : s === 401 ? 'Zugang ungültig' : s === -1 ? 'keine Quellen gefunden' : 'Fehler'));
        return next();
      });
    }
    return next();
  });
}
function srcList(src) { return src.map(function (s, n) { return '<a class="src" href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener"><b>[' + (n + 1) + ']</b> ' + esc(s.title) + '</a>'; }).join(''); }
function render(out, res, label) {
  var h = esc(res.text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^\s*[*-] /gm, '• ').replace(/\[(\d{1,2})\]/g, function (m, n) {
    var s = res.sources[n - 1]; return s ? '<a class="cite" href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener">' + n + '</a>' : '';
  });
  out.innerHTML = h + (res.sources.length ? '<h2>Quellen</h2>' + srcList(res.sources) : '<div class="mut">Keine Quellen mitgeliefert.</div>') +
    (res.web ? '' : '<div class="mut">Ohne Google-Suche: Quellen sind Wikipedia, DuckDuckGo und der Nachrichten-Feed.</div>') +
    '<div class="mut">Antwort von ' + esc(label) + '</div>' +
    (res.follow.length ? '<h2>Weiterfragen</h2><div class="follow">' + res.follow.map(function (f) { return '<button data-f="' + esc(f) + '">↳ ' + esc(f) + '</button>'; }).join('') + '</div>' : '');
}
$('thread').addEventListener('click', function (e) { var b = e.target.closest('button[data-f]'); if (b) ask(b.dataset.f); });
function submit() { var q = $('inp').value; $('inp').value = ''; ask(q); }
$('askBtn').addEventListener('click', submit);
$('inp').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } });
function welcomeAsk() {
  $('thread').innerHTML = '<div class="card">Hoi Ayoub! 👋 Frag mich etwas, z. B. „Was ist heute in der Schweiz passiert?“. Ich suche im Internet und zeige dir die Quellen mit Nummern. Mit 🎤 kannst du sprechen.' +
    '<div class="row"><button id="newQ">＋ Neues Thema</button></div></div>';
}
$('thread').addEventListener('click', function (e) { if (e.target.id === 'newQ') { S = { turns: [], ctx: null }; welcomeAsk(); } });
/* Sprechen */
var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
$('micBtn').addEventListener('click', function () {
  if (!SR) { toast('Sprechen geht hier nicht direkt. Nutze das 🎤 auf deiner Tastatur.'); $('inp').focus(); return; }
  var r = new SR(); r.lang = 'de-CH'; r.interimResults = true; r.maxAlternatives = 1;
  $('micBtn').textContent = '🔴'; $('inp').placeholder = 'Ich höre zu …';
  r.onresult = function (e) { $('inp').value = Array.prototype.map.call(e.results, function (x) { return x[0].transcript; }).join(''); if (e.results[e.results.length - 1].isFinal) { r.stop(); submit(); } };
  r.onend = r.onerror = function () { $('micBtn').textContent = '🎤'; $('inp').placeholder = 'Frag mich etwas …'; };
  try { r.start(); } catch (e) {}
});

/* ================= Navigation, Version ================= */
function go(v) {
  document.querySelectorAll('.view').forEach(function (s) { s.classList.toggle('on', s.id === 'v-' + v); });
  document.querySelectorAll('nav button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === v || (v === 'art' && b.dataset.v === 'feed')); });
  $('bar').style.display = v === 'ask' ? 'flex' : 'none';
  if (v === 'set') { renderFilters(); renderKeys(); }
}
document.querySelector('nav').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) go(b.dataset.v); });
$('setBtn').addEventListener('click', function () { go('set'); });
$('ver').textContent = 'App ' + APP_VERSION;
function verCheck() {
  fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (v) {
    if (!v || !v.version || v.version === APP_VERSION) return;
    var k = 'wb.verfix.' + v.version; if (lsGet(k)) return; lsSet(k, '1');
    var p = [];
    if (window.caches) p.push(caches.keys().then(function (ks) { return Promise.all(ks.map(function (x) { return caches.delete(x); })); }));
    if (navigator.serviceWorker) p.push(navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); }));
    Promise.all(p).catch(function () {}).then(function () { location.replace(location.pathname + '?v=' + encodeURIComponent(v.version)); });
  }).catch(function () {});
}
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(function () {});
verCheck();
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { verCheck(); loadFeed(); } });
welcomeAsk(); renderKeys(); loadFeed();
