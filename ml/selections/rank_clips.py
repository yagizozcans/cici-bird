"""Rank one species' clips by what THIS pipeline actually needs.

v1 was wrong and worth recording: it combined SNR, in-band share, tonality and
coverage as z-scores, and ranked 2nd a clip that is 92% silence. SNR is defined
as voiced-mean over unvoiced-mean, so a clip where only the few loudest frames
clear the voicing threshold scores brilliantly on it — snr and coverage
correlated at -0.74, i.e. the composite was partly rewarding emptiness.

So: HARD FILTERS for the things that are simply disqualifying, then rank the
survivors on the one quantity that determines what the model is taught —
whether the pitch tracker can lock on. The model never sees the audio. It sees
(f0, loudness). A clip where f0 is guesswork teaches guesswork.

  peak_dom    during voiced frames, how much of the in-band energy sits in the
              dominant peak. A clean tonal note gives a sharp peak; noise
              spreads it. This is pitch-track CONFIDENCE.
  continuity  how smooth the resulting f0 track is, as the share of frame-to-
              frame jumps under 300 Hz. A tracker locked onto a real note glides;
              one chasing noise teleports around the band.

v2 — SPECIES-AWARE. This was hardcoded to the wren, which meant the second bird
got a copy of the file with three constants edited: two rankings that would
silently drift apart. The band, the window and the corpus now come from the
species registry, so "how we choose clips" has one definition and each bird
differs only by the flags in its selection log.

    python selections/rank_clips.py --species bewicks_wren     --n 250
    python selections/rank_clips.py --species northern_cardinal --n 250
"""
import os, sys, json, argparse, numpy as np
ML = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ML); sys.path.insert(0, ML)
import species as SP
from config import SAMPLE_RATE, HOP
from data import list_clips, load_clip

ap = argparse.ArgumentParser()
SP.add_argument(ap)
ap.add_argument("--n", type=int, default=250, help="how many clips to select")
ap.add_argument("--cap", type=int, default=8,
                help="max clips taken from any one recording, so a single "
                     "loud bird cannot become the species")
ap.add_argument("--out", default=None, help="where to write the JSON selection")
a = ap.parse_args()

sp = SP.get(a.species)
out = a.out or os.path.join("selections", f"{sp.code}_best{a.n}.json")
paths = list_clips(sp)
print(SP.banner(sp, len(paths)))

# The ranking must analyse the audio the way TRAINING will: same band, same
# window. Scoring at the wren's 1024 and training at 256 would rank clips on a
# pitch track the model never sees.
WIN = sp.win
freqs = np.fft.rfftfreq(WIN, 1/SAMPLE_RATE); w = np.hanning(WIN)
band = (freqs >= sp.fmin) & (freqs <= sp.fmax)
fb = freqs[band]

rows = []
for n, p in enumerate(paths, 1):
    x = load_clip(p)
    if x.max() <= 0: continue
    idx = np.arange(WIN)[None,:] + HOP*np.arange(1+(len(x)-WIN)//HOP)[:,None]
    seg = x[idx]
    S = np.abs(np.fft.rfft(seg*w, axis=1)) + 1e-12
    rms = np.sqrt((seg**2).mean(1))
    thr = 0.15*np.quantile(rms, 0.95)
    voiced = rms > thr
    if voiced.sum() < 30: continue
    Sb = S[voiced][:, band]
    k = Sb.argmax(1)
    # peak dominance: energy within +/-2 bins of the peak, over in-band total
    lo = np.clip(k-2, 0, None); hi = np.clip(k+3, None, Sb.shape[1])
    dom = np.array([Sb[i, lo[i]:hi[i]].sum()/Sb[i].sum() for i in range(len(k))])
    f0 = fb[k]
    d = np.abs(np.diff(f0))
    cont = float((d < 300).mean()) if len(d) else 0.0
    rows.append(dict(name=os.path.basename(p), rec=os.path.basename(p).split("-")[0],
                     dom=float(np.median(dom)), cont=cont,
                     cov=float(voiced.mean()),
                     inb=float(S[voiced][:, band].sum()/S[voiced].sum()),
                     peak=float(np.abs(x).max()),
                     clip=float((np.abs(x) >= 0.999).mean())))
    if n % 200 == 0: print(f"  {n}/{len(paths)}", flush=True)
print(f"\nscored {len(rows)} clips")

# ---- hard filters ----------------------------------------------------------
# Every clip in this corpus is peak-normalised to 1.0, so "has a sample at full
# scale" is true of all of them and says nothing. Real clipping is FLAT-TOPPING —
# many samples pinned at the rail — so the test is a fraction, not a presence.
def keep(r):
    return (r["cov"] >= 0.20 and r["clip"] <= 0.001 and r["inb"] >= 0.90)
ok = [r for r in rows if keep(r)]
print(f"\nhard filters (>=20% song, no clipping, >=90% energy in band):")
for lab, f in [("too little song (<20% voiced)", lambda r: r['cov'] < 0.20),
               ("flat-topped / clipped (>0.1% at rail)", lambda r: r['clip'] > 0.001),
               ("energy outside the band (<90%)", lambda r: r['inb'] < 0.90)]:
    print(f"  rejected by {lab:34} {sum(1 for r in rows if f(r)):4}")
print(f"  survivors: {len(ok)}")
if len(ok) < a.n:
    raise SystemExit(f"only {len(ok)} clips survive the filters, fewer than the "
                     f"{a.n} requested — loosen the filters deliberately or ask "
                     f"for fewer clips, do not pad with rejects")

d = np.array([r["dom"] for r in ok]); c = np.array([r["cont"] for r in ok])
# Report the correlation rather than asserting it. On the wren the two axes are
# nearly independent and the sum genuinely combines two judgements; on a bird
# where they collapse together the sum is really just peak-dominance wearing a
# second name, and you should know which one you got.
r_ax = float(np.corrcoef(d, c)[0, 1])
verdict = ("two largely independent judgements" if abs(r_ax) < 0.5 else
           "NOTE: these axes mostly agree — the composite is close to peak_dom alone")
print(f"\nranking axes on survivors:  peak_dom vs continuity  r = {r_ax:+.2f}   {verdict}")
score = (d-d.mean())/d.std() + (c-c.mean())/c.std()
for r, s in zip(ok, score): r["score"] = float(s)
ok.sort(key=lambda r: -r["score"])

# Was a pre-existing hand-picked subset actually a quality selection? Only the
# wren has one to check against.
if sp.key == "bewicks_wren":
    orig = {os.path.basename(p) for p in list_clips(SP.get("bewicks_wren_222"))}
    A = np.array([r["score"] for r in ok if r["name"] in orig])
    B = np.array([r["score"] for r in ok if r["name"] not in orig])
    print(f"\nwas the original 222 a quality selection?")
    print(f"  in the 222 : mean {A.mean():+.3f} (n={len(A)})")
    print(f"  the rest   : mean {B.mean():+.3f} (n={len(B)})")
    print(f"  -> {'YES, it was curated' if A.mean()-B.mean() > 0.2 else 'NO — no meaningful quality difference'}")

# ---- pick n, capped per recording so one bird cannot dominate --------------
sel, used = {}, []
for r in ok:
    if used.count(r["rec"]) >= a.cap: continue
    used.append(r["rec"]); sel[r["name"]] = r
    if len(sel) >= a.n: break
sel = list(sel.values())
print(f"\nselected {len(sel)} clips from {len(set(used))} recordings (cap {a.cap}/recording)")
for lab, key in [("peak-dominance", "dom"), ("continuity", "cont"), ("song coverage", "cov")]:
    print(f"  median {lab:15} selected {np.median([r[key] for r in sel]):.3f}"
          f"  vs corpus {np.median([r[key] for r in rows]):.3f}")
json.dump([r["name"] for r in sel], open(out, "w"))
print(f"\nwrote {out}")
print("top 5:")
for r in sel[:5]:
    print(f"  {r['name']:16} dom {r['dom']:.3f}  cont {r['cont']:.3f}  cov {100*r['cov']:4.1f}%")
