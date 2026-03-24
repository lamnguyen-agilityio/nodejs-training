/**
 * machine-readable error codes returned in the errors[].errCode field.
 * used by clients for programmatic error handling and by the exception filter
 * to produce consistent error responses.
 */
export const ERROR_CODES = {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

const {
  BAD_REQUEST,
  UNAUTHORIZED,
  FORBIDDEN,
  NOT_FOUND,
  CONFLICT,
  UNPROCESSABLE_ENTITY,
  TOO_MANY_REQUESTS,
  INTERNAL_SERVER_ERROR,
} = ERROR_CODES;

/**
 * maps HTTP status codes to their corresponding ErrorCode.
 * used by the global exception filter to resolve errCode from status code
 * when no structured error payload is present.
 */
export const HTTP_STATUS_ERROR_CODE_MAP: Readonly<
  Record<number, (typeof ERROR_CODES)[keyof typeof ERROR_CODES]>
> = {
  400: BAD_REQUEST,
  401: UNAUTHORIZED,
  403: FORBIDDEN,
  404: NOT_FOUND,
  409: CONFLICT,
  422: UNPROCESSABLE_ENTITY,
  429: TOO_MANY_REQUESTS,
  500: INTERNAL_SERVER_ERROR,
} as const;
