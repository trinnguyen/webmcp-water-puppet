const audioCtx: AudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
let bgmAudio: HTMLAudioElement | null = null;
let isMuted = localStorage.getItem('waterPuppetMuted') === 'true';

const sfxElements: Record<string, HTMLAudioElement> = {
  splash: new Audio('assets/audio/splash.wav'),
  sneeze: new Audio('assets/audio/sneeze.wav'),
};

export async function initAudio() {
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
}

export function toggleMute() {
  isMuted = !isMuted;
  localStorage.setItem('waterPuppetMuted', isMuted.toString());
  
  if (bgmAudio) {
    bgmAudio.muted = isMuted;
  }
  return isMuted;
}

export function playBGM(track: string) {
  if (track === 'silent') {
    if (bgmAudio) {
      bgmAudio.pause();
    }
    return;
  }

  if (!bgmAudio) {
    bgmAudio = new Audio('assets/audio/bgm.mp3');
    bgmAudio.loop = true;
  }
  
  bgmAudio.muted = isMuted;
  bgmAudio.play().catch(e => console.warn('Audio playback failed', e));
}

export function playSFX(sfxName: string) {
  if (isMuted) return;
  const audio = sfxElements[sfxName];
  if (audio) {
    audio.currentTime = 0;
    audio.play().catch(e => console.warn('SFX playback failed', e));
  }
}

export function getMuteState() {
  return isMuted;
}
