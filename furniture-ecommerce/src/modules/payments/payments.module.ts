import { Module } from '@nestjs/common';

import { AuthModule } from '@/modules/auth/auth.module';
import { OrdersModule } from '@/modules/orders/orders.module';

import { PaymentProviderService } from './payment-provider.service';
import { PaymentsController } from './payments.controller';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';
import { StripeProviderService } from './providers/stripe-provider.service';

@Module({
  imports: [AuthModule, OrdersModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsRepository,
    PaymentsService,
    StripeProviderService,
    {
      provide: PaymentProviderService,
      useExisting: StripeProviderService,
    },
  ],
  exports: [PaymentsService, PaymentsRepository, PaymentProviderService, StripeProviderService],
})
export class PaymentsModule {}
