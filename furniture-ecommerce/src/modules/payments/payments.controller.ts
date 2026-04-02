import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiBadRequestResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';

import { Auth, CurrentUser } from '@/modules/auth/decorators';
import type { AuthenticatedUser } from '@/modules/auth/interfaces';

import { CheckoutResponseDto, PaymentResponseDto } from './dtos';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(':orderId/checkout')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create Stripe checkout session for an order',
    description:
      'Creates a Stripe Checkout Session for the given pending order. ' +
      'If a pending session already exists for this order, returns the existing checkout URL.',
  })
  @ApiOkResponse({ type: CheckoutResponseDto })
  @ApiBadRequestResponse({ description: 'Order not pending or insufficient stock' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiConflictResponse({ description: 'Order already has a non-pending payment' })
  async createCheckout(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<CheckoutResponseDto> {
    const { checkoutUrl } = await this.paymentsService.createCheckout(authUser, orderId);

    return CheckoutResponseDto.from(checkoutUrl);
  }

  @Get(':orderId')
  @Auth()
  @ApiOperation({
    summary: 'Get payment status for an order',
    description:
      'Returns the payment record for a given order. ' +
      'If payment is still pending, checkoutUrl is included so the FE can redirect.',
  })
  @ApiOkResponse({ type: PaymentResponseDto })
  @ApiNotFoundResponse({ description: 'Payment not found for order' })
  async getPaymentStatus(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<PaymentResponseDto> {
    const { payment, checkoutUrl } = await this.paymentsService.getPaymentStatus(authUser, orderId);

    return PaymentResponseDto.from(payment, checkoutUrl);
  }
}
