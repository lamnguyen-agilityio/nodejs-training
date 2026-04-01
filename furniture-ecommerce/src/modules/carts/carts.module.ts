import { Module } from '@nestjs/common';

import { AuthModule } from '@/modules/auth/auth.module';
import { ProductsModule } from '@/modules/products/products.module';
import { UsersModule } from '@/modules/users/users.module';

import { CartsController } from './carts.controller';
import { CartsRepository } from './carts.repository';
import { CartService } from './carts.service';

@Module({
  imports: [AuthModule, ProductsModule, UsersModule],
  controllers: [CartsController],
  providers: [CartsRepository, CartService],
  exports: [CartService, CartsRepository],
})
export class CartsModule {}
