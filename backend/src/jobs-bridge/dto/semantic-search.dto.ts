import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

/**
 * Payload for POST /internal/search/semantic.
 *
 * Takes a query embedding vector and returns the top-K most similar
 * chunks for the specified document.
 */
export class SemanticSearchDto {
  /**
   * UUID of the document to search within.
   */
  @IsUUID()
  documentId!: string;

  /**
   * Query embedding vector (1536 floats from text-embedding-3-small).
   */
  @IsArray()
  @ArrayMinSize(1536)
  @ArrayMaxSize(1536)
  @IsNumber({}, { each: true })
  queryEmbedding!: number[];

  /**
   * Number of results to return (1–20). Defaults to 5.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  topK: number = 5;
}

/**
 * A single search result item returned from the semantic search.
 */
export interface SearchResultItem {
  chunkIndex: number;
  chunkText: string;
  similarity: number;
}
