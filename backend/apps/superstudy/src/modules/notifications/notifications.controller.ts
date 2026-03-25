import {
  Controller, Get, Post, Patch,
  Param, Query, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({ summary: 'List notifications for a user (newest first)' })
  @Get()
  findAll(@Query('userId') userId: string, @Query('unreadOnly') unreadOnly?: string) {
    return this.notificationsService.findAll(userId, unreadOnly === 'true');
  }

  @ApiOperation({ summary: 'Create a single notification (internal use)' })
  @Post()
  create(@Body() body: Record<string, any>) {
    return this.notificationsService.create(body);
  }

  @ApiOperation({ summary: 'Mark a single notification as read' })
  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  markRead(@Param('id') id: string) {
    return this.notificationsService.markRead(id);
  }

  @ApiOperation({ summary: 'Mark all unread notifications as read for a user' })
  @Post('batch-read')
  @HttpCode(HttpStatus.OK)
  markAllRead(@Body() body: { userId: string }) {
    return this.notificationsService.markAllRead(body.userId);
  }

  @ApiOperation({ summary: 'Get count of unread notifications for a user' })
  @Get('unread-count')
  unreadCount(@Query('userId') userId: string) {
    return this.notificationsService.unreadCount(userId);
  }
}
