/**
 * Plays a GIF exactly once, then freezes on the first frame.
 *
 * Uses gifuct-js to decode the GIF client-side and draw frames manually to a
 * canvas, so we have full control over playback. After the last frame's delay
 * expires we draw frame 0 and stop the animation loop.
 *
 * The canvas element inherits the same CSS class as the original <img> so it
 * slots in as a drop-in replacement without touching the stylesheet.
 */
import { useEffect, useRef } from "react";
import { parseGIF, decompressFrames } from "gifuct-js";

interface Props {
  src: string;
  className?: string;
}

export function GifBackground({ src, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let rafId = 0;

    async function run() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      let buf: ArrayBuffer;
      try {
        const resp = await fetch(src);
        buf = await resp.arrayBuffer();
      } catch {
        return;
      }
      if (cancelled) return;

      const gif = parseGIF(buf);
      const frames = decompressFrames(gif, true);
      if (!frames.length || cancelled) return;

      const W = gif.lsd.width;
      const H = gif.lsd.height;
      canvas.width = W;
      canvas.height = H;

      // Pre-composite all frames onto a scratch canvas so playback is just
      // blitting cached ImageData — no per-frame patch compositing on the hot path.
      const scratch = document.createElement("canvas");
      scratch.width = W;
      scratch.height = H;
      const sctx = scratch.getContext("2d", { willReadFrequently: true })!;

      const rendered: ImageData[] = [];
      for (const frame of frames) {
        if (cancelled) return;
        // disposal 2 = restore to background (clear before drawing)
        if (frame.disposalType === 2) sctx.clearRect(0, 0, W, H);

        const patch = new ImageData(
          frame.patch as Uint8ClampedArray<ArrayBuffer>,
          frame.dims.width,
          frame.dims.height,
        );
        sctx.putImageData(patch, frame.dims.left, frame.dims.top);
        rendered.push(sctx.getImageData(0, 0, W, H));
      }
      if (cancelled) return;

      // Draw frame 0 immediately so there's no blank flash.
      ctx.putImageData(rendered[0], 0, 0);

      // Animate through all frames once, then freeze on frame 0.
      let idx = 0;
      let deadline = performance.now() + (frames[0].delay ?? 10) * 10;

      function tick(now: number) {
        if (cancelled) return;
        if (now >= deadline) {
          idx++;
          if (idx >= frames.length) {
            // One loop complete — freeze on the first frame.
            ctx!.putImageData(rendered[0], 0, 0);
            return;
          }
          ctx!.putImageData(rendered[idx], 0, 0);
          deadline = now + (frames[idx].delay ?? 10) * 10;
        }
        rafId = requestAnimationFrame(tick);
      }

      rafId = requestAnimationFrame(tick);
    }

    run();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [src]);

  // aria-hidden: purely decorative
  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
