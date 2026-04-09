import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { MESSAGES } from '@/common/constants';
import { IS_PUBLIC_KEY } from '@/modules/auth/decorators/public.decorator';
import { UsersService } from '@/modules/users/users.service';

import { SKIP_MFA_KEY } from '../constants';
import { MfaService } from '../mfa.service';

@Injectable()
export class MfaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly usersService: UsersService,
    private readonly mfaService: MfaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // public routes — no auth, no MFA
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // MFA send/verify endpoints — reachable before MFA confirmed
    const skipMfa = this.reflector.getAllAndOverride<boolean>(SKIP_MFA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipMfa) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const authUser = request['user'];

    // protected route without auth context must fail closed
    if (!authUser) {
      throw new UnauthorizedException(MESSAGES.INVALID_TOKEN);
    }

    const user = await this.usersService.findOne({ id: authUser.userId });

    if (!this.mfaService.isMfaSessionValid(user)) {
      throw new UnauthorizedException(MESSAGES.MFA_REQUIRED);
    }

    return true;
  }
}
