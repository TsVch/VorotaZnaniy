import { ApiProperty } from '@nestjs/swagger';

export class PaymentHistoryItemDto {
  @ApiProperty({
    description: 'Provider transaction ID',
    example: 'tx-123456',
  })
  providerTransactionId!: string;

  @ApiProperty({
    description: 'Event type',
    example: 'payment.succeeded',
  })
  eventType!: string;

  @ApiProperty({
    description: 'Payment amount',
    example: '990.00',
  })
  amount!: string;

  @ApiProperty({
    description: 'Payment currency',
    example: 'RUB',
  })
  currency!: string;

  @ApiProperty({
    description: 'Whether this was an auto-renewal payment',
    example: false,
  })
  isRecurring!: boolean;

  @ApiProperty({
    description: 'When the payment was processed',
    example: '2026-07-23T12:00:00.000Z',
  })
  processedAt!: string;
}

export class SubscriptionHistoryDto {
  @ApiProperty({
    type: [PaymentHistoryItemDto],
    description: 'List of payments for this workspace',
  })
  payments!: PaymentHistoryItemDto[];

  @ApiProperty({
    description: 'Total number of payments',
    example: 5,
  })
  total!: number;

  @ApiProperty({
    description: 'Current subscription status',
    example: 'ACTIVE',
  })
  subscriptionStatus!: string;

  @ApiProperty({
    description: 'Next billing date (if active)',
    example: '2026-08-23T00:00:00.000Z',
    required: false,
  })
  nextBillingDate?: string;

  @ApiProperty({
    description: 'Saved payment method info (masked)',
    example: { type: 'bank_card', last4: '1234' },
    required: false,
  })
  paymentMethod?: {
    type: string;
    last4?: string;
  };
}
