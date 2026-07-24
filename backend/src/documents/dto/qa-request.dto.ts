import { IsString, MinLength, MaxLength } from 'class-validator';

/**
 * Request payload for POST /v1/documents/:id/qa.
 */
export class QaRequestDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  question!: string;
}
