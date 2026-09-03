import { useEffect, useRef, useState } from "react";

interface Props {
  onExit: () => void;
}

interface RaceState {
  speed: number;
  lap: number;
  checkpoint: number;
  time: number;
  nitro: number;
  heat: number;
  finished: boolean;
}

const initialState: RaceState = {
  speed: 0,
  lap: 1,
  checkpoint: 1,
  time: 0,
  nitro: 100,
  heat: 12,
  finished: false,
};

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = (seconds % 60).toFixed(2).padStart(5, "0");
  return `${minutes}:${remainder}`;
}

export function StreetRacingMode({ onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef(new Set<string>());
  const carRef = useRef({ x: 0.5, distance: 0, pulse: 0 });
  const [state, setState] = useState<RaceState>(initialState);
  const [build, setBuild] = useState("MIDNIGHT // R-01");
  const [started, setStarted] = useState(false);
  const stateRef = useRef(state);
  const startedRef = useRef(started);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    startedRef.current = started;
  }, [started]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      keysRef.current.add(event.code);
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
        event.preventDefault();
      }
      if (event.code === "Enter") setStarted(true);
    };
    const up = (event: KeyboardEvent) => keysRef.current.delete(event.code);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let frame = 0;
    let last = performance.now();

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(canvas.clientWidth * ratio);
      canvas.height = Math.floor(canvas.clientHeight * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const draw = (now: number) => {
      const elapsed = Math.min((now - last) / 1000, 0.05);
      last = now;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const keys = keysRef.current;
      const car = carRef.current;
      const currentState = stateRef.current;
      const currentStarted = startedRef.current;
      const boosting = keys.has("Space") && currentState.nitro > 0 && currentStarted;
      const throttle = currentStarted && !currentState.finished && keys.has("ArrowUp");
      const braking = keys.has("ArrowDown");
      const targetSpeed = throttle ? (boosting ? 235 : 175) : braking ? 25 : 70;
      const nextSpeed = currentState.speed + (targetSpeed - currentState.speed) * elapsed * 2.2;
      car.x += ((keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0)) * elapsed * (0.55 + nextSpeed / 280);
      car.x = Math.max(0.29, Math.min(0.71, car.x));
      car.distance += nextSpeed * elapsed * 0.32;
      car.pulse += elapsed * (boosting ? 12 : 4);
      const nextCheckpoint = Math.min(12, Math.floor(car.distance / 100) + 1);
      const nextLap = Math.min(3, Math.floor(car.distance / 1200) + 1);
      const finished = car.distance >= 3600;
      if (currentStarted && !currentState.finished) {
        setState((previous) => {
          const next = {
          speed: nextSpeed,
          lap: nextLap,
          checkpoint: nextCheckpoint,
          time: previous.time + elapsed,
          nitro: Math.max(0, previous.nitro + (boosting ? -elapsed * 18 : elapsed * 4)),
          heat: Math.min(100, Math.max(0, previous.heat + (boosting ? elapsed * 8 : -elapsed * 2))),
          finished,
          };
          stateRef.current = next;
          return next;
        });
      }

      const horizon = height * 0.39;
      const roadTop = width * 0.21;
      const roadBottom = width * 0.92;
      const gradient = context.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "#0c1020");
      gradient.addColorStop(0.58, "#18213a");
      gradient.addColorStop(1, "#071018");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
      context.fillStyle = "#111a31";
      context.fillRect(0, horizon, width, height - horizon);
      context.fillStyle = "#263453";
      context.beginPath();
      context.moveTo(roadTop, horizon);
      context.lineTo(width - roadTop, horizon);
      context.lineTo(width - roadBottom, height);
      context.lineTo(roadBottom, height);
      context.closePath();
      context.fill();

      const scroll = (car.distance * 0.06) % 80;
      for (let y = horizon + 20 - scroll; y < height; y += 80) {
        const perspective = (y - horizon) / (height - horizon);
        const left = roadTop + (roadBottom - roadTop) * perspective;
        const right = width - left;
        context.strokeStyle = `rgba(117, 238, 255, ${0.12 + perspective * 0.25})`;
        context.lineWidth = 1 + perspective * 2;
        context.beginPath();
        context.moveTo(left, y);
        context.lineTo(right, y);
        context.stroke();
      }
      for (const lane of [-0.33, 0.33]) {
        context.strokeStyle = "rgba(255,255,255,0.34)";
        context.setLineDash([18, 26]);
        context.beginPath();
        context.moveTo(width / 2 + lane * roadTop, horizon);
        context.lineTo(width / 2 + lane * roadBottom, height);
        context.stroke();
      }
      context.setLineDash([]);

      for (let i = 0; i < 13; i += 1) {
        const x = i % 2 === 0 ? 16 + (i * 31) % 110 : width - 22 - (i * 47) % 130;
        const buildingHeight = 45 + ((i * 37) % 90);
        context.fillStyle = i % 3 === 0 ? "#202e4a" : "#18243c";
        context.fillRect(x, horizon - buildingHeight, 28 + (i % 3) * 10, buildingHeight);
        context.fillStyle = i % 2 ? "#ff5d8f" : "#59e6ff";
        for (let window = 0; window < 3; window += 1) {
          context.fillRect(x + 7 + window * 10, horizon - buildingHeight + 12 + ((car.distance + i * 17) % 28), 3, 8);
        }
      }

      const carY = height * 0.76;
      context.save();
      context.translate(car.x * width, carY);
      context.rotate((keys.has("ArrowRight") ? 1 : keys.has("ArrowLeft") ? -1 : 0) * 0.035);
      if (boosting) {
        context.shadowColor = "#ff5d8f";
        context.shadowBlur = 32;
        context.fillStyle = "#ff5d8f";
        context.fillRect(-28, 34, 56, 5);
      }
      context.shadowColor = "#59e6ff";
      context.shadowBlur = 18;
      context.fillStyle = "#dcecff";
      context.beginPath();
      context.moveTo(-42, 22);
      context.lineTo(-29, -25);
      context.lineTo(-10, -38);
      context.lineTo(24, -32);
      context.lineTo(43, 22);
      context.closePath();
      context.fill();
      context.shadowBlur = 0;
      context.fillStyle = "#10182c";
      context.beginPath();
      context.moveTo(-21, -22);
      context.lineTo(-7, -32);
      context.lineTo(18, -27);
      context.lineTo(25, -7);
      context.lineTo(-17, -7);
      context.closePath();
      context.fill();
      context.fillStyle = "#ff5d8f";
      context.fillRect(-38, 13, 76, 7);
      context.restore();

      frame = requestAnimationFrame(draw);
    };
    resize();
    window.addEventListener("resize", resize);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div style={styles.root}>
      <canvas ref={canvasRef} style={styles.canvas} />
      <header style={styles.header}>
        <div><strong>RAVER //</strong> STREET CIRCUIT</div>
        <div style={styles.live}>LOCAL AUTHORITY · DISTRICT 01</div>
        <button type="button" onClick={onExit} style={styles.button}>EXIT TO LIBRARY</button>
      </header>
      <aside style={styles.leftPanel}>
        <div style={styles.kicker}>BUILD PROFILE</div>
        <h1>{build}</h1>
        <p style={styles.muted}>A clean line through the city is worth more than raw horsepower.</p>
        {[["POWER", "742 HP"], ["GRIP", "86 / 100"], ["NITRO", "2-STAGE"], ["HEAT", `${Math.round(state.heat)}%`]].map(([label, value]) => <div key={label} style={styles.stat}><span>{label}</span><b>{value}</b></div>)}
        <button type="button" style={styles.buildButton} onClick={() => setBuild(build.includes("R-01") ? "NIGHTSHIFT // R-02" : "MIDNIGHT // R-01")}>SWAP BUILD</button>
      </aside>
      <section style={styles.hud}>
        <div style={styles.speed}>{Math.round(state.speed)}<small> KM/H</small></div>
        <div style={styles.raceLine}><span>LAP {state.lap} / 3</span><span>CHECKPOINT {state.checkpoint} / 12</span><span>{formatTime(state.time)}</span></div>
        <div style={styles.meter}><span style={{ width: `${state.nitro}%` }} /></div>
        <div style={styles.meterLabel}>NITRO RESERVE <b>{Math.round(state.nitro)}%</b></div>
      </section>
      {!started && <div style={styles.start}><div style={styles.kicker}>NIGHT RUN // QUALIFIER</div><h2>OWN THE LIGHTS.</h2><p>Arrow keys to drive. Space to deploy nitro.</p><button type="button" style={styles.startButton} onClick={() => setStarted(true)}>START RUN <span>ENTER</span></button></div>}
      {state.finished && <div style={styles.finish}><div style={styles.kicker}>CLEAN RUN RECORDED</div><h2>{formatTime(state.time)}</h2><button type="button" style={styles.startButton} onClick={() => { carRef.current.distance = 0; setState(initialState); setStarted(false); }}>RUN IT BACK</button></div>}
      <footer style={styles.footer}><span>W / ARROW UP ACCELERATE</span><span>A D / ARROWS STEER</span><span>SPACE NITRO</span><span>CHECKPOINT ROUTE · 3.6 KM</span></footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { position: "relative", width: "100%", height: "100%", minHeight: 620, overflow: "hidden", background: "#0c1020", color: "#eaf4ff", fontFamily: "'Trebuchet MS', sans-serif" },
  canvas: { position: "absolute", inset: 0, width: "100%", height: "100%" },
  header: { position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", gap: 24, padding: "22px 28px", background: "linear-gradient(180deg, rgba(5,9,20,.92), transparent)", letterSpacing: 1.4, fontSize: 12 },
  live: { color: "#59e6ff", opacity: .8, marginRight: "auto" },
  button: { border: "1px solid rgba(89,230,255,.5)", background: "rgba(9,18,34,.7)", color: "#eaf4ff", padding: "9px 12px", cursor: "pointer", fontSize: 10, letterSpacing: 1 },
  leftPanel: { position: "absolute", top: 92, left: 28, width: 220, padding: 18, background: "rgba(6,12,27,.78)", borderLeft: "2px solid #ff5d8f", backdropFilter: "blur(10px)" },
  kicker: { color: "#ff5d8f", fontSize: 10, letterSpacing: 2.2, fontWeight: 700 },
  muted: { color: "#a2b5cd", lineHeight: 1.5, fontSize: 12 },
  stat: { display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid rgba(160,190,220,.13)", fontSize: 10, letterSpacing: 1 },
  buildButton: { marginTop: 16, width: "100%", padding: 10, border: "1px solid #59e6ff", background: "transparent", color: "#59e6ff", cursor: "pointer", letterSpacing: 1.5, fontSize: 10 },
  hud: { position: "absolute", left: "50%", bottom: 72, transform: "translateX(-50%)", width: "min(560px, 62vw)", textAlign: "center" },
  speed: { fontSize: 64, lineHeight: .9, fontWeight: 700, textShadow: "0 0 24px rgba(89,230,255,.55)" },
  raceLine: { display: "flex", justifyContent: "space-between", color: "#dcecff", fontSize: 10, letterSpacing: 1.2, margin: "12px 0" },
  meter: { height: 5, background: "rgba(220,236,255,.18)", transform: "skewX(-24deg)" },
  meterLabel: { textAlign: "right", color: "#59e6ff", fontSize: 9, letterSpacing: 1, marginTop: 8 },
  start: { position: "absolute", top: "45%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", width: "min(600px, 80vw)", background: "rgba(7,12,28,.74)", padding: "28px 34px", borderTop: "1px solid #59e6ff", borderBottom: "1px solid #ff5d8f", backdropFilter: "blur(8px)" },
  finish: { position: "absolute", top: "45%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", minWidth: 300, background: "rgba(7,12,28,.88)", padding: 30, border: "1px solid #59e6ff" },
  startButton: { marginTop: 14, padding: "13px 20px", border: "1px solid #ff5d8f", background: "#ff5d8f", color: "#120b18", cursor: "pointer", fontWeight: 700, letterSpacing: 1.5 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", justifyContent: "center", gap: 24, padding: "14px 20px", background: "rgba(4,8,18,.84)", color: "#8da4c2", fontSize: 9, letterSpacing: 1 },
};