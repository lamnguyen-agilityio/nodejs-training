import { Global, Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

import { createLoggerModule } from './logger.config';

const PinoModule = createLoggerModule();

@Global()
@Module({
  imports: [PinoModule],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
