'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Render state for the canvas.
 */
export type CanvasState = 'idle' | 'loading' | 'rendered' | 'error';

/**
 * Result returned by the useCanvasRenderer hook.
 */
export interface CanvasRenderResult {
  /** Current render state */
  canvasState: CanvasState;
  /** Error message if state is 'error' */
  errorMessage: string | null;
  /** Retry rendering the current image */
  retry: () => void;
}

/**
 * useCanvasRenderer — Manages drawing a page image onto an HTML5 <canvas>.
 *
 * Handles:
 * - Drawing the preloaded image via ctx.drawImage()
 * - Canvas resize via ResizeObserver for responsive layouts
 * - Loading and error states
 * - Cleanup on unmount or page change
 *
 * @param canvasRef - Ref to the target <canvas> element
 * @param image - The preloaded HTMLImageElement to draw (null if not ready)
 * @param pageNumber - Current page number (for resetting state on change)
 * @returns CanvasRenderResult with state, error info, and retry function
 */
export function useCanvasRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  image: HTMLImageElement | null,
  pageNumber: number,
): CanvasRenderResult {
  const [canvasState, setCanvasState] = useState<CanvasState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  /**
   * Draws the image onto the canvas, fitting it within the canvas bounds
   * while maintaining aspect ratio.
   */
  const drawImageOnCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setCanvasState('error');
      setErrorMessage('Canvas context not available');
      return;
    }

    // ── Set canvas size to match container ───────────────────────────────
    const parent = canvas.parentElement;
    if (parent) {
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    // ── Calculate aspect-ratio fit ───────────────────────────────────────
    const imgAspect = image.naturalWidth / image.naturalHeight;
    const canvasAspect = canvas.width / canvas.height;

    let drawWidth: number;
    let drawHeight: number;
    let offsetX: number;
    let offsetY: number;

    if (imgAspect > canvasAspect) {
      // Image is wider → fit by width
      drawWidth = canvas.width;
      drawHeight = canvas.width / imgAspect;
      offsetX = 0;
      offsetY = (canvas.height - drawHeight) / 2;
    } else {
      // Image is taller → fit by height
      drawHeight = canvas.height;
      drawWidth = canvas.height * imgAspect;
      offsetX = (canvas.width - drawWidth) / 2;
      offsetY = 0;
    }

    // ── Clear and draw ───────────────────────────────────────────────────
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

    setCanvasState('rendered');
    setErrorMessage(null);
  }, [canvasRef, image]);

  /**
   * Retry rendering (called from error UI).
   */
  const retry = useCallback(() => {
    setCanvasState('loading');
    setErrorMessage(null);
    // Use requestAnimationFrame to ensure canvas is ready
    animationFrameRef.current = requestAnimationFrame(() => {
      drawImageOnCanvas();
    });
  }, [drawImageOnCanvas]);

  // ── Reset state and draw when image or page changes ────────────────────
  useEffect(() => {
    if (!image) {
      setCanvasState('loading');
      return;
    }

    if (canvasRef.current) {
      animationFrameRef.current = requestAnimationFrame(() => {
        drawImageOnCanvas();
      });
    }

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [image, pageNumber, drawImageOnCanvas, canvasRef]);

  // ── ResizeObserver for responsive canvas ────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    resizeObserverRef.current = new ResizeObserver(() => {
      animationFrameRef.current = requestAnimationFrame(() => {
        drawImageOnCanvas();
      });
    });

    resizeObserverRef.current.observe(parent);

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, [canvasRef, image, drawImageOnCanvas]);

  // ── Initial idle → loading transition ──────────────────────────────────
  useEffect(() => {
    if (canvasState === 'idle' && !image) {
      setCanvasState('loading');
    }
  }, [canvasState, image]);

  return { canvasState, errorMessage, retry };
}
