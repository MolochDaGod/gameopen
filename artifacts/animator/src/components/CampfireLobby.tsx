/**
 * Ethereal Falls campfire — 4-slot GRUDOX hero stage + Avatar Editor entry.
 * Main visual for Characters GRUDOX (collection hub).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { gameSession } from "../game/GameSession";
import {
  buildGenesisHeroOptions,
  type GenesisHeroOption,
} from "../lib/grudoxRoster";
import { CampfireLobbyScene } from "../three/intro/CampfireLobbyScene";
import "./campfireLobby.css";

interface Props {
  onExit: () => void;
  onNavigate: (mode: string) => void;
  /** Open Avatar Edit (Explorer modular head). */
  onAvatarEdit?: () => void;
  /** Enter Danger Room with selected hero. */
  onPlayDanger?: (hero: GenesisHeroOption) => void;
}

export function CampfireLobby({ onExit, onNavigate, onAvatarEdit, onPlayDanger }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<CampfireLobbyScene | null>(null);
  const [heroes, setHeroes] = useState<GenesisHeroOption[]>(() =>
    buildGenesisHeroOptions(
      gameSession.snapshot.characters,
      gameSession.snapshot.selectedCharacterId,
    ),
  );
  const [selected, setSelected] = useState(0);

  const active = heroes[selected] ?? heroes[0] ?? null;

  useEffect(() => {
    const unsub = gameSession.subscribe(() => {
      setHeroes(
        buildGenesisHeroOptions(
          gameSession.snapshot.characters,
          gameSession.snapshot.selectedCharacterId,
        ),
      );
    });
    if (!gameSession.snapshot.ready) {
      void gameSession.boot().catch(() => undefined);
    }
    return unsub;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let scene: CampfireLobbyScene | null = null;
    try {
      scene = new CampfireLobbyScene(canvas, {
        onSelect: (i) => setSelected(i),
      });
      sceneRef.current = scene;
      void scene.setHeroes(heroes);
    } catch (err) {
      console.warn("[CampfireLobby] init failed", err);
    }
    return () => {
      scene?.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once; heroes via effect below
  }, []);

  useEffect(() => {
    void sceneRef.current?.setHeroes(heroes);
  }, [heroes]);

  useEffect(() => {
    sceneRef.current?.setSelected(selected);
    const h = heroes[selected];
    if (h) {
      gameSession.selectCharacter(h.id);
    }
  }, [selected, heroes]);

  const slots = useMemo(() => {
    const out: (GenesisHeroOption | null)[] = [null, null, null, null];
    for (let i = 0; i < 4; i++) out[i] = heroes[i] ?? null;
    return out;
  }, [heroes]);

  return (
    <div className="cfl-root">
      <canvas ref={canvasRef} className="cfl-canvas" />
      <div className="cfl-vignette" aria-hidden />

      <header className="cfl-bar">
        <div className="cfl-brand">
          CHARACTERS<span>GRUDOX</span>
          <em>Ethereal Falls · campfire</em>
        </div>
        <div className="cfl-actions">
          <button type="button" className="cfl-btn primary" onClick={() => onAvatarEdit?.()}>
            Avatar editor
          </button>
          <button
            type="button"
            className="cfl-btn"
            disabled={!active}
            onClick={() => active && onPlayDanger?.(active)}
          >
            Danger Room
          </button>
          <button type="button" className="cfl-btn" onClick={() => onNavigate("realms")}>
            Realms
          </button>
          <button type="button" className="cfl-btn" onClick={() => onNavigate("account")}>
            Account
          </button>
          <button type="button" className="cfl-btn" onClick={onExit}>
            ↩ Home
          </button>
        </div>
      </header>

      <div className="cfl-slots">
        {slots.map((h, i) => (
          <button
            key={i}
            type="button"
            className={`cfl-slot ${i === selected ? "on" : ""} ${h ? "" : "empty"}`}
            onClick={() => setSelected(i)}
          >
            <span className="cfl-slot-idx">Seat {i + 1}</span>
            <strong>{h?.name ?? "Empty"}</strong>
            <span className="cfl-slot-meta">
              {h ? `${h.raceLabel} · ${h.source}` : "Add hero in Account"}
            </span>
          </button>
        ))}
      </div>

      {active && (
        <div className="cfl-active">
          <div>
            <b>{active.name}</b>
            <span>
              {active.raceLabel} · base {active.baseId}
            </span>
          </div>
          <p>
            Explorer design system (Avatar Edit head) applies when you save a head in the editor —
            same pipeline as threejs-rapier play-shell.
          </p>
        </div>
      )}
    </div>
  );
}
