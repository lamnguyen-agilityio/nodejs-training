import { ApiProperty } from '@nestjs/swagger';
import { Expose, plainToInstance } from 'class-transformer';

export class MfaResponseDto {
  @ApiProperty({
    example: 'OTP sent — check your phone',
    description: 'The message returned after the OTP is sent',
  })
  @Expose()
  message: string;

  static from(message: string): MfaResponseDto {
    return plainToInstance(MfaResponseDto, { message });
  }
}
