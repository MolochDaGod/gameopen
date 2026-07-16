import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Send,
  Trash2,
  DoorOpen,
  LayoutPanelTop,
  Dices,
  RotateCcw,
  UserCheck,
  Check,
} from "lucide-react";
import { LedMask, type FaceType, type MaskState } from "../three/LedMask";
import { SHELLS, type ShellId } from "../three/LedMaskShells";
import { FaceTracker } from "../three/live/FaceTracker";
import { MicLipSync } from "../three/live/MicLipSync";
import { Captioner } from "../three/live/Captioner";
import { useAssistant } from "../ai/useAssistant";
import { companionSystemPrompt, parseMood } from "../ai/companionPrompt";
import { FrameSkinModal } from "./FrameSkinModal";
import { FRAME_NONE, findFrame, loadFrameId, saveFrameId } from "./ledMaskFrames";
import { RoomGallery } from "./RoomGallery";
import type { RoomTarget } from "./ledMaskRooms";
import { HeadStage } from "../three/avatar/HeadStage";
import {
  BROW_STYLES,
  EYE_COLORS,
  EYE_STYLES,
  EXPRESSIONS,
  EXTRA_STYLES,
  FACIAL_HAIR_STYLES,
  GEAR_COLORS,
  HAIR_COLORS,
  HAIR_STYLES,
  HAT_STYLES,
  HEADGEAR_STYLES,
  MOUTH_STYLES,
  PAINT_COLORS,
  RACES,
  defaultConfig,
  earStylesFor,
  randomConfig,
  raceDef,
  sanitizeConfig,
  tuskStylesFor,
  type AvatarConfig,
  type RaceId,
} from "../three/avatar/catalog";
import { loadPlayerHeadConfig, savePlayerHeadConfig } from "../three/avatar/playerHead";
import { cssHex } from "../three/avatar/pixels";

interface Props {
  onExit: () => void;
  onNavigate: (target: RoomTarget) => void;
}

type RailTab = "live" | "design";
type StageView = "led" | "avatar";

const AVATAR_STORE = "ledmask:avatarConfig:v1";

function loadLedAvatar(): AvatarConfig {
  try {
    const fromPlayer = loadPlayerHeadConfig();
    if (fromPlayer) return fromPlayer;
    const raw = localStorage.getItem(AVATAR_STORE);
    if (raw) {
      const parsed = sanitizeConfig(JSON.parse(raw));
      if (parsed) return parsed;
    }
  } catch {
    /* ignore */
  }
  return defaultConfig("human");
}

const FACES: { id: FaceType; glyph: string; label: string }[] = [
  { id: "smile", glyph: "🙂", label: "SMILE" },
  { id: "happy", glyph: "😄", label: "HAPPY" },
  { id: "love", glyph: "😍", label: "LOVE" },
  { id: "wink", glyph: "😉", label: "WINK" },
  { id: "cool", glyph: "😎", label: "COOL" },
  { id: "mischief", glyph: "😈", label: "MISCHIEF" },
  { id: "surprise", glyph: "😲", label: "SURPRISE" },
  { id: "angry", glyph: "😠", label: "ANGRY" },
  { id: "sad", glyph: "😢", label: "SAD" },
  { id: "skeptical", glyph: "🤨", label: "SKEPTICAL" },
  { id: "neutral", glyph: "😐", label: "NEUTRAL" },
  { id: "sleepy", glyph: "😴", label: "SLEEPY" },
  { id: "dead", glyph: "💀", label: "DEAD" },
  { id: "matrix", glyph: "01", label: "MATRIX" },
  { id: "scan", glyph: "⟐", label: "SCAN" },
];

const STATES: { id: MaskState; label: string; danger?: boolean }[] = [
  { id: "idle", label: "IDLE" },
  { id: "talk", label: "TALK" },
  { id: "shout", label: "SHOUT" },
  { id: "whisper", label: "WHISPER" },
  { id: "cast", label: "CAST" },
  { id: "attack", label: "ATTACK MODE", danger: true },
];

// Numeric-keypad shortcuts for instant face changes (mirrors the physical keypad
// layout). Keyed by `e.code` so they only fire on the actual numpad, with an
// `e.key` symbol fallback for keyboards without a dedicated keypad.
const FACE_NUMPAD: Record<string, FaceType> = {
  NumpadDivide: "smile", // /
  NumpadMultiply: "happy", // *
  NumpadSubtract: "love", // -
  Numpad3: "sleepy", // 3
  NumpadAdd: "matrix", // +
  NumpadDecimal: "scan", // .
};
const FACE_SYMBOL: Record<string, FaceType> = {
  "/": "smile",
  "*": "happy",
  "-": "love",
  "+": "matrix",
  ".": "scan",
};

/**
 * Voxel LED Mask studio — an interactive AI face. A hooded voxel cube head with
 * an LED visor that: chats via the OpenAI assistant (its reply mood drives the
 * on-face expression and a live talk animation), tracks the pointer with its
 * eyes, and is always wearing an expression. Manual face/state/combat controls
 * remain for live tuning. Backed by {@link LedMask}.
 */
/** Friendly explanation for a getUserMedia failure (iframe blocks are common). */
function describeMediaError(err: unknown, device: string): string {
  const name = (err as { name?: string })?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return `${device} permission blocked. The embedded preview often disables this — open the app in a new browser tab (↗) and allow ${device.toLowerCase()} access.`;
  if (name === "NotFoundError" || name === "DevicesNotFoundError")
    return `No ${device.toLowerCase()} device was found.`;
  return `Could not start ${device.toLowerCase()}. Try opening the app in a browser tab and allowing access.`;
}

export function LedMaskMode({ onExit, onNavigate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<LedMask | null>(null);
  const avatarMountRef = useRef<HTMLDivElement>(null);
  const headStageRef = useRef<HeadStage | null>(null);
  const [banner, setBanner] = useState("HIGHPEAK DIGITAL");
  const [bannerOn, setBannerOn] = useState(false);
  const [face, setFace] = useState<FaceType>("smile");
  const [shell, setShell] = useState<ShellId>("hood");
  const [state, setState] = useState<MaskState>("idle");
  const [health, setHealth] = useState(1);
  const [webglFailed, setWebglFailed] = useState(false);
  const [draft, setDraft] = useState("");
  const [frameId, setFrameId] = useState<string>(loadFrameId);
  const [frameModal, setFrameModal] = useState(false);
  const [railTab, setRailTab] = useState<RailTab>("live");
  const [stageView, setStageView] = useState<StageView>("led");
  const [avatarCfg, setAvatarCfg] = useState<AvatarConfig>(loadLedAvatar);
  const [avatarSaved, setAvatarSaved] = useState(false);
  const [avatarStageFailed, setAvatarStageFailed] = useState(false);

  const frame = frameId === FRAME_NONE ? undefined : findFrame(frameId);
  // Draw the chosen tile as a 9-slice bezel: a transparent solid border whose
  // width insets the canvas, with the sliced image (incl. `fill` centre) painted
  // into that border region.
  const stageFrameStyle = frame
    ? {
        borderStyle: "solid" as const,
        borderWidth: "clamp(20px, 4.5vw, 42px)",
        borderColor: "transparent",
        borderImage: `url(${frame.src}) ${frame.slice} fill / 1 / 0 stretch`,
        background: "transparent",
      }
    : undefined;

  const pickFrame = (id: string) => {
    setFrameId(id);
    saveFrameId(id);
  };

  // Active Mode: live webcam→expression, mic→lip-sync, speech→captions.
  const faceRef = useRef<FaceTracker | null>(null);
  const micRef = useRef<MicLipSync | null>(null);
  const capRef = useRef<Captioner | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const liveFaceRef = useRef<FaceType | null>(null);
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [ccOn, setCcOn] = useState(false);
  const [camLoading, setCamLoading] = useState(false);
  const [micLoading, setMicLoading] = useState(false);
  const [liveCaption, setLiveCaption] = useState("");
  const [activeErr, setActiveErr] = useState("");
  const mediaSupported = FaceTracker.isSupported();
  const captionsSupported = Captioner.isSupported();

  const { messages, streaming, ready, send, clear } = useAssistant({
    surface: "companion",
    tools: [],
    getSystemPrompt: companionSystemPrompt,
  });
  const logRef = useRef<HTMLDivElement | null>(null);
  // Last mood applied to the face, so we only re-ignite on a genuine change.
  const lastMoodRef = useRef<string>("");
  // Mirror `streaming` + the last mic-driven state into refs so the long-lived
  // mic callback reads current values without being torn down on each change.
  const streamingRef = useRef(false);
  const micStateRef = useRef<MaskState>("idle");

  useEffect(() => {
    if (!canvasRef.current) return;
    const m = new LedMask(canvasRef.current);
    maskRef.current = m;
    m.onAutoIdle = () => setState("idle");
    setWebglFailed(m.webglFailed);
    setShell(m.getShell()); // restore the persisted housing shell
    return () => {
      m.dispose();
      maskRef.current = null;
    };
  }, []);

  // Voxel head stage — always attach once mount exists; survives tab switches.
  useEffect(() => {
    if (!avatarMountRef.current) return;
    if (headStageRef.current) return;
    try {
      const stage = new HeadStage(avatarMountRef.current);
      headStageRef.current = stage;
      stage.setConfig(avatarCfg);
      setAvatarStageFailed(false);
    } catch (err) {
      console.error("LedMask: avatar HeadStage unavailable", err);
      setAvatarStageFailed(true);
    }
    return () => {
      headStageRef.current?.dispose();
      headStageRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    headStageRef.current?.setConfig(avatarCfg);
    try {
      localStorage.setItem(AVATAR_STORE, JSON.stringify(avatarCfg));
    } catch {
      /* ignore */
    }
    setAvatarSaved(false);
  }, [avatarCfg]);

  const patchAvatar = useCallback((p: Partial<AvatarConfig>) => {
    setAvatarCfg((c) => ({ ...c, ...p }));
  }, []);

  const switchRace = useCallback((race: RaceId) => {
    setAvatarCfg((prev) => {
      // Keep last build for race if we stored one under player head; else defaults.
      try {
        const raw = localStorage.getItem(`ledmask:avatarRace:${race}`);
        if (raw) {
          const parsed = sanitizeConfig(JSON.parse(raw));
          if (parsed && parsed.race === race) return parsed;
        }
      } catch {
        /* ignore */
      }
      return defaultConfig(race);
    });
  }, []);

  // Persist per-race so hopping races restores last design
  useEffect(() => {
    try {
      localStorage.setItem(`ledmask:avatarRace:${avatarCfg.race}`, JSON.stringify(avatarCfg));
    } catch {
      /* ignore */
    }
  }, [avatarCfg]);

  const race = useMemo(() => raceDef(avatarCfg.race), [avatarCfg.race]);

  const saveAvatarToCharacter = useCallback(() => {
    savePlayerHeadConfig(avatarCfg);
    setAvatarSaved(true);
  }, [avatarCfg]);

  // Keyboard shortcuts mirror the original prototype (ignored while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      // Numeric keypad → instant face change.
      const faceKey = FACE_NUMPAD[e.code] ?? FACE_SYMBOL[e.key];
      if (faceKey) {
        e.preventDefault();
        return applyFace(faceKey);
      }
      const k = e.key.toLowerCase();
      if (k === "c") return castSpell();
      if (k === "h") return takeHit();
      if (k === "r") return repair();
      const map: Record<string, MaskState> = { i: "idle", t: "talk", s: "shout", w: "whisper", a: "attack" };
      const next = map[k];
      if (next) applyState(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drive the on-face expression from the assistant's mood tag the moment it
  // streams in. The reply text itself is never drawn on the visor (chat only).
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    const { mood } = parseMood(last.content);
    if (mood && mood !== lastMoodRef.current) {
      lastMoodRef.current = mood;
      setFace(mood);
      maskRef.current?.setFace(mood);
    }
  }, [messages]);

  // The mask "speaks" (mouth animation) while a reply streams, then settles.
  useEffect(() => {
    const m = maskRef.current;
    if (!m) return;
    streamingRef.current = streaming;
    // The AI reply owns the state while it streams (mic callback skips). Reset the
    // mic's last-known state on every transition so that when streaming ends the
    // mic callback sees a genuine change and re-applies talk intensity from the
    // current volume (otherwise a stale micStateRef leaves the mask stuck idle).
    micStateRef.current = "idle";
    if (streaming) {
      setState("talk");
      m.triggerState("talk");
    } else {
      setState("idle");
      m.triggerState("idle");
    }
  }, [streaming]);

  // Keep the rail (and chat) scrolled to the newest message while chatting.
  useEffect(() => {
    const rail = document.querySelector(".ledmask-controls");
    if (rail && railTab === "live") {
      // Only auto-scroll if user is near the bottom of the rail
      const el = rail as HTMLElement;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      if (nearBottom || messages.length <= 2) el.scrollTop = el.scrollHeight;
    }
  }, [messages, railTab]);

  const runBanner = () => {
    // Typing a message + RUN also turns the banner on so it's visible.
    maskRef.current?.setBanner(banner);
    maskRef.current?.setBannerEnabled(true);
    setBannerOn(true);
  };
  const toggleBanner = () => {
    const next = !bannerOn;
    maskRef.current?.setBannerEnabled(next);
    setBannerOn(next);
  };
  const applyFace = (f: FaceType) => {
    setFace(f);
    maskRef.current?.setFace(f);
  };
  const applyShell = (id: ShellId) => {
    setShell(id);
    maskRef.current?.setShell(id);
  };
  const applyState = (s: MaskState) => {
    setState(s);
    maskRef.current?.triggerState(s);
  };
  // Route through applyState→triggerState so prior-state timers/pose reset first.
  const castSpell = () => applyState("cast");
  const takeHit = () => {
    maskRef.current?.takeDamage(0.18);
    setHealth(maskRef.current?.getHealth() ?? 1);
  };
  const repair = () => {
    maskRef.current?.repair();
    setHealth(1);
  };
  const applyHealth = (h: number) => {
    setHealth(h);
    maskRef.current?.setHealth(h);
  };

  // Eyes follow the cursor over the stage; release back to idle drift on leave.
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    maskRef.current?.setGazeTarget(nx, ny);
  };
  const onPointerLeave = () => maskRef.current?.clearGazeTarget();

  const submitChat = () => {
    const text = draft.trim();
    if (!text || streaming || !ready) return;
    // Reset mood so the next reply re-ignites the face; show a "thinking" face.
    lastMoodRef.current = "";
    setFace("scan");
    maskRef.current?.setFace("scan");
    send(text);
    setDraft("");
  };

  // --- Active Mode controls ------------------------------------------------
  // Tear down every live capture when the studio unmounts.
  useEffect(() => {
    return () => {
      faceRef.current?.stop();
      micRef.current?.stop();
      capRef.current?.stop();
    };
  }, []);

  const toggleCamera = async () => {
    const m = maskRef.current;
    if (camLoading) return;
    if (camOn) {
      faceRef.current?.stop();
      faceRef.current = null;
      m?.setLiveEyes(null);
      m?.clearGazeTarget();
      liveFaceRef.current = null;
      if (previewRef.current) previewRef.current.replaceChildren();
      setCamOn(false);
      return;
    }
    setActiveErr("");
    setCamLoading(true);
    const ft = new FaceTracker();
    faceRef.current = ft;
    const ok = await ft.start(
      (sig) => {
        const mm = maskRef.current;
        if (!mm) return;
        // Mirror the user's expression — only re-ignite on a genuine change.
        if (sig.expression !== liveFaceRef.current) {
          liveFaceRef.current = sig.expression;
          setFace(sig.expression);
          mm.setFace(sig.expression);
        }
        mm.setLiveEyes(sig.eyeOpen);
        mm.setGazeTarget(sig.gazeX, -sig.gazeY);
      },
      undefined,
      (err) => setActiveErr(describeMediaError(err, "Camera")),
    );
    setCamLoading(false);
    if (ok) {
      setCamOn(true);
      const vid = ft.getVideoElement();
      if (vid && previewRef.current) {
        vid.className = "ledmask-active-preview-video";
        previewRef.current.replaceChildren(vid);
      }
    } else {
      faceRef.current = null;
    }
  };

  const toggleMic = async () => {
    const m = maskRef.current;
    if (micOn) {
      micRef.current?.stop();
      micRef.current = null;
      m?.setLiveMouth(null);
      micStateRef.current = "idle";
      setMicOn(false);
      return;
    }
    if (micLoading) return;
    setActiveErr("");
    setMicLoading(true);
    const mic = new MicLipSync();
    micRef.current = mic;
    const ok = await mic.start(
      (lvl) => {
        const mm = maskRef.current;
        if (!mm) return;
        mm.setLiveMouth(lvl);
        // Volume drives talk INTENSITY (whisper → talk → shout), never anger:
        // a louder voice reads as a bigger delivery, not a mood. Skip while the
        // AI is mid-reply so its own talk state wins.
        if (streamingRef.current) return;
        const st: MaskState = lvl > 0.5 ? "shout" : lvl > 0.22 ? "talk" : lvl > 0.06 ? "whisper" : "idle";
        if (st !== micStateRef.current) {
          micStateRef.current = st;
          setState(st);
          mm.triggerState(st);
        }
      },
      (err) => setActiveErr(describeMediaError(err, "Microphone")),
    );
    setMicLoading(false);
    if (ok) setMicOn(true);
    else micRef.current = null;
  };

  const toggleCaptions = () => {
    if (ccOn) {
      capRef.current?.stop();
      capRef.current = null;
      setLiveCaption("");
      setCcOn(false);
      return;
    }
    if (!captionsSupported) {
      setActiveErr("Live captions need the Web Speech API (Chrome or Edge). This browser doesn't expose it.");
      return;
    }
    setActiveErr("");
    const cap = new Captioner();
    capRef.current = cap;
    const ok = cap.start(
      (text, isFinal) => {
        setLiveCaption(text);
        // Only commit finished phrases to the banner so the ticker doesn't
        // keep restarting from the right edge on every interim word.
        if (isFinal) maskRef.current?.setBanner(text);
      },
      (err) => setActiveErr(`Captions error: ${err}`),
    );
    if (ok) {
      setCcOn(true);
      // Captions need the ticker to be visible, so enabling them switches the
      // banner on. The user can still turn it back off; we never force it on
      // again afterward.
      maskRef.current?.setBannerEnabled(true);
      setBannerOn(true);
    } else capRef.current = null;
  };

  return (
    <div className="ledmask">
      <div className="ledmask-head">
        <div>
          <h1 className="ledmask-title">VOXEL LED MASK</h1>
          <p className="ledmask-sub">
            AI companion · voxel face design · race, hair &amp; expression studio
          </p>
        </div>
        <div className="ledmask-head-right">
          <span className="ledmask-live">
            <span className="ledmask-live-dot" />
            AI ONLINE
          </span>
          <button
            className="ledmask-exit ledmask-frame-btn"
            onClick={() => setFrameModal(true)}
            title="Choose a stage frame"
          >
            <LayoutPanelTop size={16} /> Frame
          </button>
          <button className="ledmask-exit" onClick={onExit}>
            <DoorOpen size={16} /> Exit
          </button>
        </div>
      </div>

      <div className="ledmask-grid">
        <div className="ledmask-stage">
          <div className="ledmask-stage-tabs" role="tablist" aria-label="Stage view">
            <button
              type="button"
              role="tab"
              aria-selected={stageView === "led"}
              className={"ledmask-stage-tab" + (stageView === "led" ? " is-active" : "")}
              onClick={() => setStageView("led")}
            >
              LED Mask
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={stageView === "avatar"}
              className={"ledmask-stage-tab" + (stageView === "avatar" ? " is-active" : "")}
              onClick={() => {
                setStageView("avatar");
                setRailTab("design");
              }}
            >
              Voxel Avatar
            </button>
          </div>

          <div
            className={
              "ledmask-canvas-wrap" +
              (frame && stageView === "led" ? " has-frame" : "") +
              (stageView === "avatar" ? " is-avatar" : "")
            }
            style={stageView === "led" ? stageFrameStyle : undefined}
            onPointerMove={stageView === "led" ? onPointerMove : undefined}
            onPointerLeave={stageView === "led" ? onPointerLeave : undefined}
          >
            {/* Stack both views so LED WebGL keeps a real size when tabbed away */}
            <canvas
              ref={canvasRef}
              className="ledmask-canvas"
              style={{
                position: "absolute",
                inset: 0,
                opacity: stageView === "led" ? 1 : 0,
                pointerEvents: stageView === "led" ? "auto" : "none",
                zIndex: stageView === "led" ? 1 : 0,
              }}
            />
            <div
              ref={avatarMountRef}
              className="ledmask-avatar-mount"
              style={{
                opacity: stageView === "avatar" ? 1 : 0,
                pointerEvents: stageView === "avatar" ? "auto" : "none",
                zIndex: stageView === "avatar" ? 2 : 0,
              }}
            />
            {stageView === "led" && webglFailed && (
              <div className="ledmask-fallback">
                WebGL unavailable in this view — open in a browser tab to see the mask render.
              </div>
            )}
            {stageView === "avatar" && avatarStageFailed && (
              <div className="ledmask-fallback">
                Avatar stage unavailable — open in a browser tab with WebGL enabled.
              </div>
            )}
          </div>
          <p className="ledmask-stage-hint">
            {stageView === "led"
              ? "Drag to gaze · numpad for faces · design tab for race & hair"
              : "Orbit the cube head · edit race, hair & parts in the rail"}
          </p>
        </div>

        {/* Single scroll surface for the entire right rail */}
        <div className="ledmask-controls">
          <div className="ledmask-rail-tabs" role="tablist" aria-label="Control panels">
            <button
              type="button"
              role="tab"
              aria-selected={railTab === "live"}
              className={"ledmask-rail-tab" + (railTab === "live" ? " is-active" : "")}
              onClick={() => {
                setRailTab("live");
                setStageView("led");
              }}
            >
              Live
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={railTab === "design"}
              className={"ledmask-rail-tab" + (railTab === "design" ? " is-active" : "")}
              onClick={() => {
                setRailTab("design");
                setStageView("avatar");
              }}
            >
              Design
            </button>
          </div>

          {railTab === "live" && (
            <>
              <section className="ledmask-panel">
                <div className="ledmask-panel-title">Talk to the mask</div>
                <div className="ledmask-chat">
                  <div className="ledmask-chat-log" ref={logRef}>
                    {messages.length === 0 && (
                      <div className="ledmask-chat-empty">
                        Say something — the mask answers, shows mood on its face, and follows
                        your cursor with its eyes.
                      </div>
                    )}
                    {messages.map((m, i) => {
                      const text = m.role === "assistant" ? parseMood(m.content).clean : m.content;
                      const pending = m.role === "assistant" && !text;
                      return (
                        <div key={i} className={`ledmask-msg ${m.role}`}>
                          {pending ? (
                            <div className="ledmask-bubble">
                              <span className="ledmask-typing">
                                <span />
                                <span />
                                <span />
                              </span>
                            </div>
                          ) : (
                            <div className="ledmask-bubble">{text}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="ledmask-chat-row">
                    <textarea
                      className="ledmask-chat-input"
                      rows={2}
                      value={draft}
                      placeholder={ready ? "Ask the mask anything…" : "Connecting…"}
                      disabled={!ready}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          submitChat();
                        }
                      }}
                    />
                    <button
                      className="ledmask-run"
                      onClick={submitChat}
                      disabled={!ready || streaming || !draft.trim()}
                      title="Send"
                    >
                      <Send size={15} />
                    </button>
                  </div>
                  <button
                    className="ledmask-chat-clear"
                    onClick={() => {
                      clear();
                      lastMoodRef.current = "";
                    }}
                    disabled={messages.length === 0 || streaming}
                  >
                    <Trash2 size={12} /> Clear conversation
                  </button>
                </div>
              </section>

              <section className="ledmask-panel">
                <div className="ledmask-panel-title">Active mode — mirror your face</div>
                <p className="ledmask-hint" style={{ margin: "0 0 10px" }}>
                  Camera mirrors expression · mic lip-syncs · captions go to the banner.
                </p>
                <div className="ledmask-active-row">
                  <button
                    className={"ledmask-state" + (camOn ? " is-active" : "")}
                    onClick={toggleCamera}
                    disabled={!mediaSupported || camLoading}
                  >
                    {camLoading ? "STARTING…" : camOn ? "■ CAMERA" : "▶ CAMERA"}
                  </button>
                  <button
                    className={"ledmask-state" + (micOn ? " is-active" : "")}
                    onClick={toggleMic}
                    disabled={!mediaSupported || micLoading}
                  >
                    {micLoading ? "STARTING…" : micOn ? "■ MIC" : "▶ MIC"}
                  </button>
                  <button
                    className={"ledmask-state" + (ccOn ? " is-active" : "")}
                    onClick={toggleCaptions}
                    disabled={!captionsSupported}
                    title={captionsSupported ? "" : "Needs Chrome or Edge"}
                  >
                    {ccOn ? "■ CAPTIONS" : "▶ CAPTIONS"}
                  </button>
                </div>
                {camOn && (
                  <p className="ledmask-active-live">
                    ● Live — the AI is reading your expression. The camera feed is never shown.
                  </p>
                )}
                <div ref={previewRef} className="ledmask-active-preview" aria-hidden="true" />
                {ccOn && (
                  <div className="ledmask-active-cc">{liveCaption || "Listening…"}</div>
                )}
                {camLoading && <p className="ledmask-hint">Loading face model (first use only)…</p>}
                {!mediaSupported && (
                  <p className="ledmask-active-err">Camera/mic capture isn't available in this browser.</p>
                )}
                {activeErr && <p className="ledmask-active-err">{activeErr}</p>}
              </section>

              <section className="ledmask-panel">
                <div className="ledmask-panel-title">Scrolling banner</div>
                <div className="ledmask-banner-row" style={{ marginBottom: 8, alignItems: "center" }}>
                  <button
                    className={"ledmask-state" + (bannerOn ? " is-active" : "")}
                    onClick={toggleBanner}
                  >
                    {bannerOn ? "■ BANNER ON" : "▶ BANNER OFF"}
                  </button>
                  <span className="ledmask-hint" style={{ margin: 0 }}>
                    Captions / RUN turn the banner on.
                  </span>
                </div>
                <div className="ledmask-banner-row">
                  <input
                    className="ledmask-input"
                    value={banner}
                    onChange={(e) => setBanner(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") runBanner();
                    }}
                    placeholder="Type a message…"
                  />
                  <button className="ledmask-run" onClick={runBanner}>
                    RUN
                  </button>
                </div>
              </section>

              <section className="ledmask-panel">
                <div className="ledmask-panel-title">Head shell</div>
                <p className="ledmask-hint" style={{ margin: "0 0 10px" }}>
                  Housing around the LED face. Saved automatically.
                </p>
                <div className="ledmask-faces">
                  {SHELLS.map((s) => (
                    <button
                      key={s.id}
                      className={"ledmask-face" + (shell === s.id ? " is-active" : "")}
                      onClick={() => applyShell(s.id)}
                    >
                      <span className="ledmask-face-glyph">{s.glyph}</span>
                      <span className="ledmask-face-label">{s.label}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="ledmask-panel">
                <div className="ledmask-panel-title">LED expressions</div>
                <div className="ledmask-faces">
                  {FACES.map((f) => (
                    <button
                      key={f.id}
                      className={"ledmask-face" + (face === f.id ? " is-active" : "")}
                      onClick={() => applyFace(f.id)}
                    >
                      <span className="ledmask-face-glyph">{f.glyph}</span>
                      <span className="ledmask-face-label">{f.label}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="ledmask-panel">
                <div className="ledmask-panel-title">Animation states</div>
                <div className="ledmask-states">
                  {STATES.map((s) => (
                    <button
                      key={s.id}
                      className={
                        "ledmask-state" +
                        (s.danger ? " is-danger" : "") +
                        (state === s.id ? " is-active" : "")
                      }
                      onClick={() => applyState(s.id)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <p className="ledmask-hint">Shortcuts: I · T · S · W · C · A</p>
              </section>

              <section className="ledmask-panel">
                <div className="ledmask-panel-title">Combat — damage &amp; casting</div>
                <div className="ledmask-states">
                  <button className="ledmask-state" onClick={castSpell}>
                    CAST SPELL
                  </button>
                  <button className="ledmask-state is-danger" onClick={takeHit}>
                    TAKE HIT
                  </button>
                  <button className="ledmask-state" onClick={repair}>
                    REPAIR
                  </button>
                </div>
                <div className="ledmask-banner-row" style={{ marginTop: 10, alignItems: "center" }}>
                  <span className="ledmask-face-label" style={{ minWidth: 64 }}>
                    HEALTH {Math.round(health * 100)}%
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(health * 100)}
                    onChange={(e) => applyHealth(Number(e.target.value) / 100)}
                    style={{ flex: 1 }}
                  />
                </div>
                <p className="ledmask-hint">Shortcuts: C cast · H hit · R repair</p>
              </section>
            </>
          )}

          {railTab === "design" && (
            <section className="ledmask-panel">
              <div className="ledmask-panel-title">Voxel character design</div>
              <p className="ledmask-hint" style={{ margin: "0 0 12px" }}>
                Cube modular head — race, hair, eyes, and gear. Saved to this device;
                “Save to character” applies the head in Explorer / campfire.
              </p>
              <div className="lm-avatar-actions" style={{ marginBottom: 14 }}>
                <button
                  type="button"
                  className="ledmask-state"
                  onClick={() => setAvatarCfg(randomConfig(avatarCfg.race))}
                >
                  <Dices size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                  Randomize
                </button>
                <button
                  type="button"
                  className="ledmask-state"
                  onClick={() => setAvatarCfg(defaultConfig(avatarCfg.race))}
                >
                  <RotateCcw size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                  Reset
                </button>
                <button
                  type="button"
                  className={"ledmask-state" + (avatarSaved ? " is-active" : "")}
                  onClick={saveAvatarToCharacter}
                >
                  {avatarSaved ? (
                    <Check size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                  ) : (
                    <UserCheck size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                  )}
                  {avatarSaved ? "On character" : "Save to character"}
                </button>
              </div>

              <div className="lm-avatar-tools">
                <div className="lm-sec">
                  <h4>Race</h4>
                  <div className="lm-races">
                    {RACES.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className={"lm-race" + (avatarCfg.race === r.id ? " is-on" : "")}
                        onClick={() => switchRace(r.id)}
                      >
                        <span
                          className="lm-race-dot"
                          style={{ background: cssHex(r.skins[0]!) }}
                        />
                        <span className="lm-race-name">{r.label}</span>
                        <span className="lm-race-blurb">{r.blurb}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="lm-sec">
                  <h4>Skin tone</h4>
                  <div className="lm-swatches">
                    {race.skins.map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        className={"lm-swatch" + (avatarCfg.skin === i ? " is-on" : "")}
                        style={{ background: cssHex(c) }}
                        onClick={() => patchAvatar({ skin: i })}
                        aria-label={`Skin ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="lm-sec">
                  <h4>Hair</h4>
                  <LmChips
                    items={HAIR_STYLES}
                    value={avatarCfg.hair}
                    onPick={(hair) => patchAvatar({ hair })}
                  />
                  {avatarCfg.hair !== "bald" && (
                    <div className="lm-swatches">
                      {HAIR_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={"lm-swatch" + (avatarCfg.hairColor === c ? " is-on" : "")}
                          style={{ background: cssHex(c) }}
                          onClick={() => patchAvatar({ hairColor: c })}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="lm-sec">
                  <h4>Eyes</h4>
                  <LmChips
                    items={EYE_STYLES}
                    value={avatarCfg.eyes}
                    onPick={(eyes) => patchAvatar({ eyes })}
                  />
                  <div className="lm-swatches">
                    {EYE_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={"lm-swatch" + (avatarCfg.eyeColor === c ? " is-on" : "")}
                        style={{ background: cssHex(c) }}
                        onClick={() => patchAvatar({ eyeColor: c })}
                      />
                    ))}
                  </div>
                </div>

                <div className="lm-sec">
                  <h4>Brows</h4>
                  <LmChips
                    items={BROW_STYLES}
                    value={avatarCfg.brows}
                    onPick={(brows) => patchAvatar({ brows })}
                  />
                </div>

                <div className="lm-sec">
                  <h4>Mouth</h4>
                  <LmChips
                    items={MOUTH_STYLES}
                    value={avatarCfg.mouth}
                    onPick={(mouth) => patchAvatar({ mouth })}
                  />
                </div>

                <div className="lm-sec">
                  <h4>Expression</h4>
                  <LmChips
                    items={EXPRESSIONS}
                    value={avatarCfg.expression}
                    onPick={(expression) => patchAvatar({ expression })}
                  />
                </div>

                <div className="lm-sec">
                  <h4>Facial hair</h4>
                  <LmChips
                    items={FACIAL_HAIR_STYLES}
                    value={avatarCfg.facialHair}
                    onPick={(facialHair) => patchAvatar({ facialHair })}
                  />
                  {avatarCfg.facialHair !== "none" && (
                    <div className="lm-swatches">
                      {HAIR_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={
                            "lm-swatch" + (avatarCfg.facialHairColor === c ? " is-on" : "")
                          }
                          style={{ background: cssHex(c) }}
                          onClick={() => patchAvatar({ facialHairColor: c })}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="lm-sec">
                  <h4>Ears</h4>
                  <LmChips
                    items={earStylesFor(avatarCfg.race)}
                    value={avatarCfg.ears}
                    onPick={(ears) => patchAvatar({ ears })}
                  />
                </div>

                {tuskStylesFor(avatarCfg.race).length > 1 && (
                  <div className="lm-sec">
                    <h4>Tusks</h4>
                    <LmChips
                      items={tuskStylesFor(avatarCfg.race)}
                      value={avatarCfg.tusks}
                      onPick={(tusks) => patchAvatar({ tusks })}
                    />
                  </div>
                )}

                <div className="lm-sec">
                  <h4>Headgear</h4>
                  <LmChips
                    items={HEADGEAR_STYLES}
                    value={avatarCfg.headgear}
                    onPick={(headgear) => patchAvatar({ headgear })}
                  />
                  {avatarCfg.headgear !== "none" && (
                    <div className="lm-swatches">
                      {GEAR_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={
                            "lm-swatch" + (avatarCfg.headgearColor === c ? " is-on" : "")
                          }
                          style={{ background: cssHex(c) }}
                          onClick={() => patchAvatar({ headgearColor: c })}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="lm-sec">
                  <h4>Hat</h4>
                  <LmChips
                    items={HAT_STYLES}
                    value={avatarCfg.hat}
                    onPick={(hat) => patchAvatar({ hat })}
                  />
                </div>

                <div className="lm-sec">
                  <h4>Extras</h4>
                  <LmChips
                    items={EXTRA_STYLES}
                    value={avatarCfg.extra}
                    onPick={(extra) => patchAvatar({ extra })}
                  />
                  {avatarCfg.extra === "warpaint" && (
                    <div className="lm-swatches">
                      {PAINT_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={"lm-swatch" + (avatarCfg.extraColor === c ? " is-on" : "")}
                          style={{ background: cssHex(c) }}
                          onClick={() => patchAvatar({ extraColor: c })}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      <div className="ledmask-rooms">
        <RoomGallery onNavigate={onNavigate} />
      </div>

      <FrameSkinModal
        open={frameModal}
        current={frameId}
        onPick={pickFrame}
        onClose={() => setFrameModal(false)}
      />
    </div>
  );
}

function LmChips<T extends string>({
  items,
  value,
  onPick,
}: {
  items: { id: T; label: string }[];
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <div className="lm-chips">
      {items.map((s) => (
        <button
          key={s.id}
          type="button"
          className={"lm-chip" + (value === s.id ? " is-on" : "")}
          onClick={() => onPick(s.id)}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
