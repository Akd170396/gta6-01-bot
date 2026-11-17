// Synthesized sound effects with WebAudio. No audio files are shipped:
// every sound is built from oscillators and filtered noise at run time.

// SoundFX owns one AudioContext (created lazily on the first user gesture,
// so autoplay rules never block the game) and one method per game sound.
export class SoundFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch (e) {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.35;
    if (muted) this.stopEngine();
  }

  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      gain.gain.setValueAtTime(vol || 0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch (e) { /* audio is best-effort */ }
  }

  noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq || 1200;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol || 0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t);
    } catch (e) { /* audio is best-effort */ }
  }

  punch() { this.noise(0.09, 0.3, 500); this.tone(140, 0.08, 'square', 0.12, 70); }
  gunshot() { this.noise(0.14, 0.4, 2600); this.tone(220, 0.1, 'square', 0.15, 60); }
  pickup() { this.tone(660, 0.09, 'sine', 0.2); this.tone(990, 0.12, 'sine', 0.18); }
  cash() { this.tone(880, 0.08, 'triangle', 0.2); this.tone(1320, 0.14, 'triangle', 0.18); }
  crash() { this.noise(0.25, 0.4, 700); }
  sirenBlip() { this.tone(950, 0.16, 'square', 0.08, 1400); }
  missionDone() {
    this.tone(523, 0.12, 'triangle', 0.22);
    setTimeout(() => this.tone(659, 0.12, 'triangle', 0.22), 110);
    setTimeout(() => this.tone(784, 0.2, 'triangle', 0.24), 220);
  }
  fail() { this.tone(220, 0.35, 'sawtooth', 0.15, 110); }
  click() { this.tone(1200, 0.04, 'square', 0.08); }

  // startEngine keeps a low engine hum running while the player drives;
  // setEngineSpeed retunes it with the car's speed.
  startEngine() {
    if (!this.ctx || this.muted || this.engineOsc) return;
    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 70;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.05;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    } catch (e) { /* audio is best-effort */ }
  }

  setEngineSpeed(speedRatio) {
    if (this.engineOsc) {
      this.engineOsc.frequency.value = 60 + speedRatio * 160;
      if (this.engineGain) this.engineGain.gain.value = 0.03 + speedRatio * 0.05;
    }
  }

  stopEngine() {
    if (this.engineOsc) {
      try { this.engineOsc.stop(); } catch (e) { /* already stopped */ }
      this.engineOsc = null;
      this.engineGain = null;
    }
  }

  // startSiren loops the classic two-tone police wail while wanted.
  startSiren() {
    if (!this.ctx || this.muted || this.sirenOsc) return;
    try {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.035;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.6;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 260;
      lfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      lfo.start();
      this.sirenLfo = lfo;
    } catch (e) { /* audio is best-effort */ }
  }

  stopSiren() {
    if (this.sirenOsc) {
      try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch (e) { /* already stopped */ }
      this.sirenOsc = null;
      this.sirenGain = null;
      this.sirenLfo = null;
    }
  }
}
