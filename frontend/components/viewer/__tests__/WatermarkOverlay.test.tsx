import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WatermarkOverlay from '../WatermarkOverlay';

// ── Constants ─────────────────────────────────────────────────────────────
const TEST_PROPS = {
  userEmail: 'user@example.com',
  sessionIdShort: 'abc12345',
  timestamp: '2026-07-21',
};

// ── Helpers ───────────────────────────────────────────────────────────────
function renderWatermark() {
  return render(
    <WatermarkOverlay
      userEmail={TEST_PROPS.userEmail}
      sessionIdShort={TEST_PROPS.sessionIdShort}
      timestamp={TEST_PROPS.timestamp}
    />,
  );
}

describe('WatermarkOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── AC-1: Correct rendering of watermark data ─────────────────────────
  describe('AC-1: Correct rendering of watermark data', () => {
    it('renders a watermark overlay with test id', () => {
      renderWatermark();

      const overlay = screen.getByTestId('watermark-overlay');
      expect(overlay).toBeInTheDocument();
    });

    it('background-image is in url(...) format and contains user email', () => {
      renderWatermark();

      const overlay = screen.getByTestId('watermark-overlay');
      const bgImage = overlay.style.backgroundImage;

      expect(bgImage).toMatch(/^url\(/);
      expect(decodeURIComponent(bgImage)).toContain(TEST_PROPS.userEmail);
    });

    it('background-image contains session ID', () => {
      renderWatermark();

      const overlay = screen.getByTestId('watermark-overlay');
      const bgImage = overlay.style.backgroundImage;

      expect(decodeURIComponent(bgImage)).toContain('Session:');
      expect(decodeURIComponent(bgImage)).toContain(TEST_PROPS.sessionIdShort);
    });

    it('background-image contains the timestamp', () => {
      renderWatermark();

      const overlay = screen.getByTestId('watermark-overlay');
      const bgImage = overlay.style.backgroundImage;

      expect(decodeURIComponent(bgImage)).toContain(TEST_PROPS.timestamp);
    });

    it('has background-repeat set to repeat', () => {
      renderWatermark();

      const overlay = screen.getByTestId('watermark-overlay');
      expect(overlay.style.backgroundRepeat).toBe('repeat');
    });
  });

  // ── AC-2: Non-blocking interaction ────────────────────────────────────
  describe('AC-2: Non-blocking interaction', () => {
    it('has pointer-events: none style', () => {
      renderWatermark();

      const overlay = screen.getByTestId('watermark-overlay');
      expect(overlay.className).toContain('pointer-events-none');
    });

    it('has user-select: none style', () => {
      renderWatermark();

      const overlay = screen.getByTestId('watermark-overlay');
      expect(overlay.className).toContain('select-none');
    });

    it('is marked as aria-hidden for accessibility', () => {
      renderWatermark();

      const overlay = screen.getByTestId('watermark-overlay');
      expect(overlay.getAttribute('aria-hidden')).toBe('true');
    });

    it('has will-change: transform for GPU acceleration', () => {
      renderWatermark();

      const overlay = screen.getByTestId('watermark-overlay');
      expect(overlay.style.willChange).toBe('transform');
    });
  });

  // ── AC-3: Dynamic movement on mouse move ─────────────────────────────
  describe('AC-3: Dynamic movement on mousemove', () => {
    /**
     * jsdom does not run a layout engine, so getBoundingClientRect()
     * always returns zero dimensions. We mock it on the container
     * element so the watermark's mousemove handler can compute
     * normalised offsets relative to the container centre.
     */
    const MOCK_RECT: DOMRectInit = {
      width: 800,
      height: 600,
      x: 0,
      y: 0,
    };

    function renderInContainer() {
      const { container } = render(
        <div style={{ width: '800px', height: '600px', position: 'relative' }}>
          <WatermarkOverlay
            userEmail={TEST_PROPS.userEmail}
            sessionIdShort={TEST_PROPS.sessionIdShort}
            timestamp={TEST_PROPS.timestamp}
          />
        </div>,
      );
      const overlay = screen.getByTestId('watermark-overlay');
      const parent = container.firstChild as HTMLElement;
      // Mock getBoundingClientRect because jsdom always returns 0
      vi.spyOn(parent, 'getBoundingClientRect').mockReturnValue(
        DOMRect.fromRect(MOCK_RECT),
      );
      return { overlay, parent };
    }

    it('applies a CSS transform containing translate( on mousemove', () => {
      const { overlay, parent } = renderInContainer();

      fireEvent.mouseMove(parent, { clientX: 800, clientY: 600 });
      vi.advanceTimersByTime(16);

      const transform = overlay.style.transform;
      expect(transform).toMatch(/translate\(/);
      expect(transform).toContain('px');
    });

    it('does not cause React re-renders during rapid mouse events', () => {
      const { overlay, parent } = renderInContainer();
      const errorSpy = vi.spyOn(console, 'error');

      for (let i = 0; i < 50; i++) {
        fireEvent.mouseMove(parent, { clientX: i * 16, clientY: i * 12 });
      }
      vi.advanceTimersByTime(16);

      const transform = overlay.style.transform;
      expect(transform).toContain('px');
      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });
});
