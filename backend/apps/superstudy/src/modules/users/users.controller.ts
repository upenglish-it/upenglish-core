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

  @ApiOperation({ summary: 'List all users (optionally filter by role/status)' })
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

  @ApiOperation({
    summary: 'Change user email address (admin)',
    description: 'MongoDB email update — mirrors changeUserEmail Cloud Function. No Firebase Auth dependency.',
  })
  @Patch(':id/email')
  @HttpCode(HttpStatus.OK)
  changeEmail(@Param('id') id: string, @Body() body: { email: string }) {
    return this.usersService.changeEmail(id, body.email);
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

  @ApiOperation({
    summary: 'Reject / permanently delete a PENDING user (no cascade needed)',
    description: 'Hard-deletes a pending user document. For approved users with data, use DELETE /users/:id/delete.',
  })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.rejectUser(id);
  }

  @ApiOperation({
    summary: 'Full cascading delete — removes user + all related data',
    description:
      'Mirrors the original Firebase deleteUser Cloud Function. Cascades: assignments, exam_assignments, ' +
      'exam_submissions, teacher_ratings, skill_reports, red_flags, notifications, anonymous_feedback, ' +
      'word_progress, mail_queue, email_whitelist, reward_points. Then soft-deletes user document.',
  })
  @Delete(':id/delete')
  @HttpCode(HttpStatus.OK)
  deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }

  @ApiOperation({
    summary: 'Delete all learning progress for a user',
    description: 'Deletes all word_progress records for the user. Mirrors adminService.deleteUserProgress.',
  })
  @Delete(':id/progress')
  @HttpCode(HttpStatus.OK)
  deleteProgress(@Param('id') id: string) {
    return this.usersService.deleteUserProgress(id);
  }

  @ApiOperation({ summary: 'Add user to a group' })
  @Post(':uid/groups/:groupId')
  @HttpCode(HttpStatus.OK)
  addToGroup(@Param('uid') uid: string, @Param('groupId') groupId: string) {
    return this.usersService.addToGroup(uid, groupId);
  }

  @ApiOperation({ summary: 'Remove user from a group (archives groupId for cascade cleanup)' })
  @Delete(':uid/groups/:groupId')
  removeFromGroup(@Param('uid') uid: string, @Param('groupId') groupId: string) {
    return this.usersService.removeFromGroup(uid, groupId);
  }

  @ApiOperation({
    summary: 'Get user learning stats (totalWords, learnedWords, reviews, correct, wrong)',
    description: 'Mirrors adminService.getUserLearningStats. Supports optional startDate/endDate filtering.',
  })
  @Get(':id/stats')
  getLearningStats(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.usersService.getLearningStats(id, startDate, endDate);
  }

  @ApiOperation({
    summary: 'Update user streak (login streak — same-day safe)',
    description: 'Mirrors userService.getAndUpdateUserStreak. Safe to call on every login.',
  })
  @Post(':id/streak')
  @HttpCode(HttpStatus.OK)
  updateStreak(@Param('id') id: string) {
    return this.usersService.getAndUpdateStreak(id);
  }

  @ApiOperation({
    summary: 'Get streak data for multiple students (batch)',
    description: 'Mirrors userService.getStudentsStreakData. Used by teacher dashboard.',
  })
  @Post('streak-bulk')
  @HttpCode(HttpStatus.OK)
  getStreakBulk(@Body() body: { userIds: string[] }) {
    return this.usersService.getStudentsStreakData(body.userIds);
  }
}
