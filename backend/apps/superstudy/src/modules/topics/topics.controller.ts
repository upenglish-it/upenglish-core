import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TopicsService } from './topics.service';

@ApiTags('Topics (Admin)')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('topics')
export class TopicsController {
  constructor(private readonly topicsService: TopicsService) {}

  @ApiOperation({ summary: 'List all topics (admin)' })
  @Get()
  findAll(@Query('folderId') folderId?: string) {
    return this.topicsService.findAll(folderId);
  }

  @ApiOperation({ summary: 'Get a single topic by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.topicsService.findOne(id);
  }

  @ApiOperation({ summary: 'Create or update a topic' })
  @Post()
  create(@Body() body: Record<string, any>) {
    return this.topicsService.create(body);
  }

  @ApiOperation({ summary: 'Update topic metadata' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.topicsService.update(id, body);
  }

  @ApiOperation({ summary: 'Toggle topic public status' })
  @Patch(':id/public')
  @HttpCode(HttpStatus.OK)
  togglePublic(@Param('id') id: string, @Body() body: { isPublic: boolean }) {
    return this.topicsService.update(id, { isPublic: body.isPublic });
  }

  @ApiOperation({ summary: 'Toggle teacher-visible status' })
  @Patch(':id/teacher-visible')
  @HttpCode(HttpStatus.OK)
  toggleTeacherVisible(
    @Param('id') id: string,
    @Body() body: { teacherVisible: boolean },
  ) {
    return this.topicsService.update(id, { teacherVisible: body.teacherVisible });
  }

  @ApiOperation({ summary: 'Soft-delete a topic' })
  @Delete(':id')
  softDelete(@Param('id') id: string) {
    return this.topicsService.softDelete(id);
  }

  @ApiOperation({ summary: 'Permanently delete a topic' })
  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string) {
    return this.topicsService.permanentDelete(id);
  }
}
