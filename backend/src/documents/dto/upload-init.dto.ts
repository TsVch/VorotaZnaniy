import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsObject,
  MinLength,
  MaxLength,
  Min,
  Max,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProtectionConfigDto {
  @ApiPropertyOptional({
    description: 'Enable dynamic watermarking',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  watermark_enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Custom watermark text (max 50 chars). Supports {user_email} placeholder',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  watermark_text?: string;

  @ApiPropertyOptional({
    description: 'Maximum concurrent viewing sessions (1-10)',
    default: 2,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  max_concurrent_sessions?: number;

  @ApiPropertyOptional({
    description: 'Allow text selection and copy',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  allow_text_selection?: boolean;

  @ApiPropertyOptional({
    description: 'Allow PDF download (disabled for MVP)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  allow_download?: boolean;
}

export class UploadInitDto {
  @ApiProperty({
    description: 'Human-readable title for the document',
    example: 'Advanced SEO Guide',
    minLength: 3,
    maxLength: 255,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title!: string;

  @ApiProperty({
    description: 'Original filename (must end with .pdf)',
    example: 'seo_guide.pdf',
  })
  @IsString()
  @Matches(/\.pdf$/i, {
    message: 'file_name must end with .pdf',
  })
  file_name!: string;

  @ApiProperty({
    description: 'File size in bytes (max 500 MB = 524288000 bytes)',
    example: 5242880,
    maximum: 524288000,
  })
  @IsNumber()
  @Max(524288000, {
    message: 'file_size must not exceed 500 MB (524288000 bytes)',
  })
  file_size!: number;

  @ApiProperty({
    description: 'MIME type (must be application/pdf)',
    example: 'application/pdf',
  })
  @IsString()
  @Matches(/^application\/pdf$/, {
    message: 'mime_type must be application/pdf',
  })
  mime_type!: string;

  @ApiPropertyOptional({
    description: 'Optional DRM protection configuration overrides',
    type: ProtectionConfigDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ProtectionConfigDto)
  protection_config?: ProtectionConfigDto;
}
