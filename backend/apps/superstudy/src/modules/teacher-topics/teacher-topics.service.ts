import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { SSTTeacherTopics } from 'apps/common/src/database/mongodb/src/superstudy';

@Injectable()
export class TeacherTopicsService {
  private countWords(words: unknown) {
    return Array.isArray(words) ? words.length : 0;
  }

  constructor(
    @InjectModel(SSTTeacherTopics)
    private readonly teacherTopicsModel: ReturnModelType<typeof SSTTeacherTopics>,
  ) {}

  async findAll(teacherId?: string) {
    const query: any = { isDeleted: { $ne: true } };
    if (teacherId) query.teacherId = teacherId;
    
    const topics = await this.teacherTopicsModel
      .find(query)
      .lean();
    return topics.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  async getSharedAndPublic(topicAccessIds: string[]) {
    const query = {
      isDeleted: { $ne: true },
      $or: [
        { isPublic: true },
        { _id: { $in: topicAccessIds } }
      ]
    };
    const topics = await this.teacherTopicsModel.find(query).lean();
    return topics;
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
    console.log(data);
    const payload: Record<string, any> = {
      ...data,
      isDeleted: false,
      cachedWordCount: this.countWords(data.words),
    };
    if (data.id) payload._id = data.id;
    else if (data._id) payload._id = data._id;

    const topic = await this.teacherTopicsModel.create(payload);
    console.log(topic);
    return topic.toObject();
  }

  async update(id: string, data: Record<string, any>) {
    const current = (await this.teacherTopicsModel.findById(id).lean()) as Record<string, any> | null;
    if (!current) throw new NotFoundException(`Teacher topic ${id} not found`);

    const payload: Record<string, any> = { ...data };
    let nextWords = Array.isArray(current.words) ? [...current.words] : [];

    if (Array.isArray(payload.words)) {
      nextWords = payload.words;
      payload.cachedWordCount = this.countWords(nextWords);
    }

    if (payload._upsertWord) {
      const nextWord = payload._upsertWord;
      const nextWordKey = String(nextWord.word || '').trim().toLowerCase();
      nextWords = nextWords.filter(
        (word) => String(word?.word || '').trim().toLowerCase() !== nextWordKey,
      );
      nextWords.push(nextWord);
      payload.words = nextWords;
      payload.cachedWordCount = this.countWords(nextWords);
      delete payload._upsertWord;
    }

    if (payload._deleteWord) {
      const wordToDelete = String(payload._deleteWord || '').trim().toLowerCase();
      nextWords = nextWords.filter(
        (word) => String(word?.word || '').trim().toLowerCase() !== wordToDelete,
      );
      payload.words = nextWords;
      payload.cachedWordCount = this.countWords(nextWords);
      delete payload._deleteWord;
    }

    if (payload._recalcWordCount) {
      payload.cachedWordCount = this.countWords(payload.words ?? nextWords);
      delete payload._recalcWordCount;
    }

    const updated = await this.teacherTopicsModel
      .findByIdAndUpdate(id, { $set: payload }, { new: true })
      .lean();
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
