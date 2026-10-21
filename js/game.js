// NICHO — juego principal: nado tipo flOw, nicho (T, pH, sal), mutación + selección, HGT, depredadores, capas extremas
'use strict';
(() => {
const cv = document.getElementById('c'), cx = cv.getContext('2d');
const $ = id => document.getElementById(id);
let W = 0, H = 0, DPR = 1, U = 1;
let lang = 'es';
try { lang = localStorage.getItem('nicho_lang') || 'es'; } catch (e) {}
if (lang !== 'es' && lang !== 'en') lang = 'es';
const T_ = () => STR[lang];

// ---------- utilidades ----------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, k) => a + (b - a) * k;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rnd = (a, b) => a + Math.random() * (b - a);
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const AX = ['T', 'pH', 'S'];
const LIM = { T: { m: [-20, 125], s: [2.5, 30] }, pH: { m: [0, 13], s: [0.35, 3.5] }, S: { m: [0, 35], s: [0.8, 14] } };
const R_WORLD = 1700, SPACING = 15, MAXSEG = 14;

// ---------- genoma y aptitud ----------
function newGenome() { return { T: { m: 25, s: 9 }, pH: { m: 7, s: 1.5 }, S: { m: 0.5, s: 3 } }; }
function cloneG(g) { return { T: { ...g.T }, pH: { ...g.pH }, S: { ...g.S } }; }
function clampG(g) { for (const a of AX) { g[a].m = clamp(g[a].m, LIM[a].m[0], LIM[a].m[1]); g[a].s = clamp(g[a].s, LIM[a].s[0], LIM[a].s[1]); } g._col = null; return g; }
// curva de desempeño: térmica asimétrica (cae más rápido sobre el óptimo, Huey & Kingsolver 1989); pH y sal gaussianas
function perf(ax, x, g, off) {
  const m = g[ax].m + (off ? off[ax] : 0); let s = g[ax].s;
  if (ax === 'T' && x > m) s *= 0.5;
  const z = (x - m) / s; return Math.exp(-0.5 * z * z);
}
// compromiso generalista–especialista: más amplitud, menos rendimiento máximo
function peakF(g) { let p = 1; for (const a of AX) p *= Math.pow(AXES[a].sd0 / g[a].s, 0.22); return clamp(p, 0.55, 1.35); }
function fitness(g, e, off) { return perf('T', e.T, g, off) * perf('pH', e.pH, g, off) * perf('S', e.S, g, off) * peakF(g); }
function breadth(g) { let b = 0; for (const a of AX) b += Math.log2(g[a].s / AXES[a].sd0); return b / 3; }

function mutate(g, stressed) {
  const m = cloneG(g); const n = stressed && Math.random() < 0.5 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const a = AX[Math.floor(Math.random() * 3)];
    if (Math.random() < 0.28) m[a].s *= Math.exp(gauss() * 0.2);
    else m[a].m += gauss() * AXES[a].step;
  }
  return clampG(m);
}

// ---------- colores ----------
function hsl2rgb(h, s, l) { h /= 360; const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return [f(0) * 255, f(8) * 255, f(4) * 255]; }
const mix = (c1, c2, k) => [lerp(c1[0], c2[0], k), lerp(c1[1], c2[1], k), lerp(c1[2], c2[2], k)];
const rgb = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a == null ? 1 : a})`;
function gColor(g) {
  if (g._col) return g._col;
  const h = 200 - clamp((g.T.m + 20) / 140, 0, 1) * 205;
  let c = hsl2rgb((h + 360) % 360, 0.75, 0.62);
  if (g.pH.m < 5) c = mix(c, [230, 240, 90], clamp((5 - g.pH.m) / 5, 0, 1) * 0.45);
  if (g.pH.m > 8) c = mix(c, [190, 130, 255], clamp((g.pH.m - 8) / 5, 0, 1) * 0.55);
  c = mix(c, [255, 160, 210], clamp(g.S.m / 30, 0, 1) * 0.5);
  return (g._col = c);
}
const STOPS = [[-20, [14, 30, 70]], [10, [8, 40, 66]], [25, [8, 50, 56]], [45, [44, 44, 28]], [75, [70, 34, 16]], [110, [80, 14, 22]]];
function envColor(e, dark) {
  let c = STOPS[0][1];
  for (let i = 0; i < STOPS.length - 1; i++) if (e.T >= STOPS[i][0]) c = mix(STOPS[i][1], STOPS[i + 1][1], clamp((e.T - STOPS[i][0]) / (STOPS[i + 1][0] - STOPS[i][0]), 0, 1));
  if (e.pH < 4.5) c = mix(c, [74, 52, 8], clamp((4.5 - e.pH) / 4.5, 0, 1) * 0.55);
  if (e.pH > 8) c = mix(c, [44, 18, 74], clamp((e.pH - 8) / 4, 0, 1) * 0.6);
  c = mix(c, [96, 52, 80], clamp(e.S / 30, 0, 1) * 0.6);
  if (dark) c = mix(c, [2, 4, 10], dark);
  return c;
}

// ---------- estado ----------
const G = {
  mode: 'title', layer: 0, t: 0, g: newGenome(), off: { T: 0, pH: 0, S: 0 }, traits: new Set(),
  segs: [], biomass: 0, w: 1, lyseT: 0, grace: 0, dash: 0, dashCd: 0,
  food: [], prey: [], cils: [], phages: [], daughters: [], parts: [], amb: [], motes: [],
  portals: [], cam: { x: 0, y: 0, z: 1 }, ptr: null, keys: {}, envHist: [], trail: [],
  ev: null, nextEv: 40, seen: {}, stats: { sweeps: 0, purged: 0, genes: 0, desc: 0 },
  trans: null, phageT: 8, minW: 1, stressT: 0, deepest: 0, ended: false,
};
function resetPlayer(n, x, y) {
  G.segs = [];
  for (let i = 0; i < n; i++) G.segs.push({ x: x - i * SPACING, y: y, a: 0, g: G.g, mut: null, inf: 0, sw: 0, ng: null, born: G.t });
}

// ---------- ambiente ----------
function evAmp() {
  if (!G.ev) return 0; const k = G.t - G.ev.t0;
  if (k < 18) return sstep(0, 18, k); if (k < 48) return 1; if (k < 68) return 1 - sstep(48, 68, k); return 0;
}
function envAt(x, y, L) {
  L = L || LAYERS[G.layer];
  const r = Math.hypot(x, y), k = sstep(320, 1100, r);
  const e = { T: lerp(L.entry.T, L.core.T, k), pH: lerp(L.entry.pH, L.core.pH, k), S: lerp(L.entry.S, L.core.S, k) };
  for (const h of L.hs) {
    const d = Math.hypot(x - h.x, y - h.y) / h.r, w = Math.exp(-d * d) * 0.95;
    if (w > 0.002) for (const a of AX) e[a] = lerp(e[a], h.v[a], w);
  }
  e.T += Math.sin(G.t * 0.05 + G.layer) * 1.2;
  if (G.ev) e[G.ev.d.ax] += G.ev.d.d * evAmp();
  e.pH = clamp(e.pH, 0, 14); e.S = Math.max(0, e.S);
  return e;
}

// ---------- capas ----------
function enterLayer(n, fromBelow) {
  G.layer = n; G.deepest = Math.max(G.deepest, n);
  const L = LAYERS[n];
  G.food = []; G.prey = []; G.cils = []; G.phages = []; G.daughters = []; G.amb = []; G.parts = [];
  G.ev = null; G.nextEv = G.t + rnd(35, 50);
  const a = rnd(0, Math.PI * 2);
  G.portals = [{ x: Math.cos(a) * 1050, y: Math.sin(a) * 1050, dir: 1 }];
  if (n > 0) G.portals.push({ x: Math.cos(a + Math.PI) * 900, y: Math.sin(a + Math.PI) * 900, dir: -1 });
  const len = Math.max(3, Math.min(G.segs.length || 4, MAXSEG));
  resetPlayer(len, 0, 0);
  G.cam.x = 0; G.cam.y = 0;
  for (let i = 0; i < 70; i++) spawnFood(true);
  for (let i = 0; i < 10; i++) spawnPrey();
  for (let i = 0; i < L.cil; i++) G.cils.push({ x: rnd(-1200, 1200), y: rnd(-1200, 1200), a: rnd(0, 6.3), full: 0, ph: rnd(0, 9) });
  G.envHist = []; G.grace = Math.max(G.grace, 15);
  Sound.setLayer(n);
  showCard();
  save();
}
function showCard() {
  const L = LAYERS[G.layer], e = L.core, s = T_();
  $('card').innerHTML = `<div class="depth">${'●'.repeat(G.layer + 1)}${'○'.repeat(LAYERS.length - G.layer - 1)}</div>
    <h2>${L.name[lang]}</h2><div class="pl">${L.place[lang]}</div>
    <div class="vals"><span>🌡 ${fmt('T', e.T)}</span><span>pH ${fmt('pH', e.pH)}</span><span>NaCl ${fmt('S', e.S)}</span></div>
    <div class="org">${L.org[lang]}</div>`;
  const c = $('card'); c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
  clearTimeout(showCard._t); showCard._t = setTimeout(() => c.classList.remove('show'), 6500);
}
function fmt(a, v) {
  const n = a === 'pH' ? v.toFixed(1) : a === 'S' ? (v < 1 ? v.toFixed(1) : Math.round(v)) : Math.round(v);
  const str = lang === 'es' ? String(n).replace('.', ',') : String(n);
  return str + (a === 'T' ? ' °C' : a === 'S' ? ' %' : '');
}

// ---------- spawns ----------
function spawnFood(anywhere) {
  const L = LAYERS[G.layer], h = G.segs[0] || { x: 0, y: 0 };
  let x, y, tries = 0;
  do {
    const a = rnd(0, 6.283), r = anywhere ? rnd(60, 1300) : Math.sqrt(rnd(0.12, 1)) * 1150;
    x = (anywhere ? 0 : h.x) + Math.cos(a) * r; y = (anywhere ? 0 : h.y) + Math.sin(a) * r;
  } while (Math.hypot(x, y) > R_WORLD && ++tries < 10);
  const litho = L.food === 'litho' && Math.random() < 0.6;
  G.food.push({ x, y, vx: rnd(-6, 6), vy: rnd(-6, 6), ph: rnd(0, 9), litho, s: rnd(0.7, 1.3), age: anywhere ? 9 : 0 });
}
function spawnPrey() {
  const L = LAYERS[G.layer];
  const a = rnd(0, 6.283), r = rnd(380, 1350);
  const tr = L.prey[Math.floor(Math.random() * L.prey.length)];
  G.prey.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, a: rnd(0, 6.3), tr, shape: Math.floor(Math.random() * 4), ph: rnd(0, 9), sp: rnd(28, 46) });
}
function burst(x, y, col, n, sp, life) {
  for (let i = 0; i < n; i++) { const a = rnd(0, 6.283), v = rnd(sp * 0.3, sp); G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life || 1, max: life || 1, col, r: rnd(1, 2.6) }); }
}

// ---------- subtítulos ----------
const capQ = []; let capBusy = false;
function cap(key, html) {
  if (key && G.seen[key]) return; if (key) G.seen[key] = 1;
  capQ.push(html || T_().cap[key]); if (!capBusy) nextCap();
}
function nextCap() {
  const el = $('cap'); if (!capQ.length) { capBusy = false; return; }
  capBusy = true; el.innerHTML = capQ.shift(); el.classList.add('show');
  setTimeout(() => { el.classList.remove('show'); setTimeout(nextCap, 900); }, 6200);
}
function note(html) { const el = $('note'); el.innerHTML = html; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); clearTimeout(note._t); note._t = setTimeout(() => el.classList.remove('show'), 5000); }

// ---------- evolución ----------
function avgFit(g) {
  if (!G.envHist.length) return fitness(g, envAt(G.segs[0].x, G.segs[0].y), G.off);
  let s = 0; for (const e of G.envHist) s += fitness(g, e, G.off); return s / G.envHist.length;
}
function divide() {
  const stressed = G.w < 0.35;
  Sound.divide();
  let seg;
  if (G.segs.length < MAXSEG) {
    const t = G.segs[G.segs.length - 1];
    seg = { x: t.x - Math.cos(t.a) * SPACING, y: t.y - Math.sin(t.a) * SPACING, a: t.a, g: G.g, mut: null, inf: 0, sw: 0, ng: null, born: G.t };
    G.segs.push(seg);
    cap('grow');
  } else {
    // filamento completo: sale una célula hija (población que crece)
    const t = G.segs[G.segs.length - 1];
    G.daughters.push({ x: t.x, y: t.y, vx: -Math.cos(t.a) * 40 + rnd(-20, 20), vy: -Math.sin(t.a) * 40 + rnd(-20, 20), g: G.g, life: 14, a: t.a });
    G.stats.desc++; cap('daughter');
    seg = G.segs[1 + Math.floor(Math.random() * (G.segs.length - 1))];
  }
  const pendings = G.segs.filter(s => s.mut).length;
  if (seg && !seg.mut && pendings < 3 && Math.random() < (stressed ? 0.95 : 0.6)) {
    seg.mut = { g: mutate(G.g, stressed), t0: G.t, base: G.g };
  }
}
function resolveMutants() {
  for (let i = 0; i < G.segs.length; i++) {
    const s = G.segs[i]; if (!s.mut || G.t - s.mut.t0 < 3.5) continue;
    const m = s.mut; s.mut = null;
    if (m.base !== G.g) { // otra mutación ganó antes: interferencia clonal
      burst(s.x, s.y, gColor(m.g), 8, 40, 0.8); G.stats.purged++;
      cap('clonal', lang === 'es' ? 'Interferencia clonal: dos mutaciones compitieron y solo una ganó.' : 'Clonal interference: two mutations competed and only one won.');
      continue;
    }
    const w0 = avgFit(G.g), w1 = avgFit(m.g), ratio = w1 / (w0 + 1e-9);
    if (ratio > 1.04 || (ratio > 0.97 && Math.random() < 0.5)) {
      const neutral = ratio <= 1.04;
      sweep(m.g, i);
      if (neutral) cap('drift'); else cap('sweep');
      if (!neutral && G.minW < 0.2 && avgFit(G.g) > 0.3) { cap('rescue'); G.minW = 1; }
    } else {
      G.stats.purged++; Sound.purge(); burst(s.x, s.y, gColor(m.g), 10, 50, 1); cap('purge');
    }
  }
}
function sweep(ng, from) {
  G.g = ng; G.stats.sweeps++; Sound.sweep();
  G.segs.forEach((s, j) => { s.ng = ng; s.sw = G.t + Math.abs(j - from) * 0.08; });
  if (Math.abs(breadth(ng)) > 0.25) cap('tradeoff');
}
function gainTrait(tr, x, y) {
  const T = TRAITS[tr]; Sound.gene(); burst(x, y, hexRgb(T.col), 22, 90, 1.4);
  if (G.traits.has(tr)) { G.biomass += 0.6; return; }
  G.traits.add(tr); G.stats.genes++;
  const g = cloneG(G.g), d = T.d;
  if (d.Tm) g.T.m += d.Tm; if (d.Ts) g.T.s += d.Ts; if (d.pHm) g.pH.m += d.pHm; if (d.pHs) g.pH.s += d.pHs; if (d.Sm) g.S.m += d.Sm; if (d.Ss) g.S.s += d.Ss;
  clampG(g); sweep(g, 0); G.stats.sweeps--;
  cap('hgt');
  const tx = T[lang]; cap(null, `<b style="color:${T.col}">${tx[0]}</b> — ${tx[1]}`);
  G.biomass += 0.5;
}
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function loseSeg(idx, col) {
  if (G.segs.length <= 1) return false;
  const s = G.segs.splice(idx, 1)[0];
  burst(s.x, s.y, col || gColor(s.g), 14, 60, 1.2); Sound.hurt(); return true;
}
function dormancy() {
  G.mode = 'dorm'; G.dormT = G.t; cap('dorm'); Sound.portal();
}
function wake() {
  const up = Math.max(0, G.layer - 1);
  // cuello de botella: sobreviven las variantes que mejor toleran el ambiente al que llegan (rescate desde variación)
  const L = LAYERS[up]; const e = { T: L.entry.T, pH: L.entry.pH, S: L.entry.S };
  let best = G.g, bw = fitness(G.g, e, null);
  for (let i = 0; i < 8; i++) { const m = mutate(G.g, true); const w = fitness(m, e, null); if (w > bw) { bw = w; best = m; } }
  G.g = best; G.off = { T: 0, pH: 0, S: 0 }; G.grace = 25; G.lyseT = 0;
  resetPlayer(G.traits.has('spore') ? 5 : 3, 0, 0);
  G.mode = 'play'; enterLayer(up);
}

// ---------- transición entre capas ----------
function startTrans(dir) {
  if (G.trans) return;
  G.trans = { t0: G.t, dir, done: false }; G.mode = 'trans'; Sound.portal();
}
function updTrans() {
  const k = G.t - G.trans.t0;
  if (k > 1.6 && !G.trans.done) {
    G.trans.done = true;
    const nl = G.layer + G.trans.dir;
    if (nl >= LAYERS.length) { G.trans = null; endGame(); return; }
    enterLayer(clamp(nl, 0, LAYERS.length - 1));
  }
  if (k > 3.2) { G.trans = null; G.mode = 'play'; }
}
function endGame() {
  G.ended = true; G.mode = 'end'; openMap(true);
}

// ---------- entrada ----------
function toWorld(px, py) { return { x: G.cam.x + (px - W / 2) / G.cam.z, y: G.cam.y + (py - H / 2) / G.cam.z }; }
cv.addEventListener('pointermove', e => { G.ptr = { x: e.clientX, y: e.clientY }; });
cv.addEventListener('pointerdown', e => {
  G.ptr = { x: e.clientX, y: e.clientY };
  if (G.mode === 'title') { startGame(); return; }
  if (G.mode === 'map') { closeMap(); return; }
  if (G.mode === 'play' && G.dashCd <= 0) { G.dash = 0.7; G.dashCd = 1.4; }
});
cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') G.ptr = null; });
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); G.keys[k] = true;
  if (G.mode === 'title' && (k === ' ' || k === 'enter')) { startGame(); return; }
  if (k === 'n' || k === 'tab') { e.preventDefault(); if (G.mode === 'play') openMap(false); else if (G.mode === 'map') closeMap(); }
  if (k === 'escape' && G.mode === 'map') closeMap();
  if (k === 'm') toggleSound();
  if (k === ' ' && G.mode === 'play' && G.dashCd <= 0) { G.dash = 0.7; G.dashCd = 1.4; }
});
addEventListener('keyup', e => { G.keys[e.key.toLowerCase()] = false; });

function toggleSound() { const on = Sound.toggle(); $('bSnd').textContent = on ? '♪' : '♪̸'; $('bSnd').classList.toggle('off', !on); }

// ---------- actualización ----------
function update(dt) {
  G.t += dt;
  if (G.mode === 'map' || G.mode === 'end') return;
  if (G.mode === 'trans') updTrans();
  const auto = G.mode === 'title';
  const head = G.segs[0];
  const L = LAYERS[G.layer];

  // ambiente en la cabeza
  const e = envAt(head.x, head.y);
  G.env = e;
  if ((G.histT = (G.histT || 0) + dt) > 0.15) { G.histT = 0; G.envHist.push(e); if (G.envHist.length > 40) G.envHist.shift(); }
  // aclimatación (plasticidad fisiológica, limitada y reversible)
  for (const a of AX) {
    const tgt = clamp(e[a] - G.g[a].m, -AXES[a].accl, AXES[a].accl);
    G.off[a] += (tgt - G.off[a]) * Math.min(1, dt * 0.06);
    if (!auto && Math.abs(G.off[a]) > AXES[a].accl * 0.7) cap('accl');
  }
  G.w = fitness(G.g, e, G.off);
  if (!auto && G.mode === 'play') {
    G.minW = Math.min(G.minW, G.w);
    // estrés
    Sound.setStress(G.w < 0.35 ? (0.35 - G.w) / 0.35 : 0);
    if (G.w < 0.35) { G.stressT += dt; if (G.stressT > 2.5) cap('stress'); } else G.stressT = 0;
    if (G.grace > 0) G.grace -= dt;
    if (G.w < 0.1 && G.grace <= 0) {
      G.lyseT += dt;
      if (G.lyseT > 3.5) {
        G.lyseT = 0;
        if (G.segs.length > 1) { loseSeg(G.segs.length - 1); cap('lyse'); }
        else { dormancy(); return; }
      }
    } else G.lyseT = Math.max(0, G.lyseT - dt * 0.5);
    // trayectoria evolutiva para el mapa
    if ((G.trT = (G.trT || 0) + dt) > 1.5) { G.trT = 0; G.trail.push({ T: G.g.T.m, pH: G.g.pH.m, S: G.g.S.m, L: G.layer }); if (G.trail.length > 900) G.trail.shift(); }
    // eventos ambientales lentos
    if (!G.ev && G.t > G.nextEv) {
      const d = L.ev[Math.floor(Math.random() * L.ev.length)];
      G.ev = { d, t0: G.t };
      const arrow = d.d > 0 ? '↑' : '↓', ic = d.ax === 'T' ? '🌡' : d.ax === 'pH' ? 'pH' : 'NaCl';
      note(`${arrow} ${ic} &nbsp;${d[lang]} <span class="dim">(${d.d > 0 ? '+' : ''}${fmt(d.ax, d.d).replace(' ', '')})</span>`);
      cap('event'); G.minW = Math.min(G.minW, 1);
    }
    if (G.ev && G.t - G.ev.t0 > 68) { G.ev = null; G.nextEv = G.t + rnd(55, 85); }
  }

  // movimiento de la cabeza
  let tx, ty;
  const kx = (G.keys['arrowright'] || G.keys['d'] ? 1 : 0) - (G.keys['arrowleft'] || G.keys['a'] ? 1 : 0);
  const ky = (G.keys['arrowdown'] || G.keys['s'] ? 1 : 0) - (G.keys['arrowup'] || G.keys['w'] ? 1 : 0);
  if (auto) { const a = G.t * 0.35; tx = Math.cos(a) * 260; ty = Math.sin(a * 1.3) * 180; }
  else if (kx || ky) { tx = head.x + kx * 300; ty = head.y + ky * 300; }
  else if (G.ptr) { const p = toWorld(G.ptr.x, G.ptr.y); tx = p.x; ty = p.y; }
  else { tx = head.x + Math.cos(head.a) * 100; ty = head.y + Math.sin(head.a) * 100; }
  if (G.mode === 'dorm') { tx = head.x; ty = head.y - 100; }
  const dx = tx - head.x, dy = ty - head.y, dist = Math.hypot(dx, dy);
  let want = Math.atan2(dy, dx);
  const rr = Math.hypot(head.x, head.y);
  if (rr > R_WORLD) want = head.a + angDiff(head.a, Math.atan2(-head.y, -head.x)) * 0.5;
  head.a += angDiff(head.a, want) * Math.min(1, dt * (4.5 + 5 * (1 - sstep(0, 120, dist))));
  G.dash = Math.max(0, G.dash - dt); G.dashCd -= dt;
  let sp = (95 + Math.min(G.segs.length, 12) * 4) * (0.45 + 0.55 * clamp(G.w, 0, 1));
  if (G.dash > 0) sp *= 1 + 1.4 * (G.dash / 0.7);
  sp *= sstep(0, 70, dist) * 0.85 + 0.15;
  if (G.mode === 'dorm') sp = 30;
  head.x += Math.cos(head.a) * sp * dt; head.y += Math.sin(head.a) * sp * dt;
  for (let i = 1; i < G.segs.length; i++) {
    const p = G.segs[i - 1], s = G.segs[i];
    const ddx = p.x - s.x, ddy = p.y - s.y, d = Math.hypot(ddx, ddy) || 1;
    s.a = Math.atan2(ddy, ddx);
    if (d > SPACING) { s.x = p.x - ddx / d * SPACING; s.y = p.y - ddy / d * SPACING; }
  }
  for (const s of G.segs) if (s.ng && G.t >= s.sw) { s.g = s.ng; s.ng = null; burst(s.x, s.y, gColor(s.g), 3, 30, 0.6); }

  if (G.mode === 'dorm') { if (G.t - G.dormT > 4) wake(); updWorld(dt, true); return; }

  // comer
  if (!auto && G.mode === 'play') {
    for (let i = G.food.length - 1; i >= 0; i--) {
      const f = G.food[i];
      if ((f.x - head.x) ** 2 + (f.y - head.y) ** 2 < 18 * 18) {
        let gain = 0.26 * (0.35 + 0.65 * clamp(G.w, 0, 1));
        if (f.litho) gain *= G.traits.has('litho') ? 2 : 0.6;
        G.biomass += gain; Sound.eat(); burst(f.x, f.y, f.litho ? [255, 170, 70] : [200, 255, 220], 5, 30, 0.6);
        G.food.splice(i, 1);
        if (!G.seen.intro) cap('intro');
      }
    }
    for (let i = G.prey.length - 1; i >= 0; i--) {
      const p = G.prey[i];
      if ((p.x - head.x) ** 2 + (p.y - head.y) ** 2 < 20 * 20) { G.prey.splice(i, 1); gainTrait(p.tr, p.x, p.y); }
    }
    while (G.biomass >= 1) { G.biomass -= 1; divide(); }
    resolveMutants();
    // portales
    for (const p of G.portals) {
      const d = Math.hypot(p.x - head.x, p.y - head.y);
      if (d < 36) { startTrans(p.dir); break; }
      if (d < 380 && p.dir > 0) cap('portal');
    }
  }
  updWorld(dt, auto);
}

function updWorld(dt, auto) {
  const head = G.segs[0], L = LAYERS[G.layer];
  // comida
  for (const f of G.food) { f.x += f.vx * dt; f.y += f.vy * dt; f.ph += dt; f.age += dt; }
  for (let i = G.food.length - 1; i >= 0; i--) if ((G.food[i].x - head.x) ** 2 + (G.food[i].y - head.y) ** 2 > 1500 * 1500) G.food.splice(i, 1);
  while (G.food.length < 85) spawnFood(false);
  // presas
  for (const p of G.prey) {
    p.ph += dt; p.a += Math.sin(p.ph * 0.7) * dt * 0.8;
    const d = Math.hypot(p.x - head.x, p.y - head.y);
    let sp = p.sp;
    if (!auto && d < 170 && G.segs.length >= 2) { p.a += angDiff(p.a, Math.atan2(p.y - head.y, p.x - head.x)) * dt * 3; sp *= 1.6; }
    if (Math.hypot(p.x, p.y) > R_WORLD - 100) p.a += angDiff(p.a, Math.atan2(-p.y, -p.x)) * dt * 2;
    p.x += Math.cos(p.a) * sp * dt; p.y += Math.sin(p.a) * sp * dt;
  }
  while (G.prey.length < 10) spawnPrey();
  // ciliados (pastoreo)
  for (const c of G.cils) {
    c.ph += dt; c.full = Math.max(0, c.full - dt);
    const tail = G.segs[G.segs.length - 1];
    const d = Math.hypot(tail.x - c.x, tail.y - c.y);
    const small = G.segs.length < 6 && !G.traits.has('capsule');
    let sp = 40;
    if (!auto && G.mode === 'play' && d < 400 && c.full <= 0 && G.segs.length > 1) {
      if (small) { c.a += angDiff(c.a, Math.atan2(tail.y - c.y, tail.x - c.x)) * dt * 2; sp = 82; }
      else if (d < 220) cap('big');
    } else c.a += Math.sin(c.ph * 0.4) * dt * 0.6;
    if (Math.hypot(c.x, c.y) > R_WORLD - 150) c.a += angDiff(c.a, Math.atan2(-c.y, -c.x)) * dt * 2;
    c.x += Math.cos(c.a) * sp * dt; c.y += Math.sin(c.a) * sp * dt;
    if (!auto && small && c.full <= 0 && d < 28 && G.segs.length > 1) { loseSeg(G.segs.length - 1); c.full = 10; cap('graze'); }
  }
  // fagos: "kill the winner" — aparecen cuando tu linaje es abundante
  if (!auto && G.mode === 'play') {
    const abund = G.segs.length + Math.min(G.stats.desc, 10) * 0.4;
    if (abund >= 9) {
      G.phageT -= dt;
      if (G.phageT <= 0 && G.phages.length < 5) {
        G.phageT = clamp(16 - abund * 0.6, 4, 14);
        const a = rnd(0, 6.283); G.phages.push({ x: head.x + Math.cos(a) * 650, y: head.y + Math.sin(a) * 650, life: 30, ph: rnd(0, 9), a: 0 });
      }
    }
  }
  for (let i = G.phages.length - 1; i >= 0; i--) {
    const v = G.phages[i]; v.life -= dt; v.ph += dt;
    let best = null, bd = 1e9;
    for (let j = 1; j < G.segs.length; j++) { const s = G.segs[j]; const d = (s.x - v.x) ** 2 + (s.y - v.y) ** 2; if (d < bd && !s.inf) { bd = d; best = s; } }
    if (best && v.life > 0) {
      const a = Math.atan2(best.y - v.y, best.x - v.x); v.a = a;
      v.x += (Math.cos(a) * 62 + Math.sin(v.ph * 3) * 20) * dt; v.y += (Math.sin(a) * 62 + Math.cos(v.ph * 3) * 20) * dt;
      if (bd < 13 * 13) {
        G.phages.splice(i, 1);
        if (G.traits.has('crispr')) { burst(v.x, v.y, [80, 255, 210], 16, 70, 0.9); Sound.gene(); cap('crispr'); }
        else { best.inf = G.t; cap('phage'); }
        continue;
      }
    } else { v.x += Math.cos(v.ph) * 10 * dt; v.y += Math.sin(v.ph) * 10 * dt; }
    if (v.life < -2) G.phages.splice(i, 1);
  }
  for (let j = G.segs.length - 1; j >= 1; j--) {
    const s = G.segs[j];
    if (s.inf && G.t - s.inf > 3.5) {
      const x = s.x, y = s.y;
      loseSeg(j, [120, 255, 200]);
      for (let k = 0; k < 1 && G.phages.length < 7; k++) G.phages.push({ x: x + rnd(-8, 8), y: y + rnd(-8, 8), life: 5, ph: rnd(0, 9), a: 0 });
    }
  }
  // hijas
  for (let i = G.daughters.length - 1; i >= 0; i--) { const d = G.daughters[i]; d.life -= dt; d.x += d.vx * dt; d.y += d.vy * dt; d.a += dt * 0.3; if (d.life <= 0) G.daughters.splice(i, 1); }
  // partículas
  for (let i = G.parts.length - 1; i >= 0; i--) { const p = G.parts[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; if (p.life <= 0) G.parts.splice(i, 1); }
  updAmbient(dt);
  // cámara
  const zt = Math.min(W, H) / 820 * (1 - Math.min(G.segs.length, 14) * 0.012);
  G.cam.x += (head.x - G.cam.x) * Math.min(1, dt * 2.2); G.cam.y += (head.y - G.cam.y) * Math.min(1, dt * 2.2);
  let z = zt;
  if (G.trans) { const k = G.t - G.trans.t0; z = k < 1.6 ? zt * (1 + sstep(0, 1.6, k) * 2.5) : zt * (0.35 + 0.65 * sstep(1.6, 3.2, k)); }
  G.cam.z += (z - G.cam.z) * Math.min(1, dt * 6);
}

// partículas ambientales que muestran el ambiente: burbujas (calor), cristales de sal, hielo, flóculos de hierro
function updAmbient(dt) {
  const e = envAt(G.cam.x, G.cam.y);
  const vw = W / G.cam.z, vh = H / G.cam.z;
  const want = { bub: clamp((e.T - 55) / 40, 0, 1) * 40, salt: clamp((e.S - 10) / 20, 0, 1) * 40, ice: clamp(-e.T / 12, 0, 1) * 40, fe: clamp((3.5 - e.pH) / 3, 0, 1) * 35 };
  const cnt = { bub: 0, salt: 0, ice: 0, fe: 0 };
  for (const a of G.amb) cnt[a.k]++;
  for (const k in want) if (cnt[k] < want[k] && Math.random() < 0.3) G.amb.push({ k, x: G.cam.x + rnd(-vw / 2, vw / 2), y: G.cam.y + rnd(-vh / 2, vh / 2), life: rnd(4, 9), max: 0, r: rnd(1.5, 4), rot: rnd(0, 6), ph: rnd(0, 9) });
  for (let i = G.amb.length - 1; i >= 0; i--) {
    const a = G.amb[i]; if (!a.max) a.max = a.life; a.life -= dt; a.ph += dt;
    if (a.k === 'bub') { a.y -= (20 + a.r * 8) * dt; a.x += Math.sin(a.ph * 2) * 8 * dt; }
    else if (a.k === 'fe') { a.y += 6 * dt; a.x += Math.sin(a.ph) * 4 * dt; }
    else { a.rot += dt * 0.3; a.y += 3 * dt; }
    if (a.life <= 0) G.amb.splice(i, 1);
  }
}

// ---------- dibujo ----------
const bg = document.createElement('canvas'), bgx = bg.getContext('2d'); bg.width = 72; bg.height = 42;
const bgImg = bgx.createImageData(72, 42); let bgTick = 0;
function drawBg() {
  if (bgTick++ % 3 === 0) {
    const vw = W / G.cam.z, vh = H / G.cam.z, d = bgImg.data;
    for (let j = 0; j < 42; j++) for (let i = 0; i < 72; i++) {
      const x = G.cam.x + (i / 71 - 0.5) * vw * 1.04, y = G.cam.y + (j / 41 - 0.5) * vh * 1.04;
      const r = Math.hypot(x, y);
      const c = envColor(envAt(x, y), sstep(R_WORLD - 100, R_WORLD + 500, r) * 0.8);
      const o = (j * 72 + i) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    bgx.putImageData(bgImg, 0, 0);
  }
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
  cx.drawImage(bg, 0, 0, 72, 42, 0, 0, W, H);
  // haces de luz suaves
  cx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const x = W * (0.2 + 0.3 * i) + Math.sin(G.t * 0.05 + i * 2) * W * 0.15;
    const gr = cx.createLinearGradient(x, 0, x + W * 0.1, H);
    gr.addColorStop(0, 'rgba(160,220,255,0.035)'); gr.addColorStop(1, 'rgba(160,220,255,0)');
    cx.fillStyle = gr; cx.beginPath(); cx.moveTo(x - 60, 0); cx.lineTo(x + 60, 0); cx.lineTo(x + W * 0.25, H); cx.lineTo(x - W * 0.05, H); cx.fill();
  }
  // motas con paralaje (profundidad)
  for (const m of G.motes) {
    const px = ((m.x - G.cam.x * m.z * G.cam.z) % W + W) % W, py = ((m.y - G.cam.y * m.z * G.cam.z) % H + H) % H;
    cx.fillStyle = `rgba(200,235,255,${0.05 + m.z * 0.12})`;
    cx.beginPath(); cx.arc(px, py, m.r, 0, 6.283); cx.fill();
  }
  cx.globalCompositeOperation = 'source-over';
}
function glow(x, y, r, c, a) {
  const g = cx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgb(c, a)); g.addColorStop(1, rgb(c, 0));
  cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, r, 0, 6.283); cx.fill();
}
function capsule(x, y, a, len, rad) {
  cx.save(); cx.translate(x, y); cx.rotate(a); cx.beginPath();
  cx.moveTo(-len / 2, -rad); cx.lineTo(len / 2, -rad); cx.arc(len / 2, 0, rad, -Math.PI / 2, Math.PI / 2);
  cx.lineTo(-len / 2, rad); cx.arc(-len / 2, 0, rad, Math.PI / 2, Math.PI * 1.5); cx.closePath(); cx.restore();
}
function worldT() { const z = G.cam.z * DPR; cx.setTransform(z, 0, 0, z, (W / 2 - G.cam.x * G.cam.z) * DPR, (H / 2 - G.cam.y * G.cam.z) * DPR); }

function drawWorld() {
  worldT();
  const t = G.t, L = LAYERS[G.layer];
  // ambiente: burbujas, sal, hielo, hierro
  for (const a of G.amb) {
    const al = Math.min(1, a.life, (a.max - a.life) * 2) * 0.5;
    if (a.k === 'bub') { cx.strokeStyle = `rgba(255,230,200,${al})`; cx.lineWidth = 0.8; cx.beginPath(); cx.arc(a.x, a.y, a.r, 0, 6.283); cx.stroke(); }
    else if (a.k === 'salt') { cx.save(); cx.translate(a.x, a.y); cx.rotate(a.rot); cx.strokeStyle = `rgba(255,235,245,${al})`; cx.lineWidth = 0.8; cx.strokeRect(-a.r, -a.r, a.r * 2, a.r * 2); cx.restore(); }
    else if (a.k === 'ice') { cx.save(); cx.translate(a.x, a.y); cx.rotate(a.rot); cx.strokeStyle = `rgba(220,245,255,${al})`; cx.lineWidth = 0.7; cx.beginPath(); for (let k = 0; k < 3; k++) { const q = k * Math.PI / 3; cx.moveTo(-Math.cos(q) * a.r * 1.6, -Math.sin(q) * a.r * 1.6); cx.lineTo(Math.cos(q) * a.r * 1.6, Math.sin(q) * a.r * 1.6); } cx.stroke(); cx.restore(); }
    else { cx.fillStyle = `rgba(220,120,40,${al * 0.8})`; cx.beginPath(); cx.arc(a.x, a.y, a.r * 0.7, 0, 6.283); cx.fill(); }
  }
  // parches (vertientes, chimeneas)
  for (const h of L.hs) { glow(h.x, h.y, h.r * 0.9, envColor(h.v).map(v => Math.min(255, v * 2.4)), 0.12 + 0.03 * Math.sin(t)); }
  cx.globalCompositeOperation = 'lighter';
  // comida
  for (const f of G.food) {
    const p = (0.7 + 0.3 * Math.sin(f.ph * 2)) * Math.min(1, f.age / 2);
    if (f.litho) { glow(f.x, f.y, 9 * f.s, [255, 150, 50], 0.35 * p); cx.save(); cx.translate(f.x, f.y); cx.rotate(f.ph * 0.5); cx.fillStyle = `rgba(255,200,90,${0.9 * Math.min(1, f.age / 2)})`; cx.fillRect(-2 * f.s, -2 * f.s, 4 * f.s, 4 * f.s); cx.restore(); }
    else { glow(f.x, f.y, 9 * f.s, [150, 255, 200], 0.3 * p); cx.fillStyle = `rgba(225,255,235,${0.9 * Math.min(1, f.age / 2)})`; cx.beginPath(); cx.arc(f.x, f.y, 2 * f.s, 0, 6.283); cx.fill(); }
  }
  // portales
  for (const p of G.portals) {
    const nl = clamp(G.layer + p.dir, 0, LAYERS.length - 1);
    const c = p.dir > 0 ? [255, 120, 80] : [110, 190, 255];
    const pul = 1 + 0.12 * Math.sin(t * 2.2);
    glow(p.x, p.y, 80 * pul, c, 0.35);
    cx.strokeStyle = rgb(c, 0.7); cx.lineWidth = 2;
    for (let k = 0; k < 3; k++) { cx.beginPath(); cx.arc(p.x, p.y, (18 + k * 9) * pul, t * (k + 1) * 0.6 * p.dir, t * (k + 1) * 0.6 * p.dir + 4.2); cx.stroke(); }
    cx.fillStyle = rgb(envColor(LAYERS[nl].core).map(v => Math.min(255, v * 3)), 0.9); cx.beginPath(); cx.arc(p.x, p.y, 9, 0, 6.283); cx.fill();
  }
  cx.globalCompositeOperation = 'source-over';
  // presas (portadoras de genes)
  for (const p of G.prey) drawPrey(p);
  // ciliados
  for (const c of G.cils) drawCiliate(c);
  // hijas
  for (const d of G.daughters) { const al = Math.min(1, d.life / 3) * 0.7; cx.globalAlpha = al; const col = gColor(d.g); glow(d.x, d.y, 22, col, 0.3); capsule(d.x, d.y, d.a, 10, 5); cx.fillStyle = rgb(col, 0.8); cx.fill(); cx.globalAlpha = 1; }
  drawPlayer();
  // fagos
  for (const v of G.phages) drawPhage(v);
  // partículas
  cx.globalCompositeOperation = 'lighter';
  for (const p of G.parts) { cx.fillStyle = rgb(p.col, p.life / p.max * 0.9); cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.283); cx.fill(); }
  cx.globalCompositeOperation = 'source-over';
}
function drawPrey(p) {
  const T = TRAITS[p.tr], c = hexRgb(T.col);
  cx.globalCompositeOperation = 'lighter'; glow(p.x, p.y, 26, c, 0.28); cx.globalCompositeOperation = 'source-over';
  cx.fillStyle = rgb(c, 0.75); cx.strokeStyle = rgb(c, 1); cx.lineWidth = 1.2;
  if (p.shape === 0) { cx.beginPath(); cx.arc(p.x, p.y, 5.5, 0, 6.283); cx.fill(); cx.beginPath(); cx.arc(p.x + 8, p.y + 2, 4.5, 0, 6.283); cx.fill(); }
  else if (p.shape === 1) { capsule(p.x, p.y, p.a, 12, 4.5); cx.fill(); }
  else if (p.shape === 2) { cx.save(); cx.translate(p.x, p.y); cx.rotate(p.a); cx.lineWidth = 5; cx.lineCap = 'round'; cx.strokeStyle = rgb(c, 0.8); cx.beginPath(); cx.arc(0, 8, 10, -Math.PI * 0.75, -Math.PI * 0.25); cx.stroke(); cx.restore(); }
  else { cx.save(); cx.translate(p.x, p.y); cx.rotate(p.a); cx.lineWidth = 3; cx.lineCap = 'round'; cx.strokeStyle = rgb(c, 0.85); cx.beginPath(); for (let i = -12; i <= 12; i += 2) cx.lineTo(i, Math.sin(i * 0.5 + p.ph * 6) * 3); cx.stroke(); cx.restore(); }
  // flagelo
  cx.strokeStyle = rgb(c, 0.4); cx.lineWidth = 0.8; cx.beginPath();
  for (let i = 0; i < 10; i++) { const d = 8 + i * 2; cx.lineTo(p.x - Math.cos(p.a) * d + Math.cos(p.a + 1.57) * Math.sin(p.ph * 12 - i) * 2, p.y - Math.sin(p.a) * d + Math.sin(p.a + 1.57) * Math.sin(p.ph * 12 - i) * 2); }
  cx.stroke();
}
function drawCiliate(c) {
  cx.save(); cx.translate(c.x, c.y); cx.rotate(c.a);
  cx.globalCompositeOperation = 'lighter'; glow(0, 0, 60, [170, 210, 230], 0.12); cx.globalCompositeOperation = 'source-over';
  cx.fillStyle = 'rgba(190,220,235,0.18)'; cx.strokeStyle = 'rgba(210,235,250,0.55)'; cx.lineWidth = 1.2;
  cx.beginPath(); cx.ellipse(0, 0, 36, 22, 0, 0, 6.283); cx.fill(); cx.stroke();
  // cilios
  cx.strokeStyle = 'rgba(210,235,250,0.35)'; cx.lineWidth = 0.8; cx.beginPath();
  for (let i = 0; i < 40; i++) { const q = i / 40 * 6.283, w = Math.sin(G.t * 9 + i * 0.7) * 0.25; const x0 = Math.cos(q) * 36, y0 = Math.sin(q) * 22; cx.moveTo(x0, y0); cx.lineTo(x0 + Math.cos(q + w) * 7, y0 + Math.sin(q + w) * 7); }
  cx.stroke();
  // surco oral, macronúcleo, vacuolas
  cx.strokeStyle = 'rgba(230,245,255,0.5)'; cx.beginPath(); cx.arc(22, 0, 10, 2.2, 4.1); cx.stroke();
  cx.fillStyle = 'rgba(200,220,255,0.25)'; cx.beginPath(); cx.ellipse(-6, 2, 11, 6, 0.3, 0, 6.283); cx.fill();
  cx.fillStyle = c.full > 0 ? 'rgba(255,200,120,0.6)' : 'rgba(255,255,255,0.25)';
  for (let i = 0; i < 4; i++) { cx.beginPath(); cx.arc(-18 + i * 7, -8 + (i % 2) * 14, 2.5, 0, 6.283); cx.fill(); }
  cx.restore();
}
function drawPhage(v) {
  const al = clamp(v.life + 2, 0, 1);
  cx.save(); cx.translate(v.x, v.y); cx.rotate(v.a - Math.PI / 2); cx.globalAlpha = al;
  cx.strokeStyle = 'rgba(160,255,215,0.9)'; cx.fillStyle = 'rgba(120,255,200,0.25)'; cx.lineWidth = 1;
  if (LAYERS[G.layer].phage === 'lemon') { // virus en forma de limón (tipo SSV1 de Sulfolobus)
    cx.beginPath(); cx.ellipse(0, 0, 4, 7, 0, 0, 6.283); cx.fill(); cx.stroke();
    cx.beginPath(); cx.moveTo(0, 7); cx.lineTo(0, 11); cx.moveTo(-2, 11); cx.lineTo(2, 11); cx.stroke();
  } else { // fago con cola (Caudovirales)
    cx.beginPath(); for (let i = 0; i < 6; i++) { const q = i / 6 * 6.283; cx.lineTo(Math.cos(q) * 5, -6 + Math.sin(q) * 5); } cx.closePath(); cx.fill(); cx.stroke();
    cx.beginPath(); cx.moveTo(0, -1); cx.lineTo(0, 7); for (let k = -1; k <= 1; k += 2) { cx.moveTo(0, 7); cx.lineTo(k * 5, 11 + Math.sin(G.t * 8) * 1); cx.moveTo(0, 7); cx.lineTo(k * 2.5, 12); } cx.stroke();
  }
  cx.restore(); cx.globalAlpha = 1;
}
function drawPlayer() {
  const segs = G.segs, t = G.t, w = clamp(G.w, 0, 1);
  const dorm = G.mode === 'dorm';
  const stressed = G.w < 0.35 && G.mode !== 'title';
  // brillo
  cx.globalCompositeOperation = 'lighter';
  for (let i = segs.length - 1; i >= 0; i--) { const s = segs[i]; glow(s.x, s.y, i === 0 ? 40 : 30, gColor(s.g), (0.15 + 0.25 * w) * (dorm ? 0.5 : 1)); }
  cx.globalCompositeOperation = 'source-over';
  // flagelo en la cola
  const tl = segs[segs.length - 1];
  cx.strokeStyle = rgb(gColor(tl.g), 0.5); cx.lineWidth = 1.2; cx.beginPath();
  for (let i = 0; i < 18; i++) { const d = 8 + i * 2.6, wv = Math.sin(t * 14 - i * 0.6) * (1 + i * 0.25); cx.lineTo(tl.x - Math.cos(tl.a) * d + Math.cos(tl.a + 1.57) * wv, tl.y - Math.sin(tl.a) * d + Math.sin(tl.a + 1.57) * wv); }
  cx.stroke();
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i], col = gColor(s.g);
    const br = 1 + 0.06 * Math.sin(t * 3 - i * 0.5);
    const len = (i === 0 ? 14 : 12) * br, rad = (i === 0 ? 6.5 : 5.2) * br;
    capsule(s.x, s.y, s.a, len, rad);
    let fill = col;
    if (s.inf) fill = mix(col, [40, 70, 60], clamp((t - s.inf) / 3.5, 0, 1));
    cx.fillStyle = rgb(fill, dorm ? 0.5 : 0.85); cx.fill();
    cx.strokeStyle = stressed ? `rgba(255,${120 + 80 * Math.sin(t * 6)},120,0.8)` : rgb(mix(col, [255, 255, 255], 0.5), 0.9);
    cx.lineWidth = 1.3; cx.stroke();
    // nucleoide
    cx.fillStyle = 'rgba(255,255,255,0.35)'; cx.beginPath(); cx.ellipse(s.x, s.y, len * 0.22, rad * 0.35, s.a, 0, 6.283); cx.fill();
    // mutante pendiente: anillo iridiscente
    if (s.mut) {
      const mc = gColor(s.mut.g), k = (t - s.mut.t0) / 3.5;
      cx.strokeStyle = rgb(mc, 0.9); cx.lineWidth = 1.5; cx.beginPath(); cx.arc(s.x, s.y, 12 + 3 * Math.sin(t * 8), -Math.PI / 2, -Math.PI / 2 + k * 6.283); cx.stroke();
    }
    if (s.inf) { cx.fillStyle = 'rgba(140,255,210,0.8)'; for (let k = 0; k < 4; k++) { cx.beginPath(); cx.arc(s.x + Math.cos(t * 3 + k * 1.6) * 3, s.y + Math.sin(t * 3 + k * 1.6) * 2, 1, 0, 6.283); cx.fill(); } }
  }
  // pili en la cabeza
  const h = segs[0];
  cx.strokeStyle = rgb(gColor(h.g), 0.5); cx.lineWidth = 0.7; cx.beginPath();
  for (let k = -2; k <= 2; k++) { const q = h.a + k * 0.35; cx.moveTo(h.x + Math.cos(q) * 9, h.y + Math.sin(q) * 7); cx.lineTo(h.x + Math.cos(q) * (15 + Math.sin(t * 4 + k) * 1.5), h.y + Math.sin(q) * (13 + Math.sin(t * 4 + k))); }
  cx.stroke();
  if (dorm) { cx.strokeStyle = 'rgba(255,245,220,0.9)'; cx.lineWidth = 2.5; cx.beginPath(); cx.ellipse(h.x, h.y, 11, 8, h.a, 0, 6.283); cx.stroke(); }
}

// ---------- HUD ----------
function drawHUD() {
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const e = G.env || envAt(G.segs[0].x, G.segs[0].y), s = T_();
  // vignette
  const vg = cx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,6,0.55)'); cx.fillStyle = vg; cx.fillRect(0, 0, W, H);
  if (G.trans) { const k = G.t - G.trans.t0; const a = k < 1.6 ? sstep(0.6, 1.6, k) : 1 - sstep(1.6, 2.8, k); cx.fillStyle = `rgba(230,245,255,${a * 0.9})`; cx.fillRect(0, 0, W, H); }
  if (G.mode === 'title') return;
  // indicadores de portal fuera de pantalla
  for (const p of G.portals) {
    const sx = (p.x - G.cam.x) * G.cam.z + W / 2, sy = (p.y - G.cam.y) * G.cam.z + H / 2;
    if (sx > 0 && sx < W && sy > 0 && sy < H) continue;
    const a = Math.atan2(sy - H / 2, sx - W / 2), m = 26;
    const ex = clamp(W / 2 + Math.cos(a) * W, m, W - m), ey = clamp(H / 2 + Math.sin(a) * H, m, H - m);
    cx.save(); cx.translate(ex, ey); cx.rotate(a); cx.fillStyle = p.dir > 0 ? 'rgba(255,140,100,0.55)' : 'rgba(120,190,255,0.5)';
    cx.beginPath(); cx.moveTo(8, 0); cx.lineTo(-5, -6); cx.lineTo(-2, 0); cx.lineTo(-5, 6); cx.fill(); cx.restore();
  }
  const u = U, pw = 168 * u, ph = 46 * u, x0 = 14 * u;
  let y0 = H - 14 * u - ph * 3 - 8 * u * 2;
  const rows = [['T', s.temp, e.T], ['pH', s.ph, e.pH], ['S', s.salt, e.S]];
  cx.font = `${11 * u}px system-ui, sans-serif`;
  for (const [a, lab, v] of rows) {
    const A = AXES[a];
    cx.fillStyle = 'rgba(0,8,16,0.35)'; rr(x0, y0, pw, ph, 8 * u); cx.fill();
    const gx = x0 + 8 * u, gw = pw - 16 * u, gy = y0 + ph - 7 * u, gh = ph - 22 * u;
    const col = gColor(G.g);
    cx.beginPath(); cx.moveTo(gx, gy);
    for (let i = 0; i <= 60; i++) { const xv = A.min + (A.max - A.min) * i / 60; cx.lineTo(gx + gw * i / 60, gy - gh * perf(a, xv, G.g, G.off)); }
    cx.lineTo(gx + gw, gy); cx.closePath(); cx.fillStyle = rgb(col, 0.28); cx.fill(); cx.strokeStyle = rgb(col, 0.8); cx.lineWidth = 1; cx.stroke();
    const vx = gx + gw * clamp((v - A.min) / (A.max - A.min), 0, 1), pv = perf(a, v, G.g, G.off);
    cx.strokeStyle = 'rgba(255,255,255,0.65)'; cx.beginPath(); cx.moveTo(vx, gy); cx.lineTo(vx, gy - gh - 2 * u); cx.stroke();
    cx.fillStyle = pv > 0.6 ? '#9dffb0' : pv > 0.25 ? '#ffd66b' : '#ff7a7a';
    cx.beginPath(); cx.arc(vx, gy - gh * pv, 3.2 * u, 0, 6.283); cx.fill();
    cx.fillStyle = 'rgba(220,240,255,0.7)'; cx.textAlign = 'left'; cx.fillText(lab, x0 + 8 * u, y0 + 13 * u);
    cx.textAlign = 'right'; cx.fillStyle = 'rgba(255,255,255,0.9)'; cx.fillText(fmt(a, v), x0 + pw - 8 * u, y0 + 13 * u);
    y0 += ph + 8 * u;
  }
  // aptitud + amplitud de nicho (abajo derecha)
  const cxr = W - 46 * u, cyr = H - 52 * u, rad = 26 * u, w = clamp(G.w, 0, 1.3);
  cx.lineWidth = 4 * u; cx.strokeStyle = 'rgba(255,255,255,0.1)'; cx.beginPath(); cx.arc(cxr, cyr, rad, 0, 6.283); cx.stroke();
  cx.strokeStyle = w > 0.6 ? '#9dffb0' : w > 0.25 ? '#ffd66b' : '#ff7a7a'; cx.lineCap = 'round';
  cx.beginPath(); cx.arc(cxr, cyr, rad, -Math.PI / 2, -Math.PI / 2 + 6.283 * clamp(w, 0, 1)); cx.stroke(); cx.lineCap = 'butt';
  // biomasa (próxima división)
  cx.strokeStyle = 'rgba(200,255,230,0.45)'; cx.lineWidth = 2 * u; cx.beginPath(); cx.arc(cxr, cyr, rad - 6 * u, -Math.PI / 2, -Math.PI / 2 + 6.283 * clamp(G.biomass, 0, 1)); cx.stroke();
  cx.fillStyle = 'rgba(220,240,255,0.7)'; cx.textAlign = 'center'; cx.font = `${10 * u}px system-ui, sans-serif`; cx.fillText(s.fitness, cxr, cyr + 3 * u);
  // barra especialista–generalista
  const bx = W - 230 * u, by = H - 28 * u, bw = 140 * u;
  const b = clamp((breadth(G.g) + 0.6) / 1.6, 0, 1);
  cx.fillStyle = 'rgba(255,255,255,0.12)'; rr(bx, by, bw, 4 * u, 2 * u); cx.fill();
  cx.fillStyle = '#cfe9ff'; cx.beginPath(); cx.arc(bx + bw * b, by + 2 * u, 5 * u, 0, 6.283); cx.fill();
  cx.fillStyle = 'rgba(220,240,255,0.55)'; cx.font = `${10 * u}px system-ui, sans-serif`;
  cx.textAlign = 'left'; cx.fillText(s.spec, bx, by - 6 * u); cx.textAlign = 'right'; cx.fillText(s.gen, bx + bw, by - 6 * u);
  cx.textAlign = 'center'; cx.fillStyle = 'rgba(220,240,255,0.35)'; cx.fillText(s.breadth, bx + bw / 2, by + 16 * u);
  // profundidad (arriba izquierda)
  for (let i = 0; i < LAYERS.length; i++) {
    cx.fillStyle = i === G.layer ? '#fff' : i <= G.deepest ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)';
    cx.beginPath(); cx.arc(20 * u, (22 + i * 14) * u, (i === G.layer ? 4 : 2.5) * u, 0, 6.283); cx.fill();
  }
  cx.textAlign = 'left'; cx.fillStyle = 'rgba(220,240,255,0.6)'; cx.font = `${12 * u}px system-ui, sans-serif`;
  cx.fillText(LAYERS[G.layer].name[lang], 34 * u, (22 + G.layer * 14 + 4) * u);
  // íconos de genes adquiridos
  let gx2 = 34 * u; const gy2 = (22 + G.layer * 14 + 18) * u;
  for (const tr of G.traits) { cx.fillStyle = TRAITS[tr].col; cx.beginPath(); cx.arc(gx2, gy2, 3.5 * u, 0, 6.283); cx.fill(); gx2 += 10 * u; }
}
function rr(x, y, w, h, r) { cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); }

// ---------- mapa del nicho ----------
let mapEnd = false;
function openMap(end) { mapEnd = end; document.body.classList.add('mapopen'); if (!end) G.prevMode = G.mode; G.mode = end ? 'end' : 'map'; $('endui').style.display = end ? 'flex' : 'none'; if (end) fillEnd(); }
function closeMap() { if (G.mode === 'map') G.mode = 'play'; document.body.classList.remove('mapopen'); }
function fillEnd() {
  const s = T_(), st = G.stats;
  $('endui').innerHTML = `<div class="st"><b>${st.sweeps}</b> ${s.sweeps} · <b>${st.purged}</b> ${s.purged} · <b>${st.genes}</b> ${s.genes} · <b>${st.desc}</b> ${s.desc}</div><button id="bAgain">${s.again}</button>`;
  $('bAgain').onclick = ev => { ev.stopPropagation(); $('endui').style.display = 'none'; document.body.classList.remove('mapopen'); G.mode = 'play'; enterLayer(0); };
}
function drawMap() {
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  cx.fillStyle = 'rgba(2,8,16,0.95)'; cx.fillRect(0, 0, W, H);
  const s = T_(), u = U;
  const m = { l: 70 * u, r: 30 * u, t: 78 * u, b: (mapEnd ? 190 : 120) * u };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const X = v => m.l + pw * v / 13, Y = v => m.t + ph * (1 - (v + 25) / 150);
  const e = G.env || { T: 20, pH: 7, S: 0 };
  // campo de aptitud
  const col = gColor(G.g), N = 70, M = 60;
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const pH = (i + 0.5) / N * 13, T = -25 + (j + 0.5) / M * 150;
    const f = fitness(G.g, { T, pH, S: e.S }, G.off);
    if (f < 0.03) continue;
    cx.fillStyle = rgb(col, Math.min(0.7, Math.pow(f, 0.7) * 0.6));
    cx.fillRect(X(i / N * 13), Y(-25 + (j + 1) / M * 150), pw / N + 1, ph / M + 1);
  }
  // ejes
  cx.strokeStyle = 'rgba(255,255,255,0.15)'; cx.lineWidth = 1; cx.font = `${10 * u}px system-ui, sans-serif`; cx.fillStyle = 'rgba(220,240,255,0.5)';
  for (let p = 0; p <= 13; p++) { cx.beginPath(); cx.moveTo(X(p), Y(-25)); cx.lineTo(X(p), Y(-21)); cx.stroke(); cx.textAlign = 'center'; cx.fillText(p, X(p), Y(-25) + 14 * u); }
  for (let T = -20; T <= 120; T += 20) { cx.beginPath(); cx.moveTo(X(0) - 4, Y(T)); cx.lineTo(X(13), Y(T)); cx.strokeStyle = 'rgba(255,255,255,0.05)'; cx.stroke(); cx.textAlign = 'right'; cx.fillText(T + ' °C', X(0) - 8, Y(T) + 3); }
  cx.textAlign = 'center'; cx.fillText('pH', X(6.5), Y(-25) + 30 * u);
  // 0 °C y 100 °C
  cx.setLineDash([4, 6]); cx.strokeStyle = 'rgba(160,210,255,0.25)';
  for (const T of [0, 100]) { cx.beginPath(); cx.moveTo(X(0), Y(T)); cx.lineTo(X(13), Y(T)); cx.stroke(); }
  cx.setLineDash([]);
  // capas
  const boxes = [{ x: X(G.g.pH.m) - 6 * u, y: Y(G.g.T.m) - 18 * u, w: 30 * u, h: 24 * u }];
  LAYERS.forEach((L, i) => {
    const x = X(L.core.pH), y = Y(L.core.T);
    boxes.push({ x: x - 7 * u, y: y - 16 * u, w: 24 * u, h: 23 * u });
    cx.fillStyle = i <= G.deepest ? rgb(envColor(L.core).map(v => Math.min(255, v * 3))) : 'rgba(255,255,255,0.2)';
    cx.save(); cx.translate(x, y); cx.rotate(Math.PI / 4); cx.fillRect(-5 * u, -5 * u, 10 * u, 10 * u); cx.restore();
    cx.fillStyle = 'rgba(255,255,255,0.75)'; cx.textAlign = 'left'; cx.fillText(i + 1, x + 8 * u, y - 6 * u);
  });
  // organismos reales
  cx.font = `italic ${10 * u}px Georgia, serif`;
  const hit = b => boxes.some(q => b.x < q.x + q.w && b.x + b.w > q.x && b.y < q.y + q.h && b.y + b.h > q.y);
  for (const o of ORGS) {
    const x = X(o.pH), y = Y(o.T), txt = o.n + (o.note ? '  ' + o.note : ''), tw = cx.measureText(txt).width, th = 11 * u;
    cx.fillStyle = 'rgba(255,240,200,0.9)'; cx.beginPath(); cx.arc(x, y, 3 * u, 0, 6.283); cx.fill();
    const cand = [[6, -th / 2 + 2], [-6 - tw, -th / 2 + 2], [6, -th - 3], [6, 4], [-6 - tw, -th - 3], [-6 - tw, 4], [6, -2 * th - 3], [6, th + 4]];
    let pick = null;
    for (const [dx, dy] of cand) { const b = { x: x + dx * (dx > 0 ? u : 1), y: y + dy, w: tw, h: th }; if (b.x < 4 || b.x + b.w > W - 4) continue; if (!hit(b)) { pick = b; break; } }
    if (!pick) pick = { x: x + 6 * u, y: y - th / 2 + 2, w: tw, h: th };
    boxes.push(pick);
    cx.fillStyle = 'rgba(255,240,200,0.62)'; cx.textAlign = 'left'; cx.fillText(txt, pick.x, pick.y + th - 2);
  }
  // trayectoria
  if (G.trail.length > 1) {
    cx.lineWidth = 1.5 * u;
    for (let i = 1; i < G.trail.length; i++) {
      const a = G.trail[i - 1], b = G.trail[i];
      cx.strokeStyle = `rgba(255,255,255,${0.15 + 0.6 * i / G.trail.length})`;
      cx.beginPath(); cx.moveTo(X(a.pH), Y(a.T)); cx.lineTo(X(b.pH), Y(b.T)); cx.stroke();
    }
  }
  // tú y aquí-ahora
  cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(X(G.g.pH.m), Y(G.g.T.m), 5 * u, 0, 6.283); cx.fill();
  cx.font = `${11 * u}px system-ui, sans-serif`; cx.textAlign = 'left'; cx.fillText(s.you, X(G.g.pH.m) + 8 * u, Y(G.g.T.m) - 6 * u);
  const ex = X(clamp(e.pH, 0, 13)), ey = Y(clamp(e.T, -25, 125));
  cx.strokeStyle = '#ff9a7a'; cx.lineWidth = 2 * u; cx.beginPath(); cx.moveTo(ex - 6 * u, ey - 6 * u); cx.lineTo(ex + 6 * u, ey + 6 * u); cx.moveTo(ex + 6 * u, ey - 6 * u); cx.lineTo(ex - 6 * u, ey + 6 * u); cx.stroke();
  // banda de sal
  const sy = H - m.b + 50 * u, sx = m.l, sw = pw, sh = 28 * u;
  cx.beginPath(); cx.moveTo(sx, sy + sh);
  for (let i = 0; i <= 80; i++) { const v = 35 * i / 80; cx.lineTo(sx + sw * i / 80, sy + sh - sh * perf('S', v, G.g, G.off)); }
  cx.lineTo(sx + sw, sy + sh); cx.fillStyle = rgb(col, 0.35); cx.fill();
  cx.strokeStyle = 'rgba(255,255,255,0.2)'; cx.beginPath(); cx.moveTo(sx, sy + sh); cx.lineTo(sx + sw, sy + sh); cx.stroke();
  cx.fillStyle = 'rgba(220,240,255,0.5)'; cx.font = `${10 * u}px system-ui, sans-serif`;
  for (let v = 0; v <= 35; v += 5) { cx.textAlign = 'center'; cx.fillText(v + ' %', sx + sw * v / 35, sy + sh + 13 * u); }
  cx.textAlign = 'right'; cx.fillText('NaCl', sx - 8 * u, sy + sh - 4 * u);
  cx.font = `italic ${9.5 * u}px Georgia, serif`;
  const saltOrgs = ORGS.filter(o => o.S >= 10); saltOrgs.forEach((o, i) => { const x = sx + sw * o.S / 35; cx.fillStyle = 'rgba(255,240,200,0.9)'; cx.beginPath(); cx.arc(x, sy + sh, 2.5 * u, 0, 6.283); cx.fill(); cx.fillStyle = 'rgba(255,240,200,0.55)'; cx.textAlign = 'center'; cx.fillText(o.n.split(' ')[0], x, sy - 4 * u - (i % 2) * 11 * u); });
  cx.strokeStyle = '#ff9a7a'; cx.beginPath(); const esx = sx + sw * clamp(e.S, 0, 35) / 35; cx.moveTo(esx, sy); cx.lineTo(esx, sy + sh); cx.stroke();
  // títulos
  cx.textAlign = 'left'; cx.fillStyle = '#fff'; cx.font = `300 ${24 * u}px system-ui, sans-serif`;
  cx.fillText(mapEnd ? s.endT : s.nicheMap, m.l, 38 * u);
  cx.font = `${11 * u}px system-ui, sans-serif`; cx.fillStyle = 'rgba(220,240,255,0.55)';
  cx.fillText(mapEnd ? s.endS + '  ·  ' + s.trail + ': ─' : s.nicheSub, m.l, 58 * u);
  if (!mapEnd) { cx.textAlign = 'right'; cx.fillText(s.close + ' (N)', W - m.r, 38 * u); }
}

// ---------- bucle ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt);
  drawBg(); drawWorld(); drawHUD();
  if (G.mode === 'map' || G.mode === 'end') drawMap();
  requestAnimationFrame(frame);
}
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  U = clamp(Math.min(W, H) / 720, 0.72, 1.25);
  G.motes = []; for (let i = 0; i < 90; i++) G.motes.push({ x: rnd(0, W * 3), y: rnd(0, H * 3), z: rnd(0.15, 0.7), r: rnd(0.5, 1.8) });
}
addEventListener('resize', resize);

// ---------- guardado ----------
function save() { try { localStorage.setItem('nicho_save', JSON.stringify({ layer: G.layer, g: G.g, traits: [...G.traits], deepest: G.deepest, stats: G.stats, trail: G.trail.slice(-300), seen: G.seen })); } catch (e) {} }
function load() { try { return JSON.parse(localStorage.getItem('nicho_save') || 'null'); } catch (e) { return null; } }

// ---------- interfaz DOM ----------
function applyLang() {
  const s = T_();
  document.documentElement.lang = lang;
  $('tTitle').textContent = s.title; $('tSub').textContent = s.sub; $('tStart').textContent = s.start; $('tHint').textContent = s.hint;
  $('bLang').textContent = lang === 'es' ? 'EN' : 'ES';
  $('bInfo').title = s.sources; $('bMap').title = s.nicheMap;
  const sv = load(); $('tNew').style.display = sv && sv.layer > 0 ? 'inline-block' : 'none';
  $('tNew').textContent = lang === 'es' ? 'nuevo linaje' : 'new lineage';
  $('infoBody').innerHTML = `<h3>${lang === 'es' ? 'Cómo se juega' : 'How to play'}</h3>
    <p>${lang === 'es'
      ? 'Nada con el cursor (o el dedo). Come partículas para crecer: cada división puede traer una mutación al azar, y el ambiente decide si se queda (barrido selectivo) o se pierde. Come otras bacterias para adquirir sus genes. Las curvas abajo a la izquierda son tu nicho: dónde creces en temperatura, pH y sal. El orbe rojo lleva a un ambiente más extremo; el azul, de vuelta. N abre el mapa del nicho.'
      : 'Swim with the cursor (or your finger). Eat particles to grow: each division may bring a random mutation, and the environment decides whether it stays (selective sweep) or is lost. Eat other bacteria to acquire their genes. The curves at the bottom left are your niche: where you grow in temperature, pH and salt. The red orb leads to a more extreme environment; the blue one, back. N opens the niche map.'}</p>
    <h3>${lang === 'es' ? 'Fuentes' : 'Sources'}</h3><ol>${SOURCES.map(x => `<li>${x}</li>`).join('')}</ol>
    <p class="cred"><img src="img/logoMEL.svg" alt="MEL"><br>Microbial Ecophysiology Lab · Fundación Ciencia &amp; Vida · 2026</p>`;
}
$('bLang').onclick = e => { e.stopPropagation(); lang = lang === 'es' ? 'en' : 'es'; try { localStorage.setItem('nicho_lang', lang); } catch (er) {} applyLang(); if (G.mode !== 'title') showCard(); };
$('bSnd').onclick = e => { e.stopPropagation(); toggleSound(); };
$('bMap').onclick = e => { e.stopPropagation(); if (G.mode === 'play') openMap(false); else if (G.mode === 'map') closeMap(); };
$('bInfo').onclick = e => { e.stopPropagation(); $('info').classList.toggle('open'); };
$('info').onclick = e => { if (e.target.id === 'info') $('info').classList.remove('open'); };
$('tNew').onclick = e => { e.stopPropagation(); try { localStorage.removeItem('nicho_save'); } catch (er) {} startGame(true); };
$('title').onclick = () => startGame();

function startGame(fresh) {
  if (G.mode !== 'title') return;
  Sound.start();
  $('title').classList.add('gone');
  const sv = fresh ? null : load();
  G.g = newGenome(); G.traits = new Set(); G.trail = []; G.stats = { sweeps: 0, purged: 0, genes: 0, desc: 0 }; G.deepest = 0; G.seen = {};
  let L0 = 0;
  if (sv && sv.g) { G.g = clampG(sv.g); G.traits = new Set(sv.traits || []); G.deepest = sv.deepest || 0; G.stats = sv.stats || G.stats; G.trail = sv.trail || []; G.seen = sv.seen || {}; L0 = sv.layer || 0; }
  G.off = { T: 0, pH: 0, S: 0 }; G.biomass = 0; G.grace = 10;
  G.mode = 'play'; resetPlayer(4, 0, 0); enterLayer(L0);
  setTimeout(() => cap('intro'), 2500);
}

// arranque: modo atracción en la charca
resize(); applyLang();
resetPlayer(6, 0, 0); G.layer = 0;
for (let i = 0; i < 70; i++) spawnFood(true);
for (let i = 0; i < 8; i++) spawnPrey();
G.cils.push({ x: 400, y: 300, a: 2, full: 0, ph: 0 });
requestAnimationFrame(frame);
window.NICHO = G; window.NICHO_DBG = { enterLayer, openMap, closeMap, gainTrait, divide, startTrans, endGame, envAt }; // para depurar
})();
