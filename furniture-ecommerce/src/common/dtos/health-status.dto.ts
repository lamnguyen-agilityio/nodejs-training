import { Expose, plainToInstance } from 'class-transformer';

export class HealthStatusDto {
  @Expose()
  status: 'ok';

  @Expose()
  timestamp: string;

  static from(): HealthStatusDto {
    return plainToInstance(HealthStatusDto, {
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  }
}
