import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'List all users (optionally filter by role)' })
  @Get()
  findAll(@Query('role') role?: string, @Query('status') status?: string) {
    return this.usersService.findAll({ role, status });
  }

  @ApiOperation({ summary: 'Get user by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @ApiOperation({ summary: 'Update user fields (role, displayName, disabled, folderAccess, etc.)' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.usersService.update(id, body);
  }

  @ApiOperation({ summary: 'Sync user profile on login (create if not exists)' })
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  syncUser(@Body() body: Record<string, any>) {
    const { id, ...data } = body;
    return this.usersService.syncUser(id, data);
  }

  @ApiOperation({ summary: 'Approve pending user with role and optional expiry' })
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @Param('id') id: string,
    @Body() body: { role: string; durationDays?: number; customExpiresAt?: string },
  ) {
    return this.usersService.approveUser(id, body.role, body.durationDays, body.customExpiresAt);
  }

  @ApiOperation({ summary: 'Renew user access with optional duration' })
  @Post(':id/renew')
  @HttpCode(HttpStatus.OK)
  renew(
    @Param('id') id: string,
    @Body() body: { durationDays?: number; customExpiresAt?: string },
  ) {
    return this.usersService.renewUser(id, body.durationDays, body.customExpiresAt);
  }

  @ApiOperation({ summary: 'Reject / permanently delete a pending user' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.rejectUser(id);
  }

  @ApiOperation({ summary: 'Add user to a group' })
  @Post(':uid/groups/:groupId')
  @HttpCode(HttpStatus.OK)
  addToGroup(@Param('uid') uid: string, @Param('groupId') groupId: string) {
    return this.usersService.addToGroup(uid, groupId);
  }

  @ApiOperation({ summary: 'Remove user from a group' })
  @Delete(':uid/groups/:groupId')
  removeFromGroup(@Param('uid') uid: string, @Param('groupId') groupId: string) {
    return this.usersService.removeFromGroup(uid, groupId);
  }

  @ApiOperation({ summary: 'Get user learning stats' })
  @Get(':id/stats')
  getLearningStats(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.usersService.getLearningStats(id, startDate, endDate);
  }
}
