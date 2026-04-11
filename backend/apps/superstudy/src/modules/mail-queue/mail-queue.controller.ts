import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MailQueueService } from './mail-queue.service';

@ApiTags('Mail Queue')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('mail-queue')
export class MailQueueController {
  constructor(private readonly mailQueueService: MailQueueService) {}

  @ApiOperation({ summary: 'Queue a single email' })
  @Post()
  create(@Body() body: Record<string, any>) {
    return this.mailQueueService.create(body);
  }

  @ApiOperation({ summary: 'Queue an email for all admins' })
  @Post('admins')
  createForAdmins(@Body() body: Record<string, any>) {
    return this.mailQueueService.createForAdmins(body);
  }
}
