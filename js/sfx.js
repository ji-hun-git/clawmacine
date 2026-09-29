// Synthesised arcade sounds (Web Audio). Nothing loads from disk; every sound is built on the fly.
window.SFX = (() => {
  let ac = null, master = null, on = true, noiseBuf = null;
  let motorOsc, motorGain, rollSrc, rollGain, rollFilter;
  let lastClank = 0, lastTick = 0;

  function unlock() {
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain(); master.gain.value = .6; master.connect(ac.destination);
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const ch = noiseBuf.getChannelData(0);
        for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
        // gantry motor: a low buzzing saw, gain follows carriage speed
        motorOsc = ac.createOscillator(); motorOsc.type = 'sawtooth'; motorOsc.frequency.value = 70;
        const mf = ac.createBiquadFilter(); mf.type = 'lowpass'; mf.frequency.value = 420;
        motorGain = ac.createGain(); motorGain.gain.value = 0;
        motorOsc.connect(mf).connect(motorGain).connect(master); motorOsc.start();
        // roulette ball rolling: looped noise through a band-pass
        rollSrc = ac.createBufferSource(); rollSrc.buffer = noiseBuf; rollSrc.loop = true;
        rollFilter = ac.createBiquadFilter(); rollFilter.type = 'bandpass'; rollFilter.frequency.value = 900; rollFilter.Q.value = 1.4;
        rollGain = ac.createGain(); rollGain.gain.value = 0;
        rollSrc.connect(rollFilter).connect(rollGain).connect(master); rollSrc.start();
      } catch (e) { ac = null; }
    }
    if (ac && ac.state === 'suspended') ac.resume();
  }
  const ready = () => ac && on;
  const t0 = (d = 0) => ac.currentTime + d;

  function tone(f, d, { type = 'square', vol = .08, delay = 0, to = null } = {}) {
    if (!ready()) return;
    const t = t0(delay), o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g).connect(master); o.start(t); o.stop(t + d + .05);
  }
  function noise(d, { vol = .2, freq = 800, q = 1, delay = 0, type = 'bandpass' } = {}) {
    if (!ready()) return;
    const t = t0(delay), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    s.connect(f).connect(g).connect(master); s.start(t, Math.random() * .5); s.stop(t + d + .05);
  }
  // tin can hit: a few inharmonic partials, like a struck cylinder
  function clank(v = 3) {
    if (!ready()) return;
    const now = performance.now(); if (now - lastClank < 35) return; lastClank = now;
    const vol = Math.min(.09, .012 * v), base = 480 + Math.random() * 260;
    [1, 2.32, 3.86, 5.9].forEach((m, i) => tone(base * m, .09 + .12 / (i + 1), { type: 'sine', vol: vol / (i * .7 + 1) }));
    noise(.03, { vol: vol * 2.2, freq: 3200, q: 2 });
  }

  return {
    unlock,
    get on() { return on; },
    toggle() {
      on = !on;
      if (ac) { motorGain.gain.setTargetAtTime(0, t0(), .02); rollGain.gain.setTargetAtTime(0, t0(), .02); }
      return on;
    },
    motor(level, pitch = 1) {
      if (!ac) return;
      motorGain.gain.setTargetAtTime(on ? Math.min(1, level) * .05 : 0, t0(), .05);
      motorOsc.frequency.setTargetAtTime(52 + 60 * pitch, t0(), .06);
    },
    roll(level) {
      if (!ac) return;
      rollGain.gain.setTargetAtTime(on ? Math.min(1, level) * .09 : 0, t0(), .05);
      rollFilter.frequency.setTargetAtTime(500 + level * 1500, t0(), .05);
    },
    clank,
    tick(v = 1) {
      const now = performance.now(); if (now - lastTick < 18) return; lastTick = now;
      tone(2600 + Math.random() * 600, .02, { type: 'square', vol: .025 * v });
      noise(.018, { vol: .1 * v, freq: 4200, q: 5 });
    },
    clunk() { noise(.09, { vol: .4, freq: 900, q: 2 }); tone(160, .09, { type: 'triangle', vol: .15, to: 90 }); },
    clack() { noise(.05, { vol: .35, freq: 2200, q: 3 }); tone(330, .05, { type: 'square', vol: .05 }); },
    ballDrop() { noise(.04, { vol: .3, freq: 3000, q: 3 }); tone(1900, .06, { type: 'sine', vol: .08 }); },
    whoosh() { noise(.4, { vol: .22, freq: 700, q: .7 }); },
    coin() { tone(988, .08, { vol: .06 }); tone(1319, .38, { vol: .06, delay: .08 }); },
    ding() { tone(1568, .5, { type: 'triangle', vol: .12 }); tone(2093, .6, { type: 'sine', vol: .05, delay: .02 }); },
    fanfare() {
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, .16, { type: 'square', vol: .045, delay: i * .08 }));
      tone(1319, .55, { type: 'triangle', vol: .1, delay: .5 });
    },
    popTop() { noise(.28, { vol: .3, freq: 5000, q: .6, type: 'highpass' }); tone(740, .08, { type: 'sine', vol: .15, to: 1400, delay: .02 }); },
    stamp() { noise(.16, { vol: .6, freq: 260, q: .7, type: 'lowpass' }); tone(72, .2, { type: 'sine', vol: .3, to: 42 }); },
    crush() {
      noise(.35, { vol: .35, freq: 1200, q: .8 });
      for (let i = 0; i < 5; i++) clankRaw(i * .05);
      tone(300, .4, { type: 'sawtooth', vol: .05, to: 80 });
    },
    buzz() { tone(150, .32, { type: 'sawtooth', vol: .06 }); tone(112, .42, { type: 'sawtooth', vol: .06, delay: .14 }); },
    miss() { tone(440, .15, { vol: .05, to: 220 }); tone(330, .3, { vol: .05, delay: .15, to: 130 }); },
    beep(hi) { tone(hi ? 1320 : 880, .07, { vol: .045 }); },
  };
  function clankRaw(delay) {
    const base = 700 + Math.random() * 500;
    [1, 2.4, 4.1].forEach((m, i) => tone(base * m, .06, { type: 'sine', vol: .03 / (i + 1), delay }));
  }
})();
