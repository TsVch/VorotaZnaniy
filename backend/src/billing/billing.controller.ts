import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceOwnerGuard } from '../auth/guards/workspace-owner.guard';
import { BillingService } from './services/billing.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { SubscriptionStatusDto } from './dto/subscription-status.dto';
import { SubscriptionHistoryDto } from './dto/subscription-history.dto';

@ApiTags('Billing')
@ApiBearerAuth('access-token')
@Controller('v1/billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('create-payment')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, WorkspaceOwnerGuard)
  @ApiOperation({ summary: 'Create a payment for workspace subscription' })
  @ApiResponse({ status: 200, description: 'Payment created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async createPayment(
    @Body() dto: CreatePaymentDto,
    @Req() req: { user: { sub: string } },
  ): Promise<{ confirmationUrl: string; providerTransactionId: string }> {
    return this.billingService.createPayment(dto, req.user.sub);
  }

  @Get('subscription/:workspaceId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, WorkspaceOwnerGuard)
  @ApiOperation({ summary: 'Get subscription status for a workspace' })
  @ApiResponse({ status: 200, description: 'Subscription status retrieved', type: SubscriptionStatusDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async getSubscriptionStatus(
    @Param('workspaceId') workspaceId: string,
  ): Promise<SubscriptionStatusDto> {
    return this.billingService.getSubscriptionStatus(workspaceId);
  }

  @Post('cancel-subscription')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, WorkspaceOwnerGuard)
  @ApiOperation({ summary: 'Cancel an active subscription' })
  @ApiResponse({ status: 200, description: 'Subscription cancelled' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden (not active or not owner)' })
  async cancelSubscription(
    @Body() dto: CancelSubscriptionDto,
    @Req() req: { user: { sub: string } },
  ): Promise<{ message: string }> {
    await this.billingService.cancelSubscription(dto.workspaceId, req.user.sub);
    return { message: 'Subscription cancelled successfully' };
  }

  @Get('subscription-history/:workspaceId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, WorkspaceOwnerGuard)
  @ApiOperation({ summary: 'Get subscription payment history' })
  @ApiResponse({ status: 200, description: 'History retrieved', type: SubscriptionHistoryDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async getSubscriptionHistory(
    @Param('workspaceId') workspaceId: string,
  ): Promise<SubscriptionHistoryDto> {
    return this.billingService.getSubscriptionHistory(workspaceId);
  }
}
