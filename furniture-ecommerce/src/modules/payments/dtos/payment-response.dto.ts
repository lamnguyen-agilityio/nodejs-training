import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, plainToInstance } from 'class-transformer';

import { PaymentStatus } from '@/common/enums';

import type { Payment } from '../entities/payment.entity';

export class PaymentResponseDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty({ example: 'stripe' })
  @Expose()
  provider: string;

  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.Pending })
  @Expose()
  status: PaymentStatus;

  @ApiProperty({ example: '1299.99' })
  @Expose()
  amount: string;

  @ApiProperty({ example: 'usd' })
  @Expose()
  currency: string;

  @ApiPropertyOptional({
    example: 'https://checkout.stripe.com/c/pay/cs_test_...',
    description: 'Only present when status is pending — redirect user here to complete payment',
  })
  @Expose()
  checkoutUrl?: string;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  static from(payment: Payment, checkoutUrl?: string): PaymentResponseDto {
    return plainToInstance(
      PaymentResponseDto,
      {
        id: payment.id,
        provider: payment.provider,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        checkoutUrl,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      },
      { excludeExtraneousValues: true },
    );
  }
}
