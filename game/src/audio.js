// Synthesised sound: no audio files, everything comes from WebAudio.
// The context only starts after the player's first click, as browsers require.
export function createAudio() {
  const audio = {
    ctx: null, master: null, muted: false,
    engineOsc: null, engineGain: null, sirenOsc: null, sirenGain: null,
    sirenOn: false,
  };

  audio.ensure = function ensure() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audio.ctx = new AC();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.35;
    audio.master.connect(audio.ctx.destination);
    // Engine hum: a low sawtooth whose pitch follows the speed.
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 55;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0;
    const lp = audio.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    audio.engineOsc.connect(lp); lp.connect(audio.engineGain); audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    // Police siren: two alternating tones.
    audio.sirenOsc = audio.ctx.createOscillator();
    audio.sirenOsc.type = 'triangle';
    audio.sirenOsc.frequency.value = 660;
    audio.sirenGain = audio.ctx.createGain();
    audio.sirenGain.gain.value = 0;
    audio.sirenOsc.connect(audio.sirenGain); audio.sirenGain.connect(audio.master);
    audio.sirenOsc.start();
    audio.sirenPhase = 0;
  };

  audio.setEngine = function setEngine(speed01, driving) {
    if (!audio.ctx) return;
    audio.engineGain.gain.value = driving ? 0.05 + speed01 * 0.06 : 0;
    audio.engineOsc.frequency.value = 50 + speed01 * 130;
  };

  audio.setSiren = function setSiren(on) {
    audio.sirenOn = on;
    if (!audio.ctx) return;
    audio.sirenGain.gain.value = on ? 0.045 : 0;
  };

  audio.tickSiren = function tickSiren(dt) {
    if (!audio.ctx || !audio.sirenOn) return;
    audio.sirenPhase = (audio.sirenPhase || 0) + dt;
    audio.sirenOsc.frequency.value = Math.floor(audio.sirenPhase * 1.6) % 2 === 0 ? 660 : 880;
  };

  function blip(freq, dur, type, vol, slideTo) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const o = audio.ctx.createOscillator();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = audio.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(audio.master);
    o.start(t); o.stop(t + dur);
  }

  function noise(dur, vol, freq) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const len = Math.floor(audio.ctx.sampleRate * dur);
    const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buf;
    const f = audio.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = freq || 1800;
    const g = audio.ctx.createGain();
    g.gain.value = vol || 0.25;
    src.connect(f); f.connect(g); g.connect(audio.master);
    src.start(t);
  }

  audio.shot = () => noise(0.14, 0.3, 2400);
  audio.punch = () => noise(0.08, 0.2, 500);
  audio.click = () => blip(880, 0.06, 'sine', 0.1);
  audio.pickup = () => { blip(660, 0.09, 'sine', 0.14); setTimeout(() => blip(990, 0.12, 'sine', 0.14), 90); };
  audio.horn = () => blip(370, 0.18, 'square', 0.08, 340);
  audio.busted = () => blip(520, 0.7, 'sawtooth', 0.12, 130);
  audio.missionDone = () => { blip(523, 0.12, 'sine', 0.15); setTimeout(() => blip(659, 0.12, 'sine', 0.15), 110); setTimeout(() => blip(784, 0.22, 'sine', 0.15), 220); };
  audio.toggleMute = function toggleMute() {
    audio.muted = !audio.muted;
    if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.35;
    return audio.muted;
  };
  return audio;
}
