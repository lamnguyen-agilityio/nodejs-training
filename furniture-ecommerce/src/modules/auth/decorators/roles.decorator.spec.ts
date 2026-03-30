import { SetMetadata } from '@nestjs/common';

import { Role } from '@/common/enums';

import { Roles } from './roles.decorator';
import { ROLES_KEY } from '../guards/roles.guard';

// ─── suite ───────────────────────────────────────────────────────────────────

describe('Roles decorator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call SetMetadata with ROLES_KEY and provided roles', () => {
    Roles(Role.Admin);

    expect(SetMetadata).toHaveBeenCalledWith(ROLES_KEY, [Role.Admin]);
  });

  it('should call SetMetadata with multiple roles', () => {
    Roles(Role.Admin, Role.User);

    expect(SetMetadata).toHaveBeenCalledWith(ROLES_KEY, [Role.Admin, Role.User]);
  });

  it('should call SetMetadata with empty array when no roles provided', () => {
    Roles();

    expect(SetMetadata).toHaveBeenCalledWith(ROLES_KEY, []);
  });

  it('should use the correct ROLES_KEY constant', () => {
    Roles(Role.Admin);

    expect(SetMetadata).toHaveBeenCalledWith(ROLES_KEY, expect.any(Array));
  });
});
