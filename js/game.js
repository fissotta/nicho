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
const R_WORLD = 1700, MAXSEG = 14;
let SPACING = 15;

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
  ph: { flag: 0, pili: 0, spike: 0, size: 0 }, doses: {}, vir: [], fungi: [], carb: [], nextWave: 60,
  need: [], pulse: -9, spawnT: -9, trapped: false, visited: new Set(), start: 'neutro',
  mass: 3, muts: [], inside: [], omv: [], omvT: 3,
};
const maxSeg = () => MAXSEG + 2 * G.ph.size;
// unicelular (una sola célula que crece y se complejiza) vs cianobacteria filamentosa (suma células)
const isCyano = () => G.start === 'ciano';
const maxMass = () => 12 + 2 * G.ph.size;
const units = () => isCyano() ? G.segs.length : G.mass;
const cellSz = () => 1 + 0.12 * G.ph.size;
const cellL = () => (15 + G.mass * 4.4) * cellSz();
const cellR = () => (7 + G.mass * 0.85) * cellSz();
const traitsOf = k => Object.keys(TRAITS).filter(t => TRAITS[t].kind === k && t !== 'litho');
const pick = a => a[Math.floor(Math.random() * a.length)];
const evoLevel = () => G.ph.flag + G.ph.pili + G.ph.spike + G.ph.size;
function resetPlayer(n, x, y) {
  G.segs = []; G.muts = [];
  if (!isCyano()) { G.mass = n; n = 1; }
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
  const len = isCyano() ? Math.max(3, Math.min(G.segs.length || 4, maxSeg())) : Math.max(3, Math.min(G.mass || 3, maxMass()));
  resetPlayer(len, 0, 0);
  G.cam.x = 0; G.cam.y = 0;
  for (let i = 0; i < 70; i++) spawnFood(true);
  for (let i = 0; i < 10; i++) spawnPrey();
  for (let i = 0; i < L.cil; i++) G.cils.push({ x: rnd(-1200, 1200), y: rnd(-1200, 1200), a: rnd(0, 6.3), full: 0, ph: rnd(0, 9) });
  G.vir = []; G.carb = []; G.fungi = [];
  for (let i = 0; i < (L.fungi || 0); i++) {
    let fx, fy, ok, tries = 0;
    do { const fa = rnd(0, 6.283), fr = rnd(450, 1100); fx = Math.cos(fa) * fr; fy = Math.sin(fa) * fr;
      ok = G.portals.every(q => Math.hypot(q.x - fx, q.y - fy) > 500) && G.fungi.every(f => Math.hypot(f.x - fx, f.y - fy) > 600); } while (!ok && ++tries < 30);
    G.fungi.push(makeFungus(fx, fy));
  }
  G.nextWave = G.t + rnd(45, 65); G.visited.add(n);
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
function pickTrait() {
  const L = LAYERS[G.layer];
  if (Math.random() < 0.55) return pick(L.prey);
  return pick(Object.keys(TRAITS).filter(t => t !== 'litho' || L.food === 'litho'));
}
// presas: portadoras de genes (color = familia) o de rasgos de forma (doradas)
function spawnPrey(o) {
  o = o || {}; const L = LAYERS[G.layer];
  let x = o.x, y = o.y;
  if (x == null) { const a = rnd(0, 6.283), r = rnd(380, 1350); x = Math.cos(a) * r; y = Math.sin(a) * r; }
  const body = o.body !== undefined ? o.body : null;
  G.prey.push({ x, y, a: o.a != null ? o.a : rnd(0, 6.3), tr: body ? null : (o.tr || pickTrait()), body,
    shape: pick(L.shapes || [0, 1, 2, 3]), ph: rnd(0, 9), sp: o.sp || rnd(28, 46), wave: !!o.wave, life: o.life || 0, age: 0 });
}
function makeFungus(x0, y0) {
  const segs = [], tips = [], stack = [{ x: x0, y: y0, a: rnd(0, 6.283), d: 0 }];
  for (let k = 0; k < 3; k++) stack.push({ x: x0, y: y0, a: k * 2.1 + rnd(0, 1), d: 0 });
  let br = 0;
  while (stack.length && segs.length < 260) {
    const t = stack.pop(); let { x, y, a } = t;
    const steps = Math.floor(rnd(5, 11));
    for (let i = 0; i < steps; i++) { a += rnd(-0.22, 0.22); const nx = x + Math.cos(a) * 12, ny = y + Math.sin(a) * 12; segs.push([x, y, nx, ny]); x = nx; y = ny; }
    if (t.d < 4) { const nb = Math.random() < 0.65 ? 2 : 1; for (let k = 0; k < nb; k++) stack.push({ x, y, a: a + rnd(-0.9, 0.9), d: t.d + 1 }); }
    else tips.push({ x, y, a, ph: rnd(0, 6) });
    br++;
  }
  let rad = 0; for (const q of segs) rad = Math.max(rad, Math.hypot(q[2] - x0, q[3] - y0));
  return { x: x0, y: y0, segs, tips, rad };
}
function nearHypha(x, y, d) {
  for (const f of G.fungi) {
    if (Math.hypot(x - f.x, y - f.y) > f.rad + d) continue;
    for (const q of f.segs) {
      const vx = q[2] - q[0], vy = q[3] - q[1], k = clamp(((x - q[0]) * vx + (y - q[1]) * vy) / (vx * vx + vy * vy), 0, 1);
      const dx = x - (q[0] + vx * k), dy = y - (q[1] + vy * k);
      if (dx * dx + dy * dy < d * d) return f;
    }
  }
  return null;
}
function startWave() {
  const head = G.segs[0];
  const kinds = ['heat', 'cold', 'acid', 'alk', 'salt', 'broad', 'shield'];
  const k = G.need.length && Math.random() < 0.6 ? pick(G.need) : pick(kinds);
  const list = traitsOf(k); if (!list.length) return;
  const a = rnd(0, 6.283), dir = a + Math.PI, ox = head.x + Math.cos(a) * 760, oy = head.y + Math.sin(a) * 760;
  const n = Math.floor(rnd(14, 21));
  for (let i = 0; i < n; i++) {
    const pr = rnd(-200, 200), al = rnd(-160, 160);
    spawnPrey({ x: ox + Math.cos(dir + 1.57) * pr + Math.cos(dir) * al, y: oy + Math.sin(dir + 1.57) * pr + Math.sin(dir) * al, a: dir, tr: pick(list), wave: true, life: 38, sp: rnd(52, 62) });
  }
  if (Math.random() < 0.6) spawnPrey({ x: ox, y: oy, a: dir, body: pick(Object.keys(PHENO)), wave: true, life: 38, sp: 56 });
  note(`〰 ${T_().waveNote} · <b style="color:${KINDS[k].col}">${KINDS[k][lang]}</b>`); cap('wave');
  G.nextWave = G.t + rnd(70, 110);
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
  const pm = stressed ? 0.95 : 0.6;
  if (!isCyano()) {
    // una sola célula: crece y se complejiza; cada división deja una hija (posible mutante)
    const h = G.segs[0];
    if (G.mass < maxMass()) { G.mass++; cap('grow'); G.pulse2 = G.t; }
    else { G.daughters.push({ x: h.x, y: h.y, vx: -Math.cos(h.a) * 40 + rnd(-20, 20), vy: -Math.sin(h.a) * 40 + rnd(-20, 20), g: G.g, life: 14, a: h.a }); G.stats.desc++; cap('daughter'); }
    if (G.muts.length < 3 && Math.random() < pm) G.muts.push({ g: mutate(G.g, stressed), t0: G.t, base: G.g, side: G.muts.length % 2 ? 1 : -1, k: G.muts.length });
    return;
  }
  let seg;
  if (G.segs.length < maxSeg()) {
    const t = G.segs[G.segs.length - 1];
    seg = { x: t.x - Math.cos(t.a) * SPACING, y: t.y - Math.sin(t.a) * SPACING, a: t.a, g: G.g, mut: null, inf: 0, sw: 0, ng: null, born: G.t, het: G.segs.length % 6 === 5 };
    G.segs.push(seg);
    cap('growC'); if (seg.het) cap('hetero');
  } else {
    const t = G.segs[G.segs.length - 1];
    G.daughters.push({ x: t.x, y: t.y, vx: -Math.cos(t.a) * 40 + rnd(-20, 20), vy: -Math.sin(t.a) * 40 + rnd(-20, 20), g: G.g, life: 14, a: t.a, fil: 1 });
    G.stats.desc++; cap('daughter');
    seg = G.segs[1 + Math.floor(Math.random() * (G.segs.length - 1))];
  }
  const pendings = G.segs.filter(s => s.mut).length;
  if (seg && !seg.mut && pendings < 3 && Math.random() < pm) seg.mut = { g: mutate(G.g, stressed), t0: G.t, base: G.g };
}
function mutPos(m) { // posición de la hija mutante que acompaña a la célula
  const h = G.segs[0], L = cellL(), q = h.a + Math.PI + m.side * (0.55 + 0.25 * m.k);
  const d = L / 2 + cellR() * 0.6 + 6 + Math.sin(G.t * 2 + m.k) * 1.5;
  return { x: h.x + Math.cos(q) * d, y: h.y + Math.sin(q) * d, a: h.a + m.side * 0.3 };
}
function resolveMutants() {
  const list = isCyano() ? G.segs.map((s, i) => s.mut ? { m: s.mut, s, i } : null).filter(Boolean) : G.muts.map(m => ({ m, s: null, i: 0 }));
  for (const it of list) {
    const m = it.m; if (G.t - m.t0 < 3.5) continue;
    const pos = it.s ? it.s : mutPos(m);
    if (it.s) it.s.mut = null; else G.muts.splice(G.muts.indexOf(m), 1);
    if (m.base !== G.g) { // otra mutación ganó antes: interferencia clonal
      burst(pos.x, pos.y, gColor(m.g), 8, 40, 0.8); G.stats.purged++;
      cap('clonal', lang === 'es' ? 'Interferencia clonal: dos mutaciones compitieron y solo una ganó.' : 'Clonal interference: two mutations competed and only one won.');
      continue;
    }
    const w0 = avgFit(G.g), w1 = avgFit(m.g), ratio = w1 / (w0 + 1e-9);
    if (ratio > 1.04 || (ratio > 0.97 && Math.random() < 0.5)) {
      const neutral = ratio <= 1.04;
      sweep(m.g, it.i); burst(pos.x, pos.y, gColor(m.g), 14, 70, 1);
      if (neutral) cap('drift'); else cap('sweep');
      if (!neutral && G.minW < 0.2 && avgFit(G.g) > 0.3) { cap('rescue'); G.minW = 1; }
    } else {
      G.stats.purged++; Sound.purge(); burst(pos.x, pos.y, gColor(m.g), 10, 50, 1); cap('purge');
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
  const kind = T.kind; G.doses[kind] = (G.doses[kind] || 0) + 1;
  if (G.traits.has(tr)) { if (!applyDose(kind)) G.biomass += 0.6; else cap('dose'); return; }
  G.traits.add(tr); G.stats.genes++;
  const g = cloneG(G.g), d = T.d;
  if (d.Tm) g.T.m += d.Tm; if (d.Ts) g.T.s += d.Ts; if (d.pHm) g.pH.m += d.pHm; if (d.pHs) g.pH.s += d.pHs; if (d.Sm) g.S.m += d.Sm; if (d.Ss) g.S.s += d.Ss;
  clampG(g); sweep(g, 0); G.stats.sweeps--;
  cap('hgt'); addInside('p', T.col); addInside('g', T.col); cap('plasmid');
  const tx = T[lang]; cap(null, `<b style="color:${T.col}">${tx[0]}</b> — ${tx[1]}`);
  G.biomass += 0.5;
}
// dosis: cada célula de un color empuja tu nicho un poco más en esa dirección
function applyDose(kind) {
  const d = KINDS[kind].dose; if (!d) return false;
  const g = cloneG(G.g);
  if (d === 'broad') { let worst = 'T', wp = 2; for (const a of AX) { const p = perf(a, G.env[a], G.g, G.off); if (p < wp) { wp = p; worst = a; } } g[worst].s *= 1.1; }
  else { if (d.Tm) g.T.m += d.Tm; if (d.pHm) g.pH.m += d.pHm; if (d.Sm) g.S.m += d.Sm; }
  clampG(g); sweep(g, 0); G.stats.sweeps--; G.biomass += 0.3; addInside('g', KINDS[kind].col); return true;
}
function gainPheno(k, x, y) {
  const P = PHENO[k]; Sound.gene(); burst(x, y, [255, 214, 110], 30, 110, 1.6);
  if (G.ph[k] >= P.max) { G.biomass += 0.8; return; }
  G.ph[k]++; G.stats.genes++; G.pulse = G.t;
  if (k === 'size') SPACING = 15 * (1 + 0.1 * G.ph.size);
  cap('pheno'); cap(null, `<b style="color:#ffd166">${P[lang][0]}</b> — ${P[lang][1]}`);
  save();
}
// contenido de la célula: gránulos de color (genes), plásmidos (anillos), que flotan dentro
function addInside(k, col) {
  G.inside.push({ k, col, u: rnd(-0.6, 0.6), v: rnd(-0.5, 0.5), vu: 0, vv: 0, rot: rnd(0, 6), seg: Math.floor(Math.random() * 99) });
  const g = G.inside.filter(o => o.k === 'g'); if (g.length > 26) G.inside.splice(G.inside.indexOf(g[0]), 1);
  const pl = G.inside.filter(o => o.k === 'p'); if (pl.length > 8) G.inside.splice(G.inside.indexOf(pl[0]), 1);
}
function loseUnit(col) {
  if (isCyano()) return loseSeg(G.segs.length - 1, col);
  if (G.mass <= 1) return false;
  G.mass--; const h = G.segs[0]; burst(h.x, h.y, col || gColor(G.g), 14, 60, 1.2); Sound.hurt(); return true;
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
  if (G.mode === 'title') { onTitle(); return; }
  if (G.mode === 'map') { closeMap(); return; }
  if (G.mode === 'play' && G.dashCd <= 0) { G.dash = 0.7; G.dashCd = 1.4; }
});
cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') G.ptr = null; });
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); G.keys[k] = true;
  if (G.mode === 'title' && (k === ' ' || k === 'enter')) { onTitle(); return; }
  if (G.mode === 'choose' && '1234'.includes(k)) { chooseStart(Object.keys(STARTS)[+k - 1]); return; }
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
  const auto = G.mode === 'title' || G.mode === 'choose';
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
  // qué familia de genes te ayudaría aquí (guía de color)
  G.need = [];
  for (const a of AX) {
    if (perf(a, e[a], G.g, G.off) > 0.6) continue;
    const d = e[a] - (G.g[a].m + G.off[a]);
    G.need.push(a === 'T' ? (d > 0 ? 'heat' : 'cold') : a === 'pH' ? (d < 0 ? 'acid' : 'alk') : (d > 0 ? 'salt' : 'broad'));
  }
  if (!auto && G.mode === 'play' && G.stressT > 3) for (const k of G.need) {
    const K = KINDS[k]; cap('need_' + k, T_().cap.need.replace('{k}', K[lang]).replace('{c}', K.col).replace('{n}', K.cn[lang]));
  }
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
        if (units() > 1) { loseUnit(); cap('lyse'); }
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
    if (G.t > G.nextWave) startWave();
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
  let sp = (95 + Math.min(units(), 12) * 4) * (0.45 + 0.55 * clamp(G.w, 0, 1)) * (1 + 0.14 * G.ph.flag);
  G.trapped = !auto && !!nearHypha(head.x, head.y, 11 + 2 * G.ph.size);
  if (G.trapped) { sp *= G.ph.flag >= 3 ? 0.7 : 0.4; cap('fungi'); }
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
    const fr = isCyano() ? 0 : cellL() / 2;
    const mouth = { x: head.x + Math.cos(head.a) * fr, y: head.y + Math.sin(head.a) * fr };
    const er = 18 + 7 * G.ph.pili + (isCyano() ? 0 : cellR() * 0.6), mag = G.ph.pili ? 40 + 28 * G.ph.pili : 0;
    for (const arr of [G.food, G.carb]) if (mag) for (const f of arr) {
      const dx = mouth.x - f.x, dy = mouth.y - f.y, d = Math.hypot(dx, dy);
      if (d < mag && d > 1) { const v = (60 + 20 * G.ph.pili) * dt / d; f.x += dx * v; f.y += dy * v; }
    }
    for (let i = G.carb.length - 1; i >= 0; i--) {
      const f = G.carb[i];
      if ((f.x - mouth.x) ** 2 + (f.y - mouth.y) ** 2 < er * er) {
        G.biomass += 0.26 * 2.2 * (0.35 + 0.65 * clamp(G.w, 0, 1)); Sound.eat(); burst(f.x, f.y, [255, 200, 120], 6, 35, 0.7);
        G.carb.splice(i, 1); cap('carbon');
      }
    }
    for (let i = G.food.length - 1; i >= 0; i--) {
      const f = G.food[i];
      if ((f.x - mouth.x) ** 2 + (f.y - mouth.y) ** 2 < er * er) {
        let gain = 0.26 * (0.35 + 0.65 * clamp(G.w, 0, 1));
        if (f.litho) gain *= G.traits.has('litho') ? 2 : 0.6;
        G.biomass += gain; Sound.eat(); burst(f.x, f.y, f.litho ? [255, 170, 70] : [200, 255, 220], 5, 30, 0.6);
        G.food.splice(i, 1);
        if (!G.seen.intro) cap('intro');
      }
    }
    for (let i = G.prey.length - 1; i >= 0; i--) {
      const p = G.prey[i];
      if ((p.x - mouth.x) ** 2 + (p.y - mouth.y) ** 2 < (er + 3) ** 2) {
        G.prey.splice(i, 1);
        if (p.body) gainPheno(p.body, p.x, p.y); else gainTrait(p.tr, p.x, p.y);
        if (p.shape === 4 || p.shape === 5) cap('archaea');
      }
    }
    if (isCyano()) { G.biomass += dt * 0.035 * clamp(G.w, 0, 1); if (G.t > 20) cap('photo'); }
    // vesículas de membrana (OMV) que brotan de la superficie
    G.omvT -= dt * (0.6 + units() * 0.08);
    if (G.omvT <= 0) { G.omvT = rnd(2.5, 4.5); const sg = pick(G.segs), q = rnd(0, 6.283), rr = isCyano() ? 7 : cellR();
      G.omv.push({ x: sg.x + Math.cos(q) * rr, y: sg.y + Math.sin(q) * rr, vx: Math.cos(q) * 14, vy: Math.sin(q) * 14, life: 4, r: rnd(1.6, 2.8) }); if (G.t > 40) cap('omv'); }
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
  for (let i = G.prey.length - 1; i >= 0; i--) {
    const p = G.prey[i]; p.age += dt;
    if (p.wave) { p.life -= dt; if (p.life <= 0) { G.prey.splice(i, 1); continue; } }
  }
  for (const p of G.prey) {
    p.ph += dt; p.a += Math.sin(p.ph * 0.7) * dt * (p.wave ? 0.15 : 0.8);
    const d = Math.hypot(p.x - head.x, p.y - head.y);
    let sp = p.sp;
    if (!auto && d < 170 && units() >= 2) { p.a += angDiff(p.a, Math.atan2(p.y - head.y, p.x - head.x)) * dt * 3; sp *= 1.6; }
    if (Math.hypot(p.x, p.y) > R_WORLD - 100) p.a += angDiff(p.a, Math.atan2(-p.y, -p.x)) * dt * 2;
    p.x += Math.cos(p.a) * sp * dt; p.y += Math.sin(p.a) * sp * dt;
  }
  let nNorm = 0, nBody = 0; for (const p of G.prey) if (!p.wave) { nNorm++; if (p.body) nBody++; }
  if (nBody < 2) spawnPrey({ body: pick(Object.keys(PHENO)) });
  else if (nNorm < 12) spawnPrey();
  // carbono que exudan las hifas
  for (const f of G.fungi) {
    if (G.carb.filter(c => c.f === f).length < 16 && Math.random() < dt * 1.2) {
      const q = pick(f.segs); G.carb.push({ x: (q[0] + q[2]) / 2 + rnd(-7, 7), y: (q[1] + q[3]) / 2 + rnd(-7, 7), ph: rnd(0, 9), age: 0, f });
    }
  }
  for (const c of G.carb) { c.ph += dt; c.age += dt; }
  for (const f of G.fungi) for (const tp of f.tips) tp.ph += dt;
  // virus libres que derivan y se degradan
  if (G.vir.length < 6 && Math.random() < dt * 0.5) {
    const a = rnd(0, 6.283), r = rnd(250, 700);
    G.vir.push({ x: head.x + Math.cos(a) * r, y: head.y + Math.sin(a) * r, a: rnd(0, 6.3), life: rnd(14, 30), ph: rnd(0, 9), decay: 0, kind: pick(['tail', 'fil', 'ico', LAYERS[G.layer].phage]) });
  }
  for (let i = G.vir.length - 1; i >= 0; i--) {
    const v = G.vir[i]; v.ph += dt; v.a += dt * 0.2; v.x += Math.cos(v.ph * 0.3) * 6 * dt; v.y += Math.sin(v.ph * 0.25) * 6 * dt;
    v.life -= dt; if (v.life <= 0) { v.decay += dt; if (v.decay > 0.1 && v.decay < 0.2 && onScreen(v.x, v.y)) cap('vdecay'); }
    if (v.decay > 2.6 || Math.hypot(v.x - head.x, v.y - head.y) > 1600) G.vir.splice(i, 1);
  }
  // ciliados (pastoreo)
  for (const c of G.cils) {
    c.ph += dt; c.full = Math.max(0, c.full - dt);
    const tail = G.segs[G.segs.length - 1];
    const d = Math.hypot(tail.x - c.x, tail.y - c.y), cr = isCyano() ? 0 : cellR();
    const small = units() < 6 && !G.traits.has('capsule') && !G.ph.spike && G.ph.size < 2;
    let sp = 40;
    if (!auto && G.mode === 'play' && d < 400 && c.full <= 0 && units() > 1) {
      if (small) { c.a += angDiff(c.a, Math.atan2(tail.y - c.y, tail.x - c.x)) * dt * 2; sp = 82; }
      else if (d < 220) cap('big');
    } else c.a += Math.sin(c.ph * 0.4) * dt * 0.6;
    if (Math.hypot(c.x, c.y) > R_WORLD - 150) c.a += angDiff(c.a, Math.atan2(-c.y, -c.x)) * dt * 2;
    c.x += Math.cos(c.a) * sp * dt; c.y += Math.sin(c.a) * sp * dt;
    if (!auto && small && c.full <= 0 && d < 28 + cr && units() > 1) { loseUnit(); c.full = 10; cap('graze'); }
  }
  // fagos: "kill the winner" — aparecen cuando tu linaje es abundante
  if (!auto && G.mode === 'play') {
    const abund = units() + Math.min(G.stats.desc, 10) * 0.4;
    if (abund >= 9) {
      G.phageT -= dt;
      if (G.phageT <= 0 && G.phages.length < 5) {
        G.phageT = clamp(16 - abund * 0.6, 4, 14);
        const a = rnd(0, 6.283); G.phages.push({ x: head.x + Math.cos(a) * 650, y: head.y + Math.sin(a) * 650, life: 30, ph: rnd(0, 9), a: 0, decay: 0 });
      }
    }
  }
  for (let i = G.phages.length - 1; i >= 0; i--) {
    const v = G.phages[i]; v.life -= dt; v.ph += dt;
    if (v.decay) { v.decay += dt; v.x += Math.cos(v.ph) * 6 * dt; v.y += Math.sin(v.ph) * 6 * dt; if (v.decay > 2.6) G.phages.splice(i, 1); continue; }
    if (v.life <= 0 || Math.hypot(v.x - head.x, v.y - head.y) > 950) { v.decay = 0.001; if (onScreen(v.x, v.y)) cap('vdecay'); continue; }
    let best = null, bd = 1e9;
    for (let j = isCyano() ? 1 : 0; j < G.segs.length; j++) { const s = G.segs[j]; const d = (s.x - v.x) ** 2 + (s.y - v.y) ** 2; if (d < bd && !s.inf) { bd = d; best = s; } }
    if (best && v.life > 0) {
      const a = Math.atan2(best.y - v.y, best.x - v.x); v.a = a;
      v.x += (Math.cos(a) * 62 + Math.sin(v.ph * 3) * 20) * dt; v.y += (Math.sin(a) * 62 + Math.cos(v.ph * 3) * 20) * dt;
      if (bd < (13 + (isCyano() ? 0 : cellR())) ** 2) {
        G.phages.splice(i, 1);
        if (G.traits.has('crispr')) { burst(v.x, v.y, [80, 255, 210], 16, 70, 0.9); Sound.gene(); cap('crispr'); }
        else if (G.ph.spike && Math.random() < 0.22 * G.ph.spike) { burst(v.x, v.y, [255, 230, 160], 10, 60, 0.8); cap('slayer'); }
        else { best.inf = G.t; cap('phage'); }
        continue;
      }
    } else { v.x += Math.cos(v.ph) * 10 * dt; v.y += Math.sin(v.ph) * 10 * dt; }
  }
  for (let j = G.segs.length - 1; j >= 0; j--) {
    const s = G.segs[j];
    if (s.inf && G.t - s.inf > 3.5) {
      const x = s.x, y = s.y;
      if (isCyano()) loseSeg(j, [120, 255, 200]); else { s.inf = 0; loseUnit([120, 255, 200]); loseUnit([120, 255, 200]); }
      for (let k = 0; k < 1 && G.phages.length < 7; k++) G.phages.push({ x: x + rnd(-8, 8), y: y + rnd(-8, 8), life: 5, ph: rnd(0, 9), a: 0, decay: 0 });
    }
  }
  for (let i = G.omv.length - 1; i >= 0; i--) { const o = G.omv[i]; o.life -= dt; o.x += o.vx * dt; o.y += o.vy * dt; o.vx *= 0.97; o.vy *= 0.97; if (o.life <= 0) G.omv.splice(i, 1); }
  for (const o of G.inside) { // movimiento browniano suave dentro de la célula
    o.vu += rnd(-1, 1) * dt * 0.6; o.vv += rnd(-1, 1) * dt * 0.6; o.vu *= 0.96; o.vv *= 0.96; o.u += o.vu * dt; o.v += o.vv * dt; o.rot += dt * 0.5;
    if (Math.abs(o.u) > 0.75) { o.u = Math.sign(o.u) * 0.75; o.vu *= -1; } if (Math.abs(o.v) > 0.55) { o.v = Math.sign(o.v) * 0.55; o.vv *= -1; }
  }
  // hijas
  for (let i = G.daughters.length - 1; i >= 0; i--) { const d = G.daughters[i]; d.life -= dt; d.x += d.vx * dt; d.y += d.vy * dt; d.a += dt * 0.3; if (d.life <= 0) G.daughters.splice(i, 1); }
  // partículas
  for (let i = G.parts.length - 1; i >= 0; i--) { const p = G.parts[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; if (p.life <= 0) G.parts.splice(i, 1); }
  updAmbient(dt);
  // cámara
  const zt = Math.min(W, H) / 820 * (1 - Math.min(units(), 18) * (isCyano() ? 0.011 : 0.007)) / (1 + 0.06 * G.ph.size);
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
function onScreen(x, y) { const sx = (x - G.cam.x) * G.cam.z + W / 2, sy = (y - G.cam.y) * G.cam.z + H / 2; return sx > 0 && sx < W && sy > 0 && sy < H; }
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
  drawFungi();
  for (const v of G.vir) drawPhage(v, v.kind);
  // presas (portadoras de genes)
  for (const p of G.prey) drawPrey(p);
  // ciliados
  for (const c of G.cils) drawCiliate(c);
  // hijas
  for (const d of G.daughters) { const al = Math.min(1, d.life / 3) * 0.7; cx.globalAlpha = al; const col = gColor(d.g); glow(d.x, d.y, 22, col, 0.3); capsule(d.x, d.y, d.a, 10, 5); cx.fillStyle = rgb(col, 0.8); cx.fill(); cx.globalAlpha = 1; }
  drawPlayer();
  // fagos
  for (const v of G.phages) drawPhage(v, null);
  for (const o of G.omv) { cx.strokeStyle = `rgba(220,255,240,${0.5 * o.life / 4})`; cx.lineWidth = 0.8; cx.beginPath(); cx.arc(o.x, o.y, o.r, 0, 6.283); cx.stroke(); }
  // partículas
  cx.globalCompositeOperation = 'lighter';
  for (const p of G.parts) { cx.fillStyle = rgb(p.col, p.life / p.max * 0.9); cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.283); cx.fill(); }
  cx.globalCompositeOperation = 'source-over';
}
function drawPrey(p) {
  const t = G.t, fade = p.wave ? Math.min(1, p.life / 3, p.age) : Math.min(1, p.age + 0.3);
  cx.globalAlpha = fade;
  if (p.body) { drawBodyPrey(p); cx.globalAlpha = 1; return; }
  const T = TRAITS[p.tr], c = hexRgb(T.col);
  const needed = G.need.includes(T.kind);
  cx.globalCompositeOperation = 'lighter'; glow(p.x, p.y, needed ? 34 : 26, c, needed ? 0.4 : 0.28); cx.globalCompositeOperation = 'source-over';
  if (needed) { cx.strokeStyle = rgb(c, 0.35 + 0.3 * Math.sin(t * 4 + p.ph)); cx.lineWidth = 1.2; cx.beginPath(); cx.arc(p.x, p.y, 17 + 2 * Math.sin(t * 4 + p.ph), 0, 6.283); cx.stroke(); }
  cx.fillStyle = rgb(c, 0.75); cx.strokeStyle = rgb(c, 1); cx.lineWidth = 1.2;
  cx.save(); cx.translate(p.x, p.y); cx.rotate(p.a);
  switch (p.shape) {
    case 0: cx.beginPath(); cx.arc(-4, 0, 5, 0, 6.283); cx.fill(); cx.beginPath(); cx.arc(5, 0, 4.5, 0, 6.283); cx.fill(); break; // diplococo
    case 1: cx.restore(); capsule(p.x, p.y, p.a, 12, 4.5); cx.fill(); cx.save(); cx.translate(p.x, p.y); cx.rotate(p.a); break; // bacilo
    case 2: cx.lineWidth = 5; cx.lineCap = 'round'; cx.strokeStyle = rgb(c, 0.8); cx.beginPath(); cx.arc(0, 8, 10, -Math.PI * 0.75, -Math.PI * 0.25); cx.stroke(); break; // vibrio
    case 3: cx.lineWidth = 3; cx.lineCap = 'round'; cx.strokeStyle = rgb(c, 0.85); cx.beginPath(); for (let i = -12; i <= 12; i += 2) cx.lineTo(i, Math.sin(i * 0.5 + p.ph * 6) * 3); cx.stroke(); break; // espirilo
    case 4: cx.rotate(Math.sin(p.ph * 0.5) * 0.2); cx.fillRect(-7, -7, 14, 14); cx.strokeRect(-7, -7, 14, 14); cx.fillStyle = 'rgba(255,255,255,0.35)'; for (let k = 0; k < 3; k++) cx.fillRect(-5 + k * 4, -4 + (k % 2) * 4, 2, 2); break; // arquea cuadrada (Haloquadratum)
    case 5: cx.beginPath(); for (let k = 0; k <= 24; k++) { const q = k / 24 * 6.283, r = 6.5 + 1.4 * Math.sin(q * 5 + p.ph); cx.lineTo(Math.cos(q) * r, Math.sin(q) * r); } cx.fill(); cx.stroke(); break; // coco lobulado (Sulfolobus)
    case 6: cx.beginPath(); for (let k = 0; k < 12; k++) { const q = k / 12 * 6.283, r = k % 2 ? 3 : 8; cx.lineTo(Math.cos(q) * r, Math.sin(q) * r); } cx.closePath(); cx.fill(); break; // Stella (estrella)
    default: for (let k = -2; k <= 2; k++) { cx.beginPath(); cx.arc(k * 6, Math.sin(p.ph * 3 + k) * 1.5, 3, 0, 6.283); cx.fill(); } // cadena (estreptococo)
  }
  cx.restore();
  // flagelo
  cx.strokeStyle = rgb(c, 0.4); cx.lineWidth = 0.8; cx.beginPath();
  for (let i = 0; i < 10; i++) { const d = 8 + i * 2; cx.lineTo(p.x - Math.cos(p.a) * d + Math.cos(p.a + 1.57) * Math.sin(p.ph * 12 - i) * 2, p.y - Math.sin(p.a) * d + Math.sin(p.a + 1.57) * Math.sin(p.ph * 12 - i) * 2); }
  cx.stroke(); cx.globalAlpha = 1;
}
// presas doradas: cada una muestra la pieza de forma que entrega
function drawBodyPrey(p) {
  const t = G.t, c = [255, 210, 100];
  cx.globalCompositeOperation = 'lighter'; glow(p.x, p.y, 38, c, 0.32 + 0.1 * Math.sin(t * 3 + p.ph)); cx.globalCompositeOperation = 'source-over';
  cx.save(); cx.translate(p.x, p.y); cx.rotate(p.a);
  cx.fillStyle = 'rgba(255,214,110,0.85)'; cx.strokeStyle = 'rgba(255,240,190,1)'; cx.lineWidth = 1.2;
  if (p.body === 'size') { cx.restore(); capsule(p.x, p.y, p.a, 20, 8); cx.fill(); cx.stroke(); cx.save(); cx.translate(p.x, p.y); cx.rotate(p.a); cx.fillStyle = 'rgba(255,255,255,0.4)'; for (let k = 0; k < 5; k++) { cx.beginPath(); cx.arc(-8 + k * 4, Math.sin(k * 2) * 3, 1.6, 0, 6.283); cx.fill(); } }
  else if (p.body === 'spike') { cx.beginPath(); cx.arc(0, 0, 6, 0, 6.283); cx.fill(); cx.stroke(); cx.beginPath(); for (let k = 0; k < 10; k++) { const q = k / 10 * 6.283 + t * 0.4; cx.moveTo(Math.cos(q) * 6, Math.sin(q) * 6); cx.lineTo(Math.cos(q) * 12, Math.sin(q) * 12); cx.arc(Math.cos(q) * 12 + Math.cos(q + 1.57) * 1.5, Math.sin(q) * 12 + Math.sin(q + 1.57) * 1.5, 1.5, q + 3.14, q + 6.28); } cx.stroke(); }
  else if (p.body === 'pili') { cx.beginPath(); cx.arc(0, 0, 6, 0, 6.283); cx.fill(); cx.beginPath(); for (let k = 0; k < 16; k++) { const q = k / 16 * 6.283; const l = 12 + 2 * Math.sin(t * 5 + k); cx.moveTo(Math.cos(q) * 6, Math.sin(q) * 6); cx.lineTo(Math.cos(q) * l, Math.sin(q) * l); } cx.lineWidth = 0.8; cx.stroke(); }
  else { cx.restore(); capsule(p.x, p.y, p.a, 12, 4.5); cx.fill(); cx.stroke(); cx.save(); cx.translate(p.x, p.y); cx.rotate(p.a); cx.lineWidth = 0.9; for (let f = -1; f <= 1; f++) { cx.beginPath(); for (let i = 0; i < 12; i++) { const d = 7 + i * 2.2; cx.lineTo(-d, f * (3 + i * 0.6) + Math.sin(t * 13 - i + f) * 1.8); } cx.stroke(); } }
  cx.restore();
  // destello
  const sp = 0.5 + 0.5 * Math.sin(t * 2.5 + p.ph);
  cx.strokeStyle = `rgba(255,250,220,${0.6 * sp})`; cx.lineWidth = 1; cx.beginPath();
  cx.moveTo(p.x - 16, p.y - 14); cx.lineTo(p.x - 10, p.y - 14); cx.moveTo(p.x - 13, p.y - 17); cx.lineTo(p.x - 13, p.y - 11); cx.stroke();
}
function drawFungi() {
  const t = G.t;
  for (const f of G.fungi) {
    if (!onScreen(f.x, f.y) && Math.hypot(f.x - G.cam.x, f.y - G.cam.y) > f.rad + W / G.cam.z) continue;
    cx.strokeStyle = 'rgba(236,226,200,0.32)'; cx.lineWidth = 2.4; cx.lineCap = 'round'; cx.beginPath();
    for (const q of f.segs) { cx.moveTo(q[0], q[1]); cx.lineTo(q[2], q[3]); } cx.stroke();
    cx.strokeStyle = 'rgba(255,248,225,0.18)'; cx.lineWidth = 5; cx.stroke();
    cx.fillStyle = 'rgba(255,245,220,0.4)'; // septos
    for (let i = 0; i < f.segs.length; i += 3) { const q = f.segs[i]; cx.beginPath(); cx.arc(q[2], q[3], 1.3, 0, 6.283); cx.fill(); }
    for (const tp of f.tips) { // ápices que crecen y conidios
      const k = 0.5 + 0.5 * Math.sin(tp.ph * 1.5);
      cx.fillStyle = `rgba(255,250,230,${0.4 + 0.4 * k})`; cx.beginPath(); cx.arc(tp.x, tp.y, 2.2 + k, 0, 6.283); cx.fill();
      cx.fillStyle = 'rgba(210,230,190,0.35)';
      for (let j = 1; j <= 3; j++) { cx.beginPath(); cx.arc(tp.x + Math.cos(tp.a) * j * 5, tp.y + Math.sin(tp.a) * j * 5, 2.2, 0, 6.283); cx.fill(); }
    }
    cx.lineCap = 'butt';
  }
  if (G.trapped) { const h = G.segs[0]; cx.strokeStyle = 'rgba(255,245,215,0.6)'; cx.lineWidth = 1; cx.beginPath(); for (let k = 0; k < 5; k++) { const q = k * 1.26 + t; cx.moveTo(h.x + Math.cos(q) * 6, h.y + Math.sin(q) * 6); cx.quadraticCurveTo(h.x + Math.cos(q + 0.6) * 18, h.y + Math.sin(q + 0.6) * 18, h.x + Math.cos(q + 1.1) * 26, h.y + Math.sin(q + 1.1) * 26); } cx.stroke(); }
  cx.globalCompositeOperation = 'lighter';
  for (const c of G.carb) { const p = (0.7 + 0.3 * Math.sin(c.ph * 2)) * Math.min(1, c.age); glow(c.x, c.y, 10, [255, 190, 90], 0.4 * p); cx.fillStyle = `rgba(255,220,150,${0.9 * Math.min(1, c.age)})`; cx.beginPath(); cx.arc(c.x, c.y, 2.4, 0, 6.283); cx.fill(); }
  cx.globalCompositeOperation = 'source-over';
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
function drawPhage(v, kind) {
  kind = kind || v.kind || LAYERS[G.layer].phage;
  const dec = v.decay ? clamp(v.decay / 2.6, 0, 1) : 0;
  const al = (1 - dec) * (v.kind ? 0.55 : 1);
  cx.save(); cx.translate(v.x, v.y); cx.rotate(v.a - Math.PI / 2); cx.globalAlpha = al;
  cx.strokeStyle = 'rgba(160,255,215,0.9)'; cx.fillStyle = 'rgba(120,255,200,0.25)'; cx.lineWidth = 1;
  const sp = dec * 9; // al degradarse la cápside se abre y la cola se separa
  if (kind === 'lemon') { // virus en forma de limón (tipo SSV1 de Sulfolobus)
    cx.beginPath(); cx.ellipse(-sp * 0.5, 0, 4, 7, -dec, 0, 6.283); cx.fill(); cx.stroke();
    cx.beginPath(); cx.moveTo(sp, 7 + sp); cx.lineTo(sp, 11 + sp); cx.moveTo(sp - 2, 11 + sp); cx.lineTo(sp + 2, 11 + sp); cx.stroke();
  } else if (kind === 'fil') { // filamentoso (Inoviridae)
    cx.beginPath(); for (let i = -14; i <= 14; i += 2) cx.lineTo(Math.sin(i * 0.3 + G.t) * 2 + (i > 0 ? sp : -sp), i); cx.stroke();
  } else if (kind === 'ico') { // icosaédrico sin cola
    cx.beginPath(); for (let i = 0; i < 6; i++) { const q = i / 6 * 6.283; cx.lineTo(Math.cos(q) * 5 + Math.cos(q) * sp * 0.5, Math.sin(q) * 5 + Math.sin(q) * sp * 0.5); } cx.closePath(); cx.fill(); cx.stroke();
  } else { // fago con cola (Caudovirales)
    cx.beginPath(); for (let i = 0; i < 6; i++) { const q = i / 6 * 6.283; cx.lineTo(Math.cos(q) * 5 - sp * 0.4, -6 - sp + Math.sin(q) * 5); } cx.closePath(); cx.fill(); cx.stroke();
    cx.beginPath(); cx.moveTo(sp * 0.6, -1); cx.lineTo(sp * 0.6, 7); for (let k = -1; k <= 1; k += 2) { cx.moveTo(sp * 0.6, 7); cx.lineTo(sp * 0.6 + k * 5, 11 + Math.sin(G.t * 8) * 1); cx.moveTo(sp * 0.6, 7); cx.lineTo(sp * 0.6 + k * 2.5, 12); } cx.stroke();
  }
  if (dec > 0) { cx.fillStyle = 'rgba(180,255,220,0.7)'; for (let k = 0; k < 4; k++) { cx.beginPath(); cx.arc(Math.cos(k * 1.7) * sp * 1.3, Math.sin(k * 2.3) * sp * 1.3, 0.8, 0, 6.283); cx.fill(); } }
  cx.restore(); cx.globalAlpha = 1;
}
// cabeza que se vuelve más aguzada con la evolución de forma
function headPath(x, y, a, len, rad, pt) {
  cx.save(); cx.translate(x, y); cx.rotate(a); cx.beginPath();
  cx.moveTo(-len / 2, -rad); cx.lineTo(len / 2 * (1 - pt * 0.3), -rad * (1 - pt * 0.25));
  cx.quadraticCurveTo(len / 2 + rad * (1 + pt * 1.6), 0, len / 2 * (1 - pt * 0.3), rad * (1 - pt * 0.25));
  cx.lineTo(-len / 2, rad); cx.arc(-len / 2, 0, rad, Math.PI / 2, Math.PI * 1.5); cx.closePath(); cx.restore();
}
function drawPlayer() {
  if (!isCyano()) { drawCell(); return; }
  drawFilament();
}
// pseudo-azar estable para estructuras internas
const hsh = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
// ---- bacteria unicelular: una sola célula que crece y se vuelve más compleja ----
function drawCell() {
  const h = G.segs[0], t = G.t, w = clamp(G.w, 0, 1), P = G.ph, dorm = G.mode === 'dorm';
  const stressed = G.w < 0.35 && G.mode === 'play';
  const app = G.t - G.spawnT < 1.4 ? sstep(0, 1.4, G.t - G.spawnT) : 1;
  const L = cellL() * app * (1 + 0.04 * Math.sin(t * 2.2)), R = cellR() * app, col = gColor(h.g), lv = evoLevel();
  const pt = Math.min(1, lv / 6);
  // brillo
  cx.globalCompositeOperation = 'lighter';
  glow(h.x, h.y, (L * 0.8 + 26) * (1 + lv * 0.03), col, (0.16 + 0.2 * w + lv * 0.012) * (dorm ? 0.5 : 1));
  if (G.t - G.pulse < 1.6) { const k = (G.t - G.pulse) / 1.6; glow(h.x, h.y, L + 70 * k, [255, 214, 110], 0.5 * (1 - k)); }
  if (G.t - (G.pulse2 || -9) < 1) { const k = G.t - G.pulse2; glow(h.x, h.y, L * 0.7 + 40 * k, [220, 255, 240], 0.3 * (1 - k)); }
  cx.globalCompositeOperation = 'source-over';
  if (app < 1) { cx.strokeStyle = `rgba(230,255,245,${1 - app})`; cx.lineWidth = 2; for (let r = 0; r < 3; r++) { cx.beginPath(); cx.arc(h.x, h.y, (20 + r * 25) * app * 3, 0, 6.283); cx.stroke(); } }
  cx.save(); cx.translate(h.x, h.y); cx.rotate(h.a);
  // flagelos polares (cola): más flagelos = más rápido
  const nf = 1 + P.flag, fl = 16 + 4 * P.flag + G.mass;
  cx.strokeStyle = rgb(col, 0.55); cx.lineWidth = 1.2;
  for (let f = 0; f < nf; f++) {
    const off = (f - (nf - 1) / 2) * 0.3; cx.beginPath();
    for (let i = 0; i < fl; i++) { const d = L / 2 + R * 0.4 + i * 2.6, wv = Math.sin(t * (14 + P.flag) - i * 0.6 + f) * (1 + i * 0.25), aa = Math.PI + off * Math.min(1, i / 6); cx.lineTo(Math.cos(aa) * d + Math.cos(aa + 1.57) * wv, Math.sin(aa) * d + Math.sin(aa + 1.57) * wv); }
    cx.stroke();
  }
  // flagelos peritricos (laterales) desde nivel 2
  if (P.flag >= 2) { cx.strokeStyle = rgb(col, 0.3); cx.lineWidth = 0.8; const n = 2 + P.flag;
    for (let j = 0; j < n; j++) for (const sd of [-1, 1]) { const ux = (j / (n - 1) - 0.5) * L * 0.8; cx.beginPath(); for (let k = 0; k < 9; k++) { const d = R + k * 2.4; cx.lineTo(ux - k * 2.2 + Math.sin(t * 12 + k + j) * 1.2, sd * d); } cx.stroke(); } }
  // ganchos de capa S (tipo hami)
  if (P.spike) { cx.strokeStyle = 'rgba(255,240,200,0.6)'; cx.lineWidth = 0.9; cx.beginPath(); const n = P.spike * 5;
    for (let j = 0; j < n; j++) for (const sd of [-1, 1]) { const ux = (j / (n - 1) - 0.5) * L * 0.85, ex = ux - 1, ey = sd * (R + 4 + P.spike); cx.moveTo(ux, sd * R); cx.lineTo(ex, ey); cx.lineTo(ex + 2, ey + sd * 1.2); }
    cx.stroke(); }
  // cuerpo: envoltura (doble membrana desde masa 4)
  headPath(0, 0, 0, L, R, pt);
  let fill = col; if (h.inf) fill = mix(col, [40, 70, 60], clamp((t - h.inf) / 3.5, 0, 1) * 0.7);
  cx.fillStyle = rgb(fill, dorm ? 0.45 : 0.82); cx.fill();
  cx.strokeStyle = stressed ? `rgba(255,${120 + 80 * Math.sin(t * 6)},120,0.85)` : rgb(mix(col, [255, 255, 255], 0.55), 0.95); cx.lineWidth = 1.5; cx.stroke();
  if (G.mass >= 4) { headPath(0, 0, 0, L - 3, R - 2, pt); cx.strokeStyle = rgb(mix(col, [255, 255, 255], 0.3), 0.45); cx.lineWidth = 0.8; cx.stroke(); }
  // citoplasma
  cx.fillStyle = 'rgba(255,255,255,0.08)'; cx.beginPath(); cx.ellipse(0, 0, L * 0.42, R * 0.7, 0, 0, 6.283); cx.fill();
  // ribosomas
  cx.fillStyle = 'rgba(255,255,255,0.28)';
  for (let i = 0; i < 6 + G.mass * 4; i++) { cx.beginPath(); cx.arc((hsh(i, 1) - 0.5) * L * 0.8, (hsh(i, 2) - 0.5) * R * 1.4, 0.6, 0, 6.283); cx.fill(); }
  // nucleoide: ADN plegado que crece con la célula
  cx.strokeStyle = 'rgba(255,255,255,0.65)'; cx.lineWidth = 1.1; cx.beginPath();
  const nn = 40 + G.mass * 6;
  for (let i = 0; i <= nn; i++) { const q = i / nn * 6.283; const r1 = 1 + 0.35 * Math.sin(q * (5 + (G.mass % 4)) + t * 0.4) + 0.2 * Math.sin(q * 11); cx.lineTo(Math.cos(q) * L * 0.2 * r1, Math.sin(q) * R * 0.32 * r1); }
  cx.stroke();
  // gránulos de reserva (PHB / polifosfato)
  for (let i = 0; i < Math.floor(G.mass / 2); i++) { cx.fillStyle = i % 2 ? 'rgba(255,250,230,0.35)' : 'rgba(150,160,255,0.35)'; cx.beginPath(); cx.arc((hsh(i, 5) - 0.5) * L * 0.75, (hsh(i, 6) - 0.5) * R * 1.1, 1.4 + hsh(i, 7) * 1.8, 0, 6.283); cx.fill(); }
  // nódulos de genes (color) y plásmidos flotando dentro
  for (const o of G.inside) {
    const x = o.u * L * 0.5, y = o.v * R;
    if (o.k === 'p') { cx.strokeStyle = o.col; cx.globalAlpha = 0.85; cx.lineWidth = 1.1; cx.beginPath(); cx.ellipse(x, y, 3 + G.mass * 0.18, 2.2 + G.mass * 0.12, o.rot, 0, 6.283); cx.stroke(); cx.globalAlpha = 1; }
    else { cx.fillStyle = o.col; cx.globalAlpha = 0.9; cx.beginPath(); cx.arc(x, y, 1.5 + G.mass * 0.14, 0, 6.283); cx.fill(); cx.globalAlpha = 1; }
  }
  if (h.inf) { cx.fillStyle = 'rgba(140,255,210,0.8)'; for (let k = 0; k < 8; k++) { cx.beginPath(); cx.arc(Math.cos(t * 3 + k * 0.8) * L * 0.25, Math.sin(t * 3 + k * 1.6) * R * 0.5, 1, 0, 6.283); cx.fill(); } }
  // pili: la "boca"
  const np = 5 + 3 * P.pili, pl = 9 + 6 * P.pili;
  cx.strokeStyle = rgb(col, 0.55); cx.lineWidth = 0.7 + 0.15 * P.pili; cx.beginPath();
  for (let k = 0; k < np; k++) { const q = (k / (np - 1) - 0.5) * (1.6 + 0.25 * P.pili); const bx0 = L / 2 - 2 + Math.cos(q) * R * 0.6, by0 = Math.sin(q) * R * 0.9, r1 = pl + Math.sin(t * 4 + k) * 1.5; cx.moveTo(bx0, by0); cx.lineTo(bx0 + Math.cos(q) * r1, by0 + Math.sin(q) * r1); }
  cx.stroke();
  if (dorm) { cx.strokeStyle = 'rgba(255,245,220,0.9)'; cx.lineWidth = 2.5; cx.beginPath(); cx.ellipse(0, 0, L * 0.55, R * 1.1, 0, 0, 6.283); cx.stroke(); }
  cx.restore();
  if (P.pili) { cx.strokeStyle = 'rgba(255,255,255,0.05)'; cx.beginPath(); cx.arc(h.x + Math.cos(h.a) * L / 2, h.y + Math.sin(h.a) * L / 2, 40 + 28 * P.pili, 0, 6.283); cx.stroke(); }
  // hijas mutantes que brotan y esperan la selección
  for (const m of G.muts) {
    const p = mutPos(m), mc = gColor(m.g), k = (t - m.t0) / 3.5;
    cx.globalAlpha = Math.min(1, k * 3);
    capsule(p.x, p.y, p.a, 9 + G.mass * 1.1, 4 + G.mass * 0.3); cx.fillStyle = rgb(mc, 0.75); cx.fill(); cx.strokeStyle = rgb(mix(mc, [255, 255, 255], 0.5), 0.9); cx.lineWidth = 1; cx.stroke();
    cx.strokeStyle = rgb(mc, 0.9); cx.lineWidth = 1.4; cx.beginPath(); cx.arc(p.x, p.y, 10 + G.mass * 0.8, -Math.PI / 2, -Math.PI / 2 + k * 6.283); cx.stroke();
    cx.globalAlpha = 1;
  }
}
// ---- cianobacteria: filamento de células (con heterocistos), sin flagelos: se desliza ----
function drawFilament() {
  const segs = G.segs, t = G.t, w = clamp(G.w, 0, 1), P = G.ph;
  const dorm = G.mode === 'dorm';
  const stressed = G.w < 0.35 && G.mode === 'play';
  const sz = cellSz(), lv = evoLevel();
  const app = G.t - G.spawnT < 1.4 ? sstep(0, 1.4, G.t - G.spawnT) : 1;
  cx.globalCompositeOperation = 'lighter';
  for (let i = segs.length - 1; i >= 0; i--) { const s = segs[i]; glow(s.x, s.y, 30 * sz * (1 + lv * 0.03) * app, gColor(s.g), (0.13 + 0.2 * w + lv * 0.01) * (dorm ? 0.5 : 1) * Math.min(1, 2.4 / Math.sqrt(segs.length))); }
  if (G.t - G.pulse < 1.6) { const k = (G.t - G.pulse) / 1.6; for (const s of segs) glow(s.x, s.y, 20 + 60 * k, [255, 214, 110], 0.5 * (1 - k)); }
  cx.globalCompositeOperation = 'source-over';
  if (app < 1) { const h = segs[0]; cx.strokeStyle = `rgba(230,255,245,${1 - app})`; cx.lineWidth = 2; for (let r = 0; r < 3; r++) { cx.beginPath(); cx.arc(h.x, h.y, (20 + r * 25) * app * 3, 0, 6.283); cx.stroke(); } }
  // vaina de mucílago alrededor del filamento
  cx.strokeStyle = 'rgba(200,255,220,0.12)'; cx.lineWidth = 16 * sz; cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.beginPath();
  for (const s of segs) cx.lineTo(s.x, s.y); cx.stroke(); cx.lineCap = 'butt';
  if (P.flag) { const tl = segs[segs.length - 1]; cx.strokeStyle = rgb(gColor(tl.g), 0.45); cx.lineWidth = 1.1;
    for (let f = 0; f < P.flag; f++) { cx.beginPath(); for (let i = 0; i < 16; i++) { const d = 8 * sz + i * 2.6, aa = tl.a + (f - (P.flag - 1) / 2) * 0.3, wv = Math.sin(t * 14 - i * 0.6 + f) * (1 + i * 0.2); cx.lineTo(tl.x - Math.cos(aa) * d + Math.cos(aa + 1.57) * wv, tl.y - Math.sin(aa) * d + Math.sin(aa + 1.57) * wv); } cx.stroke(); } }
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i], col = s.het ? [235, 240, 170] : gColor(s.g);
    const br = (1 + 0.05 * Math.sin(t * 3 - i * 0.5)) * sz * app;
    const len = (s.het ? 14 : 12.5) * br, rad = (s.het ? 7.2 : 6.3) * br;
    if (P.spike) { cx.strokeStyle = 'rgba(255,240,200,0.55)'; cx.lineWidth = 0.8; cx.beginPath(); for (const sd of [-1, 1]) { const ca = Math.cos(s.a), sa = Math.sin(s.a), bx = s.x - sa * rad * sd, by = s.y + ca * rad * sd; cx.moveTo(bx, by); cx.lineTo(bx - sa * sd * (4 + P.spike), by + ca * sd * (4 + P.spike)); } cx.stroke(); }
    if (i === 0) headPath(s.x, s.y, s.a, len, rad, Math.min(1, lv / 6)); else capsule(s.x, s.y, s.a, len, rad);
    let fill = col; if (s.inf) fill = mix(col, [40, 70, 60], clamp((t - s.inf) / 3.5, 0, 1));
    cx.fillStyle = rgb(fill, dorm ? 0.5 : 0.85); cx.fill();
    cx.strokeStyle = stressed ? `rgba(255,${120 + 80 * Math.sin(t * 6)},120,0.8)` : rgb(mix(col, [255, 255, 255], 0.5), 0.9);
    cx.lineWidth = s.het ? 2 : 1.2; cx.stroke();
    cx.save(); cx.translate(s.x, s.y); cx.rotate(s.a);
    if (s.het) { // heterocisto: pared gruesa y nódulos polares
      cx.fillStyle = 'rgba(255,255,220,0.8)'; cx.beginPath(); cx.arc(-len / 2 - 0.5, 0, 1.6, 0, 6.283); cx.arc(len / 2 + 0.5, 0, 1.6, 0, 6.283); cx.fill();
    } else {
      // tilacoides (membranas fotosintéticas) y carboxisoma
      cx.strokeStyle = 'rgba(160,255,190,0.45)'; cx.lineWidth = 0.6;
      for (const k of [0.72, 0.5]) { cx.beginPath(); cx.ellipse(0, 0, len * 0.5 * k + rad * 0.3, rad * k, 0, 0, 6.283); cx.stroke(); }
      cx.strokeStyle = 'rgba(255,255,255,0.5)'; cx.beginPath(); for (let k = 0; k < 6; k++) { const q = k / 6 * 6.283; cx.lineTo(Math.cos(q) * 1.6 + 1, Math.sin(q) * 1.6); } cx.closePath(); cx.stroke();
      // vesículas de gas
      if (i % 3 === 1) { cx.fillStyle = 'rgba(255,255,255,0.25)'; cx.fillRect(-4, -rad * 0.55, 3, 1.2); cx.fillRect(-2, rad * 0.4, 3, 1.2); }
    }
    for (const o of G.inside) if (o.seg % segs.length === i) {
      const x = o.u * len * 0.45, y = o.v * rad * 0.8;
      if (o.k === 'p') { cx.strokeStyle = o.col; cx.lineWidth = 0.9; cx.beginPath(); cx.ellipse(x, y, 2.2, 1.6, o.rot, 0, 6.283); cx.stroke(); }
      else { cx.fillStyle = o.col; cx.beginPath(); cx.arc(x, y, 1.4, 0, 6.283); cx.fill(); }
    }
    cx.restore();
    if (s.mut) { const mc = gColor(s.mut.g), k = (t - s.mut.t0) / 3.5; cx.strokeStyle = rgb(mc, 0.9); cx.lineWidth = 1.5; cx.beginPath(); cx.arc(s.x, s.y, 12 * sz + 3 * Math.sin(t * 8), -Math.PI / 2, -Math.PI / 2 + k * 6.283); cx.stroke(); }
    if (s.inf) { cx.fillStyle = 'rgba(140,255,210,0.8)'; for (let k = 0; k < 4; k++) { cx.beginPath(); cx.arc(s.x + Math.cos(t * 3 + k * 1.6) * 3, s.y + Math.sin(t * 3 + k * 1.6) * 2, 1, 0, 6.283); cx.fill(); } }
  }
  if (dorm) { const h = segs[0]; cx.strokeStyle = 'rgba(255,245,220,0.9)'; cx.lineWidth = 2.5; cx.beginPath(); cx.ellipse(h.x, h.y, 11, 8, h.a, 0, 6.283); cx.stroke(); }
}


// ---------- indicadores de portales (subir / bajar de nicho) ----------
function portalInfo(p) {
  const nl = clamp(G.layer + p.dir, 0, LAYERS.length - 1), L = LAYERS[nl], s = T_();
  const last = p.dir > 0 && G.layer === LAYERS.length - 1;
  const wNext = last ? 1 : fitness(G.g, L.entry, null); // cómo te iría al llegar
  return {
    col: p.dir > 0 ? [255, 130, 90] : [120, 190, 255],
    glyph: p.dir > 0 ? '▼' : '▲',
    l1: (p.dir > 0 ? s.deeper : s.up) + ' · ' + (last ? s.endT : L.name[lang]),
    l2: last ? '' : `${fmt('T', L.core.T)} · pH ${fmt('pH', L.core.pH)} · ${fmt('S', L.core.S)}`,
    wc: wNext > 0.45 ? '#9dffb0' : wNext > 0.12 ? '#ffd66b' : '#ff7a7a',
    need: last ? [] : AX.filter(a => perf(a, L.core[a], G.g, null) < 0.5).map(a => { const d = L.core[a] - G.g[a].m; return a === 'T' ? (d > 0 ? 'heat' : 'cold') : a === 'pH' ? (d < 0 ? 'acid' : 'alk') : (d > 0 ? 'salt' : 'broad'); }),
  };
}
function drawPortalHints() {
  const u = U, head = G.segs[0], t = G.t;
  for (const p of G.portals) {
    const inf = portalInfo(p);
    const sx = (p.x - G.cam.x) * G.cam.z + W / 2, sy = (p.y - G.cam.y) * G.cam.z + H / 2;
    const dist = Math.hypot(p.x - head.x, p.y - head.y);
    const um = Math.round(dist * 0.15);
    const pul = 0.5 + 0.5 * Math.sin(t * 3 + p.dir);
    // brújula alrededor de la bacteria
    const hx = (head.x - G.cam.x) * G.cam.z + W / 2, hy = (head.y - G.cam.y) * G.cam.z + H / 2;
    const ha = Math.atan2(p.y - head.y, p.x - head.x), hr = 46 * G.cam.z + 10 * u;
    if (dist > 120) {
      cx.save(); cx.translate(hx + Math.cos(ha) * hr, hy + Math.sin(ha) * hr); cx.rotate(ha);
      cx.fillStyle = rgb(inf.col, 0.35 + 0.3 * pul);
      cx.beginPath(); cx.moveTo(9 * u, 0); cx.lineTo(-5 * u, -7 * u); cx.lineTo(-1 * u, 0); cx.lineTo(-5 * u, 7 * u); cx.fill(); cx.restore();
    }
    const on = sx > 30 && sx < W - 30 && sy > 30 && sy < H - 30;
    let bx, by;
    if (on) { bx = clamp(sx, 140 * u, W - 140 * u); by = sy + 44 * u * G.cam.z + 18 * u; if (by > H - 190 * u) by = sy - 44 * u * G.cam.z - 24 * u; }
    else {
      // insignia en el borde de la pantalla, en la dirección del portal
      const a = Math.atan2(sy - H / 2, sx - W / 2), mx = 30 * u, mtop = 70 * u, mbot = 190 * u;
      const k = Math.min(Math.abs((W / 2 - mx) / (Math.cos(a) || 1e-6)), Math.abs(((Math.sin(a) > 0 ? H / 2 - mbot : H / 2 - mtop)) / (Math.sin(a) || 1e-6)));
      const ex = W / 2 + Math.cos(a) * k, ey = H / 2 + Math.sin(a) * k;
      cx.globalCompositeOperation = 'lighter'; glow(ex, ey, 34 * u, inf.col, 0.25 + 0.2 * pul); cx.globalCompositeOperation = 'source-over';
      cx.fillStyle = 'rgba(2,10,18,0.6)'; cx.beginPath(); cx.arc(ex, ey, 15 * u, 0, 6.283); cx.fill();
      cx.strokeStyle = rgb(inf.col, 0.9); cx.lineWidth = 1.5 * u; cx.beginPath(); cx.arc(ex, ey, (15 + 3 * pul) * u, 0, 6.283); cx.stroke();
      cx.save(); cx.translate(ex, ey); cx.rotate(a); cx.fillStyle = rgb(inf.col, 0.95);
      cx.beginPath(); cx.moveTo(27 * u, 0); cx.lineTo(19 * u, -6 * u); cx.lineTo(19 * u, 6 * u); cx.fill(); cx.restore();
      cx.fillStyle = rgb(inf.col, 1); cx.font = `${13 * u}px system-ui, sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillText(inf.glyph, ex, ey + 1 * u); cx.textBaseline = 'alphabetic';
      // etiqueta hacia el centro
      const right = ex > W / 2;
      bx = ex + (right ? -1 : 1) * 0; by = ey + (ey < H / 2 ? 34 * u : -44 * u);
      if (Math.abs(ey - H / 2) < H / 2 - 120 * u) { bx = ex + (right ? -26 : 26) * u - (right ? 0 : 0); by = ey - 8 * u; cx.textAlign = right ? 'right' : 'left'; }
      else cx.textAlign = 'center';
      if (cx.textAlign === 'center') bx = clamp(ex, 120 * u, W - 120 * u);
    }
    if (on) cx.textAlign = 'center';
    // texto: destino, condiciones, distancia y aptitud esperada al llegar
    cx.font = `${12 * u}px system-ui, sans-serif`; cx.fillStyle = rgb(inf.col, 0.95);
    cx.shadowColor = 'rgba(0,0,0,0.8)'; cx.shadowBlur = 6;
    cx.fillText(`${inf.glyph} ${inf.l1}`, bx, by);
    cx.font = `${11 * u}px system-ui, sans-serif`; cx.fillStyle = 'rgba(225,240,255,0.75)';
    const l2 = (inf.l2 ? inf.l2 + '   ' : '') + um + ' µm';
    cx.fillText(l2, bx, by + 15 * u);
    // punto de aptitud prevista
    const tw = cx.measureText(l2).width, al = cx.textAlign;
    const dx = al === 'left' ? bx + tw + 8 * u : al === 'right' ? bx - tw - 8 * u : bx + tw / 2 + 8 * u;
    cx.fillStyle = inf.wc; cx.beginPath(); cx.arc(dx, by + 11 * u, 3.5 * u, 0, 6.283); cx.fill();
    // colores de genes que te faltan para ese nicho
    inf.need.forEach((k, j) => { const nx = al === 'right' ? dx - (12 + j * 10) * u : dx + (12 + j * 10) * u; cx.fillStyle = KINDS[k].col; cx.beginPath(); cx.arc(nx, by + 11 * u, 3.5 * u, 0, 6.283); cx.fill(); });
    cx.shadowBlur = 0;
  }
}

// ---------- HUD ----------
function drawHUD() {
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const e = G.env || envAt(G.segs[0].x, G.segs[0].y), s = T_();
  // vignette
  const vg = cx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,6,0.55)'); cx.fillStyle = vg; cx.fillRect(0, 0, W, H);
  if (G.trans) { const k = G.t - G.trans.t0; const a = k < 1.6 ? sstep(0.6, 1.6, k) : 1 - sstep(1.6, 2.8, k); cx.fillStyle = `rgba(230,245,255,${a * 0.9})`; cx.fillRect(0, 0, W, H); }
  if (G.mode === 'title' || G.mode === 'choose') return;
  drawPortalHints();
  const u = U, pw = 168 * u, ph = 46 * u, x0 = 14 * u;
  let y0 = H - 14 * u - ph * 3 - 8 * u * 2;
  const rows = [['T', s.temp, e.T], ['pH', s.ph, e.pH], ['S', s.salt, e.S]];
  cx.font = `${11 * u}px system-ui, sans-serif`;
  for (const [a, lab, v] of rows) {
    const A = AXES[a];
    cx.fillStyle = 'rgba(0,8,16,0.35)'; rr(x0, y0, pw, ph, 8 * u); cx.fill();
    const gx = x0 + 8 * u, gw = pw - 16 * u, gy = y0 + ph - 7 * u, gh = ph - 22 * u;
    const col = axisColor(a);
    const nk = G.need.find(k => KIND_AX[k] === a);
    if (nk) { const kc = hexRgb(KINDS[nk].col), pu = 0.5 + 0.5 * Math.sin(G.t * 4); cx.strokeStyle = rgb(kc, 0.4 + 0.5 * pu); cx.lineWidth = 1.5 * u; rr(x0, y0, pw, ph, 8 * u); cx.stroke();
      const gv = clamp((v - A.min) / (A.max - A.min), 0, 1), dirR = v > G.g[a].m + G.off[a];
      cx.fillStyle = rgb(kc, 0.9); cx.beginPath(); const ax0 = x0 + pw + 8 * u, ay0 = y0 + ph / 2; cx.arc(ax0 + 4 * u, ay0, 5 * u, 0, 6.283); cx.fill();
      cx.fillStyle = 'rgba(2,10,18,0.9)'; cx.font = `bold ${8 * u}px system-ui, sans-serif`; cx.textAlign = 'center'; cx.fillText(dirR ? '▶' : '◀', ax0 + 4 * u, ay0 + 3 * u); cx.font = `${11 * u}px system-ui, sans-serif`; }
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
  cx.font = `${9 * u}px system-ui, sans-serif`; cx.textAlign = 'left';
  for (const k in KINDS) { const n = G.doses[k] || 0; if (!n) continue; cx.fillStyle = KINDS[k].col; cx.beginPath(); cx.arc(gx2, gy2, 4 * u, 0, 6.283); cx.fill(); cx.fillStyle = 'rgba(230,245,255,0.7)'; cx.fillText(n, gx2 + 6 * u, gy2 + 3 * u); gx2 += (n > 9 ? 26 : 20) * u; }
  // rasgos de forma (fenotipo)
  let px2 = 34 * u; const py2 = gy2 + 16 * u, IC = { flag: '〰', pili: '✺', spike: '✦', size: '●' };
  for (const k in PHENO) { const n = G.ph[k]; if (!n) continue; cx.fillStyle = '#ffd166'; cx.font = `${11 * u}px system-ui, sans-serif`; cx.fillText(IC[k], px2, py2 + 4 * u);
    for (let j = 0; j < PHENO[k].max; j++) { cx.fillStyle = j < n ? '#ffd166' : 'rgba(255,214,110,0.2)'; cx.beginPath(); cx.arc(px2 + 16 * u + j * 6 * u, py2, 2 * u, 0, 6.283); cx.fill(); }
    px2 += (22 + PHENO[k].max * 6) * u; }
}
const KIND_AX = { heat: 'T', cold: 'T', acid: 'pH', alk: 'pH', salt: 'S', broad: 'S' };
// color de cada curva según hacia dónde se adaptó tu linaje (rojo calor, azul frío, amarillo ácido, violeta alcalino, rosa sal)
function axisColor(a) {
  const base = [120, 235, 170], m = G.g[a].m;
  if (a === 'T') return m >= 25 ? mix(base, hexRgb(KINDS.heat.col), clamp((m - 25) / 55, 0, 1)) : mix(base, hexRgb(KINDS.cold.col), clamp((25 - m) / 30, 0, 1));
  if (a === 'pH') return m <= 7 ? mix(base, hexRgb(KINDS.acid.col), clamp((7 - m) / 5, 0, 1)) : mix(base, hexRgb(KINDS.alk.col), clamp((m - 7) / 4, 0, 1));
  return mix(base, hexRgb(KINDS.salt.col), clamp(m / 22, 0, 1));
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
  cx.fillText(mapEnd ? s.endS.replace('{n}', G.visited.size).replace('{m}', LAYERS.length) + '  ·  ' + s.trail + ': ─' : s.nicheSub, m.l, 58 * u);
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
function save() { try { localStorage.setItem('nicho_save2', JSON.stringify({ layer: G.layer, g: G.g, traits: [...G.traits], deepest: G.deepest, stats: G.stats, trail: G.trail.slice(-300), seen: G.seen, ph: G.ph, doses: G.doses, visited: [...G.visited], start: G.start, mass: G.mass, inside: G.inside.map(o => ({ k: o.k, col: o.col })) })); } catch (e) {} }
function load() { try { return JSON.parse(localStorage.getItem('nicho_save2') || 'null'); } catch (e) { return null; } }

// ---------- interfaz DOM ----------
function applyLang() {
  const s = T_();
  document.documentElement.lang = lang;
  $('tTitle').textContent = s.title; $('tSub').textContent = s.sub; $('tStart').textContent = s.start; $('tHint').textContent = s.hint;
  $('bLang').textContent = lang === 'es' ? 'EN' : 'ES';
  $('bInfo').title = s.sources; $('bMap').title = s.nicheMap;
  const sv = load(); $('tNew').style.display = sv && sv.g ? 'inline-block' : 'none';
  $('tNew').textContent = lang === 'es' ? 'nuevo linaje' : 'new lineage';
  $('infoBody').innerHTML = `<h3>${lang === 'es' ? 'Cómo se juega' : 'How to play'}</h3>
    <p>${lang === 'es'
      ? 'Nada con el cursor (o el dedo). Come partículas para crecer: cada división puede traer una mutación al azar, y el ambiente decide si se queda (barrido selectivo) o se pierde. Come otras bacterias para adquirir sus genes. Las curvas abajo a la izquierda son tu nicho: dónde creces en temperatura, pH y sal. El orbe rojo lleva a un ambiente más extremo; el azul, de vuelta. N abre el mapa del nicho.'
      : 'Swim with the cursor (or your finger). Eat particles to grow: each division may bring a random mutation, and the environment decides whether it stays (selective sweep) or is lost. Eat other bacteria to acquire their genes. The curves at the bottom left are your niche: where you grow in temperature, pH and salt. The red orb leads to a more extreme environment; the blue one, back. N opens the niche map.'}</p>
    <h3>${lang === 'es' ? 'Colores de genes' : 'Gene colors'}</h3><p>${Object.keys(KINDS).map(k => `<span style="color:${KINDS[k].col}">●</span> ${KINDS[k][lang]}`).join(' &nbsp; ')} &nbsp; <span style="color:#ffd166">●</span> ${lang === 'es' ? 'forma (flagelos, pili, ganchos, tamaño)' : 'shape (flagella, pili, hooks, size)'}</p>
    <p>${lang === 'es' ? 'Cada bacteria de un color corre tu nicho en esa dirección. Las curvas del nicho se tiñen según cómo te adaptaste y, si te falta tolerancia, se enciende el color que necesitas. Hongos: sus hifas dan carbono pero enredan. Oleadas: comunidades enteras que pasan con la corriente.' : 'Each bacterium of a color pushes your niche that way. The niche curves take on the color of your adaptation and, when you lack tolerance, light up with the color you need. Fungi: hyphae give carbon but tangle you. Waves: whole communities drifting past.'}</p>
    <h3>${lang === 'es' ? 'Fuentes' : 'Sources'}</h3><ol>${SOURCES.map(x => `<li>${x}</li>`).join('')}</ol>
    <p class="cred"><img src="img/logoMEL.svg" alt="MEL"><br>Microbial Ecophysiology Lab · Fundación Ciencia &amp; Vida · 2026</p>`;
}
$('bLang').onclick = e => { e.stopPropagation(); lang = lang === 'es' ? 'en' : 'es'; try { localStorage.setItem('nicho_lang', lang); } catch (er) {} applyLang(); if (G.mode !== 'title') showCard(); };
$('bSnd').onclick = e => { e.stopPropagation(); toggleSound(); };
$('bMap').onclick = e => { e.stopPropagation(); if (G.mode === 'play') openMap(false); else if (G.mode === 'map') closeMap(); };
$('bInfo').onclick = e => { e.stopPropagation(); $('info').classList.toggle('open'); };
$('info').onclick = e => { if (e.target.id === 'info') $('info').classList.remove('open'); };
$('tNew').onclick = e => { e.stopPropagation(); try { localStorage.removeItem('nicho_save2'); } catch (er) {} Sound.start(); openChoose(); };
$('title').onclick = () => onTitle();

function onTitle() {
  if (G.mode !== 'title') return;
  Sound.start();
  const sv = load();
  if (sv && sv.g) beginGame(sv, null); else openChoose();
}
// elegir el tipo de inicio: acidófilo, neutrófilo, termófilo o psicrófilo (30 s o elige el azar)
let chooseIv = null;
function openChoose() {
  G.mode = 'choose'; $('title').classList.add('gone');
  const s = T_();
  $('choose').innerHTML = `<div class="ch-t">${s.choose}</div><div class="cards">${Object.keys(STARTS).map((k, i) => {
    const S = STARTS[k], tx = S[lang];
    return `<div class="card" data-k="${k}" style="--c:${S.col}">${S.photo ? '<div class="cell"><i></i><i></i><i class="het"></i><i></i></div>' : '<div class="cell one"><i></i></div>'}<b>${tx[0]}</b><span>${tx[1]}</span><em>${tx[2]}</em><small>${i + 1}</small></div>`;
  }).join('')}</div><div class="ch-auto">${s.auto} <b id="chN">30</b> s</div>`;
  $('choose').classList.add('open');
  $('choose').querySelectorAll('.card').forEach(c => c.onclick = e => { e.stopPropagation(); chooseStart(c.dataset.k); });
  const t0 = performance.now(); clearInterval(chooseIv);
  chooseIv = setInterval(() => {
    const left = Math.max(0, 30 - (performance.now() - t0) / 1000);
    const n = $('chN'); if (n) n.textContent = Math.ceil(left);
    if (left <= 0) chooseStart(pick(Object.keys(STARTS)));
  }, 250);
}
function chooseStart(k) {
  if (G.mode !== 'choose') return;
  clearInterval(chooseIv); $('choose').classList.remove('open');
  beginGame(null, k);
}
function beginGame(sv, k) {
  $('title').classList.add('gone');
  G.g = newGenome(); G.traits = new Set(); G.trail = []; G.stats = { sweeps: 0, purged: 0, genes: 0, desc: 0 }; G.deepest = 0; G.seen = {};
  G.ph = { flag: 0, pili: 0, spike: 0, size: 0 }; G.doses = {}; G.visited = new Set(); G.inside = []; G.omv = [];
  let L0 = 0;
  if (sv && sv.g) {
    G.g = clampG(sv.g); G.traits = new Set(sv.traits || []); G.deepest = sv.deepest || 0; G.stats = sv.stats || G.stats; G.trail = sv.trail || []; G.seen = sv.seen || {}; L0 = sv.layer || 0;
    G.ph = Object.assign(G.ph, sv.ph || {}); G.doses = sv.doses || {}; G.visited = new Set(sv.visited || []); G.start = sv.start || 'neutro';
    G.inside = []; for (const o of sv.inside || []) addInside(o.k, o.col);
  } else {
    const S = STARTS[k]; G.start = k; G.g = clampG(JSON.parse(JSON.stringify(S.g))); L0 = S.layer; G.deepest = L0;
  }
  SPACING = 15 * (1 + 0.1 * G.ph.size);
  G.off = { T: 0, pH: 0, S: 0 }; G.biomass = 0; G.grace = 12;
  G.mode = 'play'; resetPlayer(sv && sv.mass && !isCyano() ? sv.mass : 3, 0, 0); enterLayer(L0);
  // aparece de repente, en el rincón de la capa que mejor le acomoda
  let bx = 0, by = 0, bw = -1;
  for (let i = 0; i < 60; i++) { const a = rnd(0, 6.283), r = rnd(0, 1450), x = Math.cos(a) * r, y = Math.sin(a) * r; const w = fitness(G.g, envAt(x, y), null); if (w > bw && G.portals.every(q => Math.hypot(q.x - x, q.y - y) > 250)) { bw = w; bx = x; by = y; } }
  resetPlayer(isCyano() ? 3 : G.mass, bx, by); G.cam.x = bx; G.cam.y = by;
  G.spawnT = G.t; burst(bx, by, gColor(G.g), 40, 160, 1.6); burst(bx, by, [255, 255, 255], 20, 90, 1); Sound.gene();
  setTimeout(() => cap('intro'), 2500); setTimeout(() => cap('portal'), 12000); setTimeout(() => cap('dose'), 22000);
}

// arranque: modo atracción en la charca
resize(); applyLang();
resetPlayer(6, 0, 0); G.layer = 0;
for (let i = 0; i < 70; i++) spawnFood(true);
for (let i = 0; i < 8; i++) spawnPrey();
G.cils.push({ x: 400, y: 300, a: 2, full: 0, ph: 0 });
requestAnimationFrame(frame);
window.NICHO = G; window.NICHO_DBG = { enterLayer, openMap, closeMap, gainTrait, gainPheno, divide, startTrans, endGame, envAt, startWave, chooseStart, openChoose }; // para depurar
})();
