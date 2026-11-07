"""30초 쇼릴용 오리지널 배경음악 합성기 (numpy만 사용).

갤럭시 광고 음악 '스타일'(밝고 미래적인 일렉트로닉 팝)을 참고한 순수 오리지널 곡이다.
삼성 공식 음원/멜로디는 사용하지 않는다.

구성 (120 BPM, 1마디 = 2초, 키: C장조/A단조):
  0~2s   인트로 패드 + 쉬머, 2초에 임팩트
  2~12s  플럭 아르페지오 + 베이스 + 킥
  12~14s 빌드업 (라이저, 스네어 롤)
  14~24s 드롭 (4-on-the-floor, 리드 멜로디)
  24~26s 빌드업
  26~30s 아웃트로 임팩트 + 마지막 코드 잔향
"""
import wave
import numpy as np

SR = 44100
DUR = 30.0
BPM = 120
BEAT = 60 / BPM          # 0.5s
BAR = BEAT * 4           # 2.0s
N = int(SR * DUR)
rng = np.random.default_rng(7)

L = np.zeros(N)
R = np.zeros(N)


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(sig, start, gain=1.0, pan=0.0):
    """sig(mono)를 start초 위치에 더한다. pan: -1(왼)~1(오)."""
    i0 = int(start * SR)
    if i0 >= N:
        return
    sig = sig[: N - i0]
    gl = np.cos((pan + 1) * np.pi / 4) * gain
    gr = np.sin((pan + 1) * np.pi / 4) * gain
    L[i0:i0 + len(sig)] += sig * gl
    R[i0:i0 + len(sig)] += sig * gr


def add_st(sl, sr_, start, gain=1.0):
    i0 = int(start * SR)
    n = min(len(sl), N - i0)
    L[i0:i0 + n] += sl[:n] * gain
    R[i0:i0 + n] += sr_[:n] * gain


def adsr(n, a=0.01, d=0.1, s=0.7, r=0.2):
    t = np.arange(n) / SR
    total = n / SR
    env = np.ones(n) * s
    env[t < a] = t[t < a] / a
    m = (t >= a) & (t < a + d)
    env[m] = 1 - (1 - s) * (t[m] - a) / d
    rm = t > total - r
    env[rm] *= np.clip((total - t[rm]) / r, 0, 1)
    return env


def saw_additive(f0, n, cutoff, harmonics=40, phase=0.0):
    """배음 합성 톱니파 + (시간가변) 저역통과 필터. cutoff: 스칼라 또는 길이 n 배열."""
    t = np.arange(n) / SR
    out = np.zeros(n)
    cutoff = np.broadcast_to(cutoff, (n,))
    for k in range(1, harmonics + 1):
        fk = f0 * k
        if fk > SR / 2.2:
            break
        g = 1.0 / (1.0 + (fk / cutoff) ** 4)
        out += g * np.sin(2 * np.pi * fk * t + phase * k) / k
    return out


def lowpass_fft(x, fc):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1.0 / (1.0 + (f / fc) ** 4)
    return np.fft.irfft(X, len(x))


def highpass_fft(x, fc):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1.0 / (1.0 + (fc / np.maximum(f, 1)) ** 4)
    return np.fft.irfft(X, len(x))


def bandpass_fft(x, lo, hi):
    return highpass_fft(lowpass_fft(x, hi), lo)


# ---------------------------------------------------------------- 코드 진행
# IV - V - vi - I  (F - G - Am - C), 마디마다 1개 코드
CHORDS = [
    [53, 57, 60, 64],   # Fmaj7 (F A C E)
    [55, 59, 62, 67],   # G     (G B D G)
    [57, 60, 64, 67],   # Am7   (A C E G)
    [48, 55, 60, 64],   # C     (C G C E)
]
ROOTS = [41, 43, 45, 36]  # 베이스 루트 (F2 G2 A2 C2)


def chord_at(bar):
    return CHORDS[bar % 4], ROOTS[bar % 4]


# ---------------------------------------------------------------- 악기
def pad(notes, dur, cutoff_start, cutoff_end):
    n = int(dur * SR)
    cutoff = np.linspace(cutoff_start, cutoff_end, n)
    sl = np.zeros(n)
    sr_ = np.zeros(n)
    for m in notes:
        f = midi_hz(m)
        for det, p in ((-0.12, -0.6), (0.0, 0.0), (0.12, 0.6)):
            v = saw_additive(f * 2 ** (det / 12), n, cutoff, 30, rng.uniform(0, 6.28))
            sl += v * np.cos((p + 1) * np.pi / 4)
            sr_ += v * np.sin((p + 1) * np.pi / 4)
    env = adsr(n, a=0.35, d=0.3, s=0.85, r=0.5)
    return sl * env, sr_ * env


def pluck(m, dur=0.35, bright=4000):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = midi_hz(m)
    cutoff = 300 + bright * np.exp(-t * 18)
    v = saw_additive(f, n, cutoff, 24) + 0.5 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t * 25)
    return v * np.exp(-t * 9) * np.minimum(1, t / 0.002)


def bell(m, dur=0.7):
    """FM 벨 리드."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = midi_hz(m)
    idx = 2.5 * np.exp(-t * 6)
    v = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * 3.5 * t))
    v += 0.35 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t * 4)
    return v * np.exp(-t * 3.2) * np.minimum(1, t / 0.004)


def kick(dur=0.45):
    n = int(dur * SR)
    t = np.arange(n) / SR
    freq = 45 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(freq) / SR
    v = np.sin(ph) * np.exp(-t * 7.5)
    click = rng.standard_normal(n) * np.exp(-t * 300) * 0.25
    return np.tanh((v + click) * 1.6)


def clap(dur=0.35):
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = bandpass_fft(rng.standard_normal(n), 900, 5000)
    env = np.zeros(n)
    for off in (0.0, 0.011, 0.022):
        tt = t - off
        env += np.where(tt >= 0, np.exp(-np.maximum(tt, 0) * 60), 0) * 0.5
    env += np.exp(-t * 14) * 0.6
    return noise * env / np.max(np.abs(noise))


def hat(dur=0.08, open_=False):
    n = int((0.25 if open_ else dur) * SR)
    t = np.arange(n) / SR
    v = highpass_fft(rng.standard_normal(n), 7000)
    return v / np.max(np.abs(v)) * np.exp(-t * (12 if open_ else 55))


def bass_note(m, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = midi_hz(m)
    v = np.sin(2 * np.pi * f * t) + 0.35 * saw_additive(f, n, 600, 12)
    return v * adsr(n, a=0.005, d=0.08, s=0.8, r=0.05)


def riser(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = t / dur
    noise = rng.standard_normal(n)
    # 블록 단위로 밴드 이동
    out = np.zeros(n)
    blk = 2048
    for i in range(0, n, blk):
        seg = noise[i:i + blk]
        c = 400 + 9000 * (i / n) ** 2
        out[i:i + blk] = bandpass_fft(seg, c * 0.6, c * 1.6) if len(seg) > 64 else 0
    sweep_f = 200 * 2 ** (x * 3)
    sweep = np.sin(2 * np.pi * np.cumsum(sweep_f) / SR) * 0.3
    return (out / (np.max(np.abs(out)) + 1e-9) + sweep) * x ** 2


def impact(dur=2.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    freq = 38 + 80 * np.exp(-t * 10)
    boom = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t * 2.2)
    noise = lowpass_fft(rng.standard_normal(n), 3000) * np.exp(-t * 5) * 0.4
    return np.tanh((boom + noise) * 1.4)


def shimmer(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    v = np.zeros(n)
    for m in (84, 88, 91, 95):
        v += np.sin(2 * np.pi * midi_hz(m) * t + rng.uniform(0, 6)) * (0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(0.3, 1.2) * t))
    return v / 4


# ---------------------------------------------------------------- 편곡
sidechain = np.ones(N)


def duck(start, depth=0.75, rel=0.22):
    i0 = int(start * SR)
    n = int(rel * SR)
    if i0 >= N:
        return
    n = min(n, N - i0)
    t = np.arange(n) / SR
    sidechain[i0:i0 + n] = np.minimum(sidechain[i0:i0 + n], 1 - depth * np.exp(-t / (rel / 3.5)))


music_L = np.zeros(N)  # 사이드체인 대상 버스
music_R = np.zeros(N)


def add_music(sl, sr_, start, gain):
    i0 = int(start * SR)
    n = min(len(sl), N - i0)
    music_L[i0:i0 + n] += sl[:n] * gain
    music_R[i0:i0 + n] += sr_[:n] * gain


# 패드 (전체 구간)
for bar in range(15):
    notes, _ = chord_at(bar)
    t0 = bar * BAR
    if bar == 0:
        c0, c1, g = 400, 2200, 0.09
    elif bar in (6, 12):
        c0, c1, g = 1200, 5000, 0.08
    elif 7 <= bar <= 11:
        c0, c1, g = 2600, 2600, 0.075
    elif bar >= 13:
        c0, c1, g = 3000, 900, 0.1
    else:
        c0, c1, g = 1500, 1800, 0.07
    dur = BAR + 0.6 if bar < 14 else 2.0
    pl, pr = pad(notes, dur, c0, c1)
    add_music(pl, pr, t0, g)

# 마지막 코드는 길게 (26~30s), 끝으로 갈수록 페이드
pl, pr = pad([48, 55, 60, 64, 67, 72], 4.0, 3500, 700)
fade = np.linspace(1, 0, len(pl)) ** 1.5
add_music(pl * fade, pr * fade, 26.0, 0.09)

# 쉬머 인트로
add(shimmer(2.4) * adsr(int(2.4 * SR), a=1.2, d=0.1, s=1, r=0.6), 0.0, 0.05, 0.0)

# 플럭 아르페지오 (16분음표) 2~12s, 14~24s
ARP_PATTERN = [0, 1, 2, 3, 2, 1, 3, 2]
for bar in list(range(1, 7)) + list(range(7, 12)):
    notes, _ = chord_at(bar)
    arp_notes = notes + [notes[1] + 12, notes[2] + 12]
    for i in range(16):
        t0 = bar * BAR + i * BEAT / 4
        if bar == 6 and i >= 8:
            break
        m = arp_notes[(ARP_PATTERN[i % 8] + (i // 8) * 2) % len(arp_notes)] + 12
        bright = 2500 + (2500 if bar >= 7 else 0)
        p = pluck(m, 0.3, bright)
        # 스테레오 핑퐁 (짝수 스텝 왼쪽, 홀수 스텝 오른쪽 강조)
        gl, gr = (1.0, 0.6) if i % 2 == 0 else (0.6, 1.0)
        add_music(p * gl, p * gr, t0, 0.07)

# 베이스 (8분음표 오프비트 펌핑) 2~12s, 14~24s
for bar in list(range(1, 6)) + list(range(7, 12)):
    _, root = chord_at(bar)
    for i in range(8):
        t0 = bar * BAR + i * BEAT / 2
        m = root + (12 if i % 2 else 0)
        b = bass_note(m, BEAT / 2 * 0.9)
        add_music(b, b, t0, 0.16)

# 킥
for bar in range(1, 13):
    for beat in range(4):
        t0 = bar * BAR + beat * BEAT
        if 1 <= bar <= 5 and beat not in (0, 2):
            continue  # 하프타임
        if bar == 6 and beat >= 2:
            continue
        if bar == 12 and beat >= 2:
            continue
        add(kick(), t0, 0.5)
        duck(t0)

# 클랩 (2, 4박) 6~12s, 14~24s
for bar in list(range(3, 6)) + list(range(7, 12)):
    for beat in (1, 3):
        add(clap(), bar * BAR + beat * BEAT, 0.18, 0.1)

# 하이햇
for bar in list(range(1, 6)) + list(range(7, 12)):
    for i in range(8):
        t0 = bar * BAR + i * BEAT / 2
        if i % 2:
            add(hat(open_=(bar >= 7)), t0, 0.06 if bar >= 7 else 0.045, 0.3)
        elif bar >= 7:
            add(hat(), t0 + BEAT / 4, 0.03, -0.3)

# 스네어 롤 빌드업 (12~14s, 24~26s)
for start in (12.0, 24.0):
    steps = 16
    for i in range(steps):
        t0 = start + 1.0 + i * (1.0 / steps)
        add(clap(0.15), t0, 0.04 + 0.12 * i / steps, 0.0)
    add(riser(2.0), start, 0.12)

# 리드 멜로디 (드롭 14~24s): 8분음표 그리드, None = 쉼표
MELODY = [
    # F            # G             # Am            # C
    [69, None, 72, None, 76, 74, 72, None],
    [71, None, 74, None, 79, None, 74, 72],
    [72, None, 76, None, 79, 77, 76, None],
    [74, 72, None, 67, 72, None, None, None],
    [69, None, 72, None, 76, 74, 72, None],
]
for k, bar in enumerate(range(7, 12)):
    for i, m in enumerate(MELODY[k]):
        if m is None:
            continue
        t0 = bar * BAR + i * BEAT / 2
        v = bell(m + 12, 0.8)
        add(v, t0, 0.07, -0.25)
        add(v, t0 + BEAT * 0.75, 0.025, 0.4)  # 딜레이 에코

# 임팩트
add(impact(2.0), 2.0, 0.35)
add(impact(2.0), 14.0, 0.3)
add(impact(3.5), 26.0, 0.42)

# 아웃트로 벨 모티프 (26~30s)
for i, m in enumerate([72, 76, 79, 84]):
    add(bell(m + 12, 1.6), 26.0 + i * BEAT / 2, 0.06, (-0.4, -0.1, 0.2, 0.4)[i])

# ---------------------------------------------------------------- 믹스
music_L *= sidechain
music_R *= sidechain
L += music_L
R += music_R


def reverb(x, decay=1.6, mix=0.22, seed=3):
    r = np.random.default_rng(seed)
    n = int(decay * SR)
    t = np.arange(n) / SR
    ir = r.standard_normal(n) * np.exp(-t * 6.9 / decay)
    ir = lowpass_fft(ir, 6000)
    ir /= np.sqrt(np.sum(ir ** 2))
    size = len(x) + n
    nfft = 1 << (size - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)[: len(x)]
    return x * (1 - mix) + y * mix


L = reverb(L, seed=3)
R = reverb(R, seed=4)

# 마스터: 하이패스 30Hz, 소프트 클립, 노멀라이즈, 끝부분 페이드
L = highpass_fft(L, 30)
R = highpass_fft(R, 30)
peak = max(np.max(np.abs(L)), np.max(np.abs(R)))
L = np.tanh(L / peak * 1.3) / np.tanh(1.3)
R = np.tanh(R / peak * 1.3) / np.tanh(1.3)
fade_n = int(1.2 * SR)
fade = np.linspace(1, 0, fade_n) ** 2
L[-fade_n:] *= fade
R[-fade_n:] *= fade
L[:200] *= np.linspace(0, 1, 200)
R[:200] *= np.linspace(0, 1, 200)

stereo = np.stack([L, R], axis=1) * 0.89
pcm = (stereo * 32767).astype(np.int16)

out = __import__("sys").argv[1] if len(__import__("sys").argv) > 1 else "music.wav"
with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("wrote", out, f"{DUR}s")
