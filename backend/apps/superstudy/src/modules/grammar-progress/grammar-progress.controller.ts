import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GrammarProgressService } from './grammar-progress.service';

@ApiTags('Grammar Progress')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('grammar-progress')
export class GrammarProgressController {
  constructor(private readonly grammarProgressService: GrammarProgressService) {}

  @ApiOperation({ summary: 'List grammar progress records for a user' })
  @Get()
  findAll(
    @Query('userId') userId: string,
    @Query('exerciseId') exerciseId?: string,
    @Query('exerciseIds') exerciseIds?: string,
  ) {
    const parsedExerciseIds = exerciseIds?.split(',').filter(Boolean) ?? [];
    return this.grammarProgressService.findAll(userId, exerciseId, parsedExerciseIds);
  }

  @ApiOperation({ summary: 'Get grammar progress for one question' })
  @Get('question')
  findOne(@Query('userId') userId: string, @Query('questionId') questionId: string) {
    return this.grammarProgressService.findOne(userId, questionId);
  }

  @ApiOperation({ summary: 'Get due grammar review records for a user' })
  @Get('due')
  findDue(@Query('userId') userId: string) {
    return this.grammarProgressService.findDue(userId);
  }

  @ApiOperation({ summary: 'Get due grammar review count for a user' })
  @Get('review-count')
  getReviewCount(@Query('userId') userId: string) {
    return this.grammarProgressService.getReviewCount(userId);
  }

  @ApiOperation({ summary: 'Get grammar summary for one or more exercises' })
  @Get('summary')
  getSummary(@Query('userId') userId: string, @Query('exerciseIds') exerciseIds?: string) {
    const parsedExerciseIds = exerciseIds?.split(',').filter(Boolean) ?? [];
    return this.grammarProgressService.getExerciseSummaries(userId, parsedExerciseIds);
  }

  @ApiOperation({ summary: 'Get question-by-question grammar progress for one exercise' })
  @Get('questions')
  getQuestionProgress(@Query('userId') userId: string, @Query('exerciseId') exerciseId: string) {
    return this.grammarProgressService.getExerciseQuestionsProgress(userId, exerciseId);
  }

  @ApiOperation({ summary: 'Get overall grammar stats for a user' })
  @Get('stats')
  getStats(
    @Query('userId') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.grammarProgressService.getUserOverallStats(userId, startDate, endDate);
  }

  @ApiOperation({ summary: 'Upsert grammar progress for a question' })
  @Post()
  upsert(
    @Body()
    body: {
      userId: string;
      questionId: string;
      exerciseId: string;
      passed: boolean;
      variationIndex: number;
      totalVariations?: number;
    },
  ) {
    return this.grammarProgressService.upsert(body);
  }

  @ApiOperation({ summary: 'Reset grammar progress for one exercise' })
  @Post('reset')
  @HttpCode(HttpStatus.OK)
  reset(@Body() body: { userId: string; exerciseId: string }) {
    return this.grammarProgressService.resetExerciseProgress(body.userId, body.exerciseId);
  }

  @ApiOperation({ summary: 'Delete one grammar progress record' })
  @Delete('question')
  @HttpCode(HttpStatus.OK)
  removeOne(@Query('userId') userId: string, @Query('questionId') questionId: string) {
    return this.grammarProgressService.removeOne(userId, questionId);
  }
}
