import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { SSTExams, SSTExamQuestions, SSTExamAssignments, SSTExamSubmissions } from 'apps/common/src/database/mongodb/src/superstudy';

@Injectable()
export class ExamsService {
  constructor(
    @InjectModel(SSTExams)
    private readonly examsModel: ReturnModelType<typeof SSTExams>,
    @InjectModel(SSTExamQuestions)
    private readonly questionsModel: ReturnModelType<typeof SSTExamQuestions>,
    @InjectModel(SSTExamAssignments)
    private readonly assignmentsModel: ReturnModelType<typeof SSTExamAssignments>,
    @InjectModel(SSTExamSubmissions)
    private readonly submissionsModel: ReturnModelType<typeof SSTExamSubmissions>,
  ) {}

  /**
   * List all non-deleted exams — mirrors examService.getExams
   */
  async findAll(createdByRole?: string) {
    const query: Record<string, any> = { isDeleted: { $ne: true } };
    if (createdByRole) query.createdByRole = createdByRole;
    const exams = await this.examsModel.find(query).lean();
    return exams.sort((a, b) => {
      const tA = a['createdAt'] ? new Date(a['createdAt']).getTime() : 0;
      const tB = b['createdAt'] ? new Date(b['createdAt']).getTime() : 0;
      return tB - tA; // newest first
    });
  }

  async findOne(id: string) {
    const exam = await this.examsModel.findById(id).lean();
    if (!exam) throw new NotFoundException(`Exam ${id} not found`);
    return exam;
  }

  /**
   * List public + teacherVisible + explicitly shared exams
   * Mirrors examService.getSharedExams
   */
  async findShared(examAccessIds: string[] = []) {
    const conditions: Record<string, any>[] = [
      { isPublic: true },
      { teacherVisible: true },
    ];
    if (examAccessIds.length > 0) {
      conditions.push({ _id: { $in: examAccessIds } });
    }
    const exams = await this.examsModel.find({ $or: conditions }).lean();
    // Deduplicate by _id
    const seen = new Set<string>();
    const unique = exams.filter((e) => {
      const id = String(e._id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    return unique.sort((a, b) => {
      const tA = a['createdAt'] ? new Date(a['createdAt']).getTime() : 0;
      const tB = b['createdAt'] ? new Date(b['createdAt']).getTime() : 0;
      return tB - tA;
    });
  }

  /**
   * List soft-deleted exams — mirrors examService.getDeletedExams
   */
  async findDeleted() {
    const exams = await this.examsModel.find({ isDeleted: true }).lean();
    return exams.sort((a, b) => {
      const tA = a.deletedAt ? new Date(a['deletedAt']).getTime() : 0;
      const tB = b.deletedAt ? new Date(b['deletedAt']).getTime() : 0;
      return tB - tA;
    });
  }

  async create(data: Record<string, any>) {
    const exam = await this.examsModel.create({
      ...data,
      isDeleted: false,
      cachedQuestionCount: 0,
      cachedQuestionTimeTotalSeconds: 0,
      cachedQuestionTimeMissingCount: 0,
    });
    return exam.toObject();
  }

  async update(id: string, data: Record<string, any>) {
    const updated = await this.examsModel
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Exam ${id} not found`);
    return updated;
  }

  /**
   * Soft-delete — mirrors examService.deleteExam
   */
  async softDelete(id: string) {
    const updated = await this.examsModel
      .findByIdAndUpdate(
        id,
        { $set: { isDeleted: true, deletedAt: new Date() } },
        { new: true },
      )
      .lean();
    if (!updated) throw new NotFoundException(`Exam ${id} not found`);
    return updated;
  }

  /**
   * Restore soft-deleted exam — mirrors examService.restoreExam
   */
  async restore(id: string) {
    const updated = await this.examsModel
      .findByIdAndUpdate(
        id,
        { $set: { isDeleted: false }, $unset: { deletedAt: '' } },
        { new: true },
      )
      .lean();
    if (!updated) throw new NotFoundException(`Exam ${id} not found`);
    return updated;
  }

  /**
   * Permanently delete exam with all its questions, assignments, and submissions
   * Mirrors examService.permanentlyDeleteExam
   */
  async permanentDelete(id: string) {
    // 1. Delete all questions
    await this.questionsModel.deleteMany({ examId: id });

    // 2. Delete all assignments (soft or not)
    await this.assignmentsModel.deleteMany({ examId: id });

    // 3. Delete all submissions
    await this.submissionsModel.deleteMany({ examId: id });

    // 4. Delete the exam itself
    await this.examsModel.findByIdAndDelete(id);

    return { deleted: true, examId: id };
  }

  /**
   * Recalculate and cache question stats back onto the exam document
   * Mirrors examService.recalcExamQuestionCache
   */
  async recalcQuestionCache(examId: string) {
    const exam = await this.findOne(examId);
    const validSectionIds = new Set<string>(
      ((exam.sections as any[]) || []).map((s: any) => s.id).filter(Boolean),
    );

    const questions = await this.questionsModel.find({ examId }).lean();

    let totalSeconds = 0;
    let missingCount = 0;
    let validCount = 0;

    for (const q of questions) {
      // Skip orphan questions from removed sections
      if (q.sectionId && validSectionIds.size > 0 && !validSectionIds.has(q.sectionId)) continue;
      if (!q.sectionId && validSectionIds.size > 0) continue;

      validCount++;
      if (q.timeLimitSeconds && q.timeLimitSeconds >= 5) {
        totalSeconds += q.timeLimitSeconds;
      } else {
        missingCount++;
      }
    }

    return this.update(examId, {
      cachedQuestionCount: validCount,
      cachedQuestionTimeTotalSeconds: totalSeconds,
      cachedQuestionTimeMissingCount: missingCount,
    });
  }
}
