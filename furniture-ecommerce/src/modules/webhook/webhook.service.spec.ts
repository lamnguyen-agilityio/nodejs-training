import { faker } from '@faker-js/faker';
import { BadRequestException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { PaymentStatus } from '@/common/enums';
import { type WebhookEvent } from '@/modules/payments/interfaces';
import { PaymentProviderService } from '@/modules/payments/payment-provider.service';
import { PaymentsRepository } from '@/modules/payments/payments.repository';
import { PaymentsService } from '@/modules/payments/payments.service';
import { createMockLogger } from '@/test/mocks';

import { CheckoutCompletedHandler } from './handlers/checkout-completed.handler';
import { CheckoutExpiredHandler } from './handlers/checkout-expired.handler';
import { WebhookService } from './webhook.service';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeSessionId = () => `cs_test_${faker.string.alphanumeric(24)}`;

const makeEvent = (type: string, overrides: Partial<WebhookEvent> = {}): WebhookEvent => ({
  type,
  sessionId: makeSessionId(),
  intentId: `pi_${faker.string.alphanumeric(24)}`,
  ...overrides,
});

const makePayment = (status: PaymentStatus) => ({
  id: faker.string.uuid(),
  status,
  checkoutSessionId: makeSessionId(),
});

const makePayload = () => Buffer.from(faker.string.alphanumeric(128));
const makeSignature = () => `t=${Date.now()},v1=${faker.string.alphanumeric(64)}`;

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockPaymentProvider = {
  verifyWebhookSignature: jest.fn(),
} satisfies Partial<jest.Mocked<PaymentProviderService>>;

const mockPaymentsRepository = {
  findBySessionId: jest.fn(),
} satisfies Partial<jest.Mocked<PaymentsRepository>>;

const mockPaymentsService = {
  isFinalStatus: jest.fn(),
} satisfies Partial<jest.Mocked<PaymentsService>>;

const mockCompletedHandler = {
  handleCompleted: jest.fn(),
} satisfies Partial<jest.Mocked<CheckoutCompletedHandler>>;

const mockExpiredHandler = {
  handleExpired: jest.fn(),
} satisfies Partial<jest.Mocked<CheckoutExpiredHandler>>;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('WebhookService', () => {
  let service: WebhookService;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    jest.clearAllMocks();

    service = new WebhookService(
      mockLogger as unknown as PinoLogger,
      mockPaymentProvider as unknown as PaymentProviderService,
      mockPaymentsRepository as unknown as PaymentsRepository,
      mockPaymentsService as unknown as PaymentsService,
      mockCompletedHandler as unknown as CheckoutCompletedHandler,
      mockExpiredHandler as unknown as CheckoutExpiredHandler,
    );

    // default: no existing payment
    mockPaymentsRepository.findBySessionId.mockResolvedValue(null);
    mockPaymentsService.isFinalStatus.mockReturnValue(false);
    mockCompletedHandler.handleCompleted.mockResolvedValue(undefined);
    mockExpiredHandler.handleExpired.mockResolvedValue(undefined);
  });

  // ── signature verification ─────────────────────────────────────────────────

  describe('signature verification', () => {
    it('should throw BadRequestException when signature is invalid', async () => {
      mockPaymentProvider.verifyWebhookSignature.mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature for payload');
      });

      await expect(service.handleWebhook(makePayload(), 'bad-sig')).rejects.toThrow(
        BadRequestException,
      );

      await expect(service.handleWebhook(makePayload(), 'bad-sig')).rejects.toThrow(
        'Invalid webhook signature',
      );
    });

    it('should call verifyWebhookSignature with payload and signature', async () => {
      const payload = makePayload();
      const signature = makeSignature();
      const event = makeEvent('checkout.session.completed');

      mockPaymentProvider.verifyWebhookSignature.mockReturnValue(event);

      await service.handleWebhook(payload, signature);

      expect(mockPaymentProvider.verifyWebhookSignature).toHaveBeenCalledWith(payload, signature);
    });
  });

  // ── event routing ─────────────────────────────────────────────────────────

  describe('event routing', () => {
    it('should route checkout.session.completed to CheckoutCompletedHandler', async () => {
      const event = makeEvent('checkout.session.completed');
      mockPaymentProvider.verifyWebhookSignature.mockReturnValue(event);

      await service.handleWebhook(makePayload(), makeSignature());

      expect(mockCompletedHandler.handleCompleted).toHaveBeenCalledWith(event);
      expect(mockExpiredHandler.handleExpired).not.toHaveBeenCalled();
    });

    it('should route checkout.session.expired to CheckoutExpiredHandler', async () => {
      const event = makeEvent('checkout.session.expired');
      mockPaymentProvider.verifyWebhookSignature.mockReturnValue(event);

      await service.handleWebhook(makePayload(), makeSignature());

      expect(mockExpiredHandler.handleExpired).toHaveBeenCalledWith(event);
      expect(mockCompletedHandler.handleCompleted).not.toHaveBeenCalled();
    });

    it('should skip and log unhandled event types', async () => {
      const event = makeEvent('customer.created');
      mockPaymentProvider.verifyWebhookSignature.mockReturnValue(event);

      await service.handleWebhook(makePayload(), makeSignature());

      expect(mockCompletedHandler.handleCompleted).not.toHaveBeenCalled();
      expect(mockExpiredHandler.handleExpired).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'customer.created' }),
        'Unhandled event type — skipping',
      );
    });
  });

  // ── idempotency ───────────────────────────────────────────────────────────

  describe('idempotency', () => {
    it('should skip handler when payment is already in final status', async () => {
      const event = makeEvent('checkout.session.completed');
      const payment = makePayment(PaymentStatus.Succeeded);

      mockPaymentProvider.verifyWebhookSignature.mockReturnValue(event);
      mockPaymentsRepository.findBySessionId.mockResolvedValue(payment);
      mockPaymentsService.isFinalStatus.mockReturnValue(true);

      await service.handleWebhook(makePayload(), makeSignature());

      expect(mockCompletedHandler.handleCompleted).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: event.sessionId,
          status: PaymentStatus.Succeeded,
        }),
        'Payment already final — skipping duplicate webhook',
      );
    });

    it('should proceed when payment exists but is not in final status', async () => {
      const event = makeEvent('checkout.session.completed');
      const payment = makePayment(PaymentStatus.Pending);

      mockPaymentProvider.verifyWebhookSignature.mockReturnValue(event);
      mockPaymentsRepository.findBySessionId.mockResolvedValue(payment);
      mockPaymentsService.isFinalStatus.mockReturnValue(false);

      await service.handleWebhook(makePayload(), makeSignature());

      expect(mockCompletedHandler.handleCompleted).toHaveBeenCalledWith(event);
    });

    it('should proceed when no payment record exists yet', async () => {
      const event = makeEvent('checkout.session.completed');
      mockPaymentProvider.verifyWebhookSignature.mockReturnValue(event);
      mockPaymentsRepository.findBySessionId.mockResolvedValue(null);

      await service.handleWebhook(makePayload(), makeSignature());

      expect(mockCompletedHandler.handleCompleted).toHaveBeenCalledWith(event);
    });

    it('should skip idempotency check when sessionId is missing', async () => {
      const event = makeEvent('checkout.session.completed', { sessionId: '' });
      mockPaymentProvider.verifyWebhookSignature.mockReturnValue(event);

      await service.handleWebhook(makePayload(), makeSignature());

      expect(mockPaymentsRepository.findBySessionId).not.toHaveBeenCalled();
      expect(mockCompletedHandler.handleCompleted).toHaveBeenCalled();
    });
  });

  // ── logging ───────────────────────────────────────────────────────────────

  describe('logging', () => {
    it('should log received webhook with type and sessionId', async () => {
      const event = makeEvent('checkout.session.completed');
      mockPaymentProvider.verifyWebhookSignature.mockReturnValue(event);

      await service.handleWebhook(makePayload(), makeSignature());

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: event.type,
          sessionId: event.sessionId,
        }),
        'Webhook received',
      );
    });
  });
});
