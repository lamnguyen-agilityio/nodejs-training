import { faker } from '@faker-js/faker';
import type { EntityManager } from '@mikro-orm/postgresql';
import { PinoLogger } from 'nestjs-pino';

import { PaymentStatus } from '@/common/enums';
import type { Order } from '@/modules/orders/entities/order.entity';
import { createMockEm, createMockLogger } from '@/test/mocks';

import type { Payment } from './entities/payment.entity';
import type { AttachSessionData } from './interfaces';
import { PaymentsRepository } from './payments.repository';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeOrder = (): Order => ({ id: faker.string.uuid() }) as Order;

const makePayment = (overrides: Partial<Payment> = {}): Payment =>
  ({
    id: faker.string.uuid(),
    status: PaymentStatus.Pending,
    checkoutSessionId: `cs_test_${faker.string.alphanumeric(24)}`,
    intentId: null,
    amount: '0',
    currency: '',
    provider: 'stripe',
    ...overrides,
  }) as Payment;

const makeAttachData = (): AttachSessionData => ({
  checkoutSessionId: `cs_test_${faker.string.alphanumeric(24)}`,
  intentId: null,
  amount: '99.99',
  currency: 'usd',
});

// ─── suite ───────────────────────────────────────────────────────────────────

describe('PaymentsRepository', () => {
  let repository: PaymentsRepository;
  let mockEm: ReturnType<typeof createMockEm>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockEm = createMockEm();
    mockLogger = createMockLogger();
    jest.clearAllMocks();

    repository = new PaymentsRepository(
      mockEm as unknown as EntityManager,
      mockLogger as unknown as PinoLogger,
    );
  });

  // ── findByOrder ────────────────────────────────────────────────────────────

  describe('findByOrder', () => {
    it('should return payment when found', async () => {
      const order = makeOrder();
      const payment = makePayment();
      mockEm.findOne.mockResolvedValue(payment);

      const result = await repository.findByOrder(order);

      expect(mockEm.findOne).toHaveBeenCalledWith(expect.anything(), { order });
      expect(result).toBe(payment);
    });

    it('should return null when not found', async () => {
      mockEm.findOne.mockResolvedValue(null);

      const result = await repository.findByOrder(makeOrder());

      expect(result).toBeNull();
    });
  });

  // ── findBySessionId ────────────────────────────────────────────────────────

  describe('findBySessionId', () => {
    it('should return payment with order populated', async () => {
      const sessionId = `cs_test_${faker.string.alphanumeric(24)}`;
      const payment = makePayment({ checkoutSessionId: sessionId });
      mockEm.findOne.mockResolvedValue(payment);

      const result = await repository.findBySessionId(sessionId);

      expect(mockEm.findOne).toHaveBeenCalledWith(
        expect.anything(),
        { checkoutSessionId: sessionId },
        { populate: ['order'] },
      );
      expect(result).toBe(payment);
    });

    it('should return null when session not found', async () => {
      mockEm.findOne.mockResolvedValue(null);

      const result = await repository.findBySessionId('cs_test_unknown');

      expect(result).toBeNull();
    });
  });

  // ── createOrClaimPending ───────────────────────────────────────────────────

  describe('createOrClaimPending', () => {
    it('should create new pending payment when none exists', async () => {
      const order = makeOrder();
      const payment = makePayment();

      mockEm.findOne.mockResolvedValue(null);
      mockEm.create.mockReturnValue(payment);
      mockEm.flush.mockResolvedValue(undefined);

      const result = await repository.createOrClaimPending(order, 'stripe');

      expect(mockEm.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          order,
          provider: 'stripe',
          status: PaymentStatus.Pending,
          intentId: null,
          checkoutSessionId: '',
          amount: '0',
          currency: '',
        }),
      );
      expect(mockEm.persist).toHaveBeenCalledWith(payment);
      expect(mockEm.flush).toHaveBeenCalled();
      expect(result).toEqual({ payment, isNew: true });
    });

    it('should return existing payment with isNew=false when one exists', async () => {
      const order = makeOrder();
      const existing = makePayment({ checkoutSessionId: 'cs_test_existing' });

      mockEm.findOne.mockResolvedValue(existing);

      const result = await repository.createOrClaimPending(order, 'stripe');

      expect(mockEm.create).not.toHaveBeenCalled();
      expect(mockEm.flush).not.toHaveBeenCalled();
      expect(result).toEqual({ payment: existing, isNew: false });
    });

    it('should propagate error when flush fails', async () => {
      const order = makeOrder();
      mockEm.findOne.mockResolvedValue(null);
      mockEm.create.mockReturnValue(makePayment());
      mockEm.flush.mockRejectedValue(new Error('flush failed'));

      await expect(repository.createOrClaimPending(order, 'stripe')).rejects.toThrow(
        'flush failed',
      );
    });
  });

  // ── attachSession ──────────────────────────────────────────────────────────

  describe('attachSession', () => {
    it('should assign session data and flush', async () => {
      const payment = makePayment();
      const data = makeAttachData();

      mockEm.assign.mockImplementation(
        (entity: Record<string, unknown>, d: Record<string, unknown>) => Object.assign(entity, d),
      );
      mockEm.flush.mockResolvedValue(undefined);

      const result = await repository.attachSession(payment, data);

      expect(mockEm.assign).toHaveBeenCalledWith(payment, data);
      expect(mockEm.flush).toHaveBeenCalled();
      expect(result.checkoutSessionId).toBe(data.checkoutSessionId);
      expect(result.amount).toBe(data.amount);
      expect(result.currency).toBe(data.currency);
    });

    it('should propagate error when flush fails', async () => {
      const payment = makePayment();
      mockEm.assign.mockImplementation(
        (entity: Record<string, unknown>, d: Record<string, unknown>) => Object.assign(entity, d),
      );
      mockEm.flush.mockRejectedValue(new Error('flush failed'));

      await expect(repository.attachSession(payment, makeAttachData())).rejects.toThrow(
        'flush failed',
      );
    });
  });

  // ── updateStatus ───────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should update status and flush', async () => {
      const payment = makePayment({ status: PaymentStatus.Pending });
      mockEm.assign.mockImplementation(
        (entity: Record<string, unknown>, d: Record<string, unknown>) => Object.assign(entity, d),
      );
      mockEm.flush.mockResolvedValue(undefined);

      const result = await repository.updateStatus(payment, PaymentStatus.Succeeded);

      expect(mockEm.assign).toHaveBeenCalledWith(
        payment,
        expect.objectContaining({ status: PaymentStatus.Succeeded }),
      );
      expect(result.status).toBe(PaymentStatus.Succeeded);
    });

    it('should update intentId when provided', async () => {
      const payment = makePayment();
      const intentId = `pi_${faker.string.alphanumeric(24)}`;
      mockEm.assign.mockImplementation(
        (entity: Record<string, unknown>, d: Record<string, unknown>) => Object.assign(entity, d),
      );
      mockEm.flush.mockResolvedValue(undefined);

      await repository.updateStatus(payment, PaymentStatus.Succeeded, intentId);

      expect(mockEm.assign).toHaveBeenCalledWith(payment, expect.objectContaining({ intentId }));
    });

    it('should not include intentId in assign when not provided', async () => {
      const payment = makePayment();
      mockEm.assign.mockImplementation(
        (entity: Record<string, unknown>, d: Record<string, unknown>) => Object.assign(entity, d),
      );
      mockEm.flush.mockResolvedValue(undefined);

      await repository.updateStatus(payment, PaymentStatus.Failed);

      const assignArg = mockEm.assign.mock.calls[0][1] as Record<string, unknown>;
      expect(assignArg).not.toHaveProperty('intentId');
    });
  });
});
