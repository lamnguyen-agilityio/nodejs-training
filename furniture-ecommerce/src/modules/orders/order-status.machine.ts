import { UnprocessableEntityException } from '@nestjs/common';

import { OrderStatus, Role } from '@/common/enums';

const { Pending, Paid, Shipped, Delivered, Cancelled, Failed } = OrderStatus;

/**
 * defines the valid transitions for each role and order status.
 */
const TRANSITIONS: Record<Role, Partial<Record<OrderStatus, OrderStatus[]>>> = {
  [Role.User]: {
    [Pending]: [Cancelled],
  },
  [Role.Admin]: {
    [Pending]: [Paid, Cancelled],
    [Paid]: [Shipped, Cancelled, Failed],
    [Shipped]: [Delivered],
    [Delivered]: [],
    [Cancelled]: [],
    [Failed]: [],
  },
};

/**
 * asserts that a transition from one order status to another is valid for the given role.
 */
export const assertValidTransition = (from: OrderStatus, to: OrderStatus, role: Role): void => {
  const allowed = TRANSITIONS[role]?.[from] ?? [];
  if (!allowed.includes(to)) {
    throw new UnprocessableEntityException(`Cannot transition order from '${from}' to '${to}'`);
  }
};
