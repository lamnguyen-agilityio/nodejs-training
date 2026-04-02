import { Injectable } from '@nestjs/common';

import { HealthStatusDto } from '@/common/dtos';

@Injectable()
export class AppService {
  getHealth(): HealthStatusDto {
    return HealthStatusDto.from();
  }
}
