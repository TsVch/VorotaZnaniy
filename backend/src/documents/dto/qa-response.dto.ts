/**
 * A single source chunk cited in the Q&A answer.
 */
export interface SourceItem {
  chunkIndex: number;
  text: string;
}

/**
 * Response payload for POST /v1/documents/:id/qa.
 */
export class QaResponseDto {
  answer!: string;
  sources!: SourceItem[];
}
