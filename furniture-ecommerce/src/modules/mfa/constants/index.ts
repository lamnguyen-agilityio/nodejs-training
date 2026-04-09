// the number of minutes before an OTP expires.
export const OTP_TTL_MINUTES = 5;

// the number of attempts a user can make before being locked out.
export const MAX_ATTEMPTS = 3;

// the number of bcrypt rounds to use for hashing OTPs.
export const BCRYPT_ROUNDS = 10;

// the number of hours a user has to complete MFA before the session expires.
export const MFA_SESSION_HOURS = 8;

// 8 hours in milliseconds — MFA session window.
export const MFA_SESSION_MS = MFA_SESSION_HOURS * 60 * 60 * 1000;

// the length of the OTP code.
export const OPT_LENGTH = 6;

// injection token for the array of registered OTP channels.
export const OTP_CHANNELS = 'OTP_CHANNELS';

// key used to skip MFA for a session.
export const SKIP_MFA_KEY = 'skipMfa';
