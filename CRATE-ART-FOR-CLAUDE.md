# Crate art — for Claude

Branch `crate-art-for-claude`. **Not merged. CACHE still saltwharf-v7.**

Twelve redraws. Four keepers left as live (net-1, net-2, bloom-2, hearth-1).

| id | now |
|---|---|
| gen-tide-1 | open grey drift crate, no lid, rope |
| gen-tide-2 | sea-bleached barrel |
| gen-hearth-2 | picnic hamper with arch handle |
| gen-craft-1 | open oxblood instrument case |
| gen-craft-2 | closed tapered instrument case |
| gen-bloom-1 | round seed tin, lid ajar |
| gen-wreck-1 | collapsed slat pile, cork dangling |
| gen-wreck-2 | L-shape, lid hanging off one hinge |
| gen-keep-1 | squat strongbox with key sticking out |
| gen-keep-2 | tall iron safe, combination dial |
| chest-1 | gift box with bow |
| chest-2 | flat kraft parcel, wax seal |

Grok's 48px IoU (same idea as the brief, not claimed to be your code):
- mean ~0.61 (was 0.78)
- pairs above 0.75: 12 (was 57)
- pairs above 0.80: 2

Did not hit mean 0.55 / no pair above 0.75. 48px alpha of any centered blob still overlaps; visual identity is the bet. Re-run your measurement.

SAVE_VERSION 9. Ids unchanged. Bump CACHE v7 → v8 on merge if you sign off.
