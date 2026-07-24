'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import { viewerApi } from '@/lib/api/client';

/**
 * Maximum number of preloaded page images stored in memory.
 * LRU eviction — oldest unused pages are removed first.
 */
const MAX_CACHED_PAGES = 5;

/**
 * A preloaded page entry in the LRU cache.
 */
interface CacheEntry {
  /** The loaded HTMLImageElement ready for canvas rendering */
  image: HTMLImageElement;
  /** Timestamp of last access (used for LRU eviction) */
  lastAccessed: number;
}

/**
 * Result returned by the usePagePreloader hook for a single page.
 */
export interface PreloadedPage {
  /** The image element (null if loading or failed) */
  image: HTMLImageElement | null;
  /** Whether the page is currently being fetched */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
}

/**
 * usePagePreloader — Manages an LRU cache of preloaded page images.
 *
 * Preloads currentPage - 1, currentPage, currentPage + 1 in the background.
 * Evicts the least-recently-used pages when cache exceeds MAX_CACHED_PAGES.
 * Cleans up all cached images on unmount to prevent memory leaks.
 *
 * @param sessionId - Active viewing session UUID
 * @param currentPage - The currently viewed page number
 * @returns Record of page numbers to their preloaded states
 */
export function usePagePreloader(
  sessionId: string,
  currentPage: number,
): Record<number, PreloadedPage> {
  // ── Refs (no re-render needed for cache operations) ────────────────────
  const cacheRef = useRef<Map<number, CacheEntry>>(new Map());
  const loadingRef = useRef<Set<number>>(new Set());
  const errorsRef = useRef<Record<number, string>>({});

  // ── Render trigger ─────────────────────────────────────────────────────
  const [, forceUpdate] = useState(0);
  const triggerRender = useCallback(() => {
    forceUpdate((n) => n + 1);
  }, []);

  /**
   * Fetches and caches a page image.
   * If already cached, updates the LRU timestamp.
   * If already loading, skips the request.
   */
  const preloadPage = useCallback(
    async (pageNum: number): Promise<void> => {
      // ── Already cached → update LRU timestamp ──────────────────────────
      const cached = cacheRef.current.get(pageNum);
      if (cached) {
        cached.lastAccessed = Date.now();
        return;
      }

      // ── Already loading → skip ────────────────────────────────────────
      if (loadingRef.current.has(pageNum)) {
        return;
      }

      loadingRef.current.add(pageNum);
      triggerRender();

      try {
        const { url } = await viewerApi.getPageUrl(sessionId, pageNum);

        const img = new Image();
        img.crossOrigin = 'anonymous';

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () =>
            reject(new Error(`Failed to load page ${pageNum}`));
          img.src = url;
        });

        // ── Store in LRU cache ──────────────────────────────────────────
        cacheRef.current.set(pageNum, {
          image: img,
          lastAccessed: Date.now(),
        });

        // ── Evict LRU if over limit ──────────────────────────────────────
        if (cacheRef.current.size > MAX_CACHED_PAGES) {
          const sorted = [...cacheRef.current.entries()].sort(
            ([, a], [, b]) => a.lastAccessed - b.lastAccessed,
          );
          const evicted = sorted.slice(
            0,
            cacheRef.current.size - MAX_CACHED_PAGES,
          );
          for (const [key] of evicted) {
            cacheRef.current.delete(key);
          }
        }

        // Clear any previous error
        delete errorsRef.current[pageNum];
      } catch (error: unknown) {
        errorsRef.current[pageNum] =
          error instanceof Error ? error.message : 'Unknown error';
      } finally {
        loadingRef.current.delete(pageNum);
        triggerRender();
      }
    },
    [sessionId, triggerRender],
  );

  // ── Preload on currentPage change ──────────────────────────────────────
  useEffect(() => {
    const pagesToPreload = [
      currentPage - 1,
      currentPage,
      currentPage + 1,
    ].filter((p) => p >= 1);

    for (const page of pagesToPreload) {
      preloadPage(page);
    }
  }, [currentPage, preloadPage]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────
  useEffect(() => {
    const cache = cacheRef.current;
    const loadingSet = loadingRef.current;
    return () => {
      cache.clear();
      loadingSet.clear();
      errorsRef.current = {};
    };
  }, []);

  // ── Build result record ────────────────────────────────────────────────
  const result: Record<number, PreloadedPage> = {};
  for (const page of [currentPage - 1, currentPage, currentPage + 1]) {
    if (page < 1) continue;
    const cached = cacheRef.current.get(page);
    result[page] = {
      image: cached?.image ?? null,
      isLoading: loadingRef.current.has(page),
      error: errorsRef.current[page] ?? null,
    };
  }

  return result;
}
