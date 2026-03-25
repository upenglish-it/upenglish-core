import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EmailWhitelistService } from './email-whitelist.service';

@ApiTags('Email Whitelist')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('email-whitelist')
export class EmailWhitelistController {
  constructor(private readonly emailWhitelistService: EmailWhitelistService) {}

  @ApiOperation({ summary: 'List all whitelisted emails (optionally filter by role or used status)' })
  @Get()
  findAll(
    @Query('role') role?: string,
    @Query('used') used?: string,
  ) {
    return this.emailWhitelistService.findAll({
      role,
      used: used === 'true' ? true : used === 'false' ? false : undefined,
    });
  }

  @ApiOperation({ summary: 'Check if an email is whitelisted (returns entry or null)' })
  @Get('check')
  checkEmail(@Query('email') email: string) {
    return this.emailWhitelistService.checkEmail(email);
  }

  @ApiOperation({ summary: 'Get a single whitelist entry by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.emailWhitelistService.findOne(id);
  }

  @ApiOperation({ summary: 'Add an email to the whitelist' })
  @Post()
  create(@Body() body: Record<string, any>) {
    return this.emailWhitelistService.create(body);
  }

  @ApiOperation({ summary: 'Bulk add multiple emails to the whitelist' })
  @Post('bulk')
  bulkCreate(@Body() body: Record<string, any>[]) {
    return this.emailWhitelistService.bulkCreate(body);
  }

  @ApiOperation({ summary: 'Update a whitelist entry (role, duration, groups, etc.)' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.emailWhitelistService.update(id, body);
  }

  @ApiOperation({ summary: 'Mark a whitelist entry as used (called on registration)' })
  @Patch(':id/mark-used')
  @HttpCode(HttpStatus.OK)
  markUsed(@Param('id') id: string) {
    return this.emailWhitelistService.markUsed(id);
  }

  @ApiOperation({ summary: 'Remove an email from the whitelist' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.emailWhitelistService.remove(id);
  }
}
