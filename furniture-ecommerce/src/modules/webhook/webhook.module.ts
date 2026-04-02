import { Module } from '@nestjs/common';

import { OrdersModule } from '@/modules/orders/orders.module';
import { PaymentsModule } from '@/modules/payments/payments.module';

import { CheckoutExpiredHandler, CheckoutCompletedHandler } from './handlers';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [PaymentsModule, OrdersModule],
  controllers: [WebhookController],
  providers: [WebhookService, CheckoutCompletedHandler, CheckoutExpiredHandler],
})
export class WebhookModule {}
