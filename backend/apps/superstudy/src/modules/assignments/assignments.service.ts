import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { SSTAssignments } from 'apps/common/src/database/mongodb/src/superstudy';

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectModel(SSTAssignments)
    private readonly assignmentsModel: ReturnModelType<typeof SSTAssignments>,
  ) {}

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
    });
  }

  async findOne(id: string) {
    const a = await this.assignmentsModel.findById(id).lean();
    if (!a) throw new NotFoundException(`Assignment ${id} not found`);
    return a;
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
    return assignment.toObject();
  }

  async update(id: string, data: Record<string, any>) {
    const updated = await this.assignmentsModel
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Assignment ${id} not found`);
    return updated;
  }

  async softDelete(id: string) {
    const updated = await this.assignmentsModel
      .findByIdAndUpdate(id, { $set: { isDeleted: true, deletedAt: new Date() } }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Assignment ${id} not found`);
    return updated;
  }

  async permanentDelete(id: string) {
    const result = await this.assignmentsModel.findByIdAndDelete(id).lean();
    if (!result) throw new NotFoundException(`Assignment ${id} not found`);
    return { deleted: true };
  }
}
