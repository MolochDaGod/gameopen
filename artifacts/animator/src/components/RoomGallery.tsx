import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, LayoutGrid, Rows3 } from "lucide-react";
import { MASK_ROOMS, type MaskRoom, type RoomTarget } from "./ledMaskRooms";

interface Props {
  onNavigate: (target: RoomTarget) => void;
}

type Layout = "row" | "grid";
const LAYOUT_KEY = "ledmask:roomlayout";

function loadLayout(): Layout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === "grid" ? "grid" : "row";
  } catch {
    return "row";
  }
}

/**
 * Room gallery shown under the LED Mask studio. Each of the five rooms renders
 * two images: a tall poster (Row layout — "5 in a line") and a square scene
 * (Grid layout — "5 in squares"). Picking a room plays a full-screen loading
 * transition that uses the room's square scene as the background, then navigates.
 *
 * Built mobile- and desktop-first: Row is a snap-scrolling poster strip on small
 * screens and a 5-across rail on wide ones; Grid reflows from 2 columns up to 5.
 */
export function RoomGallery({ onNavigate }: Props) {
  const [layout, setLayout] = useState<Layout>(loadLayout);
  const [entering, setEntering] = useState<MaskRoom | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_KEY, layout);
    } catch {
      /* ignore */
    }
  }, [layout]);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const enter = (room: MaskRoom) => {
    if (entering) return;
    setEntering(room);
    // The scene image doubles as the loading backdrop; hold it briefly so the
    // transition reads before the next surface mounts.
    timer.current = window.setTimeout(() => onNavigate(room.target), 900);
  };

  return (
    <section className="roomgal">
      <div className="roomgal-head">
        <div>
          <div className="roomgal-title">ENTER A ROOM</div>
          <div className="roomgal-sub">
            Five studios, two looks each — jump straight in.
          </div>
        </div>
        <div className="roomgal-toggle" role="group" aria-label="Gallery layout">
          <button
            className={layout === "row" ? "is-active" : ""}
            onClick={() => setLayout("row")}
            title="Posters in a line"
            aria-pressed={layout === "row"}
          >
            <Rows3 size={15} />
            <span>Line</span>
          </button>
          <button
            className={layout === "grid" ? "is-active" : ""}
            onClick={() => setLayout("grid")}
            title="Square tiles"
            aria-pressed={layout === "grid"}
          >
            <LayoutGrid size={15} />
            <span>Squares</span>
          </button>
        </div>
      </div>

      <div className={`roomgal-deck roomgal-${layout}`}>
        {MASK_ROOMS.map((room, i) => (
          <motion.button
            key={room.id}
            type="button"
            className="roomgal-card"
            style={{ ["--accent" as string]: room.accent }}
            onClick={() => enter(room)}
            disabled={!!entering}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, type: "spring", stiffness: 320, damping: 30 }}
            whileHover={{ y: -6 }}
            whileTap={{ scale: 0.97 }}
          >
            <img
              className="roomgal-art"
              src={layout === "row" ? room.poster : room.scene}
              alt={room.label}
              loading="lazy"
              draggable={false}
            />
            <div className="roomgal-veil" />
            <div className="roomgal-meta">
              <div className="roomgal-name">{room.label}</div>
              <div className="roomgal-tag">{room.tagline}</div>
              <span className="roomgal-enter">
                Enter <ArrowRight size={14} />
              </span>
            </div>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {entering && (
          <motion.div
            className="roomgal-loader"
            style={{ ["--accent" as string]: entering.accent }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <motion.div
              className="roomgal-loader-bg"
              style={{ backgroundImage: `url(${entering.scene})` }}
              initial={{ scale: 1.15, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.1, ease: "easeOut" }}
            />
            <div className="roomgal-loader-veil" />
            <motion.div
              className="roomgal-loader-card"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 280, damping: 26 }}
            >
              <div className="roomgal-loader-name">{entering.label}</div>
              <div className="roomgal-loader-status">ENTERING…</div>
              <div className="roomgal-loader-bar">
                <motion.span
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 0.85, ease: "easeInOut" }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
