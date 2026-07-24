'use client';

import { useEffect, useRef, useMemo } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────

export interface WatermarkOverlayProps {
  /** Viewer's email address — identifies who is viewing */
  userEmail: string;
  /** First 8 characters of the session UUID — for traceability */
  sessionIdShort: string;
  /** ISO date string (YYYY-MM-DD) — when the session was created */
  timestamp: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

/** Tile dimensions for the repeating SVG pattern (in SVG units) */
const TILE_W = 300;
const TILE_H = 150;

/** Maximum pixel offset from centre for the dynamic shift effect */
const MAX_OFFSET = 10;

/** Opacity of watermark text — semi-transparent deterrent */
const TEXT_OPACITY = 0.13;

/** Font size used inside the SVG pattern */
const FONT_SIZE = 11;

/** Counter-rotation angle (degrees) so text cuts across the page */
const TEXT_ROTATION = -18;

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Minimal XML-escaping for user-controlled strings embedded in SVG.
 * This prevents injection via userEmail or sessionIdShort values
 * that happen to contain XML special characters.
 */
function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Builds an SVG data-URL that repeats user-identifying text in a
 * sparse grid pattern so it tiles seamlessly as a CSS background.
 */
function buildWatermarkSvg(
  email: string,
  sessionId: string,
  date: string,
): string {
  // Three lines per watermark group
  const lines = [email, `Session: ${sessionId}`, date];

  // Four grid positions per tile (2 × 2)
  const positions = [
    { x: 20, y: 35 },
    { x: 170, y: 40 },
    { x: 20, y: 100 },
    { x: 170, y: 95 },
  ];

  const textElements = positions
    .flatMap((pos) =>
      lines.map(
        (line, i) =>
          `<text x="${pos.x}" y="${pos.y + i * 18}" font-size="${FONT_SIZE}" opacity="${TEXT_OPACITY}" fill="currentColor" transform="rotate(${TEXT_ROTATION} ${pos.x} ${pos.y})">${esc(line)}</text>`,
      ),
    )
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE_W}" height="${TILE_H}">${textElements}</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// ── Component ─────────────────────────────────────────────────────────────

/**
 * WatermarkOverlay — Repeating, semi-transparent watermark overlay.
 *
 * DRM feature: renders user-identifying information (email, session ID, date)
 * as a tiled SVG background across the viewer area. The watermark:
 *  - Does NOT block mouse/touch events (`pointer-events: none`)
 *  - Shifts slightly (±10px) based on cursor position to frustrate
 *    automated removal from screenshots
 *  - Uses GPU-accelerated CSS transforms + requestAnimationFrame
 *    throttling for zero jank
 *
 * @example
 * ```tsx
 * <WatermarkOverlay
 *   userEmail="user@example.com"
 *   sessionIdShort="abc12345"
 *   timestamp="2026-07-21"
 * />
 * ```
 */
export default function WatermarkOverlay({
  userEmail,
  sessionIdShort,
  timestamp,
}: WatermarkOverlayProps) {
  // ── Generate SVG data URL (stable across renders when props don't change) ─
  const svgDataUrl = useMemo(
    () => buildWatermarkSvg(userEmail, sessionIdShort, timestamp),
    [userEmail, sessionIdShort, timestamp],
  );

  // ── Refs ────────────────────────────────────────────────────────────────
  const overlayRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  // ── Dynamic shift on mouse move (ref-based, no React re-renders) ────────
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const parent = overlay.parentElement;
    if (!parent) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = parent.getBoundingClientRect();
      const centreX = rect.left + rect.width / 2;
      const centreY = rect.top + rect.height / 2;

      // Normalise cursor position relative to container centre, clamping to ±1
      const halfW = rect.width / 2;
      const halfH = rect.height / 2;
      const normX = halfW > 0 ? Math.max(-1, Math.min(1, (e.clientX - centreX) / halfW)) : 0;
      const normY = halfH > 0 ? Math.max(-1, Math.min(1, (e.clientY - centreY) / halfH)) : 0;

      // Scale to ±MAX_OFFSET pixels
      offsetRef.current = {
        x: normX * MAX_OFFSET,
        y: normY * MAX_OFFSET,
      };

      // Schedule a single rAF — coalesces rapid mousemove events
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          const { x, y } = offsetRef.current;
          overlay.style.transform = `translate(${x}px, ${y}px)`;
        });
      }
    };

    parent.addEventListener('mousemove', handleMouseMove, { passive: true });

    return () => {
      parent.removeEventListener('mousemove', handleMouseMove);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-10 pointer-events-none select-none"
      style={{
        backgroundImage: `url("${svgDataUrl}")`,
        backgroundRepeat: 'repeat',
        backgroundSize: `${TILE_W}px ${TILE_H}px`,
        willChange: 'transform',
      }}
      aria-hidden="true"
      data-testid="watermark-overlay"
    />
  );
}
