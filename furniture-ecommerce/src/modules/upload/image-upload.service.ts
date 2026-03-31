/**
 * abstract strategy for image upload providers.
 *
 * to add a new provider (Cloudinary, S3, etc.):
 *  1. create a class that extends ImageUploadService.
 *  2. implement `upload()`.
 *  3. swap the provider binding in UploadModule.
 */
export abstract class ImageUploadService {
  /**
   * upload a file buffer and return the public URL.
   */
  abstract upload(buffer: Buffer, filename: string): Promise<string>;
}
