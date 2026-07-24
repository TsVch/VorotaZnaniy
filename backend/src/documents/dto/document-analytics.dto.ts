/**
 * DTO for document analytics response.
 * Contains aggregated metrics from Session and AiUsageLog tables.
 */
export class DocumentAnalyticsDto {
  /** Total number of viewing sessions for this document */
  totalViews!: number;

  /** Number of distinct users who viewed this document */
  uniqueViewers!: number;

  /** Total number of AI queries made against this document */
  aiQueries!: number;

  /** Last 5 viewing sessions (newest first) */
  recentSessions!: RecentSessionDto[];
}

export class RecentSessionDto {
  /** Session ID */
  id!: string;

  /** When the session was created */
  createdAt!: Date;

  /** Whether the session is still active */
  isActive!: boolean;
}
