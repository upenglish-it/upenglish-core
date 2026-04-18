import { Injectable } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import {
  SSTGrammarExercises,
  SSTGrammarProgress,
  SSTGrammarQuestions,
} from 'apps/common/src/database/mongodb/src/superstudy';

const INTERVALS = [0, 1, 3, 7, 14, 30];

function getProgressTimeMillis(value: any): number {
  if (!value) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

@Injectable()
export class GrammarProgressService {
  constructor(
    @InjectModel(SSTGrammarProgress)
    private readonly progressModel: ReturnModelType<typeof SSTGrammarProgress>,

    @InjectModel(SSTGrammarQuestions)
    private readonly questionsModel: ReturnModelType<typeof SSTGrammarQuestions>,

    @InjectModel(SSTGrammarExercises)
    private readonly exercisesModel: ReturnModelType<typeof SSTGrammarExercises>,
  ) {}

  async findAll(userId: string, exerciseId?: string, exerciseIds: string[] = []) {
    const query: Record<string, any> = { userId };
    if (exerciseId) query.exerciseId = exerciseId;
    else if (exerciseIds.length > 0) query.exerciseId = { $in: exerciseIds };
    return this.progressModel.find(query).lean();
  }

  async findOne(userId: string, questionId: string) {
    return this.progressModel.findOne({ userId, questionId }).lean();
  }

  async upsert(params: {
    userId: string;
    questionId: string;
    exerciseId: string;
    passed: boolean;
    variationIndex: number;
    totalVariations?: number;
  }) {
    const {
      userId,
      questionId,
      exerciseId,
      passed,
      variationIndex,
      totalVariations = 4,
    } = params;

    const existing = await this.progressModel.findOne({ userId, questionId }).lean();
    const now = new Date();
    let level = existing?.level ?? 0;
    let failCount = existing?.failCount ?? 0;
    let passCount = existing?.passCount ?? 0;
    const variationsPassed = Array.isArray(existing?.variationsPassed)
      ? [...existing.variationsPassed]
      : [];
    const variationsFailed = Array.isArray(existing?.variationsFailed)
      ? [...existing.variationsFailed]
      : [];
    let lastLeveledDay = existing?.lastLeveledDay ?? '';

    if (passed) {
      if (!variationsPassed.includes(variationIndex)) variationsPassed.push(variationIndex);
      passCount += 1;
      const todayKey = now.toISOString().slice(0, 10);
      const allVariationsPassed = variationsPassed.length >= totalVariations;
      if (allVariationsPassed && lastLeveledDay !== todayKey) {
        level = Math.min(level + 1, 5);
        lastLeveledDay = todayKey;
      }
    } else {
      if (!variationsFailed.includes(variationIndex)) variationsFailed.push(variationIndex);
      failCount += 1;
      level = Math.max(level - 1, 0);
    }

    const interval = INTERVALS[level] || 0;
    const nextReview = new Date(now.getTime() + interval * 86400000);

    return this.progressModel
      .findOneAndUpdate(
        { userId, questionId },
        {
          $set: {
            exerciseId,
            level,
            interval,
            nextReview,
            lastStudied: now,
            failCount,
            passCount,
            variationsPassed,
            variationsFailed,
            lastVariationAttempted: variationIndex,
            lastLeveledDay,
            totalVariations,
          },
          $setOnInsert: { userId, questionId },
        },
        { upsert: true, new: true },
      )
      .lean();
  }

  async findDue(userId: string) {
    const due = await this.progressModel
      .find({ userId, nextReview: { $lte: new Date() } })
      .lean();

    if (!due.length) return [];

    const exerciseIds = [...new Set(due.map((item) => item.exerciseId).filter(Boolean))];
    const questionIds = [...new Set(due.map((item) => item.questionId).filter(Boolean))];

    const [validExercises, validQuestions] = await Promise.all([
      exerciseIds.length
        ? this.exercisesModel
            .find({ _id: { $in: exerciseIds }, isDeleted: { $ne: true } })
            .select({ _id: 1 })
            .lean()
        : [],
      questionIds.length
        ? this.questionsModel.find({ _id: { $in: questionIds } }).select({ _id: 1 }).lean()
        : [],
    ]);

    const validExerciseIds = new Set(validExercises.map((item: any) => String(item._id)));
    const validQuestionIds = new Set(validQuestions.map((item: any) => String(item._id)));

    const orphanRecordIds = due
      .filter(
        (item) =>
          !validExerciseIds.has(String(item.exerciseId)) ||
          !validQuestionIds.has(String(item.questionId)),
      )
      .map((item: any) => item._id);

    if (orphanRecordIds.length > 0) {
      await this.progressModel.deleteMany({ _id: { $in: orphanRecordIds } });
    }

    return due.filter(
      (item) =>
        validExerciseIds.has(String(item.exerciseId)) &&
        validQuestionIds.has(String(item.questionId)),
    );
  }

  async getReviewCount(userId: string) {
    const due = await this.findDue(userId);
    return due.length;
  }

  async resetExerciseProgress(userId: string, exerciseId: string) {
    const result = await this.progressModel.deleteMany({ userId, exerciseId });
    return { deleted: result.deletedCount };
  }

  async removeOne(userId: string, questionId: string) {
    const result = await this.progressModel.findOneAndDelete({ userId, questionId }).lean();
    return { deleted: !!result };
  }

  async getExerciseSummaries(userId: string, exerciseIds: string[]) {
    const uniqueExerciseIds = [...new Set((exerciseIds || []).filter(Boolean))];
    if (!userId || uniqueExerciseIds.length === 0) return {};

    const [questions, progressDocs] = await Promise.all([
      this.questionsModel.find({ exerciseId: { $in: uniqueExerciseIds } }).lean(),
      this.progressModel.find({ userId, exerciseId: { $in: uniqueExerciseIds } }).lean(),
    ]);

    const questionsByExercise = new Map<string, any[]>();
    const progressByExercise = new Map<string, any[]>();

    questions.forEach((question: any) => {
      const list = questionsByExercise.get(question.exerciseId) ?? [];
      list.push(question);
      questionsByExercise.set(question.exerciseId, list);
    });

    progressDocs.forEach((progress: any) => {
      const list = progressByExercise.get(progress.exerciseId) ?? [];
      list.push(progress);
      progressByExercise.set(progress.exerciseId, list);
    });

    const result: Record<string, any> = {};

    uniqueExerciseIds.forEach((exerciseId) => {
      const exerciseQuestions = questionsByExercise.get(exerciseId) ?? [];
      const exerciseProgress = progressByExercise.get(exerciseId) ?? [];

      const total = exerciseQuestions.length;
      let learned = 0;
      let learning = 0;
      const notStarted = total - exerciseProgress.length;
      let completedSteps = 0;
      let totalCorrect = 0;
      let totalWrong = 0;
      let latestLearnedAtMs = 0;

      exerciseProgress.forEach((progress: any) => {
        const variationsPassed = Array.isArray(progress.variationsPassed)
          ? progress.variationsPassed
          : [];
        if (variationsPassed.length >= 1) {
          learned++;
          completedSteps += 6;
          const lastStudiedMs = getProgressTimeMillis(progress.lastStudied);
          if (lastStudiedMs > latestLearnedAtMs) latestLearnedAtMs = lastStudiedMs;
        } else {
          learning++;
          completedSteps += 3;
        }
        totalCorrect += Number(progress.passCount) || 0;
        totalWrong += Number(progress.failCount) || 0;
      });

      result[exerciseId] = {
        total,
        learned,
        learning,
        notStarted,
        completedSteps,
        totalCorrect,
        totalWrong,
        completedAt: total > 0 && learned === total && latestLearnedAtMs > 0 ? latestLearnedAtMs : null,
      };
    });

    return result;
  }

  async getExerciseQuestionsProgress(userId: string, exerciseId: string) {
    if (!userId || !exerciseId) return [];

    const [questions, progressDocs] = await Promise.all([
      this.questionsModel.find({ exerciseId }).lean(),
      this.progressModel.find({ userId, exerciseId }).lean(),
    ]);

    const progressMap = new Map<string, any>();
    progressDocs.forEach((progress: any) => {
      progressMap.set(progress.questionId, progress);
    });

    return questions
      .map((question: any) => ({
        ...question,
        id: question._id || question.id,
        progress: progressMap.get(String(question._id || question.id)) ?? null,
      }))
      .sort((a: any, b: any) => {
        const orderA = a.order ?? 999;
        const orderB = b.order ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        const levelA = a.progress ? a.progress.level : -1;
        const levelB = b.progress ? b.progress.level : -1;
        return levelA - levelB;
      });
  }

  async getUserOverallStats(userId: string, startDate = '', endDate = '') {
    if (!userId) return { learned: 0, totalCorrect: 0, totalWrong: 0 };

    const progressDocs = await this.progressModel.find({ userId }).lean();
    const start = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : null;
    const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : null;

    let learned = 0;
    let totalCorrect = 0;
    let totalWrong = 0;

    progressDocs.forEach((progress: any) => {
      if (start || end) {
        const lastStudiedMs = getProgressTimeMillis(progress.lastStudied);
        if (lastStudiedMs === 0) return;
        if (start && lastStudiedMs < start) return;
        if (end && lastStudiedMs > end) return;
      }

      const variationsPassed = Array.isArray(progress.variationsPassed)
        ? progress.variationsPassed
        : [];
      if (variationsPassed.length >= 1) learned++;
      totalCorrect += Number(progress.passCount) || 0;
      totalWrong += Number(progress.failCount) || 0;
    });

    return { learned, totalCorrect, totalWrong };
  }
}
