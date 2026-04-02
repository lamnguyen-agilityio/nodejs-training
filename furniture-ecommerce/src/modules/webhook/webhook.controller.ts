import { Controller, Headers, HttpCode, HttpStatus, Post, RawBody } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';

import { WebhookService } from './webhook.service';

@Controller('payments/webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  /**
   * Stripe webhook endpoint.
   * — raw body required for signature verification
   * — no @Auth() — Stripe calls server-to-server
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handleWebhook(
    @RawBody() payload: Buffer,
    @Headers('stripe-signature') signature: string,
  ): Promise<void> {
    await this.webhookService.handleWebhook(payload, signature);
  }
}
