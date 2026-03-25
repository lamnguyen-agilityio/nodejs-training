import { ERROR_CODES } from '@/constants';

/**
 * shared error response types used across filters, exceptions, and interceptors.
 * centralizing these types ensures a consistent error contract throughout the application.
 */

// represents a single structured error detail returned to the client.
export interface ErrorDetail {
  errCode: (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
  message: string;
  field?: string;
  description?: string;
}

// represents the top-level error response envelope sent to the client.
export interface ErrorResponse {
  statusCode: number;
  message: string;
  errors: ErrorDetail[];
}
