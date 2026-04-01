import { UnprocessableEntityException } from '@nestjs/common';

import { OrderStatus, Role } from '@/common/enums';

import { assertValidTransition } from './order-status.machine';

const { Pending, Paid, Shipped, Delivered, Cancelled, Failed } = OrderStatus;

describe('assertValidTransition', () => {
  // ── User transitions ───────────────────────────────────────────────────────

  describe('Role.User', () => {
    it('should allow pending → cancelled', () => {
      expect(() => assertValidTransition(Pending, Cancelled, Role.User)).not.toThrow();
    });

    it('should throw for pending → paid', () => {
      expect(() => assertValidTransition(Pending, Paid, Role.User)).toThrow(
        UnprocessableEntityException,
      );
    });

    it('should throw for pending → shipped', () => {
      expect(() => assertValidTransition(Pending, Shipped, Role.User)).toThrow(
        UnprocessableEntityException,
      );
    });

    it('should throw for paid → any status', () => {
      [Shipped, Cancelled, Failed, Delivered].forEach((to) => {
        expect(() => assertValidTransition(Paid, to, Role.User)).toThrow(
          UnprocessableEntityException,
        );
      });
    });

    it('should include from/to in the error message', () => {
      expect(() => assertValidTransition(Pending, Paid, Role.User)).toThrow(
        `Cannot transition order from '${Pending}' to '${Paid}'`,
      );
    });
  });

  // ── Admin transitions ──────────────────────────────────────────────────────

  describe('Role.Admin', () => {
    it('should allow pending → paid', () => {
      expect(() => assertValidTransition(Pending, Paid, Role.Admin)).not.toThrow();
    });

    it('should allow pending → cancelled', () => {
      expect(() => assertValidTransition(Pending, Cancelled, Role.Admin)).not.toThrow();
    });

    it('should allow paid → shipped', () => {
      expect(() => assertValidTransition(Paid, Shipped, Role.Admin)).not.toThrow();
    });

    it('should allow paid → cancelled', () => {
      expect(() => assertValidTransition(Paid, Cancelled, Role.Admin)).not.toThrow();
    });

    it('should allow paid → failed', () => {
      expect(() => assertValidTransition(Paid, Failed, Role.Admin)).not.toThrow();
    });

    it('should allow shipped → delivered', () => {
      expect(() => assertValidTransition(Shipped, Delivered, Role.Admin)).not.toThrow();
    });

    it('should throw for pending → shipped (skip step)', () => {
      expect(() => assertValidTransition(Pending, Shipped, Role.Admin)).toThrow(
        UnprocessableEntityException,
      );
    });

    it('should throw for delivered → any status (terminal)', () => {
      [Pending, Paid, Shipped, Cancelled, Failed].forEach((to) => {
        expect(() => assertValidTransition(Delivered, to, Role.Admin)).toThrow(
          UnprocessableEntityException,
        );
      });
    });

    it('should throw for cancelled → any status (terminal)', () => {
      [Pending, Paid, Shipped, Delivered, Failed].forEach((to) => {
        expect(() => assertValidTransition(Cancelled, to, Role.Admin)).toThrow(
          UnprocessableEntityException,
        );
      });
    });

    it('should throw for failed → any status (terminal)', () => {
      [Pending, Paid, Shipped, Delivered, Cancelled].forEach((to) => {
        expect(() => assertValidTransition(Failed, to, Role.Admin)).toThrow(
          UnprocessableEntityException,
        );
      });
    });
  });
});
