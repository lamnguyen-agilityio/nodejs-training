import { Module } from '@nestjs/common';

import { AuthModule } from '@/modules/auth/auth.module';
import { OrdersModule } from '@/modules/orders/orders.module';
import { OrdersRepository } from '@/modules/orders/orders.repository';

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
    OrdersRepository,
    PaymentsService,
    {
      provide: PaymentProviderService,
      useClass: StripeProviderService,
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
