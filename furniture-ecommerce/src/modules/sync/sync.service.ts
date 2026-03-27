import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class SyncService {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(SyncService.name);
  }
}
