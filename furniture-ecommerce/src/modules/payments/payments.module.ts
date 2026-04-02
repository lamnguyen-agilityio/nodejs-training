import { Module } from '@nestjs/common';

import { AuthModule } from '@/modules/auth/auth.module';
import { OrdersModule } from '@/modules/orders/orders.module';

import { PaymentProviderService } from './payment-provider.service';
import { PaymentsController } from './payments.controller';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';
import { StripeProvider } from './providers/stripe.provider';

@Module({
  imports: [AuthModule, OrdersModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsRepository,
    PaymentsService,
    StripeProvider,
    {
      provide: PaymentProviderService,
      useExisting: StripeProvider,
    },
  ],
  exports: [PaymentsService, PaymentsRepository, PaymentProviderService, StripeProvider],
})
export class PaymentsModule {}
