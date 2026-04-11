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

  /**
   * Lookup a single submission by assignmentId + studentId.
   * Mirrors examService.getExamSubmission — picks the most-complete submission
   * if multiple exist (shouldn't normally happen, but guards against duplicates).
   */
  async lookup(assignmentId: string, studentId: string) {
    const subs = await this.submissionsModel
      .find({ assignmentId, studentId })
      .lean();
    if (!subs || subs.length === 0) return null;
    // Prefer submitted/graded over in-progress (schema statuses: in_progress | submitted | graded)
    const finished = subs.find(
      (s) => s.status === 'submitted' || s.status === 'graded',
    );
    if (finished) return finished;
    const hasScore = subs.find(
      (s) => s['totalScore'] !== undefined && s['totalScore'] !== null,
    );
    return hasScore ?? subs[0];
  }

  /**
   * Find submissions for multiple assignments (bulk).
   * Mirrors examService.getExamSubmissionsForAssignments
   */
  async findByAssignments(assignmentIds: string[]) {
    if (!assignmentIds.length) return [];
    return this.submissionsModel.find({ assignmentId: { $in: assignmentIds } }).lean();
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

    // Separate null values into $unset (mimics Firestore deleteField())
    const setFields: Record<string, any> = {};
    const unsetFields: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === null) {
        unsetFields[key] = '';
      } else {
        setFields[key] = value;
      }
    }

    const updateOp: Record<string, any> = {};
    if (Object.keys(setFields).length > 0) updateOp.$set = setFields;
    if (Object.keys(unsetFields).length > 0) updateOp.$unset = unsetFields;

    const updated = await this.submissionsModel
      .findByIdAndUpdate(id, updateOp, { new: true })
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

  /**
   * Hard-delete a submission — mirrors examService.deleteExamSubmission
   * Note: The frontend also cleans up Firebase Storage audio files separately.
   */
  async remove(id: string) {
    const result = await this.submissionsModel.findByIdAndDelete(id).lean();
    if (!result) throw new NotFoundException(`Submission ${id} not found`);
    return { deleted: true };
  }
}
