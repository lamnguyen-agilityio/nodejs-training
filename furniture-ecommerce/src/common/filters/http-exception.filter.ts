import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

import { ERROR_CODES, MESSAGES, HTTP_STATUS_ERROR_CODE_MAP } from '@/constants';

import type { ErrorDetail, ErrorResponse } from '../interfaces';

// shape of the response body produced by NestJS ValidationPipe on failure.
interface ValidationErrorResponse {
  message: string[];
  error: string;
}

// shape of a structured exception response carrying an errors array.
interface StructuredErrorResponse {
  message: string;
  errors: ErrorDetail[];
}

/**
 * GlobalHttpExceptionFilter catches every exception thrown within the application
 * and normalises it into the standard ErrorResponse envelope before sending it
 * to the client. This guarantees a consistent error contract regardless of where
 * or how an exception originates.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    const body = this.normalize(exception);

    res.status(body.statusCode).json(body);
  }

  // ---------------------------------------------------------------------------
  // normalisation
  // ---------------------------------------------------------------------------

  // converts any exception into a well-formed ErrorResponse.
  private normalize(exception: unknown): ErrorResponse {
    if (exception instanceof HttpException) {
      return this.normalizeHttpException(exception);
    }

    // Unhandled / non-HTTP errors — never leak internal detail to the client.
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: MESSAGES.INTERNAL_SERVER_ERROR,
      errors: [
        {
          errCode: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: MESSAGES.UNEXPECTED_ERROR,
        },
      ],
    };
  }

  // normalises an HttpException into an ErrorResponse.
  private normalizeHttpException(exception: HttpException): ErrorResponse {
    const statusCode = exception.getStatus();
    const response = exception.getResponse();

    if (this.isValidStructured(response)) {
      return { statusCode, message: response.message, errors: response.errors };
    }

    if (this.isValidationError(response)) {
      return {
        statusCode,
        message: MESSAGES.VALIDATION_FAILED,
        errors: this.normalizeValidationMessages(response.message),
      };
    }

    // NestJS built-in exceptions (NotFoundException, UnauthorizedException, etc.)
    const message = typeof response === 'string' ? response : this.extractMessage(response);

    return {
      statusCode,
      message,
      errors: [{ errCode: this.toErrCode(statusCode), message }],
    };
  }

  // ---------------------------------------------------------------------------
  // validation error mapping
  // ---------------------------------------------------------------------------

  /**
   * converts the flat string array emitted by ValidationPipe into ErrorDetail
   * entries. ValidationPipe formats each entry as "property constraint message".
   */
  private normalizeValidationMessages(messages: string[]): ErrorDetail[] {
    return messages.map((msg) => {
      const spaceIndex = msg.indexOf(' ');
      const field = spaceIndex !== -1 ? msg.slice(0, spaceIndex) : undefined;
      const detail = spaceIndex !== -1 ? msg.slice(spaceIndex + 1) : msg;

      return {
        errCode: ERROR_CODES.VALIDATION_ERROR,
        ...(field !== undefined && { field }),
        message: detail,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // type guards
  // ---------------------------------------------------------------------------

  private isValidStructured(value: unknown): value is StructuredErrorResponse {
    return (
      typeof value === 'object' &&
      value !== null &&
      'message' in value &&
      'errors' in value &&
      Array.isArray((value as StructuredErrorResponse).errors)
    );
  }

  private isValidationError(value: unknown): value is ValidationErrorResponse {
    return (
      typeof value === 'object' &&
      value !== null &&
      'message' in value &&
      Array.isArray((value as ValidationErrorResponse).message)
    );
  }

  // ---------------------------------------------------------------------------
  // helpers
  // ---------------------------------------------------------------------------

  // extracts the message string from an unknown HttpException response object.
  private extractMessage(response: unknown): string {
    if (
      typeof response === 'object' &&
      response !== null &&
      'message' in response &&
      typeof (response as Record<string, unknown>)['message'] === 'string'
    ) {
      return (response as Record<string, unknown>)['message'] as string;
    }
    return MESSAGES.UNKNOWN_ERROR;
  }

  // resolves the machine-readable error code for a given HTTP status code.
  private toErrCode(statusCode: number): (typeof ERROR_CODES)[keyof typeof ERROR_CODES] {
    return HTTP_STATUS_ERROR_CODE_MAP[statusCode] ?? ERROR_CODES.UNKNOWN_ERROR;
  }
}
