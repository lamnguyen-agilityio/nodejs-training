import { faker } from '@faker-js/faker';
import { BadRequestException } from '@nestjs/common';

import { FILE_UPLOAD, MESSAGES } from '@/common/constants';

import { ParseImageFilePipe } from './parse-image-file.pipe';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File =>
  ({
    fieldname: 'image',
    originalname: faker.system.fileName({ extensionCount: 1 }),
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024 * 100, // 100KB — well within 5MB limit
    buffer: Buffer.from(''),
    destination: '',
    filename: '',
    path: '',
    stream: undefined,
    ...overrides,
  }) as Express.Multer.File;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('ParseImageFilePipe', () => {
  // ── required = true (default) ──────────────────────────────────────────────

  describe('when required=true (default)', () => {
    let pipe: ParseImageFilePipe;

    beforeEach(() => {
      pipe = new ParseImageFilePipe(true);
    });

    it('should return the file when valid jpeg is provided', () => {
      const file = makeFile({ mimetype: 'image/jpeg' });
      expect(pipe.transform(file)).toBe(file);
    });

    it('should return the file when valid png is provided', () => {
      const file = makeFile({ mimetype: 'image/png' });
      expect(pipe.transform(file)).toBe(file);
    });

    it('should return the file when valid webp is provided', () => {
      const file = makeFile({ mimetype: 'image/webp' });
      expect(pipe.transform(file)).toBe(file);
    });

    it('should throw BadRequestException when file is undefined', () => {
      expect(() => pipe.transform(undefined)).toThrow(BadRequestException);
      expect(() => pipe.transform(undefined)).toThrow(MESSAGES.IMAGE_REQUIRED);
    });

    it('should throw BadRequestException for unsupported mime type', () => {
      const file = makeFile({ mimetype: 'image/gif' });
      expect(() => pipe.transform(file)).toThrow(BadRequestException);
      expect(() => pipe.transform(file)).toThrow(
        `Invalid image type. Allowed: ${FILE_UPLOAD.ALLOWED_IMAGE_TYPES_LABEL}`,
      );
    });

    it('should throw BadRequestException for pdf mime type', () => {
      const file = makeFile({ mimetype: 'application/pdf' });
      expect(() => pipe.transform(file)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException when file exceeds max size', () => {
      const file = makeFile({ size: FILE_UPLOAD.MAX_IMAGE_SIZE_BYTES + 1 });
      expect(() => pipe.transform(file)).toThrow(BadRequestException);
      expect(() => pipe.transform(file)).toThrow(
        `Image size must not exceed ${FILE_UPLOAD.MAX_IMAGE_SIZE_LABEL}`,
      );
    });

    it('should return file when size equals max size exactly', () => {
      const file = makeFile({ size: FILE_UPLOAD.MAX_IMAGE_SIZE_BYTES });
      expect(pipe.transform(file)).toBe(file);
    });
  });

  // ── required = false ───────────────────────────────────────────────────────

  describe('when required=false', () => {
    let pipe: ParseImageFilePipe;

    beforeEach(() => {
      pipe = new ParseImageFilePipe(false);
    });

    it('should return undefined when file is not provided', () => {
      expect(pipe.transform(undefined)).toBeUndefined();
    });

    it('should return the file when valid file is provided', () => {
      const file = makeFile({ mimetype: 'image/png' });
      expect(pipe.transform(file)).toBe(file);
    });

    it('should still throw for invalid mime type even when not required', () => {
      const file = makeFile({ mimetype: 'image/bmp' });
      expect(() => pipe.transform(file)).toThrow(BadRequestException);
    });

    it('should still throw for oversized file even when not required', () => {
      const file = makeFile({ size: FILE_UPLOAD.MAX_IMAGE_SIZE_BYTES + 1 });
      expect(() => pipe.transform(file)).toThrow(BadRequestException);
    });
  });
});
