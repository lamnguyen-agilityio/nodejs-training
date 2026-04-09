import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { MESSAGES } from '@/common/constants';
import { Auth, CurrentUser } from '@/modules/auth/decorators';
import type { AuthenticatedUser } from '@/modules/auth/interfaces';
import { UsersService } from '@/modules/users/users.service';

import { SkipMfa } from './decorators/skip-mfa.decorator';
import { SendOtpDto } from './dtos';
import { MfaResponseDto } from './dtos/mfa-response.dto';
import { MfaService } from './mfa.service';

@ApiTags('auth / mfa')
@ApiBearerAuth()
@SkipMfa()
@Controller('auth/mfa')
export class MfaController {
  constructor(
    private readonly mfaService: MfaService,
    private readonly usersService: UsersService,
  ) {}

  @Post('send')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send MFA OTP',
    description:
      'Generates a 6-digit OTP and sends it via the specified channel. ' +
      'Requires a valid provider (Clerk/Auth0) Bearer token. ' +
      'The same provider JWT is used for all subsequent calls — no new token is issued.',
  })
  @ApiCreatedResponse({ description: 'OTP sent — check your phone' })
  async sendOtp(
    @CurrentUser() authUser: AuthenticatedUser,
    @Body() dto: SendOtpDto,
  ): Promise<MfaResponseDto> {
    const user = await this.usersService.findOne({ id: authUser.userId });
    await this.mfaService.sendOtp(user, dto.method);

    return MfaResponseDto.from(MESSAGES.OTP_SENT);
  }
}
