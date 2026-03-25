import { Global, Module } from '@nestjs/common';

import { createLoggerModule } from './logger.config';

const PinoModule = createLoggerModule();

@Global()
@Module({
  imports: [PinoModule],
  exports: [PinoModule],
})
export class LoggerModule {}
