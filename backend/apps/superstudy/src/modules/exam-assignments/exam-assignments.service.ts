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
   * List non-deleted assignments filtered by examId, groupId, targetType+targetId, or studentId
   * Mirrors examService.getExamAssignmentsForGroup / getExamAssignmentsForStudent
   */
  async findAll(filters: {
    examId?: string;
    groupId?: string;
    targetType?: string;
    targetId?: string;
    studentId?: string;
  }) {
    const query: Record<string, any> = { isDeleted: { $ne: true } };

    if (filters.examId) query.examId = filters.examId;
    // Support both legacy ?groupId=X (mapped to targetId + group) and new ?targetType+targetId
    if (filters.targetType && filters.targetId) {
      query.targetType = filters.targetType;
      query.targetId = filters.targetId;
    } else if (filters.groupId) {
      query.targetType = 'group';
      query.targetId = filters.groupId;
    }
    if (filters.studentId) {
      // Individual assignments for this student
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
   * Fetch assignments for a student across all their groups + individual assignments.
   * Mirrors examService.getExamAssignmentsForStudent
   */
  async findForStudent(studentId: string, groupIds: string[]) {
    const orClauses: Record<string, any>[] = [
      { targetType: 'individual', targetId: studentId },
    ];
    if (groupIds.length > 0) {
      orClauses.push({ targetType: 'group', targetId: { $in: groupIds } });
    }

    const assignments = await this.assignmentsModel
      .find({ isDeleted: { $ne: true }, $or: orClauses })
      .lean();

    // Filter by assignedStudentIds if the list is non-empty
    return assignments
      .filter((a) => {
        const ids: string[] = (a as any).assignedStudentIds;
        if (ids && Array.isArray(ids) && ids.length > 0) {
          return ids.includes(studentId);
        }
        return true;
      })
      .sort((a, b) => {
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
    // Handle legacy Firestore timestamp format if sent by frontend
    if (data.dueDate && typeof data.dueDate === 'object' && data.dueDate.seconds) {
      data.dueDate = new Date(data.dueDate.seconds * 1000);
    }
    if (data.scheduledStart && typeof data.scheduledStart === 'object' && data.scheduledStart.seconds) {
      data.scheduledStart = new Date(data.scheduledStart.seconds * 1000);
    }

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

  /**
   * Generic update — allows patching any fields including studentDeadlines.
   * Mirrors examService.updateExamAssignmentStudentDeadline / removeExamAssignmentStudentDeadline
   * If a field value is explicitly null, it is treated as an $unset operation.
   */
  async update(id: string, data: Record<string, any>) {
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

    const updated = await this.assignmentsModel
      .findByIdAndUpdate(id, updateOp, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Assignment ${id} not found`);
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
