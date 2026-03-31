import { Module } from '@nestjs/common';

import { ImageUploadService } from './image-upload.service';
import { ImgbbUploadService } from './providers/imgbb-upload.service';

/**
 * UploadModule provides `ImageUploadService` to any module that imports it.
 *
 * to switch providers, change only the `useClass` binding here:
 *
 * ```ts
 * { provide: ImageUploadService, useClass: CloudinaryUploadService }
 * { provide: ImageUploadService, useClass: S3UploadService }
 * ```
 *
 * all consumers (`ProductsModule`, etc.) remain untouched.
 */
@Module({
  providers: [
    {
      provide: ImageUploadService,
      useClass: ImgbbUploadService,
    },
  ],
  exports: [ImageUploadService],
})
export class UploadModule {}
