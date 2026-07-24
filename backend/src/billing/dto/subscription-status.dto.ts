import { ApiProperty } from '@nestjs/swagger';

export class SubscriptionStatusDto {
  @ApiProperty({
    description: 'Current subscription status',
    example: 'FREE',
    enum: ['FREE', 'ACTIVE', 'CANCELLED', 'PAST_DUE'],
  })
  status!: string;

  @ApiProperty({
    description: 'Active subscription plan',
    example: 'FREE',
    enum: ['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'],
  })
  plan!: string;

  @ApiProperty({
    description: 'Subscription expiry date (null if FREE)',
    example: '2026-08-23T00:00:00.000Z',
    required: false,
  })
  expiresAt?: string;

  @ApiProperty({
    description: 'Active payment provider name',
    example: 'yookassa',
    required: false,
  })
  activeProvider?: string;

  @ApiProperty({
    description: 'Whether the workspace has an active paid subscription',
    example: false,
  })
  isActive!: boolean;

  @ApiProperty({
    description: 'Days remaining until expiry (null if FREE)',
    example: 25,
    required: false,
  })
  daysRemaining?: number;

  @ApiProperty({
    description: 'Pro plan monthly price in minor units',
    example: 99000,
  })
  proPlanPrice!: number;

  @ApiProperty({
    description: 'Pro plan currency',
    example: 'RUB',
  })
  proPlanCurrency!: string;
}
