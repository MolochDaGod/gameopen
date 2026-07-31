import { useCallback, useEffect, useRef, useState } from "react";
import type { AnimApi } from "./AnimEditorUI";
import {
  deleteCloudClip,
  editClip,
  generateClip,
  generatePose,
  getCloudClip,
  listCloudClips,
  poseFromImage,
  saveCloudClip,
  solveIk,
  weaponAdjust,
  optimizeClipRemote,
  chatAnim,
  workerConfigured,
  workerHealth,
  workerBaseUrl,
  WorkerError,
  type CloudClipMeta,
  type LimbId,
} from "../three/ai/workerClient";

interface Props {
  api: AnimApi;
  ready: boolean;
}

type Status =
  | { kind: "idle" }
  | { kind: "busy"; text: string }
  | { kind: "ok"; text: string }
  | { kind: "err"; text: string };

type ChatLine = { role: "user" | "assistant"; content: string };

function errText(e: unknown): string {
  if (e instanceof WorkerError) return e.message;
  return "Something went wrong talking to the AI worker.";
}

const DIRECTIONS: ReadonlyArray<{ label: string; value: number }> = [
  { label: "Forward", value: 0 },
  { label: "Forward-Right", value: 45 },
  { label: "Right", value: 90 },
  { label: "Back-Right", value: 135 },
  { label: "Backward", value: 180 },
  { label: "Back-Left", value: 225 },
  { label: "Left", value: 270 },
  { label: "Forward-Left", value: 315 },
];

const WEAPON_STYLES = [
  "sword_guard",
  "sword_overhead",
  "sword_slash_r",
  "sword_slash_l",
  "spear_thrust",
  "bow_draw",
  "rifle_aim",
  "pistol_aim",
  "staff_cast",
  "twohand_high",
] as const;

/**
 * AI skeleton-mover + chat-to-create + IK / weapon / optimize tools.
 * Every generated clip lands in the live {@link AnimEditor} for preview & save.
 */
export function AiAnimatorPanel({ api, ready }: Props) {
  const configured = workerConfigured();
  const [tab, setTab] = useState<"chat" | "generate" | "tools" | "cloud">("chat");
  const [prompt, setPrompt] = useState("");
  const [time, setTime] = useState("");
  const [distance, setDistance] = useState("");
  const [direction, setDirection] = useState(0);
  const [instruction, setInstruction] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<string>("");

  const [clips, setClips] = useState<CloudClipMeta[]>([]);
  const [cloudName, setCloudName] = useState("");
  const [libraryLoaded, setLibraryLoaded] = useState(false);

  // Chat
  const [chatInput, setChatInput] = useState("");
  const [chatLog, setChatLog] = useState<ChatLine[]>([
    {
      role: "assistant",
      content:
        "Chat to create animations. Try: “confident sword idle”, “walk cycle 2m”, “IK right arm aim up”, “rifle aim”, “optimize current clip”.",
    },
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Tools
  const [limb, setLimb] = useState<LimbId>("rightArm");
  const [ikYaw, setIkYaw] = useState(0);
  const [ikPitch, setIkPitch] = useState(15);
  const [ikBend, setIkBend] = useState(0.5);
  const [weaponStyle, setWeaponStyle] = useState<string>("sword_guard");
  const [wYaw, setWYaw] = useState(0);
  const [wPitch, setWPitch] = useState(0);
  const [posePrompt, setPosePrompt] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadClip = useCallback(
    (frames: Array<{ duration: number; pose: Record<string, [number, number, number, number]>; root?: [number, number, number] }>) => {
      const ok = api.loadFrames(frames);
      if (!ok) throw new WorkerError("The editor wasn't ready to receive the clip.");
    },
    [api],
  );

  const refreshLibrary = useCallback(async () => {
    if (!configured) return;
    try {
      setClips(await listCloudClips());
      setLibraryLoaded(true);
    } catch (e) {
      setStatus({ kind: "err", text: errText(e) });
    }
  }, [configured]);

  useEffect(() => {
    void refreshLibrary();
    if (configured) {
      void workerHealth()
        .then((h) =>
          setHealth(
            h.ok
              ? `Worker v${h.version ?? "?"} · ${(h.tools ?? []).length} tools · ${workerBaseUrl()}`
              : "Worker unhealthy",
          ),
        )
        .catch(() => setHealth("Worker unreachable"));
    }
  }, [refreshLibrary, configured]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatLog]);

  const onGenerate = useCallback(
    async (frames?: number) => {
      const p = prompt.trim();
      if (!p || busy || !ready) return;
      const ale = frames !== undefined;
      setBusy(true);
      setStatus({
        kind: "busy",
        text: ale ? `A.L.E. generating ${frames} frames…` : "Generating motion…",
      });
      try {
        const t = parseFloat(time);
        const d = parseFloat(distance);
        const reqTime = Number.isFinite(t) && t > 0 ? t : 0;
        const reqDistance = Number.isFinite(d) && d > 0 ? d : 0;
        const hasMotion = reqTime > 0 || reqDistance > 0;
        const motion = hasMotion
          ? { time: reqTime || undefined, distance: reqDistance || undefined, direction }
          : undefined;
        const { clip, warnings } = await generateClip(p, motion, frames);
        loadClip(clip.frames);
        if (hasMotion) {
          api.applyMotion({ time: reqTime, distance: reqDistance, direction });
        }
        const warn = warnings.length ? ` (${warnings.join(" ")})` : "";
        setStatus({
          kind: "ok",
          text: `${ale ? "A.L.E. — " : ""}Loaded ${clip.frames.length} frame(s).${warn}`,
        });
      } catch (e) {
        setStatus({ kind: "err", text: errText(e) });
      } finally {
        setBusy(false);
      }
    },
    [prompt, busy, ready, api, time, distance, direction, loadClip],
  );

  const onEdit = useCallback(async () => {
    const ins = instruction.trim();
    if (!ins || busy || !ready) return;
    setBusy(true);
    setStatus({ kind: "busy", text: "Editing current clip…" });
    try {
      const current = api.getClip();
      const { clip, warnings } = await editClip(
        { bones: current.bones, frames: current.frames },
        ins,
      );
      loadClip(clip.frames);
      setStatus({
        kind: "ok",
        text: `Updated to ${clip.frames.length} frame(s).${warnings.length ? ` (${warnings.join(" ")})` : ""}`,
      });
    } catch (e) {
      setStatus({ kind: "err", text: errText(e) });
    } finally {
      setBusy(false);
    }
  }, [instruction, busy, ready, api, loadClip]);

  const onChat = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || busy || !ready) return;
    setChatInput("");
    setChatLog((l) => [...l, { role: "user", content: msg }]);
    setBusy(true);
    setStatus({ kind: "busy", text: "Chat → animation…" });
    try {
      const current = api.getClip();
      const history = chatLog.slice(-10);
      const res = await chatAnim(msg, {
        history,
        clip:
          current.frames.length > 0
            ? { bones: current.bones, frames: current.frames }
            : undefined,
      });
      setChatLog((l) => [...l, { role: "assistant", content: res.reply || `(${res.action})` }]);
      if (res.clip) {
        loadClip(res.clip.frames);
        setStatus({
          kind: "ok",
          text: `Chat applied ${res.action}: ${res.clip.frames.length} frames.`,
        });
      } else {
        setStatus({ kind: "ok", text: res.reply.slice(0, 120) || "OK" });
      }
    } catch (e) {
      const t = errText(e);
      setChatLog((l) => [...l, { role: "assistant", content: `Error: ${t}` }]);
      setStatus({ kind: "err", text: t });
    } finally {
      setBusy(false);
    }
  }, [chatInput, busy, ready, api, chatLog, loadClip]);

  const onIk = useCallback(async () => {
    if (busy || !ready) return;
    setBusy(true);
    setStatus({ kind: "busy", text: "Solving IK…" });
    try {
      const current = api.getClip();
      const { clip, warnings } = await solveIk({
        limb,
        aimYawDeg: ikYaw,
        aimPitchDeg: ikPitch,
        bend: ikBend,
        clip:
          current.frames.length > 0
            ? { bones: current.bones, frames: current.frames }
            : undefined,
      });
      loadClip(clip.frames);
      setStatus({
        kind: "ok",
        text: `IK ${limb} applied.${warnings.length ? ` ${warnings.join(" ")}` : ""}`,
      });
    } catch (e) {
      setStatus({ kind: "err", text: errText(e) });
    } finally {
      setBusy(false);
    }
  }, [busy, ready, limb, ikYaw, ikPitch, ikBend, api, loadClip]);

  const onWeapon = useCallback(async () => {
    if (busy || !ready) return;
    setBusy(true);
    setStatus({ kind: "busy", text: "Weapon adjust…" });
    try {
      const current = api.getClip();
      const { clip, warnings } = await weaponAdjust({
        style: weaponStyle,
        yawDeg: wYaw,
        pitchDeg: wPitch,
        clip:
          current.frames.length > 0
            ? { bones: current.bones, frames: current.frames }
            : undefined,
      });
      loadClip(clip.frames);
      setStatus({
        kind: "ok",
        text: `Weapon ${weaponStyle}.${warnings.length ? ` ${warnings.join(" ")}` : ""}`,
      });
    } catch (e) {
      setStatus({ kind: "err", text: errText(e) });
    } finally {
      setBusy(false);
    }
  }, [busy, ready, weaponStyle, wYaw, wPitch, api, loadClip]);

  const onOptimize = useCallback(async () => {
    if (busy || !ready) return;
    setBusy(true);
    setStatus({ kind: "busy", text: "Optimizing clip…" });
    try {
      const current = api.getClip();
      if (!current.frames.length) throw new WorkerError("No clip in the editor.");
      const { clip, warnings } = await optimizeClipRemote(
        { bones: current.bones, frames: current.frames },
        { smoothPasses: 2, mergeEpsilon: 0.02 },
      );
      loadClip(clip.frames);
      setStatus({
        kind: "ok",
        text: `Optimized → ${clip.frames.length} frames.${warnings.length ? ` ${warnings.join(" ")}` : ""}`,
      });
    } catch (e) {
      setStatus({ kind: "err", text: errText(e) });
    } finally {
      setBusy(false);
    }
  }, [busy, ready, api, loadClip]);

  const onPoseText = useCallback(async () => {
    const p = posePrompt.trim();
    if (!p || busy || !ready) return;
    setBusy(true);
    setStatus({ kind: "busy", text: "Generating pose…" });
    try {
      const { clip, warnings } = await generatePose(p, { frames: 1 });
      loadClip(clip.frames);
      setStatus({
        kind: "ok",
        text: `Pose ready.${warnings.length ? ` ${warnings.join(" ")}` : ""}`,
      });
    } catch (e) {
      setStatus({ kind: "err", text: errText(e) });
    } finally {
      setBusy(false);
    }
  }, [posePrompt, busy, ready, loadClip]);

  const onImageFile = useCallback(
    async (file: File | null) => {
      if (!file || busy || !ready) return;
      setBusy(true);
      setStatus({ kind: "busy", text: "Analyzing image → pose…" });
      try {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const b64 = btoa(binary);
        const { clip, warnings, description } = await poseFromImage({
          imageBase64: `data:${file.type || "image/png"};base64,${b64}`,
          prompt: posePrompt.trim() || undefined,
        });
        loadClip(clip.frames);
        if (description) {
          setChatLog((l) => [
            ...l,
            { role: "assistant", content: `Image pose: ${description.slice(0, 280)}` },
          ]);
        }
        setStatus({
          kind: "ok",
          text: `Pose from image.${warnings.length ? ` ${warnings.join(" ")}` : ""}`,
        });
      } catch (e) {
        setStatus({ kind: "err", text: errText(e) });
      } finally {
        setBusy(false);
      }
    },
    [busy, ready, posePrompt, loadClip],
  );

  const onSaveCloud = useCallback(async () => {
    const name = cloudName.trim();
    if (!name || busy) return;
    setBusy(true);
    setStatus({ kind: "busy", text: "Saving to cloud…" });
    try {
      const current = api.getClip();
      await saveCloudClip(name, { bones: current.bones, frames: current.frames });
      setCloudName("");
      await refreshLibrary();
      setStatus({ kind: "ok", text: `Saved "${name}" to cloud.` });
    } catch (e) {
      setStatus({ kind: "err", text: errText(e) });
    } finally {
      setBusy(false);
    }
  }, [cloudName, busy, api, refreshLibrary]);

  const onLoadCloud = useCallback(
    async (meta: CloudClipMeta) => {
      if (busy || !ready) return;
      setBusy(true);
      setStatus({ kind: "busy", text: `Loading "${meta.name}"…` });
      try {
        const { clip } = await getCloudClip(meta.id);
        loadClip(clip.frames);
        setStatus({ kind: "ok", text: `Loaded "${meta.name}".` });
      } catch (e) {
        setStatus({ kind: "err", text: errText(e) });
      } finally {
        setBusy(false);
      }
    },
    [busy, ready, loadClip],
  );

  const onDeleteCloud = useCallback(
    async (meta: CloudClipMeta) => {
      if (busy) return;
      setBusy(true);
      try {
        await deleteCloudClip(meta.id);
        await refreshLibrary();
        setStatus({ kind: "ok", text: `Deleted "${meta.name}".` });
      } catch (e) {
        setStatus({ kind: "err", text: errText(e) });
      } finally {
        setBusy(false);
      }
    },
    [busy, refreshLibrary],
  );

  return (
    <div className="aip">
      <div className="aip-section">
        <h3>AI Animator</h3>
        <p className="aip-sub">
          Chat → create · pose · IK · weapon angles · optimize. Clips bind to Danger Room after local Save.
        </p>
        {health && <p className="aip-sub" style={{ opacity: 0.85 }}>{health}</p>}
      </div>

      {!configured && (
        <div className="aip-notice">
          Worker URL missing. Deploy <code>worker/</code> and set{" "}
          <code>VITE_ANIM_WORKER_URL</code>.
        </div>
      )}

      <div className="aip-row">
        {(["chat", "generate", "tools", "cloud"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`aip-btn ${tab === t ? "primary" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "chat" ? "Chat" : t === "generate" ? "Generate" : t === "tools" ? "Tools" : "Cloud"}
          </button>
        ))}
      </div>

      {status.kind !== "idle" && (
        <div className={`aip-status ${status.kind}`}>{status.text}</div>
      )}

      {tab === "chat" && (
        <div className="aip-section" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div
            className="aip-list"
            style={{ flex: 1, overflowY: "auto", maxHeight: "42vh", marginBottom: 8 }}
          >
            {chatLog.map((line, i) => (
              <div
                key={i}
                className="aip-clip"
                style={{
                  flexDirection: "column",
                  alignItems: "stretch",
                  borderColor:
                    line.role === "user" ? "rgba(79,195,255,0.25)" : "rgba(94,234,212,0.2)",
                }}
              >
                <span className="meta">{line.role === "user" ? "You" : "Anim AI"}</span>
                <span style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{line.content}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <textarea
            placeholder="Describe a motion or ask for IK / weapon / optimize…"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            disabled={!configured || busy}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onChat();
              }
            }}
          />
          <button
            type="button"
            className="aip-btn primary"
            onClick={() => void onChat()}
            disabled={!configured || busy || !ready || !chatInput.trim()}
          >
            Send · create animation
          </button>
        </div>
      )}

      {tab === "generate" && (
        <>
          <div className="aip-section">
            <span className="aip-label">Generate from a prompt</span>
            <textarea
              placeholder="e.g. confident hero idle, weight on one hip, slow breathing"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={!configured || busy}
            />
            <span className="aip-label">Travel (root motion bake)</span>
            <div className="aip-row aip-motion">
              <label className="aip-field">
                Time (s)
                <input
                  className="aip-input"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="auto"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  disabled={!configured || busy}
                />
              </label>
              <label className="aip-field">
                Distance
                <input
                  className="aip-input"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="0"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  disabled={!configured || busy}
                />
              </label>
              <label className="aip-field">
                Direction
                <select
                  className="aip-input"
                  value={direction}
                  onChange={(e) => setDirection(Number(e.target.value))}
                  disabled={!configured || busy}
                >
                  {DIRECTIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="aip-row">
              <button
                type="button"
                className="aip-btn primary"
                onClick={() => void onGenerate()}
                disabled={!configured || busy || !ready || !prompt.trim()}
              >
                Generate
              </button>
              <button
                type="button"
                className="aip-btn"
                onClick={() => void onGenerate(8)}
                disabled={!configured || busy || !ready || !prompt.trim()}
              >
                A.L.E. · 8 frames
              </button>
            </div>
          </div>
          <div className="aip-divider" />
          <div className="aip-section">
            <span className="aip-label">Edit the current clip</span>
            <textarea
              placeholder="e.g. raise the right arm higher, faster timing"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              disabled={!configured || busy}
            />
            <button
              type="button"
              className="aip-btn"
              onClick={() => void onEdit()}
              disabled={!configured || busy || !ready || !instruction.trim()}
            >
              Apply edit
            </button>
          </div>
        </>
      )}

      {tab === "tools" && (
        <>
          <div className="aip-section">
            <span className="aip-label">Pose from text</span>
            <textarea
              placeholder="Kneeling archer, bow drawn, eyes on horizon"
              value={posePrompt}
              onChange={(e) => setPosePrompt(e.target.value)}
              disabled={!configured || busy}
            />
            <div className="aip-row">
              <button
                type="button"
                className="aip-btn primary"
                onClick={() => void onPoseText()}
                disabled={!configured || busy || !ready || !posePrompt.trim()}
              >
                Pose from text
              </button>
              <button
                type="button"
                className="aip-btn"
                onClick={() => fileRef.current?.click()}
                disabled={!configured || busy || !ready}
              >
                Pose from image
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => void onImageFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <div className="aip-divider" />
          <div className="aip-section">
            <span className="aip-label">IK (two-bone aim)</span>
            <div className="aip-row">
              <select
                className="aip-input"
                value={limb}
                onChange={(e) => setLimb(e.target.value as LimbId)}
                disabled={busy}
              >
                <option value="rightArm">Right arm</option>
                <option value="leftArm">Left arm</option>
                <option value="rightLeg">Right leg</option>
                <option value="leftLeg">Left leg</option>
              </select>
            </div>
            <div className="aip-row aip-motion">
              <label className="aip-field">
                Yaw
                <input
                  className="aip-input"
                  type="number"
                  value={ikYaw}
                  onChange={(e) => setIkYaw(Number(e.target.value))}
                />
              </label>
              <label className="aip-field">
                Pitch
                <input
                  className="aip-input"
                  type="number"
                  value={ikPitch}
                  onChange={(e) => setIkPitch(Number(e.target.value))}
                />
              </label>
              <label className="aip-field">
                Bend
                <input
                  className="aip-input"
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={ikBend}
                  onChange={(e) => setIkBend(Number(e.target.value))}
                />
              </label>
            </div>
            <button type="button" className="aip-btn primary" onClick={() => void onIk()} disabled={!configured || busy || !ready}>
              Apply IK
            </button>
          </div>
          <div className="aip-divider" />
          <div className="aip-section">
            <span className="aip-label">Weapon style / angle</span>
            <select
              className="aip-input"
              value={weaponStyle}
              onChange={(e) => setWeaponStyle(e.target.value)}
              disabled={busy}
            >
              {WEAPON_STYLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <div className="aip-row aip-motion">
              <label className="aip-field">
                Yaw°
                <input
                  className="aip-input"
                  type="number"
                  value={wYaw}
                  onChange={(e) => setWYaw(Number(e.target.value))}
                />
              </label>
              <label className="aip-field">
                Pitch°
                <input
                  className="aip-input"
                  type="number"
                  value={wPitch}
                  onChange={(e) => setWPitch(Number(e.target.value))}
                />
              </label>
            </div>
            <div className="aip-row">
              <button type="button" className="aip-btn primary" onClick={() => void onWeapon()} disabled={!configured || busy || !ready}>
                Apply weapon
              </button>
              <button type="button" className="aip-btn" onClick={() => void onOptimize()} disabled={!configured || busy || !ready}>
                Optimize clip
              </button>
            </div>
          </div>
        </>
      )}

      {tab === "cloud" && (
        <div className="aip-section">
          <span className="aip-label">Cloud library (D1)</span>
          <div className="aip-row">
            <input
              className="aip-input"
              placeholder="Clip name"
              value={cloudName}
              onChange={(e) => setCloudName(e.target.value)}
              disabled={!configured || busy}
            />
            <button
              type="button"
              className="aip-btn primary"
              onClick={() => void onSaveCloud()}
              disabled={!configured || busy || !cloudName.trim()}
            >
              Save
            </button>
            <button type="button" className="aip-btn" onClick={() => void refreshLibrary()} disabled={!configured || busy}>
              Refresh
            </button>
          </div>
          {!libraryLoaded && <p className="aip-empty">Loading…</p>}
          <div className="aip-list">
            {clips.map((c) => (
              <div key={c.id} className="aip-clip">
                <span className="name">{c.name}</span>
                <span className="meta">
                  {c.frameCount}f · {c.duration.toFixed(1)}s
                </span>
                <button type="button" onClick={() => void onLoadCloud(c)} disabled={busy || !ready}>
                  Load
                </button>
                <button type="button" className="del" onClick={() => void onDeleteCloud(c)} disabled={busy}>
                  Del
                </button>
              </div>
            ))}
            {libraryLoaded && clips.length === 0 && (
              <p className="aip-empty">No cloud clips yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
