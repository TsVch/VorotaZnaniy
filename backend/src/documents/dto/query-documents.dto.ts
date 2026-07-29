import { IsOptional, IsInt, Min, Max, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryDocumentsDto {
  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of documents per page',
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter by document status',
    enum: ['PROCESSING', 'READY', 'ERROR'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['PROCESSING', 'READY', 'ERROR'])
  status?: string;

  @ApiPropertyOptional({
    description: 'Search by document title (case-insensitive)',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
