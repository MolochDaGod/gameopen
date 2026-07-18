# App-wide music — CPT RAC + radio stations

**Default soundtrack:** Racalvin / CPT RAC local MP3 set under `public/audio/dj/`.  
**Engine:** `musicStation` singleton (survives mode switches).  
**UI:** `DjStationPanel` in Danger Room menubar + Test Play topbar.

## Why

CombatSfx used a **generative synth bed**. The full DJ playlist existed but was never wired. Now:

1. `bootAppMusic()` loads the last station (default **cpt-rac** full set).
2. First click/key resumes playback (browser autoplay rules).
3. Generative bed only starts if no playlist is active.
4. DJ booth pulse reads the **live spectrum** of the real track.

## Local playlists (`djPlaylist.ts`)

| Station id | Name | Tracks |
| --- | --- | --- |
| `cpt-rac` | CPT RAC Station | Full 14-track set |
| `rac-anthems` | RAC Anthems | Rac / pirate titles |
| `warlords-set` | Warlords Set | Horns, siege, kingpins |
| `remixes` | RAC Remixes | Remix + experimental |

## Streamed stations (Audius)

Lo-Fi, Ambient, Classical, Jazz, Electronic, Hip-Hop, Rock — free trending, no API key.

## Key files

| File | Role |
| --- | --- |
| `three/audio/djPlaylist.ts` | Local track lists |
| `three/audio/radioStations.ts` | Station catalog + `bootAppMusic` / `assertStation` |
| `three/audio/musicStation.ts` | Dual-deck player, crossfade, pulse |
| `hooks/useAppMusic.ts` | React wiring + gesture unlock |
| `components/DjStationPanel.tsx` | Transport + station picker UI |

## Mixer

Music channel + master mute drive `musicStation.setLevel` / `setMuted` from App sound state and Studio.
