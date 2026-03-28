import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
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
}
