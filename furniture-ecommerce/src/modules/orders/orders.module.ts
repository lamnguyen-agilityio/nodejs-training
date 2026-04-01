import { Module } from '@nestjs/common';

import { AuthModule } from '@/modules/auth/auth.module';
import { CartsModule } from '@/modules/carts/carts.module';
import { UsersModule } from '@/modules/users/users.module';

import { OrdersController } from './orders.controller';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';

@Module({
  imports: [AuthModule, CartsModule, UsersModule],
  controllers: [OrdersController],
  providers: [OrdersRepository, OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
