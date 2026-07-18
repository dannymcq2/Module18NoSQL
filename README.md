# 🎧 EarGym — Train Your Ears

A SoundGym-style ear training web app for producers and audio engineers. All sound is synthesized in the browser with the Web Audio API — no audio files, no build step, works offline.

**[Open `index.html` to play](index.html)** (or serve the folder with any static server).

## Games

| Game | Skill |
|------|-------|
| 🎚️ **EQ Detective** | Identify which frequency band is boosted in pink noise — the core mixing/mastering skill |
| 🎛️ **Pan Precision** | Pinpoint where a sound sits in the stereo field (headphones recommended) |
| 🔊 **dB Boss** | Pick the louder of two clips, down to sub-1 dB differences |
| 🧪 **Filter Lab** | Name the filter type by ear: low-pass, high-pass, band-pass, notch |

## Progression

- **10-round workouts** with scoring, combo streak bonuses, and difficulty multipliers
- **XP and levels** — earn XP every workout, level up your profile
- **Adaptive difficulty** — score 80%+ to get promoted (Easy → Medium → Hard → Pro); each tier shrinks the boost, tightens the pan positions, or narrows the dB gap
- **Daily streaks** 🔥 and per-game personal bests, saved locally in your browser

## Tech

Vanilla HTML/CSS/JS. Pink noise is generated with the Paul Kellet filter method; EQ boosts, filters, panning, and level changes use native `BiquadFilterNode`, `StereoPannerNode`, and `GainNode` chains. Progress persists in `localStorage`.

## Also in this repo

- [`beatvisual/`](beatvisual/) — circular audio visualizer for your own beat files
- `module18/`, `module20hw/` — coursework projects
