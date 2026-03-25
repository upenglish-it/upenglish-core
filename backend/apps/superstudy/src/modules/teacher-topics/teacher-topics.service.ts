import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { SSTTeacherTopics } from 'apps/common/src/database/mongodb/src/superstudy';

@Injectable()
export class TeacherTopicsService {
  constructor(
    @InjectModel(SSTTeacherTopics)
    private readonly teacherTopicsModel: ReturnModelType<typeof SSTTeacherTopics>,
  ) {}

  async findAll(teacherId: string) {
    const topics = await this.teacherTopicsModel
      .find({ teacherId, isDeleted: { $ne: true } })
      .lean();
    return topics.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  async findDeleted(teacherId?: string) {
    const query: Record<string, any> = { isDeleted: true };
    if (teacherId) query.teacherId = teacherId;
    const topics = await this.teacherTopicsModel.find(query).lean();
    return topics.sort((a, b) => {
      const tA = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
      const tB = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
      return tB - tA;
    });
  }

  async findOne(id: string) {
    const topic = await this.teacherTopicsModel.findById(id).lean();
    if (!topic) throw new NotFoundException(`Teacher topic ${id} not found`);
    return topic;
  }

  async create(data: Record<string, any>) {
    const topic = await this.teacherTopicsModel.create({
      ...data,
      isDeleted: false,
      cachedWordCount: 0,
    });
    return topic.toObject();
  }

  async update(id: string, data: Record<string, any>) {
    const updated = await this.teacherTopicsModel
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Teacher topic ${id} not found`);
    return updated;
  }

  async softDelete(id: string) {
    const updated = await this.teacherTopicsModel
      .findByIdAndUpdate(id, { $set: { isDeleted: true, deletedAt: new Date() } }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Teacher topic ${id} not found`);
    return updated;
  }

  async restore(id: string) {
    const updated = await this.teacherTopicsModel
      .findByIdAndUpdate(id, { $set: { isDeleted: false }, $unset: { deletedAt: '' } }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Teacher topic ${id} not found`);
    return updated;
  }

  async permanentDelete(id: string) {
    const result = await this.teacherTopicsModel.findByIdAndDelete(id).lean();
    if (!result) throw new NotFoundException(`Teacher topic ${id} not found`);
    return { deleted: true };
  }
}
