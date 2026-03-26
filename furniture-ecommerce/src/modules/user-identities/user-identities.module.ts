import { Module } from '@nestjs/common';

import { UserIdentitiesRepository } from './user-identities.repository';
import { UserIdentitiesService } from './user-identities.service';

@Module({
  providers: [UserIdentitiesRepository, UserIdentitiesService],
  exports: [UserIdentitiesService],
})
export class UserIdentitiesModule {}
