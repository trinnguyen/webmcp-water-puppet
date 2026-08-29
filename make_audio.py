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

# ---------------- encode bgm -> mp3, others stay wav ----------------
for src,dst in [('/tmp/bgm_tmp.wav','public/assets/audio/bgm.mp3')]:
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',src,
                    '-codec:a','libmp3lame','-b:a','128k',dst], check=True)
import shutil
shutil.move('/tmp/splash_tmp.wav','public/assets/audio/splash.wav')
shutil.move('/tmp/sneeze_tmp.wav','public/assets/audio/sneeze.wav')
print("done")