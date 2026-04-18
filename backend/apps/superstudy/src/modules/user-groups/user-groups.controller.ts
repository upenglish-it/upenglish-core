import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserGroupsService } from './user-groups.service';

@ApiTags('User Groups')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('user-groups')
export class UserGroupsController {
  constructor(private readonly userGroupsService: UserGroupsService) {}

  @ApiOperation({ summary: 'List all groups (excludes hidden by default)' })
  @Get()
  findAll(
    @Query('includeHidden') includeHidden?: string,
    @Query('ids') ids?: string,
  ) {
    if (ids) {
      return this.userGroupsService.findByIds(ids.split(',').map((id) => id.trim()).filter(Boolean));
    }
    return this.userGroupsService.findAll(includeHidden === 'true');
  }

  @ApiOperation({ summary: 'Get a single group by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userGroupsService.findOne(id);
  }

  @ApiOperation({ summary: 'Get students in a group' })
  @Get(':id/students')
  getStudents(@Param('id') id: string) {
    return this.userGroupsService.getStudentsInGroup(id);
  }

  @ApiOperation({ summary: 'Create a new group' })
  @Post()
  create(@Body() body: Record<string, any>) {
    return this.userGroupsService.create(body);
  }

  @ApiOperation({ summary: 'Update an existing group' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.userGroupsService.update(id, body);
  }

  @ApiOperation({ summary: 'Delete a group permanently' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userGroupsService.remove(id);
  }

  @ApiOperation({ summary: 'Add/remove topic/grammar/exam access for a group' })
  @Patch(':id/access')
  updateAccess(
    @Param('id') id: string,
    @Body() body: { field: string; resourceId: string; action: 'add' | 'remove' },
  ) {
    return this.userGroupsService.updateAccess(id, body.field, body.resourceId, body.action);
  }
}
