import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import {
  SSTAssignments,
  SSTMailQueue,
  SSTNotifications,
  SSTUserGroups,
} from 'apps/common/src/database/mongodb/src/superstudy';
import { Accounts } from 'apps/common/src/database/mongodb/src/isms';

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectModel(SSTAssignments)
    private readonly assignmentsModel: ReturnModelType<typeof SSTAssignments>,
    @InjectModel(SSTUserGroups)
    private readonly groupsModel: ReturnModelType<typeof SSTUserGroups>,
    @InjectModel(Accounts)
    private readonly accountsModel: ReturnModelType<typeof Accounts>,
    @InjectModel(SSTNotifications)
    private readonly notificationsModel: ReturnModelType<typeof SSTNotifications>,
    @InjectModel(SSTMailQueue)
    private readonly mailQueueModel: ReturnModelType<typeof SSTMailQueue>,
  ) {}

  private normalize<T extends Record<string, any>>(doc: T | null) {
    if (!doc) return doc;
    return { ...doc, id: doc._id ?? doc.id };
  }

  private normalizeEmail(value?: string | null) {
    return String(value ?? '').trim().toLowerCase();
  }

  private normalizeAccountStudent(account: any) {
    const uid = String(account?.accountId || account?._id || '').trim();
    if (!uid) return null;

    return {
      _id: uid,
      uid,
      id: uid,
      email: this.normalizeEmail(account?.email || account?.emailAddresses?.[0]),
      displayName:
        String(account?.displayName ?? '').trim()
        || [account?.firstName, account?.lastName].filter(Boolean).join(' ').trim()
        || this.normalizeEmail(account?.email || account?.emailAddresses?.[0])
        || uid,
      role: account?.role === 'student' ? 'user' : account?.role,
      deleted: Boolean(account?.deleted),
    };
  }

  private normalizeLegacyStudent(student: any) {
    const uid = String(student?._id || student?.uid || '').trim();
    if (!uid) return null;

    return {
      ...student,
      _id: uid,
      uid,
      id: uid,
      email: this.normalizeEmail(student?.email),
      deleted: Boolean(student?.deleted),
    };
  }

  private async getStudentsForGroup(groupId: string) {
    const accountStudents = await this.accountsModel
      .find({ groupIds: groupId, role: 'student', deleted: { $ne: true } })
      .lean();

    return accountStudents
      .map((accountStudent) => this.normalizeAccountStudent(accountStudent))
      .filter(Boolean)
      .map((student) => ({ ...student }));
  }

  private buildMergedStudents(accountStudents: any[]) {
    const merged = new Map<string, any>();
    for (const accountStudent of accountStudents) {
      const normalized = this.normalizeAccountStudent(accountStudent);
      if (!normalized?.uid) continue;
      merged.set(normalized.uid, normalized);
    }
    return Array.from(merged.values());
  }

  private buildAssignmentEmailHtml(topicName: string, dueDateStr: string) {
    return `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
        <p>Chao ban,</p>
        <p>Thay/co vua giao cho ban bai luyen moi.</p>
        <div style="padding:16px;border:1px solid #c7d2fe;border-radius:12px;background:#f8fafc">
          <strong style="font-size:16px">${topicName}</strong>
          ${dueDateStr ? `<div style="margin-top:8px;color:#dc2626">Han: ${dueDateStr}</div>` : ''}
        </div>
        <p style="margin-top:16px">Hay vao SuperStudy de hoan thanh bai dung han.</p>
      </div>
    `.trim();
  }

  private async runCreateSideEffects(assignment: Record<string, any>) {
    if (assignment.groupId && assignment.topicId && !assignment.isGrammar) {
      await this.groupsModel.findByIdAndUpdate(
        assignment.groupId,
        { $addToSet: { topicAccess: assignment.topicId } },
        { new: true },
      );
    }

    const scheduledStartDate = assignment.scheduledStart ? new Date(assignment.scheduledStart) : null;
    const shouldNotifyNow = !scheduledStartDate || scheduledStartDate <= new Date();

    if (!assignment.groupId || !shouldNotifyNow) {
      return;
    }

    const students = await this.getStudentsForGroup(assignment.groupId);

    if (students.length === 0) {
      return;
    }

    const topicName = assignment.topicName || 'bai luyen moi';
    const dueDateStr = assignment.dueDate
      ? new Date(assignment.dueDate).toLocaleString('vi-VN')
      : '';

    await this.notificationsModel.insertMany(
      students.map((student) => ({
        type: 'assignment_new',
        title: 'Bai luyen moi',
        message: `Ban co bai luyen moi: "${topicName}".${dueDateStr ? ` Han: ${dueDateStr}` : ''}`,
        link: '/dashboard?tab=assignments',
        userId: student['uid'] || student._id,
        isRead: false,
      })),
    );

    const mailDocs = students
      .filter((student) => student.email)
      .map((student) => ({
        to: student.email,
        subject: `Bai luyen moi: ${topicName}`,
        html: this.buildAssignmentEmailHtml(topicName, dueDateStr),
        status: 'pending',
      }));

    if (mailDocs.length > 0) {
      await this.mailQueueModel.insertMany(mailDocs);
    }
  }

  async findAll(filters: { groupId?: string; topicId?: string; isGrammar?: boolean }) {
    const query: Record<string, any> = { isDeleted: { $ne: true } };
    if (filters.groupId) query.groupId = filters.groupId;
    if (filters.topicId) query.topicId = filters.topicId;
    if (filters.isGrammar !== undefined) query.isGrammar = filters.isGrammar;

    const assignments = await this.assignmentsModel.find(query).lean();
    return assignments.sort((a, b) => {
      const tA = a['createdAt'] ? new Date(a['createdAt']).getTime() : 0;
      const tB = b['createdAt'] ? new Date(b['createdAt']).getTime() : 0;
      return tB - tA;
    }).map((assignment) => this.normalize(assignment));
  }

  async findOne(id: string) {
    const a = await this.assignmentsModel.findById(id).lean();
    if (!a) throw new NotFoundException(`Assignment ${id} not found`);
    return this.normalize(a);
  }

  async create(data: Record<string, any>) {
    // Handle legacy Firestore timestamp format if sent by frontend
    if (data.dueDate && typeof data.dueDate === 'object' && data.dueDate.seconds) {
      data.dueDate = new Date(data.dueDate.seconds * 1000);
    }
    if (data.scheduledStart && typeof data.scheduledStart === 'object' && data.scheduledStart.seconds) {
      data.scheduledStart = new Date(data.scheduledStart.seconds * 1000);
    }

    const assignment = await this.assignmentsModel.create({ ...data, isDeleted: false });
    const normalized = this.normalize(assignment.toObject());
    await this.runCreateSideEffects(normalized);
    return normalized;
  }

  async update(id: string, data: Record<string, any>) {
    const updated = await this.assignmentsModel
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Assignment ${id} not found`);
    return this.normalize(updated);
  }

  async softDelete(id: string) {
    const updated = await this.assignmentsModel
      .findByIdAndUpdate(id, { $set: { isDeleted: true, deletedAt: new Date() } }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Assignment ${id} not found`);
    return this.normalize(updated);
  }

  async permanentDelete(id: string) {
    const result = await this.assignmentsModel.findByIdAndDelete(id).lean();
    if (!result) throw new NotFoundException(`Assignment ${id} not found`);
    return { deleted: true };
  }
}
