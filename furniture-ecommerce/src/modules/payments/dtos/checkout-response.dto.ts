import { ApiProperty } from '@nestjs/swagger';
import { Expose, plainToInstance } from 'class-transformer';

export class CheckoutResponseDto {
  @ApiProperty({
    example: 'https://checkout.stripe.com/c/pay/cs_test_...',
    description: 'Stripe hosted checkout URL — redirect user here to complete payment',
  })
  @Expose()
  checkoutUrl: string;

  static from(checkoutUrl: string): CheckoutResponseDto {
    return plainToInstance(CheckoutResponseDto, {
      checkoutUrl,
    });
  }
}
