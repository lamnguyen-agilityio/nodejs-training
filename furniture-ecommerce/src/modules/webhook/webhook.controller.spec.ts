import { faker } from '@faker-js/faker';
import { BadRequestException } from '@nestjs/common';

import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockWebhookService = {
  handleWebhook: jest.fn(),
} satisfies Partial<jest.Mocked<WebhookService>>;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('WebhookController', () => {
  let controller: WebhookController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new WebhookController(mockWebhookService as unknown as WebhookService);
  });

  describe('handleWebhook', () => {
    it('should delegate to webhookService.handleWebhook with payload and signature', async () => {
      const payload = Buffer.from(faker.string.alphanumeric(128));
      const signature = `t=${Date.now()},v1=${faker.string.alphanumeric(64)}`;
      mockWebhookService.handleWebhook.mockResolvedValue(undefined);

      await controller.handleWebhook(payload, signature);

      expect(mockWebhookService.handleWebhook).toHaveBeenCalledWith(payload, signature);
    });

    it('should propagate BadRequestException when signature is invalid', async () => {
      const payload = Buffer.from('invalid');
      const signature = 'bad-signature';
      mockWebhookService.handleWebhook.mockRejectedValue(
        new BadRequestException('Invalid webhook signature'),
      );

      await expect(controller.handleWebhook(payload, signature)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return void on success', async () => {
      mockWebhookService.handleWebhook.mockResolvedValue(undefined);

      const result = await controller.handleWebhook(Buffer.from('payload'), 'valid-sig');

      expect(result).toBeUndefined();
    });
  });
});
