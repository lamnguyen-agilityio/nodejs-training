import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import { UserIdentityEntity } from './entities/user-identity.entity';
import { UserIdentitiesService } from './user-identities.service';

@Module({
  imports: [MikroOrmModule.forFeature([UserIdentityEntity])],
  providers: [UserIdentitiesService],
  exports: [UserIdentitiesService],
})
export class UserIdentitiesModule {}
