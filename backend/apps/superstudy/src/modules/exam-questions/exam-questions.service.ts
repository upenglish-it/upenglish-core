import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { SSTExamQuestions, SSTExams } from 'apps/common/src/database/mongodb/src/superstudy';

@Injectable()
export class ExamQuestionsService {
  constructor(
    @InjectModel(SSTExamQuestions)
    private readonly questionsModel: ReturnModelType<typeof SSTExamQuestions>,
    @InjectModel(SSTExams)
    private readonly examsModel: ReturnModelType<typeof SSTExams>,
  ) {}

  /**
   * List questions for an exam, sorted by order
   * Mirrors examService.getExamQuestions / getExamQuestionsBySection
   */
  async findAll(examId: string, sectionId?: string) {
    const query: Record<string, any> = { examId };
    if (sectionId) query.sectionId = sectionId;
    const questions = await this.questionsModel.find(query).lean();
    return questions.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  async findOne(id: string) {
    const q = await this.questionsModel.findById(id).lean();
    if (!q) throw new NotFoundException(`Question ${id} not found`);
    return q;
  }

  /**
   * Returns count of questions per examId
   * Mirrors examService.getExamQuestionCounts
   */
  async getCounts(examIds: string[]) {
    const counts: Record<string, number> = {};
    await Promise.all(
      examIds.map(async (examId) => {
        counts[examId] = await this.questionsModel.countDocuments({ examId });
      }),
    );
    return counts;
  }

  /**
   * Create a new question — auto-sets order to current count for that section
   * Mirrors examService.saveExamQuestion (create branch)
   */
  async create(data: Record<string, any>) {
    const existingCount = await this.questionsModel.countDocuments({
      examId: data.examId,
      sectionId: data.sectionId,
    });

    const payload: Record<string, any> = { ...data, order: existingCount };
    if (data.id) payload._id = data.id;
    else if (data._id) payload._id = data._id;

    const question = await this.questionsModel.create(payload);

    // Fire-and-forget: recalc exam question cache
    this.recalcExamCache(data.examId).catch(() => {});

    return question.toObject();
  }

  async update(id: string, data: Record<string, any>) {
    const updated = await this.questionsModel
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Question ${id} not found`);

    // Fire-and-forget: recalc cache
    if (updated.examId) this.recalcExamCache(String(updated.examId)).catch(() => {});

    return updated;
  }

  /**
   * Hard delete question — mirrors examService.deleteExamQuestion
   */
  async remove(id: string) {
    const q = await this.questionsModel.findByIdAndDelete(id).lean();
    if (!q) throw new NotFoundException(`Question ${id} not found`);

    // Fire-and-forget: recalc cache
    if (q.examId) this.recalcExamCache(String(q.examId)).catch(() => {});

    return { deleted: true };
  }

  /**
   * Bulk reorder questions — mirrors examService.updateExamQuestionsOrder
   */
  async reorder(orderedItems: Array<{ id: string; order: number }>) {
    await Promise.all(
      orderedItems.map(({ id, order }) =>
        this.questionsModel.findByIdAndUpdate(id, { $set: { order } }),
      ),
    );
    return { reordered: orderedItems.length };
  }

  /**
   * Recalculate and cache question stats back on the exam document
   */
  private async recalcExamCache(examId: string) {
    const exam = await this.examsModel.findById(examId).lean();
    if (!exam) return;

    const validSectionIds = new Set<string>(
      ((exam.sections as any[]) || []).map((s: any) => s.id).filter(Boolean),
    );

    const questions = await this.questionsModel.find({ examId }).lean();

    let totalSeconds = 0;
    let missingCount = 0;
    let validCount = 0;

    for (const q of questions) {
      if (q.sectionId && validSectionIds.size > 0 && !validSectionIds.has(q.sectionId)) continue;
      if (!q.sectionId && validSectionIds.size > 0) continue;
      validCount++;
      if (q.timeLimitSeconds && q.timeLimitSeconds >= 5) {
        totalSeconds += q.timeLimitSeconds;
      } else {
        missingCount++;
      }
    }

    await this.examsModel.findByIdAndUpdate(examId, {
      $set: {
        cachedQuestionCount: validCount,
        cachedQuestionTimeTotalSeconds: totalSeconds,
        cachedQuestionTimeMissingCount: missingCount,
      },
    });
  }
}
