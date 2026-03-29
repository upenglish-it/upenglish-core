import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { SSTTopics } from 'apps/common/src/database/mongodb/src/superstudy';

@Injectable()
export class TopicsService {
  constructor(
    @InjectModel(SSTTopics)
    private readonly topicsModel: ReturnModelType<typeof SSTTopics>,
  ) {}

  async findAll(folderId?: string) {
    const query: Record<string, any> = { isDeleted: { $ne: true } };
    if (folderId) query.folderId = folderId;
    const topics = await this.topicsModel.find(query).lean();
    return topics.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  async findOne(id: string) {
    const topic = await this.topicsModel.findById(id).lean();
    if (!topic) throw new NotFoundException(`Topic ${id} not found`);
    return topic;
  }

  /**
   * List topics accessible to a specific user
   * Includes: isPublic + individually shared + folder-level access
   * Mirrors adminService.getTopicsForStudent / getTopicsForTeacher
   */
  async findAccessible(topicIds: string[], folderIds: string[], teacherVisible = false) {
    const conditions: Record<string, any>[] = [{ isPublic: true }];
    if (teacherVisible) conditions.push({ teacherVisible: true });
    if (topicIds.length > 0) conditions.push({ _id: { $in: topicIds } });
    if (folderIds.length > 0) conditions.push({ folderId: { $in: folderIds } });

    const topics = await this.topicsModel.find({
      isDeleted: { $ne: true },
      $or: conditions,
    }).lean();

    const seen = new Set<string>();
    return topics.filter((t) => {
      const id = String(t._id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  async create(data: Record<string, any>) {
    const payload: Record<string, any> = { ...data, isDeleted: false, cachedWordCount: 0 };
    if (data.id) payload._id = data.id;
    else if (data._id) payload._id = data._id;

    const topic = await this.topicsModel.create(payload);
    return topic.toObject();
  }

  async update(id: string, data: Record<string, any>) {
    const updated = await this.topicsModel
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Topic ${id} not found`);
    return updated;
  }

  async softDelete(id: string) {
    const updated = await this.topicsModel
      .findByIdAndUpdate(id, { $set: { isDeleted: true, deletedAt: new Date() } }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Topic ${id} not found`);
    return updated;
  }

  async permanentDelete(id: string) {
    const result = await this.topicsModel.findByIdAndDelete(id).lean();
    if (!result) throw new NotFoundException(`Topic ${id} not found`);
    return { deleted: true };
  }
}
