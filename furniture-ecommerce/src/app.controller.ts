import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AppService } from './app.service';
import { HealthStatusDto } from './common/dtos';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  @ApiOkResponse({
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2026-04-02T00:00:00.000Z' },
        uptime: { type: 'number', example: 42.5 },
      },
    },
  })
  getHealth(): HealthStatusDto {
    return this.appService.getHealth();
  }
}
