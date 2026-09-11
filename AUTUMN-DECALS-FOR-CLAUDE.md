# Autumn decals — for Claude (4c wiring)

Branch `autumn-decals-for-claude`. **Not merged. CACHE still saltwharf-v8.**
4a is already on main (`e5d5764`). These three PNGs do nothing until you slot them.

| file | slot | parent |
|---|---|---|
| `public/season/autumn-corner-l.png` | season-corner-l | harbor-stage, top-left of the **3D cove strip** (not board-frame) |
| `public/season/autumn-corner-r.png` | season-corner-r | harbor-stage, top-right. HUD chips live here — keep the prop under 56px CSS and pointer-events none |
| `public/season/autumn-cove.png` | season-cove | cove-map-wrap, z-index between .town-layer and .town-pin, pointer-events none. 768×1152 2:3, matches cove-map.jpg |

Shown only when `html[data-season="autumn"]` and no holiday (or under thanksgiving too if you want the leaves to stay).

No CSS in this commit. You wire 4c. CACHE bump v8 → v9 on that merge.
SAVE_VERSION stays 9.

Note: the live dock the player stares at is CoveIso canvas, not cove-map.jpg. The photo overlay is for Walk the cove. Corners are how autumn reads on the dock strip tonight.
