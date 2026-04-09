import { defineEntity, p } from '@mikro-orm/core';

import { MfaMethod } from '@/common/enums';
import { UserEntity } from '@/modules/users/entities/user.entity';

export const MfaOtpEntity = defineEntity({
  name: 'MfaOtp',
  tableName: 'mfa_otps',
  properties: {
    // // unique identifier for the MFA OTP.
    id: p.uuid().primary().defaultRaw('uuid_generate_v7()'),

    // the user associated with this MFA OTP.
    user: p.manyToOne(UserEntity).fieldName('user_id'),

    // the hashed code for the MFA OTP.
    codeHash: p.string().columnType('varchar(255)'),

    // the method used for the MFA OTP (SMS or Email).
    method: p.enum(Object.values(MfaMethod)).default(MfaMethod.Sms),

    // the number of attempts made to verify this MFA OTP.
    attempts: p.integer().default(0),

    // the expiration time for this MFA OTP.
    expiresAt: p.datetime(),

    // the timestamp when this MFA OTP was created.
    createdAt: p
      .datetime()
      .defaultRaw('now()')
      .onCreate(() => new Date()),
  },
});

export type MfaOtp = (typeof MfaOtpEntity)['~entity'];
