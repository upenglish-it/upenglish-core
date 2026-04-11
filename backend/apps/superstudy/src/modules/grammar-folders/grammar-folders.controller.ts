import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GrammarFoldersService } from './grammar-folders.service';

@ApiTags('Grammar Folders')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('grammar-folders')
export class GrammarFoldersController {
  constructor(private readonly service: GrammarFoldersService) {}

  @ApiOperation({ summary: 'Get all with optional filters' })
  @Get()
  findAll(@Query() query: Record<string, any>) {
    return this.service.findAll(query);
  }

  @ApiOperation({ summary: 'Get by id' })
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @ApiOperation({ summary: 'Create' })
  @Post()
  create(@Body() body: Record<string, any>) {
    return this.service.create(body);
  }

  @ApiOperation({ summary: 'Update' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.update(id, body);
  }

  @ApiOperation({ summary: 'Delete' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
