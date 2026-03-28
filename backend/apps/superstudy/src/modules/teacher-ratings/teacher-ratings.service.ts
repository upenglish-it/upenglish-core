import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { SSTTeacherRatingSummaries } from 'apps/common/src/database/mongodb/src/superstudy';

@Injectable()
export class TeacherRatingsService {
  constructor(
    @InjectModel(SSTTeacherRatingSummaries)
    private readonly summariesModel: ReturnModelType<typeof SSTTeacherRatingSummaries>,
  ) {}

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
