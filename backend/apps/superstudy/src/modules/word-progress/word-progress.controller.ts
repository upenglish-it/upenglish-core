import {
  Controller, Get, Post, Patch,
  Param, Query, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WordProgressService } from './word-progress.service';

@ApiTags('Word Progress')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('word-progress')
export class WordProgressController {
  constructor(private readonly wordProgressService: WordProgressService) {}

  @ApiOperation({ summary: 'Get all progress records for a user (optionally filter by topicId)' })
  @Get()
  findAll(@Query('userId') userId: string, @Query('topicId') topicId?: string) {
    return this.wordProgressService.findAll(userId, topicId);
  }

  @ApiOperation({ summary: 'Get progress for a specific word' })
  @Get('word')
  findOne(
    @Query('userId') userId: string,
    @Query('topicId') topicId: string,
    @Query('wordId') wordId: string,
  ) {
    return this.wordProgressService.findOne(userId, topicId, wordId);
  }

  @ApiOperation({ summary: 'Get mastery summary for a topic (count mastered vs total)' })
  @Get('summary')
  getSummary(@Query('userId') userId: string, @Query('topicId') topicId: string) {
    return this.wordProgressService.getTopicSummary(userId, topicId);
  }

  @ApiOperation({ summary: 'Get streak data for a user (mirrors userService.getAndUpdateUserStreak)' })
  @Get('streak/:userId')
  getStreak(@Param('userId') userId: string) {
    return this.wordProgressService.getAndUpdateStreak(userId);
  }

  @ApiOperation({ summary: 'Get streak data for multiple users (bulk — for teacher dashboard)' })
  @Post('streak/bulk')
  @HttpCode(HttpStatus.OK)
  getBulkStreak(@Body() body: { userIds: string[] }) {
    return this.wordProgressService.getStudentsStreakData(body.userIds);
  }

  @ApiOperation({ summary: 'Upsert progress for a single word (create or update)' })
  @Post()
  upsert(@Body() body: {
    userId: string;
    topicId: string;
    wordId: string;
    [key: string]: any;
  }) {
    return this.wordProgressService.upsert(body);
  }

  @ApiOperation({ summary: 'Record a game result for a word (updates score + masteryScore)' })
  @Patch('game-result')
  @HttpCode(HttpStatus.OK)
  recordGameResult(@Body() body: {
    userId: string;
    topicId: string;
    wordId: string;
    gameType: string;
    score: number;         // 0-100
    isCorrect: boolean;
  }) {
    return this.wordProgressService.recordGameResult(body);
  }

  @ApiOperation({ summary: 'Update pronunciation score for a word' })
  @Patch('pronunciation')
  @HttpCode(HttpStatus.OK)
  updatePronunciation(@Body() body: {
    userId: string;
    topicId: string;
    wordId: string;
    pronunciationScore: number;
  }) {
    return this.wordProgressService.updatePronunciationScore(body);
  }

  @ApiOperation({ summary: 'Reset all progress for a topic (for a user)' })
  @Post('reset')
  @HttpCode(HttpStatus.OK)
  reset(@Body() body: { userId: string; topicId: string }) {
    return this.wordProgressService.resetTopicProgress(body.userId, body.topicId);
  }
}
