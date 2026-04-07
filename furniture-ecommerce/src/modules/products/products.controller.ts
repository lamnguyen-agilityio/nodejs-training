import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  NotFoundException,
  Patch,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { Role } from '@/common/enums';
import { ParseImageFilePipe } from '@/common/pipes/parse-image-file.pipe';
import { AuthRoles } from '@/modules/auth/decorators';
import type { Category } from '@/modules/categories/entities/category.entity';
import { ImageUploadService } from '@/modules/upload/image-upload.service';

import {
  CreateProductDto,
  CreateProductFormDto,
  FindProductsQueryDto,
  PaginatedProductsDto,
  UpdateProductDto,
  UpdateProductFormDto,
  ProductResponseDetailDto,
} from './dtos';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly imageUploadService: ImageUploadService,
  ) {}

  // ─── Public ───────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List products with filters and pagination' })
  @ApiOkResponse({ type: PaginatedProductsDto })
  async findAll(@Query() query: FindProductsQueryDto): Promise<PaginatedProductsDto> {
    const { items, total, page, limit } = await this.productsService.findAll(query);

    return PaginatedProductsDto.from(items, total, page, limit);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get product by slug' })
  @ApiOkResponse({ type: ProductResponseDetailDto })
  @ApiNotFoundResponse({ description: 'Product not found' })
  async findOne(@Param('slug') slug: string): Promise<ProductResponseDetailDto> {
    const product = await this.productsService.findOne({ slug });

    return ProductResponseDetailDto.from(product);
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  @Post()
  @AuthRoles(Role.Admin)
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create product with image upload (Admin)' })
  @ApiBody({ type: CreateProductFormDto })
  @ApiCreatedResponse({ type: ProductResponseDetailDto })
  @ApiForbiddenResponse({ description: 'You are not authorized to create a product' })
  @ApiConflictResponse({ description: 'Product with this name already exists' })
  async create(
    @Body() dto: CreateProductDto,
    @UploadedFile(new ParseImageFilePipe(true)) file: Express.Multer.File,
  ): Promise<ProductResponseDetailDto> {
    const category = await this.productsService.findCategoryById(dto.categoryId);
    if (!category) throw new NotFoundException(`Category ${dto.categoryId} not found`);

    const image = await this.imageUploadService.upload(file.buffer, file.originalname);
    const product = await this.productsService.create(
      {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        quantityInStock: dto.quantityInStock,
        image,
      },
      category,
    );

    return ProductResponseDetailDto.from(product);
  }

  @Patch(':id')
  @AuthRoles(Role.Admin)
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update product with optional image upload (Admin)' })
  @ApiBody({ type: UpdateProductFormDto })
  @ApiOkResponse({ type: ProductResponseDetailDto })
  @ApiForbiddenResponse({ description: 'You are not authorized to update a product' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @UploadedFile(new ParseImageFilePipe(false)) file: Express.Multer.File | undefined,
  ): Promise<ProductResponseDetailDto> {
    let category: Category | undefined;
    let image: string | undefined;

    if (dto.categoryId) {
      category = await this.productsService.findCategoryById(dto.categoryId);

      if (!category) throw new NotFoundException(`Category ${dto.categoryId} not found`);
    }

    if (file) {
      image = await this.imageUploadService.upload(file.buffer, file.originalname);
    }

    const product = await this.productsService.update(
      id,
      {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        quantityInStock: dto.quantityInStock,
        image,
      },
      category as Category,
    );

    return ProductResponseDetailDto.from(product);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthRoles(Role.Admin)
  @ApiOperation({ summary: 'Delete product (Admin)' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Product not found' })
  async softDelete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.productsService.softDelete(id);
  }
}
