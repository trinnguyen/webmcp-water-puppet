#!/usr/bin/env python3
"""Synthesize the water-puppet audio assets with stdlib only (no numpy).

Produces:
  bgm.mp3      - a dan-bau-ish plucked pentatonic melody loop (~24s)
  splash.wav   - filtered noise "water splash"
  sneeze.wav   - inhale + explosive sneeze burst

Múa rối nước music uses the pentatonic scale (ngũ cung). We synthesize a
soft plucked-string timbre (harmonic series, exponential decay) over the
Vietnamese "South" mode feel, at a gentle tempo. 16-bit mono PCM.
"""
import math, struct, subprocess, wave

SR = 44100

def write_wav(path, samples):
    with wave.open(path, 'w') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        # clip + 16-bit
        frames = b''.join(
            struct.pack('<h', max(-32768, min(32767, int(s * 32767))))
            for s in samples
        )
        w.writeframes(frames)
    print(f"wrote {path}: {len(samples)/SR:.2f}s")

def to_wav(x_sr, x_vals):
    """Re-samples a value-array given as (sample_rate, [vals]) to SR."""
    r, v = x_sr, x_vals
    n = int(len(v) * SR / r)
    out = []
    for i in range(n):
        t = i * r / SR
        ti = t
        i0 = int(ti)
        if i0 >= len(v) - 1:
            out.append(v[-1])
            continue
        frac = ti - i0
        out.append(v[i0] * (1 - frac) + v[i0 + 1] * frac)
    return out

def pluck(freq, dur, amp=0.30):
    """Plucked-string tone: harmonics with exp decay."""
    n = int(SR * dur)
    out = []
    for i in range(n):
        t = i / SR
        env = math.exp(-t * (3.0 + freq * 0.0015))
        v = 0.0
        for h, w in ((1,1.0),(2,0.45),(3,0.22),(4,0.12),(5,0.07)):
            v += w * math.sin(2*math.pi*freq*h*t) * env
        out.append(amp * v * 0.6)
    return out

# ---------------- BGM: pentatonic plucked melody, 24s loop ----------------
# A pentatonic mode (A C D E G), frequencies for A minor pentatonic.
F = {
    'A2':110.0,'C3':130.81,'D3':146.83,'E3':164.81,'G3':196.00,
    'A3':220.0,'C4':261.63,'D4':293.66,'E4':329.63,'G4':392.00,'A4':440.0,
}
# A gentle 6/8 water-puppet melody. (note, eighth-count)
mel = [
    ('C4',1),('E4',1),('A3',2),('E4',1),('G4',1),
    ('A4',2),('G4',1),('E4',1),('C4',2),('A3',1),
    ('D4',1),('E4',1),('G4',2),('E4',1),('D4',1),
    ('C4',2),('D4',1),('C4',1),('A3',2),('G3',1),('C4',1),
    ('D4',1),('E4',1),('A3',2),('C4',1),('D4',1),('E4',2),('C4',1),('A3',1),
]
EIGHTH = 0.30  # seconds per eighth note
bgm = []
t = 0.0
for note, beats in mel:
    dur = EIGHTH * beats
    note_sound = pluck(F[note], dur, 0.30)
    # slight gate so notes don't clip into each other
    bgm += note_sound
    t += dur

master = []
# simple DC-safe normalize
peak = max(1e-6, max(abs(s) for s in bgm))
gain = 0.9 / peak
bgm = [s*gain for s in bgm]

# pad tail & fade
bgm += [0.0]*int(SR*0.5)
fade = int(SR*0.05)
for i in range(fade):
    bgm[-(i+1)] *= i/fade
write_wav('/tmp/bgm_tmp.wav', bgm)

# ---------------- splash.wav: filtered noise burst ----------------
n = int(SR * 0.8)
splash = []
# two-phase: initial plop (low bump) + hissy spray tail
for i in range(n):
    t = i / SR
    if t < 0.02:
        continue  # quiet instant before
    env = math.exp(-t * 6.0)
    # combine band-limited-ish: mix noise modulated at a spreading rate
    # simple pseudo-noise via sin sum (cheap band-pass feel)
    spray = math.sin(2*math.pi*940*t + 7*math.sin(2*math.pi*31*t)) \
          + 0.6*math.sin(2*math.pi*1510*t + 11*math.sin(2*math.pi*53*t))
    low = math.sin(2*math.pi*120*t) * math.exp(-t*12)
    splash.append((0.6*spray*env + 0.7*low))
# normalize
p = max(1e-6,max(abs(s) for s in splash)); splash=[s*0.9/p for s in splash]
write_wav('/tmp/splash_tmp.wav', splash)

# ---------------- sneeze.wav: sharp inhale then burst ----------------
sn = []
inhale_n = int(SR*0.12)
for i in range(inhale_n):
    t=i/SR
    sn.append(0.15*math.sin(2*math.pi*500*t)*math.exp(-t*6))
burst_n = int(SR*0.30)
for i in range(burst_n):
    t=i/SR
    haul = math.sin(2*math.pi*260*t + 14*math.sin(2*math.pi*29*t)) \
         + 0.7*math.sin(2*math.pi*700*t)
    env = math.exp(-t*7)
    sn.append(0.85*haul*env)
sn += [0.0]*int(SR*0.15)
p=max(1e-6,max(abs(s) for s in sn)); sn=[s*0.92/p for s in sn]
write_wav('/tmp/sneeze_tmp.wav', sn)

# ---------------- capture.wav: scoop/capture ----------------
capture = pluck(440, 0.08, 0.5) + pluck(587.33, 0.2, 0.5)
p = max(1e-6, max(abs(s) for s in capture)); capture = [s*0.9/p for s in capture]
write_wav('/tmp/capture_tmp.wav', capture)

# ---------------- dice_roll.wav: rattling dice tumble ----------------
dice = []
for i in range(int(SR * 0.4)):
    t = i / SR
    noise = math.sin(2*math.pi*1500*t + 10*math.sin(2*math.pi*333*t))
    env_mod = max(0, math.sin(2*math.pi*18*t)) ** 3
    decay = math.exp(-t * 4)
    dice.append(0.7 * noise * env_mod * decay)
p = max(1e-6, max(abs(s) for s in dice)); dice = [s*0.9/p for s in dice]
write_wav('/tmp/dice_roll_tmp.wav', dice)

# ---------------- win_chime.wav: bright winning arpeggio ----------------
win = []
for idx, f in enumerate([523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]):
    seg = pluck(f, 0.6, 0.4)
    if idx == 0:
        win = seg
    else:
        offset = int(SR * 0.08 * idx)
        for j in range(len(seg)):
            if offset + j < len(win):
                win[offset + j] += seg[j]
            else:
                win.append(seg[j])
p = max(1e-6, max(abs(s) for s in win)); win = [s*0.9/p for s in win]
write_wav('/tmp/win_chime_tmp.wav', win)

# ---------------- coin.wav: distinctive coin drop ----------------
coin = []
for i in range(int(SR * 0.08)):
    t = i / SR
    coin.append(math.sin(2*math.pi*987*t) * math.exp(-t*30))
for i in range(int(SR * 0.4)):
    t = i / SR
    coin.append(math.sin(2*math.pi*1318.51*t) * math.exp(-t*10))
p = max(1e-6, max(abs(s) for s in coin)); coin = [s*0.9/p for s in coin]
write_wav('/tmp/coin_tmp.wav', coin)

# ---------------- bgm_festive.mp3: lively melody ----------------
F_high = {
    'C4':261.63,'D4':293.66,'E4':329.63,'G4':392.00,'A4':440.0,
    'C5':523.25,'D5':587.33,'E5':659.25,'G5':783.99,'A5':880.00
}
festive_mel = [
    ('C5',1),('A4',1),('G4',1),('E4',1),('D4',2),('G4',2),
    ('C4',1),('D4',1),('E4',2),('A4',1),('G4',1),('E4',2),
    ('G4',1),('A4',1),('C5',2),('A4',1),('G4',1),('E4',2),
    ('D4',1),('E4',1),('G4',2),('C4',1),('D4',1),('C4',2),
]
SIXTEENTH = 0.15
bgm_f = []
for note, beats in festive_mel:
    dur = SIXTEENTH * beats
    bgm_f += pluck(F_high[note], dur, 0.4)
p = max(1e-6, max(abs(s) for s in bgm_f)); bgm_f = [s*0.9/p for s in bgm_f]
bgm_f += [0.0]*int(SR*0.5)
write_wav('/tmp/bgm_festive_tmp.wav', bgm_f)

# ---------------- bgm_gong.mp3: slower gong/bell ambience ----------------
bgm_g = []
for n_idx in range(4): # 4 gong hits
    gong = []
    dur = 4.0
    for i in range(int(SR * dur)):
        t = i / SR
        env = math.exp(-t * 0.8)
        mod = math.sin(2*math.pi*155*t) * math.exp(-t*3)
        v = math.sin(2*math.pi*110*t + 2.5*mod)
        v += 0.2 * math.sin(2*math.pi*600*t) * math.exp(-t*4)
        v += 0.1 * math.sin(2*math.pi*870*t) * math.exp(-t*5)
        gong.append(v * env)
    bgm_g += gong
p = max(1e-6, max(abs(s) for s in bgm_g)); bgm_g = [s*0.9/p for s in bgm_g]
write_wav('/tmp/bgm_gong_tmp.wav', bgm_g)


# ---------------- encode bgm -> mp3, others stay wav ----------------
mp3_files = [
    ('/tmp/bgm_tmp.wav', 'public/assets/audio/bgm.mp3'),
    ('/tmp/bgm_festive_tmp.wav', 'public/assets/audio/bgm_festive.mp3'),
    ('/tmp/bgm_gong_tmp.wav', 'public/assets/audio/bgm_gong.mp3'),
]
for src, dst in mp3_files:
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',src,
                    '-codec:a','libmp3lame','-b:a','128k',dst], check=True)

import shutil
wav_files = [
    ('/tmp/splash_tmp.wav', 'public/assets/audio/splash.wav'),
    ('/tmp/sneeze_tmp.wav', 'public/assets/audio/sneeze.wav'),
    ('/tmp/capture_tmp.wav', 'public/assets/audio/capture.wav'),
    ('/tmp/dice_roll_tmp.wav', 'public/assets/audio/dice_roll.wav'),
    ('/tmp/win_chime_tmp.wav', 'public/assets/audio/win_chime.wav'),
    ('/tmp/coin_tmp.wav', 'public/assets/audio/coin.wav'),
]
for src, dst in wav_files:
    shutil.move(src, dst)

print("done")