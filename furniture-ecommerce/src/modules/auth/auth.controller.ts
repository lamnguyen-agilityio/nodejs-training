import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { Role } from '@/enums';

import { AuthProviderFactory } from './auth-provider.factory';
import { CurrentUser, Roles } from './decorators';
import { ProviderStatusDto, SwitchProviderDto } from './dtos';
import { AuthGuard, RolesGuard } from './guards';
import type { AuthenticatedUser } from './interfaces';

@Controller('auth')
@UseGuards(AuthGuard, RolesGuard)
export class AuthController {
  constructor(private readonly authProviderFactory: AuthProviderFactory) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  @Get('provider')
  getProviderStatus(): ProviderStatusDto {
    return plainToInstance(ProviderStatusDto, {
      active: this.authProviderFactory.getActiveProvider(),
      available: this.authProviderFactory.getRegisteredProviders(),
    });
  }

  @Post('provider/switch')
  @Roles(Role.Admin)
  switchProvider(@Body() dto: SwitchProviderDto): ProviderStatusDto {
    this.authProviderFactory.switchProvider(dto.provider);

    return plainToInstance(ProviderStatusDto, {
      active: this.authProviderFactory.getActiveProvider(),
      available: this.authProviderFactory.getRegisteredProviders(),
    });
  }
}
