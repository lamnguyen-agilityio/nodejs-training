import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PinoLogger } from 'nestjs-pino';

import { MESSAGES } from '@/common/constants';

import { TokenResponseDto } from './dtos';
import type { InternalTokenPayload, AuthenticatedUser } from './interfaces';

const ACCESS_TOKEN_EXPIRATION = Number(process.env.JWT_ACCESS_TOKEN_EXPIRY);

@Injectable()
export class TokenService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly jwtService: JwtService,
  ) {
    this.logger.setContext(TokenService.name);
  }

  /**
   * issue a new access for an authenticated user.
   * called after successful provider token verification.
   */
  issueTokens(user: AuthenticatedUser): TokenResponseDto {
    const accessToken = this.signAccessToken(user);

    this.logger.info({ userId: user.userId }, 'Tokens issued');

    return TokenResponseDto.from(accessToken, ACCESS_TOKEN_EXPIRATION);
  }

  /**
   * verify an internal access token.
   * throws UnauthorizedException when invalid or expired.
   */
  verifyAccessToken(token: string): InternalTokenPayload {
    try {
      return this.jwtService.verify<InternalTokenPayload>(token);
    } catch {
      throw new UnauthorizedException(MESSAGES.INVALID_TOKEN);
    }
  }

  /**
   * sign an access token for an authenticated user.
   */
  private signAccessToken(user: AuthenticatedUser): string {
    const payload: InternalTokenPayload = {
      sub: user.userId,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    return this.jwtService.sign(payload);
  }
}
