import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

import type { AppConfig } from '@/config';

import { ImageUploadService } from '../image-upload.service';

interface ImgbbResponse {
  success: boolean;
  data: {
    url: string;
    display_url: string;
    delete_url: string;
  };
  error?: { message: string };
}

@Injectable()
export class ImgbbUploadService extends ImageUploadService {
  private readonly apiKey: string;
  private readonly uploadUrl = 'https://api.imgbb.com/1/upload';

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(ImgbbUploadService.name);
    this.apiKey = this.configService.getOrThrow<AppConfig>('app').imgbbApiKey;
  }

  async upload(buffer: Buffer, filename: string): Promise<string> {
    // ImgBB supports base64 image upload — avoids Blob/ArrayBuffer type issues
    const base64 = buffer.toString('base64');

    const params = new URLSearchParams();
    params.append('key', this.apiKey);
    params.append('image', base64);
    params.append('name', filename);

    this.logger.info({ filename }, 'Uploading image via ImgBB');

    const response = await fetch(this.uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      this.logger.error({ status: response.status, filename }, 'ImgBB upload failed');
      throw new InternalServerErrorException('Image upload failed');
    }

    const result = (await response.json()) as ImgbbResponse;

    if (!result.success || !result.data?.url) {
      this.logger.error({ result, filename }, 'ImgBB returned unsuccessful response');
      throw new InternalServerErrorException('Image upload failed');
    }

    this.logger.info({ url: result.data.url, filename }, 'Image uploaded successfully');

    return result.data.url;
  }
}
