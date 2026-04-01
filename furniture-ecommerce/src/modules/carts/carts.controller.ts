import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBody,
  ApiNoContentResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiBadRequestResponse,
} from '@nestjs/swagger';

import { Auth } from '@/modules/auth/decorators';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/modules/auth/interfaces';
import { UsersService } from '@/modules/users/users.service';

import { CartService } from './carts.service';
import {
  AddCartItemDto,
  CartItemResponseDto,
  CartResponseDto,
  MergeCartDto,
  UpdateCartItemDto,
} from './dtos';

@ApiTags('carts')
@Controller('carts')
@Auth()
export class CartsController {
  constructor(
    private readonly cartService: CartService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get current user cart' })
  @ApiOkResponse({ type: CartResponseDto })
  async getCart(@CurrentUser() authUser: AuthenticatedUser): Promise<CartResponseDto> {
    const user = await this.usersService.findOne({ id: authUser.userId });
    const items = await this.cartService.getCart(user);

    return this.toCartResponse(items);
  }

  @Post('items')
  @ApiOperation({ summary: 'Add item to cart' })
  @ApiBody({ type: AddCartItemDto })
  @ApiBadRequestResponse({ description: 'The quantity is invalid' })
  @ApiCreatedResponse({ type: CartItemResponseDto })
  async addItem(
    @CurrentUser() authUser: AuthenticatedUser,
    @Body() dto: AddCartItemDto,
  ): Promise<CartItemResponseDto> {
    const user = await this.usersService.findOne({ id: authUser.userId });
    const item = await this.cartService.addItem(user, dto);

    return CartItemResponseDto.from(item);
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Update cart item quantity' })
  @ApiBody({ type: UpdateCartItemDto })
  @ApiOkResponse({ type: CartItemResponseDto })
  @ApiBadRequestResponse({ description: 'The quantity is invalid' })
  async updateItem(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartItemResponseDto> {
    const user = await this.usersService.findOne({ id: authUser.userId });
    const item = await this.cartService.updateItem(user, id, dto);

    return CartItemResponseDto.from(item);
  }

  @Delete('items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove item from cart' })
  @ApiNoContentResponse()
  async removeItem(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    const user = await this.usersService.findOne({ id: authUser.userId });
    await this.cartService.removeItem(user, id);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear entire cart' })
  @ApiNoContentResponse()
  async clearCart(@CurrentUser() authUser: AuthenticatedUser): Promise<void> {
    const user = await this.usersService.findOne({ id: authUser.userId });
    await this.cartService.clearCart(user);
  }

  @Post('merge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Merge guest session cart into user cart',
    description:
      'Called after login. FE sends items from session/localStorage. ' +
      'When the same product exists in both carts, the higher quantity is kept.',
  })
  @ApiBody({ type: MergeCartDto })
  @ApiOkResponse({ type: CartResponseDto })
  async mergeCart(
    @CurrentUser() authUser: AuthenticatedUser,
    @Body() dto: MergeCartDto,
  ): Promise<CartResponseDto> {
    await this.cartService.mergeSessionCart(authUser.userId, dto.items);

    const user = await this.usersService.findOne({ id: authUser.userId });
    const items = await this.cartService.getCart(user);

    return this.toCartResponse(items);
  }

  // ─── private ──────────────────────────────────────────────────────────────

  private toCartResponse(items: Awaited<ReturnType<CartService['getCart']>>): CartResponseDto {
    const dtoItems = CartItemResponseDto.fromMany(items);
    const totalAmount = items.reduce(
      (sum, item) => sum + Number(item.product.price) * item.quantity,
      0,
    );

    return CartResponseDto.from(dtoItems, items.length, totalAmount);
  }
}
