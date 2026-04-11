import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { SSTGrammarSubmissions } from 'apps/common/src/database/mongodb/src/superstudy';

@Injectable()
export class GrammarSubmissionsService {
  constructor(
    @InjectModel(SSTGrammarSubmissions)
    private readonly submissionsModel: ReturnModelType<typeof SSTGrammarSubmissions>,
  ) {}

  async findAll(filters: { assignmentId?: string; studentId?: string }) {
    const query: Record<string, any> = {};
    if (filters.assignmentId) query.assignmentId = filters.assignmentId;
    if (filters.studentId) query.studentId = filters.studentId;

    const submissions = await this.submissionsModel.find(query).lean();
    return submissions.sort((a: any, b: any) => {
      const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : new Date(a.createdAt || 0).getTime();
      const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : new Date(b.createdAt || 0).getTime();
      return tB - tA;
    });
  }

  async lookup(assignmentId: string, studentId: string) {
    const submissions = await this.submissionsModel.find({ assignmentId, studentId }).lean();
    if (!submissions.length) return null;
    return submissions.sort((a: any, b: any) => {
      const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : new Date(a.createdAt || 0).getTime();
      const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : new Date(b.createdAt || 0).getTime();
      return tB - tA;
    })[0];
  }

  async findOne(id: string) {
    const submission = await this.submissionsModel.findById(id).lean();
    if (!submission) throw new NotFoundException(`Grammar submission ${id} not found`);
    return submission;
  }

  async create(data: Record<string, any>) {
    const submission = await this.submissionsModel.create(data);
    return submission.toObject();
  }

  async update(id: string, data: Record<string, any>) {
    const setFields: Record<string, any> = {};
    const unsetFields: Record<string, any> = {};

    Object.entries(data).forEach(([key, value]) => {
      if (value === null) unsetFields[key] = '';
      else setFields[key] = value;
    });

    const updateOp: Record<string, any> = {};
    if (Object.keys(setFields).length > 0) updateOp.$set = setFields;
    if (Object.keys(unsetFields).length > 0) updateOp.$unset = unsetFields;

    const updated = await this.submissionsModel
      .findByIdAndUpdate(id, updateOp, { new: true })
      .lean();

    if (!updated) throw new NotFoundException(`Grammar submission ${id} not found`);
    return updated;
  }

  async remove(id: string) {
    const deleted = await this.submissionsModel.findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundException(`Grammar submission ${id} not found`);
    return { deleted: true };
  }
}
