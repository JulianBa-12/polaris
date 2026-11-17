/* Polaris Community – website (vanilla JS, no dependencies, no external requests) */
'use strict';
(() => {
  // ---------------- config / api ----------------
  const RAW = String(window.POLARIS_API || '');
  // GitHub-Pages mode: the community data is published as static JSON files next to this page
  const STATIC = !!window.POLARIS_STATIC;
  const API = STATIC ? '.' : RAW.startsWith('__PORT_') ? '' : RAW.replace(/\/$/, '');
  const abs = (u) => (u && u.startsWith('/') ? API + u : u);

  const memory = {};
  const store = {
    get(k) { try { return window.localStorage.getItem(k); } catch (_) { return memory[k] ?? null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); } catch (_) { memory[k] = v; } },
    del(k) { try { window.localStorage.removeItem(k); } catch (_) { delete memory[k]; } },
  };

  const S = { token: store.get('nova.token') || '', user: null, status: null, badges: [], route: '' };

  // Server messages are German; show them in English on the website.
  const ERR_EN = {
    'Altes Passwort falsch': 'Current password is incorrect',
    'Anmeldung erforderlich': 'Please sign in first',
    'Benutzer nicht gefunden': 'User not found',
    'Benutzername oder Passwort falsch': 'Incorrect username or password',
    'Benutzername vergeben': 'Username is already taken',
    'Benutzername: 3–20 Zeichen (A–Z, 0–9, _ . -)': 'Username: 3–20 characters (A–Z, 0–9, _ . -)',
    'Bild zu groß': 'Image is too large',
    'Bildinhalt ungültig': 'Invalid image content',
    'CSS leer': 'CSS is empty',
    'CSS zu groß': 'CSS is too large',
    'Datei leer oder zu groß (max. 4 MB)': 'File is empty or too large (max. 4 MB)',
    'Dateiinhalt passt nicht zum Typ – Upload abgelehnt': 'File content does not match its type – upload rejected',
    'Dateityp nicht erlaubt': 'File type not allowed',
    'Größe 64 oder 128': 'Size must be 64 or 128',
    'Skin-Größe 64 oder 128': 'Skin size must be 64 or 128',
    'Inhalt zu groß': 'Content is too large',
    'Keine Berechtigung': 'Permission denied',
    'Kirka-ID nicht verifiziert – ein Admin muss sie bestätigen': 'Kirka ID not verified – an admin has to confirm it',
    'Kirka-ID ungültig': 'Invalid Kirka ID',
    'Konto gesperrt': 'Account suspended',
    'Maximal 100 Cloud-Skins': 'Maximum of 100 cloud skins',
    'Neues Passwort: mindestens 8 Zeichen': 'New password: at least 8 characters',
    'Passwort: mindestens 8 Zeichen': 'Password: at least 8 characters',
    'Nicht gefunden': 'Not found',
    'Sitzung abgelaufen – bitte erneut anmelden': 'Session expired – please sign in again',
    'Text zu kurz': 'Text is too short',
    'Titel fehlt': 'Title is missing',
    'Unbekannter Typ': 'Unknown type',
    'Ungültiges Bild': 'Invalid image',
    'Ungültiges JSON': 'Invalid request',
    'Wartungsmodus – Uploads sind pausiert': 'Maintenance mode – uploads are paused',
    'Zu viele Anfragen – bitte später erneut versuchen': 'Too many requests – please try again later',
    'Interner Serverfehler': 'Internal server error',
  };
  const tr = (m) => {
    if (!m) return m;
    if (ERR_EN[m]) return ERR_EN[m];
    if (m.startsWith('Keine Berechtigung')) return 'Permission denied';
    if (m.startsWith('Theme-Farbe')) return 'Invalid theme color';
    return m;
  };

  const STATIC_EP = /^\/api\/(status|profiles|badges|announcements|updates|downloads|stats)$/;
  async function staticApi(path, method) {
    const p = path.split('?')[0]; const m = STATIC_EP.exec(p);
    if (method !== 'GET' || !m) throw new Error('This feature is available inside Polaris Client');
    let res;
    try { res = await fetch(API + p + '.json?t=' + Math.floor(Date.now() / 30000), { cache: 'no-store' }); }
    catch (_) { throw new Error('Community data unreachable'); }
    if (res.status === 404) return { profiles: {}, badges: [], announcements: [], updates: [], files: {} };
    if (!res.ok) throw new Error('Error ' + res.status);
    return res.json();
  }
  async function api(path, { method = 'GET', body, auth = true } = {}) {
    if (STATIC) return staticApi(path, method);
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth && S.token) headers.Authorization = 'Bearer ' + S.token;
    let res;
    try { res = await fetch(API + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined }); }
    catch (_) { throw new Error('Community server unreachable'); }
    let data = {};
    try { data = await res.json(); } catch (_) { /* leer */ }
    if (!res.ok) {
      if (res.status === 401 && S.token) { setSession('', null); }
      throw new Error(tr(data.error) || 'Error ' + res.status);
    }
    return data;
  }

  function setSession(token, user) {
    S.token = token; S.user = user;
    if (token) store.set('nova.token', token); else store.del('nova.token');
    renderAccountButton();
  }

  // ---------------- dom helpers ----------------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v; // only for our own static SVG icons
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'style') Object.assign(el.style, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(String(k)));
    return el;
  }
  const $ = (s, r = document) => r.querySelector(s);
  const fmtDate = (t) => (t ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(t)) : '');
  const fmtNum = (n) => new Intl.NumberFormat('en-US').format(n || 0);
  const plural = (n, one, many) => fmtNum(n) + ' ' + (n === 1 ? one : many);
  const fmtSize = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  function toast(msg, bad) {
    const t = h('div', { class: 'toast' + (bad ? ' bad' : ''), role: bad ? 'alert' : 'status', text: msg });
    $('#toasts').append(t); setTimeout(() => t.remove(), 4200);
  }

  const ICONS = {
    windows: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.5l7.5-1v7H3zM11.5 4.4L21 3v8.5h-9.5zM3 12.5h7.5v7L3 18.5zM11.5 12.5H21V21l-9.5-1.4z"/></svg>',
    linux: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 3c-2.2 0-3.4 1.9-3.4 4.4 0 1.6-.4 2.7-1.4 4.2C6 13.3 5 15 5 17c0 .8.3 1.4.7 1.8L5 20.5c.8.4 2.6.5 3.6-.3.9.5 1.9.8 3.4.8s2.5-.3 3.4-.8c1 .8 2.8.7 3.6.3l-.7-1.7c.4-.4.7-1 .7-1.8 0-2-1-3.7-2.2-5.4-1-1.5-1.4-2.6-1.4-4.2C15.4 4.9 14.2 3 12 3z"/><circle cx="10.4" cy="7.6" r=".6" fill="currentColor"/><circle cx="13.6" cy="7.6" r=".6" fill="currentColor"/><path d="M10.6 9.6l1.4.9 1.4-.9"/></svg>',
    apple: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.6-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.3 1.2 9.7.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.5-1-2.5-3.9zM14 5.5c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.6 2.8-1.4z"/></svg>',
    download: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 20h14"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/></svg>',
    heartFull: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/></svg>',
    cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/></svg>',
    code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/></svg>',
    layout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/></svg>',
    plug: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 01-12 0zM12 17v4"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
    brush: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4l6 6-8.5 8.5a3 3 0 01-4.2 0l-1.8-1.8a3 3 0 010-4.2z"/><path d="M4 20l3-3"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.6a3.5 3.5 0 010 6.8M18 14a6.5 6.5 0 013.5 6"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
    film: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.5v5l4-2.5z" fill="currentColor"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1.5 2.5h5L16 13h5"/></svg>',
  };
  const icon = (n, cls) => h('span', { class: cls || 'ic', 'aria-hidden': 'true', html: ICONS[n] }).firstChild;

  const TYPES = {
    skin: { label: 'Skin', plural: 'Skins', icon: 'box' },
    crosshair: { label: 'Crosshair', plural: 'Crosshairs', icon: 'cross' },
    css: { label: 'CSS', plural: 'CSS', icon: 'code' },
    theme: { label: 'Theme', plural: 'Themes', icon: 'brush' },
    hud: { label: 'HUD layout', plural: 'HUD layouts', icon: 'layout' },
    texture: { label: 'Texture', plural: 'Textures', icon: 'image' },
    plugin: { label: 'Plugin', plural: 'Plugins', icon: 'plug' },
  };

  function emptyState(title, text, iconName = 'inbox') {
    return h('div', { class: 'empty' }, icon(iconName), h('b', { text: title }), text ? h('p', { text }) : null);
  }
  const skeletons = (n, height) => Array.from({ length: n }, () => h('div', { class: 'skel', style: { height: height + 'px' } }));
  const errorBox = (e) => h('div', { class: 'err', role: 'alert', text: (e && e.message) || String(e) });

  // ---------------- dialog ----------------
  function modal(title, body, actions = []) {
    const dlg = h('dialog', { class: 'modal', 'aria-label': title });
    const close = () => { dlg.close(); };
    dlg.append(
      h('div', { class: 'modal-head' }, h('h2', { text: title }), h('button', { class: 'x', 'aria-label': 'Close', onclick: close, 'data-testid': 'button-close-modal', html: ICONS.close })),
      h('div', { class: 'modal-body' }, body),
      actions.length ? h('div', { class: 'modal-foot' }, actions) : null,
    );
    dlg.addEventListener('close', () => dlg.remove());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
    document.body.append(dlg); dlg.showModal();
    return { dlg, close };
  }
  function confirmBox(title, text, okLabel = 'Confirm', danger) {
    return new Promise((resolve) => {
      let done = false;
      const ok = h('button', { class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'), text: okLabel, 'data-testid': 'button-confirm', onclick: () => { done = true; resolve(true); m.close(); } });
      const cancel = h('button', { class: 'btn btn-ghost', text: 'Cancel', onclick: () => m.close() });
      const m = modal(title, h('p', { class: 'muted', text }), [cancel, ok]);
      m.dlg.addEventListener('close', () => { if (!done) resolve(false); });
    });
  }
  function needLogin(reason) {
    toast('You need a Polaris account ' + (reason || 'for this') + '.', true);
    location.hash = '#/account';
  }

  // ---------------- file helpers ----------------
  function saveBlob(blob, name) {
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const dataUrlToBlob = (d) => { const [head, b64] = d.split(','); const mime = /data:([^;]+)/.exec(head)[1]; const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new Blob([u8], { type: mime }); };
  const safeName = (s) => String(s || 'polaris').replace(/[^\w\-äöüÄÖÜß ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 50) || 'polaris';
  const readAsDataUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Could not read the file')); r.readAsDataURL(file); });
  const readAsText = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Could not read the file')); r.readAsText(file); });
  const imageSize = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => rej(new Error('Invalid image')); i.src = src; });

  function exportContent(item) {
    const d = item.data || {}; const base = safeName(item.title);
    switch (item.type) {
      case 'skin': case 'texture': return saveBlob(dataUrlToBlob(d.png), base + '.png');
      case 'css': return saveBlob(new Blob([d.css], { type: 'text/css' }), base + '.css');
      default: return saveBlob(new Blob([JSON.stringify({ nova: 1, type: item.type, title: item.title, data: d }, null, 2)], { type: 'application/json' }), base + '.polaris-' + item.type + '.json');
    }
  }

  // ---------------- shared bits ----------------
  async function loadStatus() {
    try {
      S.status = await api('/api/status', { auth: false });
      const b = $('#banner');
      if (S.status.maintenance) { b.textContent = 'Maintenance: ' + (S.status.maintenanceMessage || 'Some features are temporarily limited.'); b.hidden = false; } else b.hidden = true;
      $('#foot-meta').textContent = (S.status.name || 'Polaris Community') + (STATIC ? ' · hosted on GitHub' : ' · Server v' + S.status.version);
    } catch (e) {
      S.status = null; $('#foot-meta').textContent = 'Community server unreachable';
    }
  }
  async function loadMe() {
    if (STATIC) return;
    if (!S.token) return renderAccountButton();
    try { S.user = (await api('/api/auth/me')).user; } catch (_) { S.user = null; }
    renderAccountButton();
  }
  function renderAccountButton() {
    const b = $('#account-btn'); if (!b) return;
    b.textContent = S.user ? S.user.username : 'Sign in';
    b.classList.toggle('btn-primary', !S.user); b.classList.toggle('btn-ghost', !!S.user);
  }
  async function getBadges() { if (!S.badges.length) { try { S.badges = (await api('/api/badges', { auth: false })).badges || []; } catch (_) { /* optional */ } } return S.badges; }

  function detectOS() {
    const ua = navigator.userAgent; const p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
    if (/Win/i.test(p) || /Windows/i.test(ua)) return 'windows';
    if (/Mac/i.test(p) || /Mac OS X/i.test(ua)) return 'mac';
    if (/Linux/i.test(p) && !/Android/i.test(ua)) return 'linux';
    return '';
  }

  // ---------------- pages ----------------
  const PLATFORMS = [
    { id: 'windows', name: 'Windows', sub: 'Installer (.exe) · Windows 10/11, 64-bit', icon: 'windows', os: 'windows' },
    { id: 'linux', name: 'Linux', sub: 'AppImage · x86_64', icon: 'linux', os: 'linux' },
    { id: 'mac-arm64', name: 'macOS Apple Silicon', sub: 'ZIP · M1, M2, M3, M4', icon: 'apple', os: 'mac' },
    { id: 'mac-x64', name: 'macOS Intel', sub: 'ZIP · Intel Macs', icon: 'apple', os: 'mac' },
  ];
  const FEATURES = [
    ['bolt', 'Built for low-end PCs', 'Unlimited FPS, an adjustable FPS cap, reduced render resolution and a performance mode that turns off menu effects.'],
    ['box', 'Skin Studio', 'Paint skins with layers, templates and a 3D preview, then save them locally or to the cloud.'],
    ['cross', 'Custom crosshair', 'Set shape, color, size and outline freely, or use your own image as a crosshair.'],
    ['layout', 'HUD editor', 'Move, scale and hide HUD elements, then save and share them as a layout.'],
    ['map', 'Maps & boxes', 'A queue for maps and boxes, quick join via links and a screenshot gallery.'],
    ['film', 'Replay Studio', 'Record matches and watch them later, plus per-session statistics.'],
    ['users', 'Custom profiles', 'Name colors, titles, banners and badges that only other Polaris players can see.'],
    ['plug', 'Plugins & resources', 'Reviewed plugins, custom CSS, themes and a resource swapper for textures and sounds.'],
    ['shield', 'Safe and local', 'Settings stay on your PC, and profiles and backups can be restored at any time.'],
  ];

  async function pageHome(main) {
    const os = detectOS();
    const dlGrid = h('div', { class: 'downloads' }, PLATFORMS.map(() => skeletons(1, 190)));
    const statsEl = h('div', { class: 'stats wrap', 'aria-label': 'Community statistics' }, [['Accounts', 'users'], ['Items in the Hub', 'content'], ['Custom profiles', 'profiles'], ['Online now', 'online']].filter(([, k]) => !STATIC || k === 'profiles').map(([l, k]) => h('div', { class: 'stat' }, h('b', { 'data-stat': k, text: '–' }), h('span', { text: l }))));
    const versionEl = h('span', {}, h('i', { class: 'dot' }), 'Loading status …');
    const newsEl = h('div', { class: 'timeline' }, skeletons(2, 96));

    main.append(
      h('section', { class: 'hero' },
        h('div', { class: 'wrap hero-in' },
          h('div', {},
            h('div', { class: 'eyebrow', text: 'Client for Kirka.io' }),
            h('h1', {}, 'Kirka.io, ', h('em', { text: 'faster' }), ' and exactly the way you want to play.'),
            h('p', { class: 'lead', text: 'Polaris is a desktop client for Kirka.io with performance options for low-end PCs, Skin Studio, a HUD editor and a Community Hub. The game itself stays unchanged.' }),
            h('div', { class: 'hero-cta' },
              h('a', { class: 'btn btn-primary btn-lg', href: '#downloads', 'data-testid': 'button-hero-download', onclick: (e) => { e.preventDefault(); $('#downloads').scrollIntoView({ behavior: 'smooth' }); } }, icon('download'), 'Download'),
              (STATIC ? h('a', { class: 'btn btn-ghost btn-lg', href: '#/profile', 'data-testid': 'link-hero-profiles' }, 'See custom profiles') : h('a', { class: 'btn btn-ghost btn-lg', href: '#/hub', 'data-testid': 'link-hero-hub' }, 'Browse the Community Hub')),
            ),
            h('div', { class: 'hero-meta' }, versionEl, h('span', { text: 'Windows · Linux · macOS' })),
          ),
          h('figure', { class: 'shot', style: { margin: 0 } },
            h('div', { class: 'shot-bar', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
            h('img', { src: 'img/perf.webp', alt: 'Polaris menu over the Kirka.io main menu showing the performance settings', width: 1366, height: 768 }),
          ),
        ),
      ),
      h('div', { class: 'stats-wrap', style: { borderBottom: '1px solid var(--line)' } }, statsEl),
      h('section', { class: 'block', id: 'downloads' },
        h('div', { class: 'wrap' },
          h('div', { class: 'block-head' }, h('div', {}, h('div', { class: 'eyebrow', text: 'Download' }), h('h2', { id: 'dl-title', text: 'Download Polaris Client' })), h('p', { class: 'muted', id: 'dl-version' })),
          dlGrid,
          h('p', { class: 'faint', style: { marginTop: 'var(--s4)', fontSize: 'var(--text-sm)' }, text: 'The builds are not commercially signed. On first launch Windows may show “Windows protected your PC” (More info → Run anyway). On a Mac, right-click → Open on first launch.' }),
        ),
      ),
      h('section', { class: 'block' },
        h('div', { class: 'wrap' },
          h('div', { class: 'block-head' }, h('div', {}, h('div', { class: 'eyebrow', text: 'Features' }), h('h2', { text: 'Everything built into the client' }))),
          h('div', { class: 'features' }, FEATURES.map(([ic, t, d]) => h('div', { class: 'feature' }, icon(ic), h('h3', { text: t }), h('p', { text: d })))),
        ),
      ),
      h('section', { class: 'block' },
        h('div', { class: 'wrap split' },
          h('div', {},
            h('div', { class: 'eyebrow', text: 'Skin Studio' }),
            h('h2', { text: 'Paint skins without leaving the client' }),
            h('p', { text: 'Brush, fill, mirror, layers and templates, plus a 3D preview on the Kirka character. Export finished skins as PNG or upload them to the Community Hub.' }),
            h('ul', { class: 'ticks' }, ['64×64 and 128×128 pixels', 'Versions and comparison with the original', 'Save to the Skin Studio Cloud with your Polaris account'].map((t) => h('li', { text: t }))),
          ),
          h('figure', { class: 'shot', style: { margin: 0 } }, h('div', { class: 'shot-bar', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), h('img', { src: 'img/skin.webp', alt: 'Polaris Skin Studio with tools, canvas and 3D preview', width: 1280, height: 820, loading: 'lazy', style: { aspectRatio: '1280 / 820' } })),
        ),
      ),
      h('section', { class: 'block' },
        h('div', { class: 'wrap split rev' },
          h('div', {},
            h('div', { class: 'eyebrow', text: 'Overview' }),
            h('h2', { text: 'One menu for everything, on F1' }),
            h('p', { text: 'Quick actions, tools and every setting in one window. Create and switch between several settings profiles, for example one for tournaments and one for casual play.' }),
            h('ul', { class: 'ticks' }, ['Hotkeys for screenshot, recording, HUD and fullscreen', 'Export, import and back up your settings', 'English and German'].map((t) => h('li', { text: t }))),
          ),
          h('figure', { class: 'shot', style: { margin: 0 } }, h('div', { class: 'shot-bar', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), h('img', { src: 'img/menu.webp', alt: 'Polaris overview with quick actions and tools', width: 1366, height: 768, loading: 'lazy' })),
        ),
      ),
      h('section', { class: 'block' },
        h('div', { class: 'wrap' },
          h('div', { class: 'block-head' }, h('div', {}, h('div', { class: 'eyebrow', text: 'News' }), h('h2', { text: 'What’s happening' })), h('a', { class: 'btn btn-ghost', href: '#/news', 'data-testid': 'link-all-news' }, 'All news')),
          newsEl,
        ),
      ),
    );

    // async fill
    api('/api/stats', { auth: false }).then((s) => { for (const k of ['users', 'content', 'profiles', 'online']) { const el = statsEl.querySelector(`[data-stat="${k}"]`); if (el) el.textContent = fmtNum(s[k]); } }).catch(() => { statsEl.remove(); });

    const renderDownloads = (d) => {
      dlGrid.replaceChildren();
      const files = (d && d.files) || {};
      let firstRec = true;
      for (const p of PLATFORMS) {
        const f = files[p.id]; const rec = os === p.os && f && (p.os !== 'mac' || firstRec);
        if (rec && p.os === 'mac') firstRec = false;
        dlGrid.append(h('div', { class: 'card dl' + (rec ? ' recommended' : ''), 'data-testid': 'card-download-' + p.id },
          rec ? h('span', { class: 'tag accent rec', text: 'Your system' }) : null,
          h('div', { class: 'dl-head' }, icon(p.icon), h('h3', { text: p.name })),
          h('p', { class: 'muted', style: { fontSize: 'var(--text-sm)' }, text: p.sub }),
          f ? h('p', { class: 'meta', text: f.name + ' · ' + fmtSize(f.size) }) : h('p', { class: 'meta', text: 'Not published yet' }),
          f ? h('a', { class: 'btn ' + (rec ? 'btn-primary' : ''), href: abs(f.url), download: f.name, 'data-testid': 'button-download-' + p.id }, icon('download'), 'Download')
            : h('button', { class: 'btn', disabled: true, 'aria-disabled': 'true', title: 'The owner has not published a file for this platform yet' }, 'Not available'),
        ));
      }
      $('#dl-version').textContent = d && d.version ? 'Version ' + d.version + (d.t ? ' · ' + fmtDate(d.t) : '') : '';
      if (d && d.version) { versionEl.replaceChildren(h('i', { class: 'dot ok' }), 'Version ' + d.version + ' available'); }
    };
    api('/api/downloads', { auth: false }).then(renderDownloads).catch((e) => { dlGrid.replaceChildren(errorBox(e)); });
    loadStatus().then(() => {
      if (!S.status) versionEl.replaceChildren(h('i', { class: 'dot bad' }), 'Server unreachable');
      else if (S.status.maintenance) versionEl.replaceChildren(h('i', { class: 'dot warn' }), 'Maintenance mode');
      else if (!versionEl.querySelector('.ok')) versionEl.replaceChildren(h('i', { class: 'dot ok' }), 'Community server online');
    });
    api('/api/announcements', { auth: false }).then((r) => {
      const list = (r.announcements || []).slice().reverse().slice(0, 3);
      newsEl.replaceChildren(...(list.length ? list.map(postCard) : [emptyState('No news yet', 'Announcements from the Owner Dashboard will appear here.')]));
    }).catch((e) => newsEl.replaceChildren(errorBox(e)));
  }

  const ANN = { info: ['Info', ''], update: ['Update', 'accent'], maintenance: ['Maintenance', 'warn'] };
  function postCard(a) {
    const [l, c] = ANN[a.type] || ANN.info;
    return h('article', { class: 'card post', 'data-testid': 'card-announcement-' + a.id },
      h('div', { class: 'post-head' }, h('span', { class: 'tag ' + c, text: l }), h('time', { datetime: new Date(a.t).toISOString(), text: fmtDate(a.t) })),
      h('h3', { text: a.title }), h('p', { text: a.text }));
  }

  // ---------------- hub ----------------
  const hubState = { type: '', q: '', sort: 'new' };
  function thumbFor(item) {
    const t = TYPES[item.type] || TYPES.skin;
    if (item.preview) return h('img', { src: abs(item.preview), alt: '', loading: 'lazy' });
    return h('div', { class: 'ph' }, icon(t.icon), t.label);
  }
  async function pageHub(main) {
    const grid = h('div', { class: 'items', 'aria-live': 'polite' });
    const search = h('input', { class: 'input', type: 'search', placeholder: 'Search by title, description or author …', value: hubState.q, 'aria-label': 'Search the Hub', 'data-testid': 'input-hub-search' });
    const sort = h('select', { class: 'input', 'aria-label': 'Sort order', 'data-testid': 'select-hub-sort' },
      [['new', 'Newest'], ['downloads', 'Most downloads'], ['favorites', 'Most favorites']].map(([v, l]) => h('option', { value: v, text: l, selected: hubState.sort === v })));
    const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter by type' },
      [['', 'All'], ...Object.entries(TYPES).map(([k, v]) => [k, v.plural])].map(([k, l]) => h('button', { class: 'chip', 'aria-pressed': String(hubState.type === k), 'data-type': k, 'data-testid': 'chip-type-' + (k || 'all'), text: l })));

    main.append(h('div', { class: 'page wrap' },
      h('div', { class: 'page-head' },
        h('div', {}, h('div', { class: 'eyebrow', text: 'Community' }), h('h1', { text: 'Community Hub' }), h('p', { text: 'Skins, crosshairs, themes, CSS, HUD layouts and plugins from other players. In the client, press F6 to install anything with one click.' })),
        h('button', { class: 'btn btn-primary', 'data-testid': 'button-upload', onclick: () => (S.user ? uploadDialog(load) : needLogin('to upload')) }, 'Upload content'),
      ),
      h('div', { class: 'toolbar' }, search, sort),
      chips, grid,
    ));

    async function load() {
      grid.replaceChildren(...skeletons(8, 260));
      const qs = new URLSearchParams({ sort: hubState.sort }); if (hubState.q) qs.set('q', hubState.q); if (hubState.type) qs.set('type', hubState.type);
      try {
        const { items } = await api('/api/content?' + qs);
        if (!items.length) return grid.replaceChildren(h('div', { style: { gridColumn: '1 / -1' } }, emptyState(hubState.q || hubState.type ? 'Nothing found' : 'The Hub is still empty', hubState.q || hubState.type ? 'Try a different search term or filter.' : 'Upload the first item and it will show up here for everyone.')));
        grid.replaceChildren(...items.map((it) => h('button', { class: 'card item', 'data-testid': 'card-item-' + it.id, onclick: () => itemDialog(it, load) },
          h('div', { class: 'thumb' }, thumbFor(it), h('span', { class: 'tag', text: (TYPES[it.type] || {}).label || it.type })),
          h('div', { class: 'item-body' },
            h('div', { class: 'item-title' }, it.title, it.official ? h('span', { class: 'tag accent', style: { marginLeft: '8px' }, text: 'Official' }) : null),
            h('div', { class: 'item-meta' }, h('span', { text: 'by ' + it.author }), h('span', {}, icon('download'), fmtNum(it.downloads)), h('span', {}, icon(it.favorited ? 'heartFull' : 'heart'), fmtNum(it.favorites))),
          ))));
      } catch (e) { grid.replaceChildren(h('div', { style: { gridColumn: '1 / -1' } }, errorBox(e))); }
    }
    search.addEventListener('input', debounce(() => { hubState.q = search.value.trim(); load(); }, 300));
    sort.addEventListener('change', () => { hubState.sort = sort.value; load(); });
    chips.addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (!b) return; hubState.type = b.dataset.type; chips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b))); load(); });
    load();
  }

  function itemDialog(it, reload) {
    const preview = h('div', { class: 'detail-preview' }, thumbFor(it));
    const favBtn = h('button', { class: 'btn btn-ghost', 'data-testid': 'button-favorite' });
    const setFav = (on, n) => { favBtn.replaceChildren(icon(on ? 'heartFull' : 'heart'), (on ? 'Favorited' : 'Add to favorites') + ' · ' + fmtNum(n)); };
    setFav(it.favorited, it.favorites);
    favBtn.onclick = async () => {
      if (!S.user) return needLogin('to use favorites');
      try { const r = await api('/api/content/' + it.id + '/favorite', { method: 'POST', body: {} }); it.favorited = r.favorited; it.favorites = r.favorites; setFav(r.favorited, r.favorites); reload && reload(); } catch (e) { toast(e.message, true); }
    };
    const dlBtn = h('button', { class: 'btn btn-primary', 'data-testid': 'button-download-item' }, icon('download'), 'Download');
    dlBtn.onclick = async () => {
      dlBtn.disabled = true;
      try { const { item } = await api('/api/content/' + it.id + '/download', { method: 'POST', body: {} }); exportContent(item); toast('Download started'); reload && reload(); } catch (e) { toast(e.message, true); } finally { dlBtn.disabled = false; }
    };
    const reportBtn = h('button', { class: 'btn btn-ghost', 'data-testid': 'button-report', text: 'Report', onclick: () => (S.user ? reportDialog(it) : needLogin('to report content')) });
    const t = TYPES[it.type] || {};
    modal(it.title, [
      preview,
      h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, h('span', { class: 'tag', text: t.label || it.type }), it.official ? h('span', { class: 'tag accent', text: 'Official' }) : null, h('span', { class: 'tag', text: 'by ' + it.author }), h('span', { class: 'tag', text: fmtDate(it.created) }), h('span', { class: 'tag', text: plural(it.downloads, 'download', 'downloads') })),
      it.description ? h('p', { class: 'muted', style: { whiteSpace: 'pre-line', overflowWrap: 'anywhere' }, text: it.description }) : null,
      h('p', { class: 'faint', style: { fontSize: 'var(--text-sm)' }, text: it.type === 'skin' ? 'Install directly: press F6 in the client, find the item under “Community” and choose “Install”. The download here saves the skin as a PNG, for example for the Skin Studio.' : 'Install directly: press F6 in the client, find the item under “Community” and choose “Install”. The download here saves a file as a backup or for sharing.' }),
    ], [reportBtn, favBtn, dlBtn]);
  }

  function reportDialog(it) {
    const reason = h('textarea', { class: 'input', maxlength: 300, placeholder: 'What is wrong with this content?', 'data-testid': 'input-report-reason' });
    const send = h('button', { class: 'btn btn-danger', text: 'Send report', 'data-testid': 'button-send-report' });
    const m = modal('Report content', h('label', { class: 'field' }, 'Reason', reason), [send]);
    send.onclick = async () => { try { await api('/api/content/' + it.id + '/report', { method: 'POST', body: { reason: reason.value } }); toast('Thanks, the team will review your report.'); m.close(); } catch (e) { toast(e.message, true); } };
  }

  function uploadDialog(done) {
    const type = h('select', { class: 'input', 'data-testid': 'select-upload-type' }, [['skin', 'Skin (PNG 64×64 or 128×128)'], ['css', 'CSS file'], ['theme', 'Theme (4 colors)']].map(([v, l]) => h('option', { value: v, text: l })));
    const title = h('input', { class: 'input', maxlength: 60, required: true, 'data-testid': 'input-upload-title' });
    const desc = h('textarea', { class: 'input', maxlength: 500, 'data-testid': 'input-upload-description' });
    const file = h('input', { class: 'input', type: 'file', 'data-testid': 'input-upload-file' });
    const fileField = h('label', { class: 'field' }, h('span', { id: 'file-label', text: 'PNG file' }), file);
    const colors = { bg: '#11131a', panel: '#1a1d27', text: '#e8eaf0', accent: '#7c5cff' };
    const colorInputs = Object.entries({ bg: 'Background', panel: 'Panels', text: 'Text', accent: 'Accent' }).map(([k, l]) => h('label', { class: 'field' }, l, h('input', { class: 'input', type: 'color', value: colors[k], 'data-k': k, style: { height: '44px', padding: '4px' }, oninput: (e) => { colors[k] = e.target.value; } })));
    const themeField = h('div', { class: 'form-row', hidden: true }, colorInputs);
    const errEl = h('p', { class: 'form-error', role: 'alert' });
    const sync = () => {
      const v = type.value; themeField.hidden = v !== 'theme'; fileField.hidden = v === 'theme';
      fileField.querySelector('span').textContent = v === 'skin' ? 'PNG file (64×64 or 128×128)' : 'CSS file (.css, max. 100 KB)';
      file.accept = v === 'skin' ? 'image/png' : '.css,text/css';
    };
    type.addEventListener('change', sync); sync();
    const submit = h('button', { class: 'btn btn-primary', text: 'Publish', 'data-testid': 'button-submit-upload' });
    const m = modal('Upload content', h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
      h('label', { class: 'field' }, 'Type', type), h('label', { class: 'field' }, 'Title', title), h('label', { class: 'field' }, h('span', {}, 'Description ', h('span', { class: 'faint', text: '(optional)' })), desc), fileField, themeField, errEl,
      h('p', { class: 'faint', style: { fontSize: 'var(--text-xs)' }, text: 'Crosshairs, HUD layouts, textures and plugins are uploaded directly in the client (F6 → Publish). Plugins are reviewed by the team before they go live.' })), [submit]);
    submit.onclick = async () => {
      errEl.textContent = '';
      if (!title.value.trim()) { errEl.textContent = 'Please enter a title.'; return title.focus(); }
      let data;
      try {
        if (type.value === 'skin') {
          const f = file.files[0]; if (!f) throw new Error('Please choose a PNG file.');
          if (f.type !== 'image/png') throw new Error('Skins must be PNG files.');
          if (f.size > 300 * 1024) throw new Error('The file is larger than 300 KB.');
          const png = await readAsDataUrl(f); const s = await imageSize(png);
          if (s.w !== s.h || ![64, 128].includes(s.w)) throw new Error('The image is ' + s.w + '×' + s.h + ' pixels; only 64×64 or 128×128 are allowed.');
          data = { size: s.w, png };
        } else if (type.value === 'css') {
          const f = file.files[0]; if (!f) throw new Error('Please choose a CSS file.');
          if (f.size > 100000) throw new Error('The file is larger than 100 KB.');
          data = { css: await readAsText(f) }; if (!data.css.trim()) throw new Error('The CSS file is empty.');
        } else data = { ...colors };
        submit.disabled = true;
        await api('/api/content', { method: 'POST', body: { type: type.value, title: title.value.trim(), description: desc.value.trim(), data } });
        toast('Published'); m.close(); done && done();
      } catch (e) { errEl.textContent = e.message; } finally { submit.disabled = false; }
    };
  }

  // ---------------- profiles ----------------
  function profileCard(id, p, badges) {
    const banner = h('div', { class: 'pbanner' });
    const bg = p.banner || p.background;
    if (bg) banner.style.backgroundImage = 'url("' + abs(bg).replace(/["\\]/g, '') + '")';
    else if (p.gradient) banner.style.background = 'linear-gradient(' + p.gradient[2] + 'deg,' + p.gradient[0] + ',' + p.gradient[1] + ')';
    else if (p.bgColor) banner.style.background = p.bgColor;
    const name = h('div', { class: 'pname', text: p.label || '#' + id });
    if (p.nameGradient) { name.style.background = 'linear-gradient(90deg,' + p.nameGradient[0] + ',' + p.nameGradient[1] + ')'; name.style.webkitBackgroundClip = 'text'; name.style.backgroundClip = 'text'; name.style.color = 'transparent'; }
    else if (p.nameColor || p.color) name.style.color = p.nameColor || p.color;
    const card = h('article', { class: 'card pcard', 'data-testid': 'card-profile-' + id }, banner,
      h('div', { class: 'pbody' },
        h('div', {}, name, h('div', { class: 'pid', text: '#' + id })),
        p.title ? (() => { const t = h('span', { class: 'ptitle', text: p.title.text }); t.style.color = p.title.color; t.style.background = p.title.bg; return h('div', {}, t); })() : null,
        (p.badges || []).length ? h('div', { class: 'badges' }, p.badges.map((bid) => badges.find((b) => b.id === bid)).filter(Boolean).map((b) => h('img', { src: abs(b.image), alt: b.name, title: b.name + (b.description ? ' – ' + b.description : ''), loading: 'lazy' }))) : null,
        p.description ? h('p', { class: 'pdesc', text: p.description }) : null,
        (p.showcase || []).length ? h('div', { class: 'item-meta' }, h('span', { text: 'Showcase:' }), p.showcase.map((s) => h('span', { class: 'tag', text: s }))) : null,
      ));
    if (p.border) { card.style.borderWidth = p.border.width + 'px'; card.style.borderStyle = p.border.style; card.style.borderColor = p.border.color; }
    return card;
  }
  async function pageProfiles(main) {
    const grid = h('div', { class: 'profiles' }, skeletons(6, 230));
    const search = h('input', { class: 'input', type: 'search', placeholder: 'Kirka ID or name, e.g. 9ITK5S', 'aria-label': 'Search profiles', 'data-testid': 'input-profile-search' });
    main.append(h('div', { class: 'page wrap' },
      h('div', { class: 'page-head' }, h('div', {}, h('div', { class: 'eyebrow', text: 'Community' }), h('h1', { text: 'Custom profiles' }), h('p', { text: 'Only players using Polaris Client can see these profiles. The real Kirka profile stays unchanged. They are designed by the team in the Owner Dashboard.' }))),
      h('div', { class: 'toolbar' }, search), grid));
    let all = [];
    const render = () => {
      const q = search.value.trim().toLowerCase().replace('#', '');
      const list = all.filter(([id, p]) => !q || id.toLowerCase().includes(q) || (p.label || '').toLowerCase().includes(q));
      grid.replaceChildren(...(list.length ? list.map(([id, p]) => profileCard(id, p, S.badges)) : [h('div', { style: { gridColumn: '1 / -1' } }, emptyState(q ? 'No profile found' : 'No custom profiles yet', q ? 'Check the Kirka ID.' : 'Profiles will appear here once the team designs them.', 'users'))]));
    };
    try {
      const [{ profiles }] = await Promise.all([api('/api/profiles', { auth: false }), getBadges()]);
      all = Object.entries(profiles || {}).filter(([, p]) => p && Object.keys(p).some((k) => k !== 'updated' && k !== 'showcase')).sort((a, b) => (b[1].updated || 0) - (a[1].updated || 0));
      render(); search.addEventListener('input', render);
    } catch (e) { grid.replaceChildren(h('div', { style: { gridColumn: '1 / -1' } }, errorBox(e))); }
  }

  // ---------------- news ----------------
  async function pageNews(main) {
    const tl = h('div', { class: 'timeline' }, skeletons(3, 110));
    const rel = h('div', { class: 'card' }, skeletons(1, 160));
    main.append(h('div', { class: 'page wrap' },
      h('div', { class: 'page-head' }, h('div', {}, h('div', { class: 'eyebrow', text: 'News' }), h('h1', { text: 'Announcements and updates' }), h('p', { text: 'What the Polaris team announces and which client versions have been released.' }))),
      h('div', { class: 'news-layout' }, h('section', { 'aria-label': 'Announcements' }, h('h2', { class: 'section-title', text: 'Announcements' }), tl), h('section', { 'aria-label': 'Releases' }, h('h2', { class: 'section-title', text: 'Releases' }), rel))));
    api('/api/announcements', { auth: false }).then((r) => {
      const list = (r.announcements || []).slice().reverse();
      tl.replaceChildren(...(list.length ? list.map(postCard) : [emptyState('No announcements yet', '')]));
    }).catch((e) => tl.replaceChildren(errorBox(e)));
    api('/api/updates').then((r) => {
      const list = (r.updates || []).slice().reverse();
      rel.replaceChildren(...(list.length ? list.map((u) => h('div', { class: 'release', 'data-testid': 'row-release-' + u.id },
        h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } }, h('b', { text: 'v' + u.version }), u.channel !== 'stable' ? h('span', { class: 'tag warn', text: u.channel === 'beta' ? 'Beta' : 'Owner' }) : h('span', { class: 'tag ok', text: 'Stable' }), h('span', { class: 'faint', style: { fontSize: 'var(--text-xs)' }, text: fmtDate(u.t) })),
        u.notes ? h('p', { text: u.notes }) : null)) : [h('div', { class: 'card-pad muted', text: 'No releases published yet.' })]));
    }).catch((e) => rel.replaceChildren(h('div', { class: 'card-pad' }, errorBox(e))));
  }

  // ---------------- feedback ----------------
  function pageFeedback(main) {
    const kind = h('select', { class: 'input', 'data-testid': 'select-feedback-kind' }, h('option', { value: 'feedback', text: 'Feedback or idea' }), h('option', { value: 'bug', text: 'Report a bug' }));
    const text = h('textarea', { class: 'input', minlength: 5, maxlength: 4000, required: true, placeholder: 'Describe as precisely as possible what you would like or what happened. For bugs: operating system, client version and steps to reproduce.', 'data-testid': 'input-feedback-text', style: { minHeight: '200px' } });
    const errEl = h('p', { class: 'form-error', role: 'alert' });
    const btn = h('button', { class: 'btn btn-primary', type: 'submit', text: 'Send', 'data-testid': 'button-send-feedback' });
    const form = h('form', { class: 'form card card-pad' }, h('label', { class: 'field' }, 'Type', kind), h('label', { class: 'field' }, 'Message', text), errEl,
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' } }, h('span', { class: 'faint', style: { fontSize: 'var(--text-xs)' }, text: S.user ? 'Sent as ' + S.user.username + '.' : 'Sent anonymously. Sign in so the team can follow up with you.' }), btn));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); errEl.textContent = '';
      if (text.value.trim().length < 5) { errEl.textContent = 'Please write at least 5 characters.'; return; }
      btn.disabled = true;
      try { await api('/api/feedback', { method: 'POST', body: { kind: kind.value, text: text.value.trim(), diagnostics: { source: 'website', userAgent: navigator.userAgent.slice(0, 300) } } }); text.value = ''; form.replaceWith(h('div', { class: 'card card-pad', 'data-testid': 'status-feedback-sent' }, h('h2', { class: 'section-title', text: 'Thanks for your message' }), h('p', { class: 'muted', text: 'The team will see it in the Owner Dashboard under Feedback.' }))); }
      catch (err) { errEl.textContent = err.message; } finally { btn.disabled = false; }
    });
    main.append(h('div', { class: 'page wrap', style: { maxWidth: '760px' } },
      h('div', { class: 'page-head' }, h('div', {}, h('div', { class: 'eyebrow', text: 'Feedback' }), h('h1', { text: 'Share ideas and report bugs' }), h('p', { text: 'You can also do this in the client’s Community Hub (F6) under “Feedback & bugs”, where you can optionally attach diagnostics.' }))), form));
  }

  // ---------------- account ----------------
  function authForms(main) {
    let mode = 'login';
    const user = h('input', { class: 'input', autocomplete: 'username', required: true, maxlength: 20, 'data-testid': 'input-username' });
    const pass = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', required: true, maxlength: 128, 'data-testid': 'input-password' });
    const kid = h('input', { class: 'input', maxlength: 13, placeholder: 'e.g. 9ITK5S', 'data-testid': 'input-kirka-id' });
    const kidField = h('label', { class: 'field', hidden: true }, h('span', {}, 'Kirka ID ', h('span', { class: 'faint', text: '(optional)' })), kid, h('span', { class: 'hint', text: 'Shown under your name in Kirka. Once an admin verifies it, you can edit your showcase.' }));
    const errEl = h('p', { class: 'form-error', role: 'alert' });
    const btn = h('button', { class: 'btn btn-primary btn-lg', type: 'submit', 'data-testid': 'button-auth-submit', text: 'Sign in' });
    const tabs = h('div', { class: 'tabs', role: 'tablist' },
      h('button', { role: 'tab', 'aria-selected': 'true', type: 'button', text: 'Sign in', 'data-testid': 'tab-login', onclick: () => setMode('login') }),
      h('button', { role: 'tab', 'aria-selected': 'false', type: 'button', text: 'Register', 'data-testid': 'tab-register', onclick: () => setMode('register') }));
    const hint = h('span', { class: 'hint' });
    function setMode(m) {
      mode = m; tabs.children[0].setAttribute('aria-selected', String(m === 'login')); tabs.children[1].setAttribute('aria-selected', String(m === 'register'));
      kidField.hidden = m === 'login'; btn.textContent = m === 'login' ? 'Sign in' : 'Create account'; pass.autocomplete = m === 'login' ? 'current-password' : 'new-password';
      hint.textContent = m === 'login' ? '' : 'At least 8 characters.'; errEl.textContent = '';
    }
    const form = h('form', { class: 'form' }, h('label', { class: 'field' }, 'Username', user), h('label', { class: 'field' }, 'Password', pass, hint), kidField, errEl, btn);
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); errEl.textContent = ''; btn.disabled = true;
      try {
        const body = { username: user.value.trim(), password: pass.value };
        if (mode === 'register') body.kirkaId = kid.value.trim();
        const r = await api('/api/auth/' + mode, { method: 'POST', body, auth: false });
        setSession(r.token, r.user); toast(mode === 'login' ? 'Welcome back, ' + r.user.username : 'Account created'); route();
      } catch (err) { errEl.textContent = err.message; } finally { btn.disabled = false; }
    });
    main.append(h('div', { class: 'page wrap' }, h('div', { class: 'auth' },
      h('div', { class: 'page-head', style: { marginBottom: 'var(--s6)' } }, h('div', {}, h('div', { class: 'eyebrow', text: 'Account' }), h('h1', { text: 'Polaris account' }), h('p', { text: 'One account for the website and the client: uploads, favorites, Skin Studio Cloud and beta updates. It is separate from your Kirka account.' }))),
      h('div', { class: 'card card-pad' }, tabs, form),
      h('p', { class: 'faint', style: { fontSize: 'var(--text-xs)', marginTop: 'var(--s4)' }, text: 'In the client, sign in with the same details under F1 → Account.' }),
    )));
  }

  const ROLE = { user: 'Player', moderator: 'Moderator', admin: 'Admin', owner: 'Owner' };
  const STATUS = { published: ['Published', 'ok'], pending: ['In review', 'warn'], hidden: ['Hidden', ''], rejected: ['Rejected', 'bad'] };
  async function pageAccount(main) {
    if (!S.user) await loadMe();
    if (!S.user) return authForms(main);
    const u = S.user;
    const side = h('aside', { class: 'acc-side' },
      h('div', { class: 'card card-pad' },
        h('div', { class: 'pname', text: u.username, 'data-testid': 'text-username' }),
        h('div', { class: 'kv', style: { marginTop: 'var(--s4)' } },
          h('div', {}, h('span', { text: 'Role' }), h('span', { class: 'tag ' + (u.role === 'user' ? '' : 'accent'), text: ROLE[u.role] || u.role })),
          h('div', {}, h('span', { text: 'Kirka ID' }), h('span', {}, u.kirkaId ? '#' + u.kirkaId + ' ' : '–', u.kirkaId ? h('span', { class: 'tag ' + (u.kirkaVerified ? 'ok' : 'warn'), text: u.kirkaVerified ? 'verified' : 'pending' }) : null)),
        ),
        h('div', { style: { display: 'grid', gap: '8px', marginTop: 'var(--s5)' } },
          h('button', { class: 'btn btn-ghost', 'data-testid': 'button-logout', text: 'Sign out', onclick: async () => { try { await api('/api/auth/logout', { method: 'POST', body: {} }); } catch (_) { /* ignore */ } setSession('', null); toast('Signed out'); route(); } }),
        ),
      ),
      u.role !== 'user' ? h('div', { class: 'card card-pad muted', style: { fontSize: 'var(--text-sm)' }, text: 'For security reasons, management (profiles, badges, moderation, updates) is only available in Polaris Client Owner via the Owner Dashboard.' }) : null,
    );

    // password
    const oldPw = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', 'data-testid': 'input-old-password' });
    const newPw = h('input', { class: 'input', type: 'password', autocomplete: 'new-password', minlength: 8, 'data-testid': 'input-new-password' });
    const pwErr = h('p', { class: 'form-error', role: 'alert' });
    const pwForm = h('form', { class: 'form' }, h('div', { class: 'form-row' }, h('label', { class: 'field' }, 'Current password', oldPw), h('label', { class: 'field' }, 'New password', newPw)), pwErr, h('div', {}, h('button', { class: 'btn', type: 'submit', text: 'Change password', 'data-testid': 'button-change-password' })));
    pwForm.addEventListener('submit', async (e) => { e.preventDefault(); pwErr.textContent = ''; try { await api('/api/auth/password', { method: 'POST', body: { oldPassword: oldPw.value, newPassword: newPw.value } }); oldPw.value = newPw.value = ''; toast('Password changed. Other sessions have been signed out.'); } catch (err) { pwErr.textContent = err.message; } });

    // beta
    const beta = h('input', { type: 'checkbox', checked: !!u.beta, 'data-testid': 'toggle-beta' });
    beta.addEventListener('change', async () => { try { S.user = (await api('/api/auth/beta', { method: 'POST', body: { beta: beta.checked } })).user; toast(beta.checked ? 'Beta updates enabled' : 'Beta updates disabled'); } catch (e) { beta.checked = !beta.checked; toast(e.message, true); } });

    const mine = h('div', { class: 'rows' }, skeletons(2, 60));
    const cloud = h('div', { class: 'rows' }, skeletons(2, 60));
    const showcaseBox = h('div');

    main.append(h('div', { class: 'page wrap' },
      h('div', { class: 'page-head' }, h('div', {}, h('div', { class: 'eyebrow', text: 'Account' }), h('h1', { text: 'Your Polaris account' }))),
      h('div', { class: 'acc-layout' }, side, h('div', { class: 'acc-main' },
        h('section', { class: 'card card-pad' }, h('h2', { class: 'section-title', text: 'My Hub content' }), mine),
        h('section', { class: 'card card-pad' }, h('h2', { class: 'section-title', text: 'Skin Studio Cloud' }), h('p', { class: 'muted', style: { fontSize: 'var(--text-sm)', marginBottom: 'var(--s3)' }, text: 'Skins you saved to the cloud from the Skin Studio.' }), cloud),
        showcaseBox,
        h('section', { class: 'card card-pad' }, h('h2', { class: 'section-title', text: 'Updates' }), h('label', { class: 'check' }, beta, 'Receive beta versions of the client'), h('p', { class: 'faint', style: { fontSize: 'var(--text-xs)', marginTop: '8px' }, text: 'Applies to every client where you are signed in with this account.' })),
        h('section', { class: 'card card-pad' }, h('h2', { class: 'section-title', text: 'Password' }), pwForm),
      ))));

    const loadMine = async () => {
      try {
        const { items } = await api('/api/me/content');
        mine.replaceChildren(...(items.length ? items.map((it) => {
          const [sl, sc] = STATUS[it.status] || [it.status, ''];
          return h('div', { class: 'row', 'data-testid': 'row-my-content-' + it.id },
            it.preview ? h('img', { src: abs(it.preview), alt: '' }) : h('div', { class: 'thumb', style: { width: '48px', height: '48px', aspectRatio: 'auto', borderRadius: '6px', border: '0', flex: 'none' } }, icon((TYPES[it.type] || TYPES.skin).icon)),
            h('div', { class: 'grow' }, h('b', { text: it.title }), h('small', { text: (TYPES[it.type] || {}).label + ' · ' + plural(it.downloads, 'download', 'downloads') + ' · ' + plural(it.favorites, 'favorite', 'favorites') + (it.reason ? ' · Reason: ' + it.reason : '') })),
            h('div', { class: 'acts' }, h('span', { class: 'tag ' + sc, text: sl }), h('button', { class: 'btn btn-sm btn-danger', text: 'Delete', 'data-testid': 'button-delete-content-' + it.id, onclick: async () => { if (!(await confirmBox('Delete content?', '“' + it.title + '” will be removed from the Hub for everyone.', 'Delete', true))) return; try { await api('/api/me/content/' + it.id, { method: 'DELETE' }); toast('Deleted'); loadMine(); } catch (e) { toast(e.message, true); } } })));
        }) : [emptyState('Nothing uploaded yet', 'Share skins, CSS and themes in the Community Hub.')]));
      } catch (e) { mine.replaceChildren(errorBox(e)); }
    };
    const loadCloud = async () => {
      try {
        const { skins } = await api('/api/cloud/skins');
        cloud.replaceChildren(...(skins.length ? skins.map((s) => h('div', { class: 'row', 'data-testid': 'row-cloud-skin-' + s.id },
          h('img', { src: s.png, alt: '' }),
          h('div', { class: 'grow' }, h('b', { text: s.name }), h('small', { text: s.size + '×' + s.size + ' · ' + fmtDate(s.updated) })),
          h('div', { class: 'acts' },
            h('button', { class: 'btn btn-sm', text: 'PNG', 'data-testid': 'button-download-cloud-' + s.id, onclick: () => saveBlob(dataUrlToBlob(s.png), safeName(s.name) + '.png') }),
            h('button', { class: 'btn btn-sm btn-danger', text: 'Delete', onclick: async () => { if (!(await confirmBox('Delete cloud skin?', '“' + s.name + '” will be removed from the cloud. Local copies in the client are kept.', 'Delete', true))) return; try { await api('/api/cloud/skins/' + s.id, { method: 'DELETE' }); toast('Deleted'); loadCloud(); } catch (e) { toast(e.message, true); } } }),
          ))) : [emptyState('No cloud skins', 'Save from the Skin Studio (F7) → Skin Studio Cloud.', 'box')]));
      } catch (e) { cloud.replaceChildren(errorBox(e)); }
    };
    const loadShowcase = async () => {
      if (!u.kirkaId || !u.kirkaVerified) return;
      try {
        const { profile } = await api('/api/me/profile');
        const input = h('input', { class: 'input', value: ((profile && profile.showcase) || []).join(', '), placeholder: 'e.g. Vandal Toxic, Bayonet Gold', 'data-testid': 'input-showcase' });
        const save = h('button', { class: 'btn', text: 'Save', 'data-testid': 'button-save-showcase', onclick: async () => { try { await api('/api/me/profile', { method: 'PUT', body: { showcase: input.value.split(',').map((s) => s.trim()).filter(Boolean) } }); toast('Showcase saved'); } catch (e) { toast(e.message, true); } } });
        showcaseBox.replaceChildren(h('section', { class: 'card card-pad' }, h('h2', { class: 'section-title', text: 'Showcase' }), h('div', { class: 'form' }, h('label', { class: 'field' }, 'Up to 6 favorite items, separated by commas', input, h('span', { class: 'hint', text: 'Shown on your Polaris profile to other Polaris players.' })), h('div', {}, save))));
      } catch (_) { /* optional */ }
    };
    loadMine(); loadCloud(); loadShowcase();
  }

  // ---------------- router ----------------
  const ROUTES = { '/': [pageHome, 'Polaris Client – the fast client for Kirka.io'], '/hub': [pageHub, 'Community Hub | Polaris Client'], '/profile': [pageProfiles, 'Custom profiles | Polaris Client'], '/news': [pageNews, 'News | Polaris Client'], '/feedback': [pageFeedback, 'Feedback | Polaris Client'], '/account': [pageAccount, 'Account | Polaris Client'] };
  if (STATIC) {
    // no accounts / uploads on the static site – those live inside Polaris Client
    for (const r of ['/hub', '/feedback', '/account']) delete ROUTES[r];
    document.querySelectorAll('#nav a[data-route="/hub"], #nav a[data-route="/feedback"], #account-btn').forEach((a) => a.remove());
  }
  function route() {
    let path = (location.hash.replace(/^#/, '') || '/').split('?')[0];
    if (STATIC && ['/hub', '/feedback', '/account', '/konto'].includes(path)) { location.hash = '#/'; return; }
    if (path === 'downloads') { location.hash = '#/'; return; }
    if (path === '/konto') { location.hash = '#/account'; return; }
    const [fn, title] = ROUTES[path] || [pageNotFound, 'Not found | Polaris Client'];
    const changed = S.route !== path; S.route = path;
    document.title = title;
    document.querySelectorAll('#nav a').forEach((a) => (a.dataset.route === path ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    $('#nav').classList.remove('open'); $('#menu-toggle').setAttribute('aria-expanded', 'false');
    const main = $('#main'); main.replaceChildren();
    Promise.resolve(fn(main)).catch((e) => main.replaceChildren(h('div', { class: 'page wrap' }, errorBox(e))));
    if (changed) { window.scrollTo(0, 0); }
  }
  function pageNotFound(main) {
    main.append(h('div', { class: 'page wrap' }, emptyState('Page not found', 'This address does not exist.'), h('p', { style: { textAlign: 'center', marginTop: 'var(--s5)' } }, h('a', { class: 'btn', href: '#/', text: 'Back to home' }))));
  }

  $('#menu-toggle').addEventListener('click', () => { const n = $('#nav'); const open = !n.classList.contains('open'); n.classList.toggle('open', open); $('#menu-toggle').setAttribute('aria-expanded', String(open)); });
  $('#skip').addEventListener('click', (e) => { e.preventDefault(); $('#main').focus(); });
  window.addEventListener('hashchange', route);
  loadStatus(); loadMe();
  route();
  setInterval(loadStatus, 120000);
})();
