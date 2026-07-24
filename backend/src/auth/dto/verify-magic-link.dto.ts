import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyMagicLinkDto {
  @ApiProperty({
    description: 'One-time magic link token (64 hex chars)',
    example: 'a1b2c3d4e5f6...',
  })
  @IsString()
  @MinLength(32, { message: 'Invalid token format' })
  token!: string;
}
