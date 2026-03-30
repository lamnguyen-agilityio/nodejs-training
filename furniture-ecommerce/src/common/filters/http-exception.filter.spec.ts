import { faker } from '@faker-js/faker';
import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { ERROR_CODES, MESSAGES } from '@/common/constants';

import { HttpExceptionFilter } from './http-exception.filter';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const makeHost = (res: ReturnType<typeof makeResponse>): ArgumentsHost =>
  ({
    switchToHttp: () => ({
      getResponse: () => res,
    }),
  }) as unknown as ArgumentsHost;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let res: ReturnType<typeof makeResponse>;
  let host: ArgumentsHost;

  beforeEach(() => {
    jest.clearAllMocks();
    filter = new HttpExceptionFilter();
    res = makeResponse();
    host = makeHost(res);
  });

  // ── non-HTTP exceptions ────────────────────────────────────────────────────

  describe('non-HTTP exceptions', () => {
    it('should return 500 for generic Error', () => {
      filter.catch(new Error('something broke'), host);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: MESSAGES.INTERNAL_SERVER_ERROR,
          errors: expect.arrayContaining([
            expect.objectContaining({ errCode: ERROR_CODES.INTERNAL_SERVER_ERROR }),
          ]),
        }),
      );
    });

    it('should return 500 for null exception', () => {
      filter.catch(null, host);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should return 500 for string exception', () => {
      filter.catch('some string error', host);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should never expose internal error details to the client', () => {
      const internalMessage = 'DB connection string: postgres://secret@localhost';
      filter.catch(new Error(internalMessage), host);

      const body = res.json.mock.calls[0][0];
      expect(JSON.stringify(body)).not.toContain(internalMessage);
    });
  });

  // ── structured error response ──────────────────────────────────────────────

  describe('structured HttpException (with errors array)', () => {
    it('should return structured response as-is when errors array is present', () => {
      const errors = [{ errCode: 'SOME_CODE', message: faker.lorem.sentence() }];
      const message = faker.lorem.sentence();
      const exception = new HttpException({ message, errors }, HttpStatus.UNPROCESSABLE_ENTITY);

      filter.catch(exception, host);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: HttpStatus.UNPROCESSABLE_ENTITY, message, errors }),
      );
    });

    it('should preserve all errors in the array', () => {
      const errors = [
        { errCode: 'CODE_1', message: 'error one' },
        { errCode: 'CODE_2', message: 'error two', field: 'email' },
      ];
      const exception = new HttpException(
        { message: 'multiple errors', errors },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, host);

      const body = res.json.mock.calls[0][0];
      expect(body.errors).toHaveLength(2);
    });
  });

  // ── validation error (ValidationPipe) ─────────────────────────────────────

  describe('validation error (message is string[])', () => {
    it('should normalise ValidationPipe array into ErrorDetail entries', () => {
      const exception = new BadRequestException({
        message: ['email must be an email', 'name should not be empty'],
        error: 'Bad Request',
      });

      filter.catch(exception, host);

      const body = res.json.mock.calls[0][0];
      expect(body.message).toBe(MESSAGES.VALIDATION_FAILED);
      expect(body.errors).toHaveLength(2);
      expect(body.errors[0]).toMatchObject({
        errCode: ERROR_CODES.VALIDATION_ERROR,
        field: 'email',
        message: 'must be an email',
      });
      expect(body.errors[1]).toMatchObject({
        errCode: ERROR_CODES.VALIDATION_ERROR,
        field: 'name',
        message: 'should not be empty',
      });
    });

    it('should handle validation message with no space (no field extracted)', () => {
      const exception = new BadRequestException({
        message: ['invalidformat'],
        error: 'Bad Request',
      });

      filter.catch(exception, host);

      const body = res.json.mock.calls[0][0];
      expect(body.errors[0]).toMatchObject({
        errCode: ERROR_CODES.VALIDATION_ERROR,
        message: 'invalidformat',
      });
      expect(body.errors[0].field).toBeUndefined();
    });

    it('should set statusCode to 400 for validation errors', () => {
      const exception = new BadRequestException({
        message: ['field is required'],
        error: 'Bad Request',
      });

      filter.catch(exception, host);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    });
  });

  // ── NestJS built-in exceptions ─────────────────────────────────────────────

  describe('NestJS built-in HttpExceptions', () => {
    it('should handle UnauthorizedException with string message', () => {
      filter.catch(new UnauthorizedException(MESSAGES.INVALID_TOKEN), host);

      const body = res.json.mock.calls[0][0];
      expect(body.statusCode).toBe(HttpStatus.UNAUTHORIZED);
      expect(body.message).toBe(MESSAGES.INVALID_TOKEN);
      expect(body.errors[0].errCode).toBeDefined();
    });

    it('should handle NotFoundException', () => {
      const message = `User ${faker.string.uuid()} not found`;
      filter.catch(new NotFoundException(message), host);

      const body = res.json.mock.calls[0][0];
      expect(body.statusCode).toBe(HttpStatus.NOT_FOUND);
      expect(body.message).toBe(message);
    });

    it('should handle ForbiddenException', () => {
      filter.catch(new ForbiddenException(MESSAGES.FORBIDDEN), host);

      const body = res.json.mock.calls[0][0];
      expect(body.statusCode).toBe(HttpStatus.FORBIDDEN);
      expect(body.message).toBe(MESSAGES.FORBIDDEN);
    });

    it('should handle HttpException with object response containing message string', () => {
      const message = faker.lorem.sentence();
      const exception = new HttpException({ message, error: 'Custom Error' }, HttpStatus.CONFLICT);

      filter.catch(exception, host);

      const body = res.json.mock.calls[0][0];
      expect(body.statusCode).toBe(HttpStatus.CONFLICT);
      expect(body.message).toBe(message);
    });

    it('should fallback to UNKNOWN_ERROR message when response object has no message', () => {
      const exception = new HttpException({ noMessage: true }, HttpStatus.BAD_GATEWAY);

      filter.catch(exception, host);

      const body = res.json.mock.calls[0][0];
      expect(body.message).toBe(MESSAGES.UNKNOWN_ERROR);
    });

    it('should handle HttpException with plain string response', () => {
      const message = faker.lorem.sentence();
      const exception = new HttpException(message, HttpStatus.GONE);

      filter.catch(exception, host);

      const body = res.json.mock.calls[0][0];
      expect(body.message).toBe(message);
    });

    it('should use UNKNOWN_ERROR errCode for unmapped status codes', () => {
      const exception = new HttpException('Custom', HttpStatus.I_AM_A_TEAPOT);

      filter.catch(exception, host);

      const body = res.json.mock.calls[0][0];
      expect(body.errors[0].errCode).toBe(ERROR_CODES.UNKNOWN_ERROR);
    });
  });
});
