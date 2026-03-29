import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { Role } from '@/common/enums';

import { AuthProviderFactory } from './auth-provider.factory';
import { AuthService } from './auth.service';
import { CurrentUser, Roles } from './decorators';
import { ExchangeTokenDto, ProviderStatusDto, SwitchProviderDto, TokenResponseDto } from './dtos';
import { AuthGuard, RolesGuard } from './guards';
import type { AuthenticatedUser } from './interfaces';
import { TokenService } from './token.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authProviderFactory: AuthProviderFactory,
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
  ) {}

  @Post('token')
  async exchangeToken(@Body() dto: ExchangeTokenDto): Promise<TokenResponseDto> {
    const adapter = this.authProviderFactory.getActiveAdapter();
    const profile = await adapter.verifyToken(dto.providerToken);
    const user = await this.authService.resolveUserFromProfile(profile);

    return this.tokenService.issueTokens(user);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  getMe(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  @Get('provider')
  @UseGuards(AuthGuard)
  getProviderStatus(): ProviderStatusDto {
    return ProviderStatusDto.from({
      active: this.authProviderFactory.getActiveProvider(),
      available: this.authProviderFactory.getRegisteredProviders(),
    });
  }

  @Post('provider/switch')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.Admin)
  switchProvider(@Body() dto: SwitchProviderDto): ProviderStatusDto {
    this.authProviderFactory.switchProvider(dto.provider);

    return ProviderStatusDto.from({
      active: this.authProviderFactory.getActiveProvider(),
      available: this.authProviderFactory.getRegisteredProviders(),
    });
  }
}
