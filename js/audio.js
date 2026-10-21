// NICHO — sonido ambiental generativo (Web Audio). Pads lentos por capa, notas suaves al comer, reverb sintética.
'use strict';
const Sound = (() => {
  let ctx = null, master, music, sfx, rev, on = true, started = false;
  let layer = 0, stress = 0, drone = null, nextChord = 0, chordIx = 0;
  // modos por capa (raíz MIDI + escala)
  const MODES = [
    { r: 57, s: [0, 2, 4, 7, 9] },        // charca: pentatónica mayor
    { r: 55, s: [0, 2, 3, 7, 10] },       // Agrio: menor suave
    { r: 52, s: [0, 2, 3, 5, 7, 9, 10] }, // cráter: dórico
    { r: 50, s: [0, 2, 4, 6, 7, 9, 11] }, // Yellowstone: lidio
    { r: 45, s: [0, 1, 5, 7, 8] },        // chimenea: in-sen grave
    { r: 53, s: [0, 2, 4, 7, 9, 11] },    // soda: mayor brillante
    { r: 59, s: [0, 2, 4, 5, 7, 9, 11] }, // salar: jónico agudo
    { r: 48, s: [0, 2, 3, 7, 8] },        // permafrost: hirajoshi
  ];
  const PROG = [[0, 2, 4], [3, 5, 7], [1, 4, 6], [4, 6, 8]];
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  function deg(d, oct) { const M = MODES[layer], L = M.s.length; let o = Math.floor(d / L), k = d - o * L; return M.r + M.s[k] + 12 * (o + (oct || 0)); }

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
    rev = ctx.createConvolver(); rev.buffer = impulse(4.5); const rg = ctx.createGain(); rg.gain.value = 0.55; rev.connect(rg); rg.connect(master);
    music = ctx.createGain(); music.gain.value = 0.32; music.connect(master); music.connect(rev);
    sfx = ctx.createGain(); sfx.gain.value = 0.42; sfx.connect(master); sfx.connect(rev);
    // dron de estrés: ruido filtrado grave
    const n = ctx.createBufferSource(); n.buffer = noiseBuf(3); n.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180; f.Q.value = 4;
    const g = ctx.createGain(); g.gain.value = 0; n.connect(f); f.connect(g); g.connect(master); n.start();
    drone = { g, f };
  }
  function impulse(sec) {
    const len = ctx.sampleRate * sec, b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    return b;
  }
  function noiseBuf(sec) { const len = ctx.sampleRate * sec, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; return b; }

  function voice(type, f, t, dur, vol, dest, att, cutoff, detune) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; if (detune) o.detune.value = detune;
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = cutoff || 2400;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(flt); flt.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  function schedule() {
    if (!ctx) return;
    const now = ctx.currentTime;
    if (nextChord < now) nextChord = now + 0.1;
    while (nextChord < now + 1.5) {
      if (on) playChord(nextChord);
      nextChord += 9; chordIx++;
    }
    if (drone) drone.g.gain.setTargetAtTime(on ? stress * 0.09 : 0, now, 0.8);
    setTimeout(schedule, 500);
  }
  function playChord(t) {
    const ch = PROG[chordIx % PROG.length];
    const cut = 700 + layer * 120;
    ch.forEach((d, i) => {
      voice('sine', hz(deg(d, -1)), t + i * 0.4, 10, 0.07, music, 3.5, cut);
      voice('triangle', hz(deg(d, 0)), t + i * 0.4 + 0.2, 9.5, 0.035, music, 4, cut, 7);
    });
    voice('sine', hz(deg(ch[0], -2)), t, 10, 0.08, music, 3, 300);
    // chispitas ocasionales (agua)
    for (let k = 0; k < 3; k++) if (Math.random() < 0.6) voice('sine', hz(deg(Math.floor(Math.random() * 8), 1)), t + 1 + Math.random() * 7, 2.5, 0.025, music, 0.01, 3000);
  }

  let lastNote = 0, run = 0;
  const api = {
    start() { init(); if (ctx.state === 'suspended') ctx.resume(); if (!started) { started = true; schedule(); } },
    toggle() { on = !on; if (master) master.gain.setTargetAtTime(on ? 0.7 : 0, ctx.currentTime, 0.2); return on; },
    get on() { return on; },
    setLayer(l) { layer = l % MODES.length; },
    setStress(s) { stress = s; if (drone) drone.f.frequency.value = 120 + s * 160; },
    eat() { // nota ascendente en la escala, como en flOw
      if (!ctx || !on) return; const t = ctx.currentTime;
      if (t - lastNote > 2) run = 0; lastNote = t;
      voice('sine', hz(deg(run % 10, 1)), t, 1.6, 0.11, sfx, 0.005, 3500);
      voice('triangle', hz(deg(run % 10, 2)), t, 0.6, 0.03, sfx, 0.005, 5000);
      run++;
    },
    gene() { if (!ctx || !on) return; const t = ctx.currentTime; [0, 2, 4, 7].forEach((d, i) => voice('sine', hz(deg(d, 1)), t + i * 0.09, 3, 0.09, sfx, 0.01, 4000)); },
    sweep() { if (!ctx || !on) return; const t = ctx.currentTime; for (let i = 0; i < 8; i++) voice('triangle', hz(deg(i, 0)), t + i * 0.07, 2.2, 0.06, sfx, 0.01, 3000); },
    purge() { if (!ctx || !on) return; const t = ctx.currentTime; voice('sine', hz(deg(2, 0)), t, 1.4, 0.06, sfx, 0.02, 1200); voice('sine', hz(deg(0, 0)), t + 0.25, 1.6, 0.05, sfx, 0.02, 900); },
    divide() { if (!ctx || !on) return; const t = ctx.currentTime; voice('sine', hz(deg(4, 1)), t, 0.9, 0.05, sfx, 0.01, 3000); voice('sine', hz(deg(4, 2)), t + 0.06, 0.7, 0.03, sfx, 0.01, 3000); },
    hurt() { if (!ctx || !on) return; const t = ctx.currentTime; voice('sine', 90, t, 0.8, 0.14, sfx, 0.005, 400); },
    portal() {
      if (!ctx || !on) return; const t = ctx.currentTime;
      const n = ctx.createBufferSource(); n.buffer = noiseBuf(4); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3;
      f.frequency.setValueAtTime(2000, t); f.frequency.exponentialRampToValueAtTime(150, t + 3.5);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.25, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.8);
      n.connect(f); f.connect(g); g.connect(sfx); n.start(t); n.stop(t + 4);
      [0, 4, 7, 11].forEach((d, i) => voice('sine', hz(deg(d, 0)), t + 0.3 + i * 0.25, 4, 0.05, sfx, 0.4, 2000));
    },
  };
  return api;
})();
