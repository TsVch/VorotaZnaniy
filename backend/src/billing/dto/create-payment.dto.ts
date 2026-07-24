import { ApiProperty, ApiHideProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  MaxLength,
} from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({
    description: 'Workspace UUID to subscribe',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  workspaceId!: string;

  @ApiProperty({
    description: 'Amount in minor units (e.g., 99000 = 990 RUB)',
    example: 99000,
    minimum: 100,
  })
  @IsNumber()
  @Min(100)
  amount!: number;

  @ApiProperty({
    description: 'ISO 4217 currency code',
    example: 'RUB',
    default: 'RUB',
  })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({
    description: 'Payment description shown on hosted page',
    example: 'Pro Subscription — 1 month',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  description!: string;

  @ApiProperty({
    description: 'Return URL after successful payment',
    example: 'http://localhost:3001/workspace/settings?payment=success',
  })
  @IsString()
  returnUrl!: string;

  /** Internal use only — set by controller */
  @ApiHideProperty()
  userId?: string;
}
