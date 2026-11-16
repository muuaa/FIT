/** Audio + vibration alerts. The AudioContext must be unlocked from a user gesture first. */
let ctx: AudioContext | null = null;

export function unlockAudio(): void {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

function beep(at: number, freq: number, duration: number): void {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.4, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

export function restFinishedAlert(): void {
  try {
    navigator.vibrate?.([250, 120, 250, 120, 400]);
  } catch {
    /* vibration unsupported */
  }
  if (!ctx) return;
  const t = ctx.currentTime;
  beep(t, 880, 0.18);
  beep(t + 0.25, 880, 0.18);
  beep(t + 0.5, 1320, 0.35);
}

export function tick(): void {
  try {
    navigator.vibrate?.(15);
  } catch {
    /* ignore */
  }
}
