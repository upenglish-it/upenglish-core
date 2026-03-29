import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ContentProposalsService } from './content-proposals.service';

@ApiTags('Content Proposals')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('content-proposals')
export class ContentProposalsController {
  constructor(private readonly contentProposalsService: ContentProposalsService) {}

  @ApiOperation({ summary: 'Create a new content proposal' })
  @Post()
  create(@Body() body: Record<string, any>) {
    return this.contentProposalsService.create(body);
  }

  @ApiOperation({ summary: 'Get all content proposals (with optional filters)' })
  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('teacherId') teacherId?: string,
    @Query('sourceId') sourceId?: string,
  ) {
    return this.contentProposalsService.findAll({ status, type, teacherId, sourceId });
  }

  @ApiOperation({ summary: 'Get a specific content proposal' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contentProposalsService.findOne(id);
  }

  @ApiOperation({ summary: 'Update/Review a content proposal' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.contentProposalsService.update(id, body);
  }

  @ApiOperation({ summary: 'Delete a content proposal' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contentProposalsService.remove(id);
  }
}
