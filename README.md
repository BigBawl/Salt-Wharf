# Saltwharf

Merge the tide, restore the cove.

A painterly harbor **merge-and-restore** game. Spend energy to tap crates, merge finds on a 7×8 dock, fill tickets for Mae, Lila, and Holt, then spend pearls and tools on the next building. Each restored site mails a new crate. Walk the town and watch the lights come back.

Play in the browser, install it as an app from your phone, or run it on your own machine.

## Play

| How | What to do |
| --- | --- |
| **GitHub Pages** | Open [https://bigbawl.github.io/Salt-Wharf/](https://bigbawl.github.io/Salt-Wharf/) after Pages is enabled |
| **Install as an app** | Open the site on your phone → Share / browser menu → **Add to Home Screen**. It runs fullscreen and saves on the device. |
| **Download & run locally** | Grab a [Release zip](https://github.com/BigBawl/Salt-Wharf/releases), unzip, then `npm install` and `npm run dev` |
| **Static folder** | After `npm run build`, serve the `dist/` folder (any static host). Opening `dist/index.html` as a file also works for a quick look. |

Progress lives in your browser (`localStorage`). Clearing site data starts a new tide.

## How the loop works

1. **Gather** — tap a crate. Each tap costs one energy. Energy returns every 15 seconds, up to 100.
2. **Merge** — drag two matching finds together. Merge is free. Double-tap a find to sell it, or drop it on the gold well by the cupboard.
3. **Fill** — four orders at a time. Tools come with the pay.
4. **Restore** — hammer, paint, lamp, and pearls buy the next place on the cove. Walk the town and tap a building to pay.
5. **Mail** — a restored site sends the next crate to your inbox.

Crates rest after a handful of taps (10 on a small crate, 14 on a big one) and come back in a few seconds.

## Run from source

Needs Node 22+.

```bash
git clone https://github.com/BigBawl/Salt-Wharf.git
cd Salt-Wharf
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

```bash
npm run build      # static files in dist/
npm run preview    # serve the build
npm test           # merge-loop stress tests
```

## Controls

- **Tap** a crate to gather, a find to select
- **Drag** finds to merge, move, or park in the cupboard
- **Double-tap** a find to sell
- **Walk the cove** — drag to look, WASD or the stick to walk, tap a house to restore
- Progress and mute save automatically

## Stack

React 19, Vite, Tailwind v4, Zustand, Three.js (`@react-three/fiber`). No account, no server — the dock is yours.

## License

MIT. Original coastal town; not a copy of any commercial merge title.
