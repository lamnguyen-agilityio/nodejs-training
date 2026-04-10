import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiBody,
} from '@nestjs/swagger';

import { Role } from '@/common/enums';
import { SkipMfa } from '@/modules/mfa/decorators/skip-mfa.decorator';

import { AuthProviderFactory } from './auth-provider.factory';
import { CurrentUser, Auth, AuthRoles, Public } from './decorators';
import { ProviderStatusDto, SwitchProviderDto, AuthenticatedUserDto } from './dtos';
import type { AuthenticatedUser } from './interfaces';

@SkipMfa()
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authProviderFactory: AuthProviderFactory) {}

  @Get('me')
  @Auth()
  @ApiOperation({
    summary: 'Get current authenticated user',
    description: 'Returns the user decoded from the access token.',
  })
  @ApiOkResponse({
    description: 'Authenticated user profile',
    type: AuthenticatedUserDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getMe(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  @Public()
  @Get('provider')
  @ApiOperation({
    summary: 'Get active auth provider',
    description: 'Returns the currently active provider and all registered providers.',
  })
  @ApiOkResponse({
    description: 'Provider status',
    type: ProviderStatusDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getProviderStatus(): ProviderStatusDto {
    return ProviderStatusDto.from({
      active: this.authProviderFactory.getActiveProvider(),
      available: this.authProviderFactory.getRegisteredProviders(),
    });
  }

  @Post('provider')
  @HttpCode(HttpStatus.OK)
  @AuthRoles(Role.Admin)
  @ApiOperation({
    summary: 'Switch active auth provider',
    description:
      'Switches the active provider in-memory immediately. ' +
      'All subsequent requests will be verified by the new provider adapter. ' +
      'Restricted to Admin role.',
  })
  @ApiBody({ type: SwitchProviderDto })
  @ApiOkResponse({
    description: 'Provider switched successfully',
    type: ProviderStatusDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Insufficient role — Admin required' })
  switchProvider(@Body() dto: SwitchProviderDto): ProviderStatusDto {
    this.authProviderFactory.switchProvider(dto.provider);

    return ProviderStatusDto.from({
      active: this.authProviderFactory.getActiveProvider(),
      available: this.authProviderFactory.getRegisteredProviders(),
    });
  }
}
