import { Injectable } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { SSTWordProgress } from 'apps/common/src/database/mongodb/src/superstudy';

/**
 * Mastery threshold: a word is considered "mastered" at this score
 */
const MASTERY_THRESHOLD = 80;

@Injectable()
export class WordProgressService {
  constructor(
    @InjectModel(SSTWordProgress)
    private readonly progressModel: ReturnModelType<typeof SSTWordProgress>,
  ) {}

  /**
   * List all word progress records for a user, optionally filtered by topicId.
   * Replaces querying the Firestore sub-collection users/{uid}/word_progress
   */
  async findAll(userId: string, topicId?: string) {
    const query: Record<string, any> = { userId };
    if (topicId) query.topicId = topicId;
    return this.progressModel.find(query).lean();
  }

  /**
   * Get progress for a specific word (userId + topicId + wordId = unique key)
   */
  async findOne(userId: string, topicId: string, wordId: string) {
    return this.progressModel.findOne({ userId, topicId, wordId }).lean();
  }

  /**
   * Get a mastery summary for a topic.
   * Returns { total, mastered, masteredIds[] }
   */
  async getTopicSummary(userId: string, topicId: string) {
    const records = await this.progressModel.find({ userId, topicId }).lean();
    const mastered = records.filter(r => r.isMastered);
    return {
      total: records.length,
      mastered: mastered.length,
      masteredIds: mastered.map(r => r.wordId),
    };
  }

  /**
   * Upsert (create or update) a word progress record.
   * Uses userId + topicId + wordId as the unique compound key.
   */
  async upsert(data: { userId: string; topicId: string; wordId: string; [key: string]: any }) {
    const { userId, topicId, wordId, ...rest } = data;
    return this.progressModel.findOneAndUpdate(
      { userId, topicId, wordId },
      {
        $set: rest,
        $setOnInsert: { userId, topicId, wordId },
      },
      { upsert: true, new: true },
    ).lean();
  }

  /**
   * Record the result of a game session for a word.
   * Updates per-game score + recalculates overall masteryScore + isMastered.
   * 
   * masteryScore = average of all recorded game scores (equally weighted)
   * correctStreak increments on correct, resets on wrong.
   * 
   * Mirrors the progression logic implied by userService.js + word_progress sub-collection usage.
   */
  async recordGameResult(params: {
    userId: string;
    topicId: string;
    wordId: string;
    gameType: string;
    score: number;
    isCorrect: boolean;
  }) {
    const { userId, topicId, wordId, gameType, score, isCorrect } = params;

    // Load existing record (or create baseline)
    let record = await this.progressModel.findOne({ userId, topicId, wordId }).lean();

    const existingGameScores: Record<string, number> = (record?.gameScores as Record<string, number>) ?? {};
    const updatedGameScores = { ...existingGameScores, [gameType]: score };

    // Compute new masteryScore = average of all game scores (capped 0-100)
    const gameScoreValues = Object.values(updatedGameScores);
    const masteryScore = gameScoreValues.length > 0
      ? Math.round(gameScoreValues.reduce((a, b) => a + b, 0) / gameScoreValues.length)
      : 0;

    const isMastered = masteryScore >= MASTERY_THRESHOLD;
    const currentStreak = record?.correctStreak ?? 0;
    const newStreak = isCorrect ? currentStreak + 1 : 0;
    const practiceCount = (record?.practiceCount ?? 0) + 1;

    // Compute next review time using spaced repetition (simple exponential back-off)
    const intervalDays = isCorrect ? Math.min(2 ** newStreak, 64) : 1;
    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + intervalDays);

    const update = {
      gameScores: updatedGameScores,
      masteryScore,
      isMastered,
      correctStreak: newStreak,
      practiceCount,
      lastPracticedAt: new Date(),
      nextReviewAt,
    };

    return this.progressModel.findOneAndUpdate(
      { userId, topicId, wordId },
      { $set: update, $setOnInsert: { userId, topicId, wordId } },
      { upsert: true, new: true },
    ).lean();
  }

  /**
   * Update pronunciation score for a word (from AI pronunciation evaluation)
   */
  async updatePronunciationScore(params: {
    userId: string;
    topicId: string;
    wordId: string;
    pronunciationScore: number;
  }) {
    const { userId, topicId, wordId, pronunciationScore } = params;
    return this.progressModel.findOneAndUpdate(
      { userId, topicId, wordId },
      { $set: { pronunciationScore }, $setOnInsert: { userId, topicId, wordId } },
      { upsert: true, new: true },
    ).lean();
  }

  /**
   * Reset all word progress records for a user's topic.
   * Used when "restart practice" is triggered.
   */
  async resetTopicProgress(userId: string, topicId: string) {
    const result = await this.progressModel.deleteMany({ userId, topicId });
    return { deleted: result.deletedCount };
  }

  // ──────────────────────────────────────────
  // Streak logic — migrated from userService.js
  // userService uses Firestore sub-collection users/{uid}/stats/overview
  // We store equivalent data on a dedicated SSTWordProgress aggregate query OR
  // we use a lightweight separate document with userId = userId, topicId = '__streak__', wordId = 'overview'
  // ──────────────────────────────────────────

  /**
   * Get and update user streak.
   * Migrated from userService.getAndUpdateUserStreak.
   * Rules:
   *   - Same day → no change
   *   - Previous day → streak + 1
   *   - Older / missing → reset to 1
   * 
   * Uses a virtual progress record: { userId, topicId: '__streak__', wordId: 'overview' }
   */
  async getAndUpdateStreak(userId: string): Promise<{ currentStreak: number; lastActiveDate: string }> {
    const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

    const streakDoc = await this.progressModel.findOne({
      userId,
      topicId: '__streak__',
      wordId: 'overview',
    }).lean();

    let currentStreak: number = streakDoc?.practiceCount ?? 0; // practiceCount stores streak
    const lastActiveDate: string = (streakDoc?.gameScores as any)?.lastActiveDate ?? null;

    if (lastActiveDate === todayStr) {
      return { currentStreak: currentStreak || 1, lastActiveDate };
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('en-CA');
    const newStreak = lastActiveDate === yesterdayStr ? currentStreak + 1 : 1;

    await this.progressModel.findOneAndUpdate(
      { userId, topicId: '__streak__', wordId: 'overview' },
      {
        $set: {
          practiceCount: newStreak,
          gameScores: { lastActiveDate: todayStr },
          lastPracticedAt: new Date(),
        },
        $setOnInsert: { userId, topicId: '__streak__', wordId: 'overview' },
      },
      { upsert: true },
    );

    return { currentStreak: newStreak, lastActiveDate: todayStr };
  }

  /**
   * Get streak data for multiple users (for teacher dashboard)
   * Mirrors userService.getStudentsStreakData
   */
  async getStudentsStreakData(userIds: string[]): Promise<Record<string, { currentStreak: number; lastActiveDate: string | null }>> {
    if (!userIds?.length) return {};

    const docs = await this.progressModel.find({
      userId: { $in: userIds },
      topicId: '__streak__',
      wordId: 'overview',
    }).lean();

    const results: Record<string, { currentStreak: number; lastActiveDate: string | null }> = {};

    for (const uid of userIds) {
      const doc = docs.find(d => d.userId === uid);
      results[uid] = {
        currentStreak: doc?.practiceCount ?? 0,
        lastActiveDate: (doc?.gameScores as any)?.lastActiveDate ?? null,
      };
    }

    return results;
  }
}
