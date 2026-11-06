// Slots Gallery – music and sound effects, all synthesised with the Web Audio API (no audio files).
//
//   SlotAudio.unlock()            call from a tap: browsers (iOS especially) only allow sound after a gesture
//   SlotAudio.scene(id)           'lobby' (title + menu) or a machine id: crossfades to that theme
//   SlotAudio.sfx(name, opts)     one-shot effects, see SFX below
//   SlotAudio.reels(on)           reel-spinning ticks on/off
//   SlotAudio.duck(seconds)       lower the music under a fanfare
//   SlotAudio.settings / set(k,v) { music, sfx, musicVol, sfxVol }, saved in localStorage 'slots-audio-v1'
(function (root) {
  const STORE = 'slots-audio-v1';
  const settings = { music: true, sfx: true, musicVol: 0.55, sfxVol: 0.8 };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch (e) { /* ignore */ }
  const persist = () => { try { localStorage.setItem(STORE, JSON.stringify(settings)); } catch (e) { /* ignore */ } };

  let ctx = null, comp, analyser, master, musicBus, sfxBus, reverb, reverbSend, noiseBuf;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  // ---------- setup ----------
  function build() {
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    // iOS: mix with other apps' audio and respect the silent switch
    try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) { /* ignore */ }
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 6; comp.ratio.value = 8; comp.attack.value = 0.003; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = 0.8;
    master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); sfxBus = ctx.createGain();
    musicBus.connect(master); sfxBus.connect(master);
    // shared reverb (generated impulse response)
    reverb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.2), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    reverb.buffer = ir;
    reverbSend = ctx.createGain(); reverbSend.gain.value = 0.28;
    reverbSend.connect(reverb); reverb.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    applyVolumes(true);
    return true;
  }

  function applyVolumes(now) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const mv = settings.music ? settings.musicVol * 0.5 : 0;
    const sv = settings.sfx ? settings.sfxVol : 0;
    musicBus.gain.cancelScheduledValues(t);
    sfxBus.gain.cancelScheduledValues(t);
    if (now) { musicBus.gain.value = mv; sfxBus.gain.value = sv; }
    else { musicBus.gain.setTargetAtTime(mv, t, 0.15); sfxBus.gain.setTargetAtTime(sv, t, 0.05); }
  }

  let unlocked = false;
  function unlock() {
    if (!ctx && !build()) return;
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    if (!unlocked) {
      unlocked = true;
      // a silent buffer started inside the gesture fully unlocks iOS
      const b = ctx.createBufferSource(); b.buffer = ctx.createBuffer(1, 1, 22050); b.connect(ctx.destination); b.start(0);
      startScheduler();
    }
  }

  // ---------- instruments ----------
  // Each plays one note: (dest, time, midi, durationSeconds, velocity 0..1)
  function env(g, t, a, peak, d, sustain, rel, end) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * sustain, t + a, d);
    g.gain.setTargetAtTime(0.0001, end, rel);
  }
  function out(dest, wet) {
    const g = ctx.createGain();
    g.connect(dest);
    if (wet) { const s = ctx.createGain(); s.gain.value = wet; g.connect(s); s.connect(reverbSend); }
    return g;
  }
  const INST = {
    // soft electric piano: sine + quiet octave with a bell-ish attack
    epiano(dest, t, m, dur, v) {
      const g = out(dest, 0.5); env(g, t, 0.01, 0.32 * v, 0.35, 0.35, 0.25, t + dur);
      const f = mtof(m);
      [[1, 1], [2, 0.18], [3.99, 0.06]].forEach(([r, a]) => {
        const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = f * r; og.gain.value = a;
        o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 1.5);
      });
    },
    // glassy FM bell (Gem Royale)
    bell(dest, t, m, dur, v) {
      const g = out(dest, 0.7); env(g, t, 0.003, 0.28 * v, 0.5, 0.12, 0.4, t + dur);
      const f = mtof(m), car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain();
      car.frequency.value = f; mod.frequency.value = f * 3.5;
      mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(f * 0.2, t + 0.8);
      mod.connect(mg); mg.connect(car.frequency); car.connect(g);
      car.start(t); mod.start(t); car.stop(t + dur + 2); mod.stop(t + dur + 2);
    },
    // plucked harp (Unicorn Royale)
    harp(dest, t, m, dur, v) {
      const g = out(dest, 0.6); env(g, t, 0.004, 0.3 * v, 0.6, 0.0001, 0.3, t + Math.max(dur, 1.2));
      const f = mtof(m), lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(f * 8, t); lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.8);
      lp.connect(g);
      [['triangle', 1, 1], ['sine', 2, 0.3]].forEach(([type, r, a]) => {
        const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = f * r; og.gain.value = a;
        o.connect(og); og.connect(lp); o.start(t); o.stop(t + 2.5);
      });
    },
    // celesta: sine with a fast-decaying shimmer partial
    celesta(dest, t, m, dur, v) {
      const g = out(dest, 0.8); env(g, t, 0.003, 0.26 * v, 0.45, 0.15, 0.35, t + dur);
      const f = mtof(m);
      [[1, 1], [4, 0.25], [2, 0.12]].forEach(([r, a], i) => {
        const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = f * r;
        og.gain.setValueAtTime(a, t); if (i) og.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 1.5);
      });
    },
    // warm pad: two detuned saws through a soft low-pass
    pad(dest, t, m, dur, v) {
      const g = out(dest, 0.6); env(g, t, 0.35, 0.09 * v, 0.6, 0.8, 0.5, t + dur);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.3; lp.connect(g);
      [-7, 7].forEach(cents => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = cents;
        o.connect(lp); o.start(t); o.stop(t + dur + 2.5);
      });
    },
    bass(dest, t, m, dur, v) {
      const g = out(dest, 0); env(g, t, 0.01, 0.42 * v, 0.25, 0.5, 0.06, t + dur * 0.9);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.connect(g);
      [['triangle', 1, 1], ['sine', 0.5, 0.6]].forEach(([type, r, a]) => {
        const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = mtof(m) * r; og.gain.value = a;
        o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.6);
      });
    },
    // brassy stab for fanfares
    brass(dest, t, m, dur, v) {
      const g = out(dest, 0.5); env(g, t, 0.03, 0.2 * v, 0.3, 0.7, 0.15, t + dur);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(3200, t + 0.08); lp.frequency.setTargetAtTime(1600, t + 0.1, 0.2);
      lp.connect(g);
      [-6, 6].forEach(c => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = c;
        o.connect(lp); o.start(t); o.stop(t + dur + 1);
      });
    },
  };
  function noise(dest, t, dur, { type = 'highpass', freq = 7000, q = 0.7, vol = 0.1, attack = 0.002, wet = 0 } = {}) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = out(dest, wet); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
    return f;
  }
  const DRUM = {
    kick(dest, t, v) {
      const o = ctx.createOscillator(), g = out(dest, 0);
      o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
      g.gain.setValueAtTime(0.5 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g); o.start(t); o.stop(t + 0.3);
    },
    snare(dest, t, v) { noise(dest, t, 0.16, { type: 'bandpass', freq: 2200, q: 0.8, vol: 0.12 * v, wet: 0.3 }); },
    hat(dest, t, v) { noise(dest, t, 0.045, { freq: 8000, vol: 0.05 * v }); },
    shaker(dest, t, v) { noise(dest, t, 0.07, { freq: 6000, vol: 0.035 * v, attack: 0.02 }); },
  };

  // ---------- music ----------
  // chords: { bass, notes } (MIDI). melody: 8 bars of [step(16th), midi, lengthInSteps].
  // The 4 chords repeat under the 8-bar melody.
  const THEMES = {
    lobby: {   // lounge jazz in C for the title screen and menu
      bpm: 96, lead: 'epiano', arp: { inst: 'epiano', every: 2, oct: 12, vel: 0.35 }, sfxVoice: 'epiano',
      chords: [
        { bass: 36, notes: [52, 55, 59, 62] }, { bass: 33, notes: [55, 59, 60, 64] },
        { bass: 38, notes: [53, 57, 60, 64] }, { bass: 43, notes: [53, 57, 59, 64] },
      ],
      bass: [[0, 0, 5], [6, 7, 2], [8, 12, 4], [12, 7, 3]],
      drums: { kick: [0, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], vel: 0.6 },
      melody: [
        [[0, 76, 4], [4, 79, 2], [6, 76, 2], [8, 74, 6]],
        [[0, 72, 4], [4, 76, 4], [8, 79, 4], [12, 81, 4]],
        [[0, 77, 4], [4, 76, 2], [6, 74, 2], [8, 72, 8]],
        [[0, 74, 6], [6, 71, 2], [8, 74, 4], [12, 79, 4]],
        [[0, 79, 4], [4, 84, 4], [8, 83, 2], [10, 79, 2], [12, 76, 4]],
        [[0, 81, 6], [6, 79, 2], [8, 76, 8]],
        [[0, 77, 4], [4, 81, 4], [8, 79, 4], [12, 77, 4]],
        [[0, 74, 8], [8, 71, 4], [12, 74, 4]],
      ],
    },
    'gem-royale': {   // bright casino swing in F with glassy bells
      bpm: 116, lead: 'bell', arp: { inst: 'bell', every: 4, oct: 24, vel: 0.22 }, sfxVoice: 'bell',
      chords: [
        { bass: 41, notes: [53, 57, 60, 64] }, { bass: 38, notes: [53, 57, 60, 62] },
        { bass: 43, notes: [55, 58, 62, 65] }, { bass: 36, notes: [52, 55, 58, 60] },
      ],
      bass: [[0, 0, 3], [4, 7, 3], [8, 12, 3], [12, 10, 3]],
      drums: { kick: [0, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], vel: 0.8 },
      melody: [
        [[0, 77, 2], [2, 81, 2], [4, 84, 4], [8, 81, 2], [10, 79, 2], [12, 77, 4]],
        [[0, 74, 2], [2, 77, 2], [4, 81, 4], [8, 77, 4], [12, 74, 4]],
        [[0, 79, 2], [2, 82, 2], [4, 86, 4], [8, 82, 2], [10, 81, 2], [12, 79, 4]],
        [[0, 76, 4], [4, 79, 2], [6, 82, 2], [8, 84, 8]],
        [[0, 89, 4], [4, 88, 2], [6, 86, 2], [8, 84, 4], [12, 81, 4]],
        [[0, 86, 4], [4, 84, 4], [8, 81, 8]],
        [[0, 82, 2], [2, 81, 2], [4, 79, 4], [8, 82, 4], [12, 86, 4]],
        [[0, 84, 6], [6, 82, 2], [8, 79, 4], [12, 76, 4]],
      ],
    },
    'unicorn-royale': {   // dreamy harp and celesta in D
      bpm: 84, lead: 'celesta', arp: { inst: 'harp', every: 2, oct: 12, vel: 0.3, updown: true }, sfxVoice: 'harp',
      chords: [
        { bass: 38, notes: [54, 57, 62, 66] }, { bass: 37, notes: [52, 57, 61, 64] },
        { bass: 35, notes: [54, 59, 62, 66] }, { bass: 43, notes: [55, 59, 62, 67] },
      ],
      bass: [[0, 0, 8], [8, 7, 8]],
      drums: { kick: [0], shaker: [2, 6, 10, 14], vel: 0.5 },
      melody: [
        [[0, 78, 6], [6, 81, 2], [8, 86, 8]],
        [[0, 85, 6], [6, 83, 2], [8, 81, 8]],
        [[0, 83, 4], [4, 86, 4], [8, 90, 4], [12, 88, 4]],
        [[0, 86, 8], [8, 83, 4], [12, 79, 4]],
        [[0, 81, 4], [4, 78, 4], [8, 81, 4], [12, 86, 4]],
        [[0, 88, 8], [8, 85, 4], [12, 81, 4]],
        [[0, 83, 2], [2, 86, 2], [4, 90, 8], [12, 88, 4]],
        [[0, 86, 12], [12, 81, 4]],
      ],
    },
  };

  let theme = THEMES.lobby, themeId = 'lobby', step = 0, nextTime = 0, timer = null;
  let sceneGain = null;   // per-scene gain so scenes can crossfade

  function scheduleStep(s, t) {
    const T = theme, stepDur = 60 / T.bpm / 4;
    const bar = Math.floor(s / 16) % 8, st = s % 16, chord = T.chords[bar % T.chords.length];
    const dest = sceneGain;
    if (st === 0) chord.notes.forEach(n => INST.pad(dest, t, n, stepDur * 16, 1));
    T.bass.forEach(([bs, iv, len]) => { if (bs === st) INST.bass(dest, t, chord.bass + iv, stepDur * len, 1); });
    if (st % T.arp.every === 0) {
      const seq = T.arp.updown ? [0, 1, 2, 3, 2, 1, 0, 1] : [0, 1, 2, 3];
      const idx = seq[(st / T.arp.every) % seq.length];
      INST[T.arp.inst](dest, t, chord.notes[idx] + T.arp.oct, stepDur * T.arp.every * 1.5, T.arp.vel);
    }
    T.melody[bar].forEach(([ms, m, len]) => { if (ms === st) INST[T.lead](dest, t, m, stepDur * len, 0.9); });
    const D = T.drums;
    ['kick', 'snare', 'hat', 'shaker'].forEach(k => { if (D[k] && D[k].includes(st)) DRUM[k](dest, t, D.vel); });
  }

  function tick() {
    if (!ctx || ctx.state !== 'running') return;
    const ahead = 0.15;
    if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
    while (nextTime < ctx.currentTime + ahead) {
      if (settings.music) scheduleStep(step, nextTime);
      nextTime += 60 / theme.bpm / 4;
      step = (step + 1) % (16 * 8);
    }
  }
  function startScheduler() {
    if (timer) return;
    sceneGain = ctx.createGain(); sceneGain.gain.value = 1; sceneGain.connect(musicBus);
    nextTime = ctx.currentTime + 0.1; step = 0;
    timer = setInterval(tick, 25);
  }

  function scene(id) {
    const next = THEMES[id] ? id : 'lobby';
    if (next === themeId && sceneGain) return;
    themeId = next;
    if (!ctx || !sceneGain) { theme = THEMES[next]; return; }
    // fade the old scene out, start the new one from bar 1
    const t = ctx.currentTime, old = sceneGain;
    old.gain.setTargetAtTime(0.0001, t, 0.25);
    setTimeout(() => old.disconnect(), 2500);
    sceneGain = ctx.createGain(); sceneGain.connect(musicBus);
    sceneGain.gain.setValueAtTime(0.0001, t); sceneGain.gain.setTargetAtTime(1, t + 0.3, 0.3);
    theme = THEMES[next]; step = 0; nextTime = t + 0.35;
  }

  function duck(seconds = 2) {
    if (!ctx || !sceneGain) return;
    const t = ctx.currentTime, g = sceneGain.gain;
    g.cancelScheduledValues(t); g.setTargetAtTime(0.18, t, 0.08); g.setTargetAtTime(1, t + seconds, 0.5);
  }

  // ---------- sound effects ----------
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  const voice = () => INST[(THEMES[themeId] || THEMES.lobby).sfxVoice];
  const SFX = {
    tap(t) { const o = ctx.createOscillator(), g = out(sfxBus, 0); o.frequency.value = 1300; g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); o.connect(g); o.start(t); o.stop(t + 0.06); },
    press(t) { noise(sfxBus, t, 0.03, { type: 'bandpass', freq: 1800, vol: 0.18 }); const o = ctx.createOscillator(), g = out(sfxBus, 0); o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(300, t + 0.06); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08); o.connect(g); o.start(t); o.stop(t + 0.1); },
    start(t) {
      noise(sfxBus, t, 0.6, { type: 'bandpass', freq: 900, q: 0.6, vol: 0.12, attack: 0.25, wet: 0.5 });
      [72, 76, 79, 84, 88].forEach((m, i) => INST.bell(sfxBus, t + 0.12 + i * 0.07, m, 0.6, 0.9));
    },
    select(t) { [79, 86].forEach((m, i) => INST.celesta(sfxBus, t + i * 0.08, m, 0.5, 1)); noise(sfxBus, t, 0.35, { freq: 5000, vol: 0.05, attack: 0.1, wet: 0.6 }); },
    back(t) { [84, 77].forEach((m, i) => INST.celesta(sfxBus, t + i * 0.08, m, 0.4, 0.8)); },
    bet(t, o = {}) { const m = 72 + (o.level || 0) * 2; INST.celesta(sfxBus, t, m, 0.18, 0.7); },
    spin(t) {
      const f = noise(sfxBus, t, 0.4, { type: 'bandpass', freq: 400, q: 1.2, vol: 0.16, attack: 0.05 });
      f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.35);
      DRUM.kick(sfxBus, t, 0.6);
    },
    reelTick(t) { noise(sfxBus, t, 0.025, { type: 'bandpass', freq: 3200 + Math.random() * 800, q: 2, vol: 0.05 }); },
    reelStop(t, o = {}) {
      const r = o.reel || 0, osc = ctx.createOscillator(), g = out(sfxBus, 0.1);
      osc.frequency.setValueAtTime(190 - r * 8, t); osc.frequency.exponentialRampToValueAtTime(70, t + 0.12);
      g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(g); osc.start(t); osc.stop(t + 0.2);
      noise(sfxBus, t, 0.05, { type: 'bandpass', freq: 2500, vol: 0.12 });
    },
    winSmall(t) { [0, 4, 7].forEach((iv, i) => voice()(sfxBus, t + i * 0.09, 79 + iv, 0.4, 0.9)); },
    winMedium(t) { [0, 4, 7, 12, 16].forEach((iv, i) => voice()(sfxBus, t + i * 0.08, 76 + iv, 0.5, 0.8)); sparkle(t + 0.3, 6); },
    coin(t) { INST.bell(sfxBus, t, 91 + PENTA[Math.floor(Math.random() * 5)], 0.12, 0.35); },
    bigWin(t) {
      duck(3);
      const stabs = [[0, [60, 64, 67, 72]], [0.28, [65, 69, 72, 77]], [0.56, [67, 71, 74, 79]], [0.9, [72, 76, 79, 84]]];
      stabs.forEach(([dt, ch], i) => ch.forEach(m => INST.brass(sfxBus, t + dt, m, i === 3 ? 1.4 : 0.22, 1)));
      noise(sfxBus, t + 0.6, 1.8, { freq: 6000, vol: 0.08, attack: 0.5, wet: 0.7 });
      sparkle(t + 0.9, 14);
    },
    freeSpins(t) {
      duck(2.5);
      [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28].forEach((iv, i) => INST.harp(sfxBus, t + i * 0.055, 67 + iv, 0.6, 0.6));
      [79, 83, 86, 91].forEach(m => INST.celesta(sfxBus, t + 0.8, m, 1.4, 0.7));
    },
    jackpot(t) {
      duck(7);
      const prog = [[0, [60, 64, 67, 72]], [0.35, [60, 64, 67, 72]], [0.6, [65, 69, 72, 77]], [1.0, [67, 71, 74, 79]], [1.4, [72, 76, 79, 84, 88]]];
      prog.forEach(([dt, ch], i) => ch.forEach(m => INST.brass(sfxBus, t + dt, m, i === 4 ? 2.4 : 0.3, 0.7)));
      [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31].forEach((iv, i) => INST.harp(sfxBus, t + 1.4 + i * 0.045, 72 + iv, 0.8, 0.5));
      noise(sfxBus, t + 1.2, 3, { freq: 5500, vol: 0.1, attack: 0.6, wet: 0.8 });
      for (let i = 0; i < 30; i++) SFX.coin(t + 1.6 + i * 0.07 + Math.random() * 0.04);
      sparkle(t + 2, 20);
    },
    noCredits(t) { [55, 50].forEach((m, i) => INST.brass(sfxBus, t + i * 0.2, m, 0.25, 0.6)); },
    autoOn(t) { [72, 79, 84].forEach((m, i) => INST.celesta(sfxBus, t + i * 0.06, m, 0.3, 0.7)); },
    autoOff(t) { [84, 79, 72].forEach((m, i) => INST.celesta(sfxBus, t + i * 0.06, m, 0.3, 0.6)); },
  };
  function sparkle(t, n) { for (let i = 0; i < n; i++) INST.celesta(sfxBus, t + i * 0.06 + Math.random() * 0.03, 96 + PENTA[Math.floor(Math.random() * 6)], 0.2, 0.25); }

  function sfx(name, opts) {
    if (!ctx || !unlocked || !settings.sfx || !SFX[name]) return;
    if (ctx.state === 'running') { SFX[name](ctx.currentTime + 0.01, opts); return; }
    // still waking up (iOS resolves resume() a moment after the tap): play once it's running
    if (name === 'reelTick' || name === 'coin') return;
    ctx.resume().then(() => { if (ctx.state === 'running') SFX[name](ctx.currentTime + 0.01, opts); }).catch(() => {});
  }

  // reel-spinning ticks
  let reelTimer = null;
  function reels(on) {
    clearInterval(reelTimer); reelTimer = null;
    if (on) reelTimer = setInterval(() => sfx('reelTick'), 75);
  }

  // pause everything while the app is in the background
  document.addEventListener('visibilitychange', () => {
    if (!ctx || !unlocked) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  });
  // a later tap also revives audio that iOS interrupted (e.g. after a call)
  document.addEventListener('pointerdown', () => { if (ctx && unlocked && ctx.state !== 'running') ctx.resume().catch(() => {}); }, true);

  function set(key, value) {
    settings[key] = value;
    persist();
    applyVolumes(false);
  }

  // Output level meter (used by tests and handy for debugging): { peak, rms } of the last ~40 ms
  function meter() {
    if (!ctx) return null;
    if (!analyser) { analyser = ctx.createAnalyser(); analyser.fftSize = 2048; comp.connect(analyser); }
    const d = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(d);
    let peak = 0, sq = 0; for (const x of d) { peak = Math.max(peak, Math.abs(x)); sq += x * x; }
    return { peak, rms: Math.sqrt(sq / d.length) };
  }

  root.SlotAudio = {
    meter,
    unlock, scene, sfx, reels, duck, set, settings,
    get unlocked() { return unlocked; },
    get state() { return ctx ? ctx.state : 'none'; },
    get scene_() { return themeId; },
    // final output node + context, for recording a demo in tests
    get output() { return comp; }, get context() { return ctx; },
  };
})(typeof self !== 'undefined' ? self : globalThis);
