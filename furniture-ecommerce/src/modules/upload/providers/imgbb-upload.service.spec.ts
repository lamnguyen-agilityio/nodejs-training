import { faker } from '@faker-js/faker';
import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

import { ImgbbUploadService } from './imgbb-upload.service';

// ─── mock global fetch ────────────────────────────────────────────────────────

const mockFetch = jest.fn();
global.fetch = mockFetch;

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeApiKey = () => faker.string.alphanumeric(32);

const makeSuccessResponse = (url?: string) => ({
  success: true,
  data: {
    url: url ?? faker.internet.url(),
    display_url: faker.internet.url(),
    delete_url: faker.internet.url(),
  },
});

const makeFailureResponse = () => ({
  success: false,
  data: null,
  error: { message: 'Upload quota exceeded' },
});

const makeFetchResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: jest.fn().mockResolvedValue(body),
});

// ─── mocks ───────────────────────────────────────────────────────────────────

const apiKey = makeApiKey();

const mockConfigService = {
  getOrThrow: jest.fn().mockReturnValue({ imgbbApiKey: apiKey }),
} satisfies Partial<jest.Mocked<ConfigService>>;

const mockLogger = {
  setContext: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} satisfies Partial<jest.Mocked<PinoLogger>>;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('ImgbbUploadService', () => {
  let service: ImgbbUploadService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ImgbbUploadService(
      mockConfigService as unknown as ConfigService,
      mockLogger as unknown as PinoLogger,
    );
  });

  // ── upload — happy path ────────────────────────────────────────────────────

  describe('upload', () => {
    it('should return the image URL on successful upload', async () => {
      const imageUrl = faker.internet.url();
      const buffer = Buffer.from(faker.string.alphanumeric(100));
      const filename = faker.system.fileName({ extensionCount: 1 });

      mockFetch.mockResolvedValue(makeFetchResponse(makeSuccessResponse(imageUrl)));

      const result = await service.upload(buffer, filename);

      expect(result).toBe(imageUrl);
    });

    it('should call fetch with POST method', async () => {
      const buffer = Buffer.from('test');
      mockFetch.mockResolvedValue(makeFetchResponse(makeSuccessResponse()));

      await service.upload(buffer, 'test.jpg');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.imgbb.com/1/upload',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should send Content-Type application/x-www-form-urlencoded', async () => {
      const buffer = Buffer.from('test');
      mockFetch.mockResolvedValue(makeFetchResponse(makeSuccessResponse()));

      await service.upload(buffer, 'test.jpg');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        }),
      );
    });

    it('should include api key and base64 image in body', async () => {
      const buffer = Buffer.from('image-data');
      const filename = 'photo.jpg';
      const expectedBase64 = buffer.toString('base64');
      mockFetch.mockResolvedValue(makeFetchResponse(makeSuccessResponse()));

      await service.upload(buffer, filename);

      const callBody = mockFetch.mock.calls[0][1].body as string;
      const params = new URLSearchParams(callBody);

      expect(params.get('key')).toBe(apiKey);
      expect(params.get('image')).toBe(expectedBase64);
      expect(params.get('name')).toBe(filename);
    });

    it('should log info when upload starts', async () => {
      const filename = faker.system.fileName({ extensionCount: 1 });
      mockFetch.mockResolvedValue(makeFetchResponse(makeSuccessResponse()));

      await service.upload(Buffer.from('test'), filename);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ filename }),
        'Uploading image via ImgBB',
      );
    });

    it('should log info when upload succeeds', async () => {
      const imageUrl = faker.internet.url();
      const filename = faker.system.fileName({ extensionCount: 1 });
      mockFetch.mockResolvedValue(makeFetchResponse(makeSuccessResponse(imageUrl)));

      await service.upload(Buffer.from('test'), filename);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ url: imageUrl, filename }),
        'Image uploaded successfully',
      );
    });
  });

  // ── upload — http errors ───────────────────────────────────────────────────

  describe('upload — HTTP errors', () => {
    it('should throw InternalServerErrorException when response is not ok', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse({}, false, 500));

      await expect(service.upload(Buffer.from('test'), 'test.jpg')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should log error when response is not ok', async () => {
      const filename = 'fail.jpg';
      mockFetch.mockResolvedValue(makeFetchResponse({}, false, 503));

      await expect(service.upload(Buffer.from('test'), filename)).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ status: 503, filename }),
        'ImgBB upload failed',
      );
    });

    it('should throw InternalServerErrorException when success is false', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(makeFailureResponse()));

      await expect(service.upload(Buffer.from('test'), 'test.jpg')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when data.url is missing', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse({ success: true, data: { url: null } }));

      await expect(service.upload(Buffer.from('test'), 'test.jpg')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should log error when ImgBB returns unsuccessful response', async () => {
      const filename = 'bad.jpg';
      mockFetch.mockResolvedValue(makeFetchResponse(makeFailureResponse()));

      await expect(service.upload(Buffer.from('test'), filename)).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ filename }),
        'ImgBB returned unsuccessful response',
      );
    });

    it('should propagate error when fetch throws', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(service.upload(Buffer.from('test'), 'test.jpg')).rejects.toThrow(
        'Network error',
      );
    });
  });
});
