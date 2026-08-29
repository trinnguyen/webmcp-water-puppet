const audioCtx: AudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
let bgmAudio: HTMLAudioElement | null = null;
let currentTrack: string | null = null;
let isMuted = localStorage.getItem('waterPuppetMuted') === 'true';

const trackMap: Record<string, string> = {
  dan_bau: 'assets/audio/bgm.mp3',
  festive: 'assets/audio/bgm_festive.mp3',
  gong: 'assets/audio/bgm_gong.mp3',
};

const sfxElements: Record<string, HTMLAudioElement> = {
  splash: new Audio('assets/audio/splash.wav'),
  sneeze: new Audio('assets/audio/sneeze.wav'),
  capture: new Audio('assets/audio/capture.wav'),
  dice_roll: new Audio('assets/audio/dice_roll.wav'),
  win_chime: new Audio('assets/audio/win_chime.wav'),
  coin: new Audio('assets/audio/coin.wav'),
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
    currentTrack = 'silent';
    return;
  }

  const targetSrc = trackMap[track] ?? 'assets/audio/bgm.mp3';

  if (!bgmAudio) {
    bgmAudio = new Audio(targetSrc);
    bgmAudio.loop = true;
  } else if (currentTrack !== track) {
    bgmAudio.src = targetSrc;
  }

  currentTrack = track;
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
