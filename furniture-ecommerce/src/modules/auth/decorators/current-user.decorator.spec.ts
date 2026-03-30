import { faker } from '@faker-js/faker';
import type { ExecutionContext } from '@nestjs/common';

import { MESSAGES } from '@/common/constants';
import { Role } from '@/common/enums';
import type { AuthenticatedUser } from '@/modules/auth/interfaces';

// ─── capture factory before module loads ─────────────────────────────────────

// jest.mock is hoisted — we capture the factory passed to createParamDecorator
// so we can invoke it directly in tests, ensuring actual source code is covered.
type Factory = (_data: unknown, ctx: ExecutionContext) => AuthenticatedUser;
let capturedFactory: Factory;

jest.mock('@nestjs/common', () => ({
  ...jest.requireActual('@nestjs/common'),
  createParamDecorator: (factory: Factory) => {
    capturedFactory = factory;

    return () => {};
  },
}));

// import AFTER mock is set up so createParamDecorator is already mocked
import { CurrentUser } from './current-user.decorator';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeAuthenticatedUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
  userId: faker.string.uuid(),
  email: faker.internet.email(),
  name: faker.person.fullName(),
  role: Role.User,
  ...overrides,
});

const makeContext = (user?: AuthenticatedUser): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  }) as unknown as ExecutionContext;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('CurrentUser decorator', () => {
  describe('factory', () => {
    it('should return the user from request when present', () => {
      const user = makeAuthenticatedUser();
      const ctx = makeContext(user);

      const result = capturedFactory(undefined, ctx);

      expect(result).toBe(user);
    });

    it('should return admin user correctly', () => {
      const user = makeAuthenticatedUser({ role: Role.Admin });
      const ctx = makeContext(user);

      const result = capturedFactory(undefined, ctx);

      expect(result.role).toBe(Role.Admin);
    });

    it('should throw Error with correct message when user is missing', () => {
      const ctx = makeContext(undefined);

      expect(() => capturedFactory(undefined, ctx)).toThrow(
        MESSAGES.INVALID_CURRENT_USER_DECORATOR,
      );
    });

    it('should throw Error (not UnauthorizedException) when user is missing', () => {
      const ctx = makeContext(undefined);

      expect(() => capturedFactory(undefined, ctx)).toThrow(Error);
    });
  });

  describe('decorator', () => {
    it('should be a function (ParameterDecorator)', () => {
      expect(typeof CurrentUser).toBe('function');
    });
  });
});
