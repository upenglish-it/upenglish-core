import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { SSTExamSubmissions } from 'apps/common/src/database/mongodb/src/superstudy';

@Injectable()
export class ExamSubmissionsService {
  constructor(
    @InjectModel(SSTExamSubmissions)
    private readonly submissionsModel: ReturnModelType<typeof SSTExamSubmissions>,
  ) {}

  async findAll(filters: { assignmentId?: string; studentId?: string }) {
    const query: Record<string, any> = {};
    if (filters.assignmentId) query.assignmentId = filters.assignmentId;
    if (filters.studentId) query.studentId = filters.studentId;
    const submissions = await this.submissionsModel.find(query).lean();
    return submissions.sort((a, b) => {
      const tA = a['createdAt'] ? new Date(a['createdAt']).getTime() : 0;
      const tB = b['createdAt'] ? new Date(b['createdAt']).getTime() : 0;
      return tB - tA;
    });
  }

  async findOne(id: string) {
    const sub = await this.submissionsModel.findById(id).lean();
    if (!sub) throw new NotFoundException(`Submission ${id} not found`);
    return sub;
  }

  /**
   * Start exam — create a new submission document
   * Mirrors examService.startExam / createExamSubmission
   * Business rule: a student cannot start the same assignment twice if not allowMultipleAttempts
   */
  async create(data: Record<string, any>) {
    // Guard: existing in-progress/submitted submission for this student + assignment
    const existing = await this.submissionsModel.findOne({
      assignmentId: data.assignmentId,
      studentId: data.studentId,
      status: { $ne: 'graded' },
    });
    if (existing) {
      throw new ConflictException(
        `Student already has an active submission for assignment ${data.assignmentId}`,
      );
    }

    const submission = await this.submissionsModel.create({
      ...data,
      status: 'in_progress',
      startedAt: new Date(),
      answers: data.answers ?? {},
      variationMap: data.variationMap ?? {},
      questionTimers: data.questionTimers ?? {},
      results: {},
      followUpAnswers: {},
      followUpResults: {},
      resultsReleased: false,
      viewedByStudent: false,
      tabSwitchCount: 0,
    });
    return submission.toObject();
  }

  /**
   * Update submission — covers save-in-progress AND submit
   * Mirrors examService.updateExamSubmission / submitExamSubmission
   */
  async update(id: string, data: Record<string, any>) {
    // If status changes to 'submitted', stamp submittedAt
    if (data.status === 'submitted' && !data.submittedAt) {
      data.submittedAt = new Date();
    }
    const updated = await this.submissionsModel
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Submission ${id} not found`);
    return updated;
  }

  /**
   * Release results to student — mirrors examService.releaseExamResults
   */
  async releaseResults(id: string, releasedBy: string, releasedByName?: string) {
    const updated = await this.submissionsModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            resultsReleased: true,
            releasedAt: new Date(),
            releasedBy,
            releasedByName: releasedByName ?? null,
          },
        },
        { new: true },
      )
      .lean();
    if (!updated) throw new NotFoundException(`Submission ${id} not found`);
    return updated;
  }

  /**
   * Release follow-up results — mirrors examService.releaseFollowUpResults
   */
  async releaseFollowUpResults(id: string, releasedBy: string, releasedByName?: string) {
    const updated = await this.submissionsModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            followUpResultsReleased: true,
            followUpReleasedAt: new Date(),
            followUpReleasedBy: releasedBy,
            followUpReleasedByName: releasedByName ?? null,
          },
        },
        { new: true },
      )
      .lean();
    if (!updated) throw new NotFoundException(`Submission ${id} not found`);
    return updated;
  }

  /** Mark that student has viewed their released results */
  async markViewed(id: string) {
    return this.submissionsModel
      .findByIdAndUpdate(id, { $set: { viewedByStudent: true } }, { new: true })
      .lean();
  }

  async markFollowUpViewed(id: string) {
    return this.submissionsModel
      .findByIdAndUpdate(id, { $set: { followUpResultsViewedByStudent: true } }, { new: true })
      .lean();
  }
}
