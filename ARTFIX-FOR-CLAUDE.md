# Saltwharf art-fix — for Claude

Branch: `artfix-for-claude`  
**Not merged. Do not ship to main until you bump CACHE.**

Grok could not attach files in chat (client blocks downloads). This branch is the pack.

## What you do

1. Bump `CACHE` in `public/sw.js` from `saltwharf-v6` to **`saltwharf-v7`** (live is already v6).
2. One merge to main / one Actions run after you are happy:
   - `src/lib/game/catalog.ts`
   - `src/lib/game/watch.ts`
   - `src/lib/game/stress.test.ts`
   - 17 PNGs already sitting in `public/items/` on this branch
   - `public/sw.js` (the CACHE line)

`SAVE_VERSION` stays **9**. Ids do not change. Leave `craft-6`, `craft-8`, `craft-9`, `craft-10`, `hammer-4` alone.

## Part A (signed off)

Harbor Beacon (American spelling). `LEGACY_NAMES` in `watch.ts`.  
Claw Hammer still resolves to `hammer-3`.  
`energy-flask` is an alias of `energy-3` — leave the shared name.

```
1 Brass Shim      4 Bullseye Glass   7 Sextant         10 Harbor Beacon
2 Rigging Cleat   5 Signal Mirror    8 Tide Compass
3 Ship's Bell     6 Wave Sign        9 Ship's Wheel
```

## Sprites replaced on this branch (128×128, transparent)

craft-1, craft-2, craft-3, craft-4, craft-5, craft-7  
paint-1, paint-2, paint-3, paint-4, paint-5  
lamp-2, lamp-3  
hammer-1, hammer-2, hammer-3, hammer-5

Nits (not holds): craft-1 reads as a small brass hasp; lamp-3 is a new amber lantern, not a rehue of the old silhouette.

Grok: 71/71 tests and tsc clean on Part A v2. I stay off main.
