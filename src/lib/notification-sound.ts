let audioCtx: AudioContext | null = null;
let unlocked = false;

export function unlockNotificationAudio() {
  if (typeof window === 'undefined') return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    unlocked = true;
  } catch {
    /* ignore */
  }
}

function playTone(freq: number, start: number, duration: number) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.start(start);
  osc.stop(start + duration);
}

export function playMessageAlert() {
  if (typeof window === 'undefined') return;

  try {
    if (navigator.vibrate) {
      navigator.vibrate([180, 80, 180]);
    }
  } catch {
    /* ignore */
  }

  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const run = () => {
      if (!audioCtx) return;
      const t = audioCtx.currentTime;
      playTone(880, t, 0.15);
      playTone(1174, t + 0.18, 0.2);
    };
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(run).catch(() => {});
    } else {
      run();
    }
  } catch {
    /* ignore */
  }
}

export function isNotificationAudioUnlocked() {
  return unlocked;
}

// Unlock on first user interaction anywhere in the app
if (typeof window !== 'undefined') {
  const unlock = () => {
    unlockNotificationAudio();
    window.removeEventListener('click', unlock);
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('click', unlock, { once: true, passive: true });
  window.addEventListener('touchstart', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true });
}
