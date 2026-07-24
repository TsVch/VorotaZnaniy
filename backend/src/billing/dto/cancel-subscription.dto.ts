import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CancelSubscriptionDto {
  @ApiProperty({
    description: 'Workspace UUID to cancel subscription for',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  workspaceId!: string;

  @ApiProperty({
    description: 'Reason for cancellation (optional)',
    example: 'No longer needed',
    required: false,
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
