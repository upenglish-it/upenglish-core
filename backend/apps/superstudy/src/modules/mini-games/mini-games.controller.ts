import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MiniGamesService } from './mini-games.service';

@ApiTags('Mini Games')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('mini-games')
export class MiniGamesController {
  constructor(private readonly service: MiniGamesService) {}

  @ApiOperation({ summary: 'Get all mini games' })
  @Get()
  getAll() {
    return this.service.getAll();
  }

  @ApiOperation({ summary: 'Get my games' })
  @Get('me')
  getMyGames(@Query('userId') userId: string) {
    return this.service.getMyGames(userId);
  }

  @ApiOperation({ summary: 'Get approved games' })
  @Get('approved/list')
  getApprovedGames() {
    return this.service.getApprovedGames();
  }

  @ApiOperation({ summary: 'Get pending games' })
  @Get('pending/list')
  getPendingGames() {
    return this.service.getPendingGames();
  }

  @ApiOperation({ summary: 'Get pending games count' })
  @Get('pending/count')
  getPendingGamesCount() {
    return this.service.getPendingGamesCount();
  }

  @ApiOperation({ summary: 'Get game by id' })
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @ApiOperation({ summary: 'Create new game' })
  @Post()
  createGame(@Body() body: Record<string, any>) {
    return this.service.createGame(body);
  }

  @ApiOperation({ summary: 'Update game' })
  @Patch(':id')
  updateGame(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.updateGame(id, body);
  }

  @ApiOperation({ summary: 'Delete game' })
  @Delete(':id')
  deleteGame(@Param('id') id: string) {
    return this.service.deleteGame(id);
  }

  @ApiOperation({ summary: 'Submit for review' })
  @Patch(':id/submit')
  submitForReview(@Param('id') id: string, @Body('userId') userId: string) {
    return this.service.submitForReview(id, userId);
  }

  @ApiOperation({ summary: 'Approve game' })
  @Patch(':id/approve')
  approveGame(@Param('id') id: string, @Body('adminId') adminId: string) {
    return this.service.approveGame(id, adminId);
  }

  @ApiOperation({ summary: 'Reject game' })
  @Patch(':id/reject')
  rejectGame(@Param('id') id: string, @Body() body: { adminId: string, note?: string }) {
    return this.service.rejectGame(id, body.adminId, body.note);
  }
}
