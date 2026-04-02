import { faker } from '@faker-js/faker';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { Role, PaymentStatus } from '@/common/enums';
import type { AuthenticatedUser } from '@/modules/auth/interfaces';

import { CheckoutResponseDto, PaymentResponseDto } from './dtos';
import type { Payment } from './entities/payment.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeAuthUser = (): AuthenticatedUser => ({
  userId: faker.string.uuid(),
  email: faker.internet.email(),
  name: faker.person.fullName(),
  role: Role.User,
});

const makeCheckoutUrl = () =>
  `https://checkout.stripe.com/c/pay/cs_test_${faker.string.alphanumeric(24)}`;

const makePayment = (status = PaymentStatus.Pending): Payment =>
  ({
    id: faker.string.uuid(),
    status,
    checkoutSessionId: `cs_test_${faker.string.alphanumeric(24)}`,
    intentId: null,
    amount: '199.98',
    currency: 'usd',
    provider: 'stripe',
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
  }) as Payment;

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockPaymentsService = {
  createCheckout: jest.fn(),
  getPaymentStatus: jest.fn(),
} satisfies Partial<jest.Mocked<PaymentsService>>;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('PaymentsController', () => {
  let controller: PaymentsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new PaymentsController(mockPaymentsService as unknown as PaymentsService);
  });

  // ── createCheckout ─────────────────────────────────────────────────────────

  describe('createCheckout', () => {
    it('should return CheckoutResponseDto with checkoutUrl', async () => {
      const authUser = makeAuthUser();
      const orderId = faker.string.uuid();
      const checkoutUrl = makeCheckoutUrl();

      mockPaymentsService.createCheckout.mockResolvedValue({ checkoutUrl });

      const result = await controller.createCheckout(authUser, orderId);

      expect(mockPaymentsService.createCheckout).toHaveBeenCalledWith(authUser, orderId);
      expect(result).toBeInstanceOf(CheckoutResponseDto);
      expect(result.checkoutUrl).toBe(checkoutUrl);
    });

    it('should propagate NotFoundException when order not found', async () => {
      mockPaymentsService.createCheckout.mockRejectedValue(new NotFoundException());

      await expect(controller.createCheckout(makeAuthUser(), faker.string.uuid())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should propagate BadRequestException when order not pending', async () => {
      mockPaymentsService.createCheckout.mockRejectedValue(
        new BadRequestException('Order status is paid'),
      );

      await expect(controller.createCheckout(makeAuthUser(), faker.string.uuid())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should propagate ConflictException when payment already exists', async () => {
      mockPaymentsService.createCheckout.mockRejectedValue(
        new ConflictException('Order already has a payment'),
      );

      await expect(controller.createCheckout(makeAuthUser(), faker.string.uuid())).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ── getPaymentStatus ───────────────────────────────────────────────────────

  describe('getPaymentStatus', () => {
    it('should return PaymentResponseDto with checkoutUrl when pending', async () => {
      const authUser = makeAuthUser();
      const orderId = faker.string.uuid();
      const payment = makePayment(PaymentStatus.Pending);
      const checkoutUrl = makeCheckoutUrl();

      mockPaymentsService.getPaymentStatus.mockResolvedValue({ payment, checkoutUrl });

      const result = await controller.getPaymentStatus(authUser, orderId);

      expect(mockPaymentsService.getPaymentStatus).toHaveBeenCalledWith(authUser, orderId);
      expect(result).toBeInstanceOf(PaymentResponseDto);
      expect(result.checkoutUrl).toBe(checkoutUrl);
    });

    it('should return PaymentResponseDto without checkoutUrl when succeeded', async () => {
      const authUser = makeAuthUser();
      const payment = makePayment(PaymentStatus.Succeeded);

      mockPaymentsService.getPaymentStatus.mockResolvedValue({
        payment,
        checkoutUrl: undefined,
      });

      const result = await controller.getPaymentStatus(authUser, faker.string.uuid());

      expect(result.status).toBe(PaymentStatus.Succeeded);
      expect(result.checkoutUrl).toBeUndefined();
    });

    it('should propagate NotFoundException when payment not found', async () => {
      mockPaymentsService.getPaymentStatus.mockRejectedValue(new NotFoundException());

      await expect(
        controller.getPaymentStatus(makeAuthUser(), faker.string.uuid()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
