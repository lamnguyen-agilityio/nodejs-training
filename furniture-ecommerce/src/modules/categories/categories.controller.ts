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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiForbiddenResponse,
  ApiConsumes,
} from '@nestjs/swagger';

import { Role } from '@/common/enums';
import { ParseImageFilePipe } from '@/common/pipes/parse-image-file.pipe';
import { AuthRoles } from '@/modules/auth/decorators';

import { CategoriesService } from './categories.service';
import {
  CategoryResponseDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateCategoryFormDto,
  UpdateCategoryFormDto,
} from './dtos';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // ─── Public ───────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all categories' })
  @ApiOkResponse({ type: [CategoryResponseDto] })
  async findAll(): Promise<CategoryResponseDto[]> {
    const categories = await this.categoriesService.findAll();
    return CategoryResponseDto.fromMany(categories);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get category by slug' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Category not found' })
  async findOne(@Param('slug') slug: string): Promise<CategoryResponseDto> {
    const category = await this.categoriesService.findOne({ slug });
    return CategoryResponseDto.from(category);
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  @Post()
  @AuthRoles(Role.Admin)
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create category (Admin)' })
  @ApiBody({ type: CreateCategoryFormDto })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  @ApiForbiddenResponse({ description: 'You are not authorized to create this category' })
  @ApiConflictResponse({ description: 'Category name already exists' })
  async create(
    @Body() dto: CreateCategoryDto,
    @UploadedFile(new ParseImageFilePipe(true)) image: Express.Multer.File,
  ): Promise<CategoryResponseDto> {
    const category = await this.categoriesService.create(dto, image);
    return CategoryResponseDto.from(category);
  }

  @Patch(':id')
  @AuthRoles(Role.Admin)
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update category (Admin)' })
  @ApiBody({ type: UpdateCategoryFormDto })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiForbiddenResponse({ description: 'You are not authorized to update this category' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiConflictResponse({ description: 'Category name already exists' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
    @UploadedFile(new ParseImageFilePipe(false)) file?: Express.Multer.File,
  ): Promise<CategoryResponseDto> {
    const category = await this.categoriesService.update(id, dto, file);
    return CategoryResponseDto.from(category);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthRoles(Role.Admin)
  @ApiOperation({ summary: 'Delete category (Admin)' })
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'You are not authorized to delete this category' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  async softDelete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.categoriesService.softDelete(id);
  }
}
