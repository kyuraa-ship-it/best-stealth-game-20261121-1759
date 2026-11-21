// All sound is synthesized with WebAudio — no audio files, no network.
// Footsteps, a coin's ring, a pickup chime, the alarm sting, and a low
// ambient hum that keeps the museum feeling empty at night.
export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    ambientNodes: null,
    ensure() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return true;
      }
      try {
        const Ctx = window.AudioContext ?? window.webkitAudioContext;
        if (!Ctx) return false;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
        this.startAmbient();
        return true;
      } catch {
        return false;
      }
    },
    setMuted(muted) {
      this.muted = muted;
      if (this.master) this.master.gain.value = muted ? 0 : 0.5;
    },
    tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) {
      if (!this.ctx || this.muted) return;
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    },
    noiseBurst(dur, vol, lowpass = 1200) {
      if (!this.ctx || this.muted) return;
      const t0 = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = this.ctx.createGain();
      gain.gain.value = vol;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t0);
    },
    startAmbient() {
      if (!this.ctx || this.ambientNodes) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 55;
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = 55.7;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.035;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 0.018;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(this.master);
      osc.start();
      osc2.start();
      lfo.start();
      this.ambientNodes = { osc, osc2, lfo };
    },
    play(event, detail = {}) {
      if (!this.ctx) return;
      switch (event) {
        case 'step':
          this.noiseBurst(0.05, detail.running ? 0.1 : detail.sneaking ? 0.02 : 0.05, detail.running ? 900 : 500);
          break;
        case 'pickup':
          this.tone(660, 0.14, 'sine', 0.22);
          this.tone(990, 0.2, 'sine', 0.2, null, 0.09);
          this.tone(1320, 0.26, 'sine', 0.14, null, 0.18);
          break;
        case 'coin':
          this.tone(1900, 0.09, 'triangle', 0.16);
          break;
        case 'coin-land':
          this.tone(2400, 0.3, 'triangle', 0.14, 1700);
          this.tone(1800, 0.4, 'sine', 0.1, 1200, 0.05);
          break;
        case 'alarm':
          this.tone(220, 0.5, 'sawtooth', 0.16, 440);
          this.tone(233, 0.5, 'sawtooth', 0.12, 466, 0.02);
          this.noiseBurst(0.3, 0.08, 2400);
          break;
        case 'caught':
          this.tone(160, 0.7, 'sawtooth', 0.2, 60);
          this.noiseBurst(0.4, 0.12, 800);
          break;
        case 'level-done':
          [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.18, null, i * 0.11));
          break;
        case 'game-over':
          [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.16, null, i * 0.16));
          break;
        case 'click':
          this.tone(700, 0.06, 'square', 0.08);
          break;
        default:
          break;
      }
    },
  };
  return audio;
}
