import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { SSTTeacherRatings, SSTTeacherRatingSummaries } from 'apps/common/src/database/mongodb/src/superstudy';

@Injectable()
export class TeacherRatingsService {
  constructor(
    @InjectModel(SSTTeacherRatings)
    private readonly model: ReturnModelType<typeof SSTTeacherRatings>,
    @InjectModel(SSTTeacherRatingSummaries)
    private readonly summariesModel: ReturnModelType<typeof SSTTeacherRatingSummaries>,
  ) {}

  async findAll(filters: Record<string, any> = {}) {
    const query: Record<string, any> = {};
    for (const [key, val] of Object.entries(filters)) {
      if (val !== undefined && val !== null && val !== '') query[key] = val;
    }
    const docs = await this.model.find(query).sort({ createdAt: -1 }).lean();
    return docs.map(d => ({ id: d._id, ...d }));
  }

  async findById(id: string) {
    const doc = await this.model.findById(id).lean();
    if (!doc) throw new NotFoundException('Not found');
    return { id: doc._id, ...doc };
  }

  async create(body: Record<string, any>) {
    const doc = await this.model.create(body);
    return { id: doc._id, ...doc.toObject() };
  }

  async update(id: string, body: Record<string, any>) {
    const setFields: Record<string, any> = {};
    const unsetFields: Record<string, any> = {};
    for (const [key, val] of Object.entries(body)) {
      if (val === null) unsetFields[key] = '';
      else setFields[key] = val;
    }
    const update: Record<string, any> = {};
    if (Object.keys(setFields).length) update['$set'] = setFields;
    if (Object.keys(unsetFields).length) update['$unset'] = unsetFields;
    const doc = await this.model.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!doc) throw new NotFoundException('Not found');
    return { id: doc._id, ...doc };
  }

  async remove(id: string) {
    const doc = await this.model.findByIdAndDelete(id).lean();
    if (!doc) throw new NotFoundException('Not found');
    return { success: true };
  }

  async getRatingSummary(periodId: string, teacherId: string) {
    if (!periodId || !teacherId) throw new BadRequestException('periodId and teacherId are required');
    const doc = await this.summariesModel.findOne({ periodId, teacherId }).lean();
    if (!doc) return null;
    return { id: doc._id, ...doc };
  }

  async getAllSummariesForPeriod(periodId: string) {
    if (!periodId) throw new BadRequestException('periodId is required');
    const docs = await this.summariesModel.find({ periodId }).lean();
    return docs.map(d => ({ id: d._id, ...d }));
  }
}
