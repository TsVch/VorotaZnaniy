import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * A single embedding entry — chunk_index, chunk_text, and embedding vector.
 */
export class EmbeddingItemDto {
  @IsInt()
  @Min(0)
  chunkIndex!: number;

  @IsString()
  @MaxLength(4000)
  chunkText!: string;

  @IsArray()
  @ArrayMinSize(1536)
  @ArrayMaxSize(1536)
  @IsNumber({}, { each: true })
  embedding!: number[];
}

/**
 * Payload for POST /internal/jobs/:id/embeddings.
 */
export class SaveEmbeddingsDto {
  @IsUUID()
  documentId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EmbeddingItemDto)
  embeddings!: EmbeddingItemDto[];
}
