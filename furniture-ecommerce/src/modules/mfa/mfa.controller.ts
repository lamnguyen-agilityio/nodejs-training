import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { MESSAGES } from '@/common/constants';
import { Auth, CurrentUser } from '@/modules/auth/decorators';
import type { AuthenticatedUser } from '@/modules/auth/interfaces';
import { UsersService } from '@/modules/users/users.service';

import { MFA_SESSION_HOURS } from './constants';
import { SkipMfa } from './decorators/skip-mfa.decorator';
import { SendOtpDto, VerifyOtpDto } from './dtos';
import { MfaResponseDto } from './dtos/mfa-response.dto';
import { MfaService } from './mfa.service';

const { OTP_SENT, MFA_VERIFIED } = MESSAGES;

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
  @ApiOkResponse({ description: 'OTP sent — check your phone' })
  async sendOtp(
    @CurrentUser() authUser: AuthenticatedUser,
    @Body() dto: SendOtpDto,
  ): Promise<MfaResponseDto> {
    const user = await this.usersService.findOne({ id: authUser.userId });
    await this.mfaService.sendOtp(user, dto.method);

    return MfaResponseDto.from(OTP_SENT);
  }

  @Post('verify')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify MFA OTP',
    description:
      'Validates the 6-digit OTP. On success, records mfa_verified_at in DB. ' +
      'The original provider JWT remains valid — no new token issued. ' +
      `MFA session lasts ${MFA_SESSION_HOURS} hours before re-verification is required.`,
  })
  @ApiOkResponse({ description: 'MFA verified — session valid for 8 hours' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired OTP' })
  async verifyOtp(
    @CurrentUser() authUser: AuthenticatedUser,
    @Body() dto: VerifyOtpDto,
  ): Promise<MfaResponseDto> {
    const user = await this.usersService.findOne({ id: authUser.userId });
    await this.mfaService.verifyOtp(user, dto.code);

    return MfaResponseDto.from(MFA_VERIFIED(MFA_SESSION_HOURS));
  }
}
