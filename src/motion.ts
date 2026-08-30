import { gsap } from 'gsap';

const STORAGE_KEY = 'san_choi_motion';
const QUERY = '(prefers-reduced-motion: reduce)';

let override: boolean | null = null;
try {
  const v = localStorage.getItem(STORAGE_KEY);
  override = v === 'reduce' ? true : v === 'full' ? false : null;
} catch {
  /* storage unavailable */
}

function systemReduced(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.(QUERY).matches;
}

/** True when the app should collapse motion (system pref or explicit user override). */
export function reducedMotion(): boolean {
  return override ?? systemReduced();
}

/** Persist a user override (wins over the system preference). */
export function setReducedMotion(reduce: boolean): void {
  override = reduce;
  try {
    localStorage.setItem(STORAGE_KEY, reduce ? 'reduce' : 'full');
  } catch {
    /* storage unavailable */
  }
}

/**
 * A reduced-motion-aware wrapper around gsap.context. Runs `reduced` when motion is
 * collapsed, otherwise `full`. All existing trigger code keeps firing — only the tweens
 * inside differ.
 */
export function addMotion(
  scope: Element | null,
  config: { reduced: (ctx: gsap.Context) => void; full: (ctx: gsap.Context) => void }
): gsap.Context {
  return gsap.context((ctx) => {
    if (reducedMotion()) {
      config.reduced(ctx);
    } else {
      config.full(ctx);
    }
  }, scope ?? undefined);
}
