import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GrammarSubmissionsService } from './grammar-submissions.service';

@ApiTags('Grammar Submissions')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('grammar-submissions')
export class GrammarSubmissionsController {
  constructor(private readonly grammarSubmissionsService: GrammarSubmissionsService) {}

  @ApiOperation({ summary: 'Find one grammar submission by assignmentId + studentId' })
  @Get('lookup')
  lookup(
    @Query('assignmentId') assignmentId: string,
    @Query('studentId') studentId: string,
  ) {
    return this.grammarSubmissionsService.lookup(assignmentId, studentId);
  }

  @ApiOperation({ summary: 'List grammar submissions' })
  @Get()
  findAll(
    @Query('assignmentId') assignmentId?: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.grammarSubmissionsService.findAll({ assignmentId, studentId });
  }

  @ApiOperation({ summary: 'Get one grammar submission by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.grammarSubmissionsService.findOne(id);
  }

  @ApiOperation({ summary: 'Create a grammar submission' })
  @Post()
  create(@Body() body: Record<string, any>) {
    return this.grammarSubmissionsService.create(body);
  }

  @ApiOperation({ summary: 'Update a grammar submission' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.grammarSubmissionsService.update(id, body);
  }

  @ApiOperation({ summary: 'Delete a grammar submission' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.grammarSubmissionsService.remove(id);
  }
}
