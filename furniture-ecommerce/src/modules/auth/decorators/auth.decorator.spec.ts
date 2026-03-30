import { UseGuards, applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';

import { SWAGGER } from '@/common/constants';
import { Role } from '@/common/enums';

import { AuthGuard, RolesGuard } from '../guards';
import { Auth, AuthRoles } from './auth.decorator';
import { Roles } from './roles.decorator';

// ─── mocks ───────────────────────────────────────────────────────────────────

jest.mock('./roles.decorator', () => ({
  Roles: jest.fn(() => () => {}),
}));

// ─── suite ───────────────────────────────────────────────────────────────────

describe('Auth decorators', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Auth ───────────────────────────────────────────────────────────────────

  describe('Auth()', () => {
    it('should apply UseGuards with AuthGuard', () => {
      Auth();

      expect(UseGuards).toHaveBeenCalledWith(AuthGuard);
    });

    it('should apply ApiBearerAuth with correct name', () => {
      Auth();

      expect(ApiBearerAuth).toHaveBeenCalledWith(SWAGGER.BEARER_AUTH_NAME);
    });

    it('should apply ApiUnauthorizedResponse', () => {
      Auth();

      expect(ApiUnauthorizedResponse).toHaveBeenCalledWith(
        expect.objectContaining({ description: expect.any(String) }),
      );
    });

    it('should compose via applyDecorators with 3 decorators', () => {
      Auth();

      expect(applyDecorators).toHaveBeenCalledTimes(1);
      const args = (applyDecorators as jest.Mock).mock.calls[0];
      expect(args).toHaveLength(3);
    });
  });

  // ── AuthRoles ──────────────────────────────────────────────────────────────

  describe('AuthRoles()', () => {
    it('should apply UseGuards with AuthGuard and RolesGuard', () => {
      AuthRoles(Role.Admin);

      expect(UseGuards).toHaveBeenCalledWith(AuthGuard, RolesGuard);
    });

    it('should apply Roles with provided role', () => {
      AuthRoles(Role.Admin);

      expect(Roles).toHaveBeenCalledWith(Role.Admin);
    });

    it('should apply Roles with multiple roles', () => {
      AuthRoles(Role.Admin, Role.User);

      expect(Roles).toHaveBeenCalledWith(Role.Admin, Role.User);
    });

    it('should apply ApiBearerAuth with correct name', () => {
      AuthRoles(Role.Admin);

      expect(ApiBearerAuth).toHaveBeenCalledWith(SWAGGER.BEARER_AUTH_NAME);
    });

    it('should apply ApiUnauthorizedResponse', () => {
      AuthRoles(Role.Admin);

      expect(ApiUnauthorizedResponse).toHaveBeenCalledWith(
        expect.objectContaining({ description: expect.any(String) }),
      );
    });

    it('should compose via applyDecorators with 4 decorators', () => {
      AuthRoles(Role.Admin);

      expect(applyDecorators).toHaveBeenCalledTimes(1);
      const args = (applyDecorators as jest.Mock).mock.calls[0];
      expect(args).toHaveLength(4);
    });
  });
});
