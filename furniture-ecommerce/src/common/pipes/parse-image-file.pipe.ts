import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

import { FILE_UPLOAD, MESSAGES } from '@/common/constants';

/**
 * pipe that validates an uploaded image file.
 * checks:
 *  - file is present (when required=true)
 *  - mime type is in the allowed list
 *  - file size does not exceed the limit
 */
@Injectable()
export class ParseImageFilePipe implements PipeTransform<Express.Multer.File | undefined> {
  constructor(private readonly required: boolean = true) {}

  transform(file: Express.Multer.File | undefined): Express.Multer.File | undefined {
    if (!file) {
      if (this.required) {
        throw new BadRequestException(MESSAGES.IMAGE_REQUIRED);
      }
      return undefined;
    }

    const allowedTypes = FILE_UPLOAD.ALLOWED_IMAGE_TYPES as readonly string[];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid image type. Allowed: ${FILE_UPLOAD.ALLOWED_IMAGE_TYPES_LABEL}`,
      );
    }

    if (file.size > FILE_UPLOAD.MAX_IMAGE_SIZE_BYTES) {
      throw new BadRequestException(
        `Image size must not exceed ${FILE_UPLOAD.MAX_IMAGE_SIZE_LABEL}`,
      );
    }

    return file;
  }
}
