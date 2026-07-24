import { IsOptional, IsString, MinLength, MaxLength, IsInt, Min, Max, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DRM protection configuration (optional, for partial updates).
 *
 * All fields are optional — only provided fields will be merged
 * into the existing protectionConfig (deep partial update).
 *
 * MVP restriction: allow_download is accepted in the DTO but
 * the service rejects any request that sets it to true.
 */
export class UpdateProtectionConfigDto {
  @IsOptional()
  @IsBoolean()
  watermark_enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  watermark_text?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  max_concurrent_sessions?: number;

  @IsOptional()
  @IsBoolean()
  allow_text_selection?: boolean;

  @IsOptional()
  @IsBoolean()
  allow_download?: boolean;
}

/**
 * DTO for updating a document (title, description, protection config).
 *
 * All fields are optional — only provided fields will be updated
 * (partial/PATCH semantics). Critical fields like id, workspaceId,
 * s3Key, status, fileSize are NOT in this DTO and cannot be changed.
 */
export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateProtectionConfigDto)
  protection_config?: UpdateProtectionConfigDto;
}
