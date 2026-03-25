import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import {
  SSTExamAssignments,
  SSTExamSubmissions,
} from 'apps/common/src/database/mongodb/src/superstudy';

@Injectable()
export class ExamAssignmentsService {
  constructor(
    @InjectModel(SSTExamAssignments)
    private readonly assignmentsModel: ReturnModelType<typeof SSTExamAssignments>,
    @InjectModel(SSTExamSubmissions)
    private readonly submissionsModel: ReturnModelType<typeof SSTExamSubmissions>,
  ) {}

  /**
   * List non-deleted assignments filtered by examId, groupId, or studentId
   * For studentId, returns group assignments where student is in group + individual assignments
   * Mirrors examService.getExamAssignmentsForGroup / getExamAssignmentsForStudent
   */
  async findAll(filters: { examId?: string; groupId?: string; studentId?: string }) {
    const query: Record<string, any> = { isDeleted: { $ne: true } };

    if (filters.examId) query.examId = filters.examId;
    if (filters.groupId) query.groupId = filters.groupId;
    if (filters.studentId) {
      // Assignments for an individual student: either targetId = studentId OR they appear in assignedStudentIds
      query.$or = [
        { targetId: filters.studentId, targetType: 'individual' },
        { assignedStudentIds: filters.studentId },
      ];
    }

    const assignments = await this.assignmentsModel.find(query).lean();
    return assignments.sort((a, b) => {
      const tA = a['createdAt'] ? new Date(a['createdAt']).getTime() : 0;
      const tB = b['createdAt'] ? new Date(b['createdAt']).getTime() : 0;
      return tB - tA;
    });
  }

  /**
   * List soft-deleted assignments — mirrors examService.getDeletedExamAssignments
   */
  async findDeleted(groupId?: string) {
    const query: Record<string, any> = { isDeleted: true };
    if (groupId) query.groupId = groupId;
    const list = await this.assignmentsModel.find(query).lean();
    return list.sort((a, b) => {
      const tA = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
      const tB = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
      return tB - tA;
    });
  }

  async findOne(id: string) {
    const a = await this.assignmentsModel.findById(id).lean();
    if (!a) throw new NotFoundException(`Assignment ${id} not found`);
    return a;
  }

  /**
   * Create assignment — mirrors examService.createExamAssignment
   * Business logic:
   * 1. Auto-set variationSeed if not provided
   * 2. Persist document
   * (Notification creation should be handled by a NotificationsService invoked from the caller/controller layer)
   */
  async create(data: Record<string, any>) {
    const assignment = await this.assignmentsModel.create({
      ...data,
      isDeleted: false,
      variationSeed: data.variationSeed ?? Math.floor(Math.random() * 100000),
    });
    return assignment.toObject();
  }

  /**
   * Update due date — mirrors examService.updateExamAssignmentDueDate
   */
  async updateDueDate(id: string, dueDate: Date, _notify = false) {
    const updated = await this.assignmentsModel
      .findByIdAndUpdate(id, { $set: { dueDate } }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Assignment ${id} not found`);
    // Notification for deadline extension is handled by caller
    return updated;
  }

  async softDelete(id: string) {
    const updated = await this.assignmentsModel
      .findByIdAndUpdate(
        id,
        { $set: { isDeleted: true, deletedAt: new Date() } },
        { new: true },
      )
      .lean();
    if (!updated) throw new NotFoundException(`Assignment ${id} not found`);
    return updated;
  }

  async restore(id: string) {
    const updated = await this.assignmentsModel
      .findByIdAndUpdate(
        id,
        { $set: { isDeleted: false }, $unset: { deletedAt: '' } },
        { new: true },
      )
      .lean();
    if (!updated) throw new NotFoundException(`Assignment ${id} not found`);
    return updated;
  }

  /**
   * Permanently delete assignment and all linked submissions
   * Mirrors examService.permanentlyDeleteExamAssignment
   */
  async permanentDelete(id: string) {
    await this.submissionsModel.deleteMany({ assignmentId: id });
    await this.assignmentsModel.findByIdAndDelete(id);
    return { deleted: true, assignmentId: id };
  }
}
