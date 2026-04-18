import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { AWSS3Service, SSTTeacherTopics, SSTTopics } from 'apps/common';

@Injectable()
export class TopicsService {
  private normalizeOfficialStatus(status: unknown) {
    return status === 'coming_soon' || status == null || status === '' ? 'active' : status;
  }

  private normalizeTopic<T extends Record<string, any> | null>(topic: T): T {
    if (!topic) return topic;
    return {
      ...topic,
      status: this.normalizeOfficialStatus(topic.status),
    };
  }

  private countWords(words: unknown) {
    return Array.isArray(words) ? words.length : 0;
  }

  constructor(
    @InjectModel(SSTTopics)
    private readonly topicsModel: ReturnModelType<typeof SSTTopics>,
    @InjectModel(SSTTeacherTopics)
    private readonly teacherTopicsModel: ReturnModelType<typeof SSTTeacherTopics>,
    private readonly awsS3Service: AWSS3Service,
  ) {}

  async findAll(folderId?: string) {
    const query: Record<string, any> = { isDeleted: { $ne: true } };
    if (folderId) query.folderId = folderId;
    const topics = await this.topicsModel.find(query).lean();
    return topics
      .map((topic) => this.normalizeTopic(topic))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  async findDeleted() {
    const topics = await this.topicsModel.find({ isDeleted: true }).lean();
    return topics.map((topic) => this.normalizeTopic(topic)).sort((a, b) => {
      const tA = a['deletedAt'] ? new Date(a['deletedAt']).getTime() : 0;
      const tB = b['deletedAt'] ? new Date(b['deletedAt']).getTime() : 0;
      return tB - tA;
    });
  }

  async restore(id: string) {
    const updated = await this.topicsModel
      .findByIdAndUpdate(id, { $unset: { isDeleted: '', deletedAt: '' } }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Topic ${id} not found`);
    return this.normalizeTopic(updated);
  }

  async findOne(id: string) {
    const topic = await this.topicsModel.findById(id).lean();
    if (!topic) throw new NotFoundException(`Topic ${id} not found`);
    return this.normalizeTopic(topic);
  }

  async checkVocabImageUsed(url: string) {
    if (!url) return { used: false };
    const wordMatchQuery = {
      isDeleted: { $ne: true },
      words: {
        $elemMatch: {
          $or: [{ image: url }, { imageUrl: url }],
        },
      },
    };

    const [officialTopic, teacherTopic] = await Promise.all([
      this.topicsModel.findOne(wordMatchQuery).lean(),
      this.teacherTopicsModel.findOne(wordMatchQuery).lean(),
    ]);

    return { used: !!officialTopic || !!teacherTopic };
  }

  async uploadVocabImage(file?: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('file is required');
    }
    if (!String(file.mimetype || '').startsWith('image/')) {
      throw new BadRequestException('file must be an image');
    }

    const extension = String(file.mimetype || 'image/webp').split('/')[1] || 'webp';
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`;
    const uploaded = await this.awsS3Service.uploadPublicFile(
      file.buffer,
      file.mimetype,
      `${process.env.AWS_S3_UPLOADED_FILES}/vocab_images`,
      fileName,
    );
    const url = uploaded.data && 'cdn' in uploaded.data ? uploaded.data.cdn : '';

    return {
      url,
      fileName,
    };
  }

  async deleteVocabImage(url: string) {
    if (!url) {
      throw new BadRequestException('url is required');
    }

    const isManagedVocabImage =
      url.includes('/vocab_images/') ||
      url.includes('/uploaded/vocab_images/');

    if (!isManagedVocabImage) {
      return { deleted: false, skipped: true };
    }

    await this.awsS3Service.deletePublicFileByUrl(url);
    return { deleted: true };
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
    }).map((topic) => this.normalizeTopic(topic));
  }

  async create(data: Record<string, any>) {
    const payload: Record<string, any> = {
      ...data,
      status: this.normalizeOfficialStatus(data.status),
      isDeleted: false,
      cachedWordCount: this.countWords(data.words),
    };
    if (data.id) payload._id = data.id;
    else if (data._id) payload._id = data._id;

    const topic = await this.topicsModel.create(payload);
    return this.normalizeTopic(topic.toObject());
  }

  async update(id: string, data: Record<string, any>) {
    const current = await this.topicsModel.findById(id).lean();
    if (!current) throw new NotFoundException(`Topic ${id} not found`);

    const payload: Record<string, any> = { ...data };
    payload.status = this.normalizeOfficialStatus(payload.status ?? current.status);
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

    const updated = await this.topicsModel
      .findByIdAndUpdate(id, { $set: payload }, { new: true })
      .lean();
    return this.normalizeTopic(updated);
  }

  async softDelete(id: string) {
    const updated = await this.topicsModel
      .findByIdAndUpdate(id, { $set: { isDeleted: true, deletedAt: new Date() } }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Topic ${id} not found`);
    return this.normalizeTopic(updated);
  }

  async permanentDelete(id: string) {
    const result = await this.topicsModel.findByIdAndDelete(id).lean();
    if (!result) throw new NotFoundException(`Topic ${id} not found`);
    return { deleted: true };
  }
}
