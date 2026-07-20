/**
 * App-wide music: boots CPT RAC / local playlists + Audius stations into
 * {@link musicStation}, and exposes props for {@link DjStationPanel}.
 */
import { useCallback, useEffect, useState } from "react";
import { musicStation } from "../three/audio/musicStation";
import {
  assertStation,
  bootAppMusic,
  loadStationId,
  saveStationId,
  stationPlaylist,
  RADIO_STATIONS,
} from "../three/audio/radioStations";
import {
  loadDjStation,
  saveDjStation,
  type DjStationSettings,
} from "../three/djStationSettings";
import type { DjNowPlaying, DjStationBodyProps } from "../components/DjStationPanel";
import type { SoundSettings } from "../three/soundSettings";

export function useAppMusic(sound: SoundSettings) {
  const [djSettings, setDjSettings] = useState<DjStationSettings>(() => loadDjStation());
  const [stationId, setStationId] = useState(() => loadStationId());
  const [stationBusy, setStationBusy] = useState<string | null>(null);
  const [stationName, setStationName] = useState("CPT RAC Station");
  const [nowPlaying, setNowPlaying] = useState<DjNowPlaying | null>(null);
  const [titles, setTitles] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const [stationMuted, setStationMuted] = useState(false);

  // Boot playlist + wire track callback once
  useEffect(() => {
    musicStation.configure(loadDjStation());
    musicStation.setOnTrack((title, index) => {
      const info = musicStation.getInfo();
      setNowPlaying(
        info
          ? { title: title || info.title, index, count: info.count }
          : { title, index, count: musicStation.getTitles().length },
      );
      setTitles(musicStation.getTitles());
      setStationName(info?.name ?? "CPT RAC Station");
    });
    bootAppMusic();
    setTitles(musicStation.getTitles());
    const info = musicStation.getInfo();
    if (info) {
      setNowPlaying({ title: info.title, index: info.index, count: info.count });
      setStationName(info.name);
    }

    // Resume + play on first user gesture (browser autoplay policy).
    // Keep re-asserting resume on later gestures so tab sleep / interrupted
    // contexts start again without a full reload (controll parity).
    const unlock = () => {
      musicStation.resume();
      if (!musicStation.isPaused()) musicStation.play();
    };
    const keepAlive = () => musicStation.resume();
    window.addEventListener("pointerdown", unlock, { once: true, capture: true });
    window.addEventListener("keydown", unlock, { once: true, capture: true });
    window.addEventListener("pointerdown", keepAlive, { capture: true });
    window.addEventListener("keydown", keepAlive, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      window.removeEventListener("pointerdown", keepAlive, true);
      window.removeEventListener("keydown", keepAlive, true);
      musicStation.setOnTrack(null);
    };
  }, []);

  // Mixer levels + mute
  useEffect(() => {
    musicStation.setLevel(sound.music, sound.master);
    musicStation.setMuted(sound.muted);
  }, [sound.music, sound.master, sound.muted]);

  const onDjChange = useCallback((patch: Partial<DjStationSettings>) => {
    setDjSettings((prev) => {
      const next = { ...prev, ...patch };
      saveDjStation(next);
      musicStation.configure(next);
      return next;
    });
  }, []);

  const onStation = useCallback((id: string) => {
    if (!RADIO_STATIONS.some((s) => s.id === id)) return;
    setStationId(id);
    saveStationId(id);
    const def = RADIO_STATIONS.find((s) => s.id === id)!;
    musicStation.setStationName(def.name);
    setStationName(def.name);
    if (!def.genre) {
      assertStation((urls, titles) => {
        musicStation.setPlaylist(urls, titles);
        setTitles(titles);
        const info = musicStation.getInfo();
        if (info) setNowPlaying({ title: info.title, index: info.index, count: info.count });
      });
      return;
    }
    setStationBusy(def.name);
    void stationPlaylist(id)
      .then((list) => {
        musicStation.setPlaylist(list.urls, list.titles);
        setTitles(list.titles);
        const info = musicStation.getInfo();
        if (info) setNowPlaying({ title: info.title, index: info.index, count: info.count });
      })
      .catch(() => {
        // fallback CPT RAC
        assertStation((urls, titles) => {
          musicStation.setPlaylist(urls, titles);
          setTitles(titles);
        });
      })
      .finally(() => setStationBusy(null));
  }, []);

  const panelProps: DjStationBodyProps = {
    settings: djSettings,
    onChange: onDjChange,
    nowPlaying,
    titles,
    onPrev: () => {
      musicStation.prev();
      musicStation.resume();
    },
    onNext: () => {
      musicStation.next();
      musicStation.resume();
    },
    onSelect: (i) => {
      musicStation.playAt(i);
      musicStation.resume();
    },
    onReset: () => {
      musicStation.reset();
      musicStation.resume();
    },
    paused,
    muted: stationMuted,
    onTogglePlay: () => {
      if (musicStation.isPaused()) {
        musicStation.play();
        musicStation.resume();
        setPaused(false);
      } else {
        musicStation.pause();
        setPaused(true);
      }
    },
    onToggleMute: () => {
      const next = !musicStation.isStationMuted();
      musicStation.setStationMuted(next);
      setStationMuted(next);
    },
    onMixNext: () => {
      musicStation.mixNext();
      musicStation.resume();
    },
    stationId,
    onStation,
    stationBusy,
    stationName,
  };

  return { panelProps, musicStation };
}
