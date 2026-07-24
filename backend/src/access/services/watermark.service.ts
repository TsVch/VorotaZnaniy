import { Injectable } from '@nestjs/common';

/**
 * Structured watermark data as defined in Security_Requirements.md §1.2.
 *
 * This payload is generated server-side and sent to the frontend
 * for rendering as a dynamic visible watermark overlay.
 */
export interface WatermarkPayload {
  /** Full email of the user viewing the document (for forensic tracing) */
  userEmail: string;
  /** First 8 characters of the session UUID (short enough for UX, long enough for tracing) */
  sessionIdShort: string;
  /** ISO date string (YYYY-MM-DD format) */
  timestamp: string;
}

/**
 * WatermarkService generates structured watermark payloads
 * for dynamic visible watermarking.
 *
 * Per Security_Requirements.md §1.2, every document view must have
 * a session-bound watermark containing user email, short session ID,
 * and current date for forensic traceability.
 */
@Injectable()
export class WatermarkService {
  /**
   * Generates a watermark payload for the given user and session.
   *
   * @param userEmail - Full email address of the authenticated user
   * @param sessionId - Full session UUID (will be truncated to first 8 chars)
   * @returns WatermarkPayload with structured watermark data
   */
  generateWatermarkPayload(
    userEmail: string,
    sessionId: string,
  ): WatermarkPayload {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return {
      userEmail,
      sessionIdShort: sessionId.slice(0, 8),
      timestamp: `${year}-${month}-${day}`,
    };
  }
}
