import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnonymousFeedbackService } from './anonymous-feedback.service';

@ApiTags('Anonymous Feedback')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('anonymous-feedback')
export class AnonymousFeedbackController {
  constructor(private readonly service: AnonymousFeedbackService) {}

  @ApiOperation({ summary: 'Get feedback targeted directly to me' })
  @Get('me')
  getMyReceivedFeedback(@Query('uid') uid: string) {
    return this.service.getMyReceivedFeedback(uid);
  }

  @ApiOperation({ summary: 'Get all admin feedback' })
  @Get('admin')
  getAdminFeedback() {
    return this.service.getAdminFeedback();
  }

  @ApiOperation({ summary: 'Get all direct feedback' })
  @Get('direct')
  getDirectFeedback() {
    return this.service.getDirectFeedback();
  }

  @ApiOperation({ summary: 'Get all feedback' })
  @Get('all')
  getAllFeedback() {
    return this.service.getAllFeedback();
  }

  @ApiOperation({ summary: 'Get unread admin feedback count' })
  @Get('admin/unread-count')
  getUnreadFeedbackCount() {
    return this.service.getUnreadFeedbackCount();
  }

  @ApiOperation({ summary: 'Get my unread feedback count' })
  @Get('me/unread-count')
  getMyUnreadFeedbackCount(@Query('uid') uid: string) {
    return this.service.getMyUnreadFeedbackCount(uid);
  }

  @ApiOperation({ summary: 'Submit anonymous feedback' })
  @Post()
  submitFeedback(@Body() body: Record<string, any>) {
    return this.service.submitFeedback(body);
  }

  @ApiOperation({ summary: 'Mark feedback as read' })
  @Patch(':id/read')
  markFeedbackAsRead(@Param('id') id: string) {
    return this.service.markFeedbackAsRead(id);
  }

  @ApiOperation({ summary: 'Hide feedback from user view' })
  @Patch(':id/hide')
  hideFeedbackForUser(@Param('id') id: string, @Body('uid') uid: string) {
    return this.service.hideFeedbackForUser(id, uid);
  }

  @ApiOperation({ summary: 'Delete feedback permanently' })
  @Delete(':id')
  deleteFeedback(@Param('id') id: string) {
    return this.service.deleteFeedback(id);
  }
}
