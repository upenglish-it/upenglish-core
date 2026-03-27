import {
  Controller, Get, Post, Patch, Delete,
  Body, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SharingService } from './sharing.service';

@ApiTags('Sharing')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('sharing')
export class SharingController {
  constructor(private readonly sharingService: SharingService) {}

  // ─────────────────────────────────────────────
  // User lookup (used by the Share Modal to resolve emails)
  // ─────────────────────────────────────────────

  @ApiOperation({ summary: 'Find an SST user by email (for sharing UI autocomplete)' })
  @Get('find-user')
  findUser(@Query('email') email: string, @Query('role') role?: string) {
    return this.sharingService.findUserByEmail(email, role);
  }

  // ─────────────────────────────────────────────
  // Mode 1 & 2: Public / Teacher-visible toggles
  // ─────────────────────────────────────────────

  @ApiOperation({ summary: 'Toggle isPublic on a resource (topics, teacher_topics, grammar_exercises, exams)' })
  @Patch('public')
  @HttpCode(HttpStatus.OK)
  togglePublic(@Body() body: {
    resourceType: string;  // 'topic' | 'teacher_topic' | 'grammar' | 'exam'
    resourceId: string;
    isPublic: boolean;
  }) {
    return this.sharingService.togglePublic(body.resourceType, body.resourceId, body.isPublic);
  }

  @ApiOperation({ summary: 'Toggle teacherVisible on an admin resource (topics, grammar_exercises, exams)' })
  @Patch('teacher-visible')
  @HttpCode(HttpStatus.OK)
  toggleTeacherVisible(@Body() body: {
    resourceType: string;  // 'topic' | 'grammar' | 'exam'
    resourceId: string;
    teacherVisible: boolean;
  }) {
    return this.sharingService.toggleTeacherVisible(body.resourceType, body.resourceId, body.teacherVisible);
  }

  // ─────────────────────────────────────────────
  // Mode 3: Group access
  // ─────────────────────────────────────────────

  @ApiOperation({ summary: 'Add a resource to a group\'s access array (topicAccess / grammarAccess / examAccess)' })
  @Post('group-access/add')
  @HttpCode(HttpStatus.OK)
  addGroupAccess(@Body() body: {
    groupId: string;
    resourceType: string;  // 'topic' | 'grammar' | 'exam'
    resourceId: string;
  }) {
    return this.sharingService.addGroupAccess(body.groupId, body.resourceType, body.resourceId);
  }

  @ApiOperation({ summary: 'Remove a resource from a group\'s access array' })
  @Delete('group-access/remove')
  @HttpCode(HttpStatus.OK)
  removeGroupAccess(@Body() body: {
    groupId: string;
    resourceType: string;
    resourceId: string;
  }) {
    return this.sharingService.removeGroupAccess(body.groupId, body.resourceType, body.resourceId);
  }

  @ApiOperation({ summary: 'Sync all group access arrays for a resource (replace entire group list)' })
  @Patch('group-access/sync')
  @HttpCode(HttpStatus.OK)
  syncGroupAccess(@Body() body: {
    resourceType: string;
    resourceId: string;
    groupIds: string[];   // final desired list of groups that should have access
  }) {
    return this.sharingService.syncGroupAccess(body.resourceType, body.resourceId, body.groupIds);
  }

  // ─────────────────────────────────────────────
  // Mode 4: Individual user access
  // ─────────────────────────────────────────────

  @ApiOperation({ summary: 'Add a resource to an individual user\'s access (by email or userId)' })
  @Post('user-access/add')
  @HttpCode(HttpStatus.OK)
  addUserAccess(@Body() body: {
    userEmail?: string;
    userId?: string;
    resourceType: string;  // 'topic' | 'grammar' | 'exam'
    resourceId: string;
  }) {
    return this.sharingService.addUserAccess(body);
  }

  @ApiOperation({ summary: 'Remove a resource from an individual user\'s access' })
  @Delete('user-access/remove')
  @HttpCode(HttpStatus.OK)
  removeUserAccess(@Body() body: {
    userId: string;
    resourceType: string;
    resourceId: string;
  }) {
    return this.sharingService.removeUserAccess(body.userId, body.resourceType, body.resourceId);
  }

  @ApiOperation({ summary: 'Get all SST access arrays for a user (topicAccess, grammarAccess, examAccess)' })
  @Get('user-access')
  getUserAccess(@Query('userId') userId: string) {
    return this.sharingService.getUserAccess(userId);
  }

  @ApiOperation({ summary: 'Get all users and groups that have access to a specific resource' })
  @Get('resource-access')
  getResourceAccess(
    @Query('resourceType') resourceType: string,
    @Query('resourceId') resourceId: string
  ) {
    return this.sharingService.getResourceAccess(resourceType, resourceId);
  }


  // ─────────────────────────────────────────────
  // Mode 5: Teacher collaboration (teacher-owned resources)
  // ─────────────────────────────────────────────

  @ApiOperation({ summary: 'Add a collaborator to a teacher resource (sends in-app notification)' })
  @Post('collaborators/add')
  @HttpCode(HttpStatus.OK)
  addCollaborator(@Body() body: {
    resourceType: string;   // 'teacher_topic' | 'grammar' | 'exam'
    resourceId: string;
    collaboratorEmail?: string;
    collaboratorId?: string;
    role?: 'editor' | 'viewer';  // default 'editor'
  }) {
    return this.sharingService.addCollaborator(body);
  }

  @ApiOperation({ summary: 'Remove a collaborator from a teacher resource' })
  @Delete('collaborators/remove')
  @HttpCode(HttpStatus.OK)
  removeCollaborator(@Body() body: {
    resourceType: string;
    resourceId: string;
    collaboratorId: string;
  }) {
    return this.sharingService.removeCollaborator(body.resourceType, body.resourceId, body.collaboratorId);
  }

  @ApiOperation({ summary: 'Update a collaborator\'s role (viewer / editor)' })
  @Patch('collaborators/role')
  @HttpCode(HttpStatus.OK)
  updateCollaboratorRole(@Body() body: {
    resourceType: string;
    resourceId: string;
    collaboratorId: string;
    role: 'editor' | 'viewer';
  }) {
    return this.sharingService.updateCollaboratorRole(
      body.resourceType, body.resourceId, body.collaboratorId, body.role,
    );
  }

  @ApiOperation({ summary: 'Transfer ownership of a teacher resource to another teacher' })
  @Patch('collaborators/transfer-ownership')
  @HttpCode(HttpStatus.OK)
  transferOwnership(@Body() body: {
    resourceType: string;
    resourceId: string;
    oldOwnerId: string;
    oldOwnerName?: string;
    newOwnerEmail?: string;
    newOwnerId?: string;
    newOwnerName?: string;
    resourceName?: string;
  }) {
    return this.sharingService.transferOwnership(body);
  }

  @ApiOperation({ summary: 'Get all resources where a teacher is a collaborator' })
  @Get('collaborators/my-resources')
  getCollaboratedResources(
    @Query('resourceType') resourceType: string,
    @Query('teacherId') teacherId: string,
  ) {
    return this.sharingService.getCollaboratedResources(resourceType, teacherId);
  }

  // ─────────────────────────────────────────────
  // Mode 6: Admin → per-teacher sharing (admin content only)
  // ─────────────────────────────────────────────

  @ApiOperation({ summary: 'Share an admin resource with a specific teacher (by email)' })
  @Post('teacher-share/add')
  @HttpCode(HttpStatus.OK)
  addTeacherShare(@Body() body: {
    resourceType: string;  // 'topic' | 'grammar' | 'exam'
    resourceId: string;
    teacherEmail?: string;
    teacherId?: string;
  }) {
    return this.sharingService.addTeacherShare(body);
  }

  @ApiOperation({ summary: 'Remove a specific teacher from an admin resource\'s shared list' })
  @Delete('teacher-share/remove')
  @HttpCode(HttpStatus.OK)
  removeTeacherShare(@Body() body: {
    resourceType: string;
    resourceId: string;
    teacherId: string;
  }) {
    return this.sharingService.removeTeacherShare(body.resourceType, body.resourceId, body.teacherId);
  }
}
