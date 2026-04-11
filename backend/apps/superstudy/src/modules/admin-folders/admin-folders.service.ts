import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { SYSTEM_ID } from 'apps/common/src/utils';
import {
  SSTTopicFolders,
  SSTGrammarFolders,
  SSTExamFolders,
} from 'apps/common/src/database/mongodb/src/superstudy';

type AdminFolderType = 'topics' | 'grammar' | 'exams';

function normalizeFolder(doc: Record<string, any>) {
  if (!doc) return doc;
  const isPublic = doc.isPublic ?? doc.public ?? false;
  return {
    ...doc,
    isPublic,
    public: isPublic,
  };
}

@Injectable()
export class AdminFoldersService {
  constructor(
    @InjectModel(SSTTopicFolders)
    private readonly topicFoldersModel: ReturnModelType<typeof SSTTopicFolders>,

    @InjectModel(SSTGrammarFolders)
    private readonly grammarFoldersModel: ReturnModelType<typeof SSTGrammarFolders>,

    @InjectModel(SSTExamFolders)
    private readonly examFoldersModel: ReturnModelType<typeof SSTExamFolders>,
  ) {}

  // ─── Model resolver ──────────────────────────────────────────────────────

  private model(type: AdminFolderType) {
    switch (type) {
      case 'topics':  return this.topicFoldersModel;
      case 'grammar': return this.grammarFoldersModel;
      case 'exams':   return this.examFoldersModel;
      default:
        throw new BadRequestException(`Unknown folder type "${type}". Valid: topics | grammar | exams`);
    }
  }

  private listField(type: AdminFolderType) {
    switch (type) {
      case 'topics':
        return 'topicIds';
      case 'grammar':
        return 'exerciseIds';
      case 'exams':
        return 'examIds';
      default:
        return null;
    }
  }

  private normalizeIds(ids: unknown) {
    const seen = new Set<string>();
    return (Array.isArray(ids) ? ids : [])
      .map((id) => (typeof id === 'string' ? id.trim() : String(id || '').trim()))
      .filter((id) => {
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
  }

  private async enforceExclusiveItems(type: AdminFolderType, targetFolderId: string, itemIds: string[]) {
    const field = this.listField(type);
    if (!field || itemIds.length === 0) return;

    const docs = await (this.model(type) as any).find({ _id: { $ne: targetFolderId } }).lean();
    await Promise.all(
      docs.map(async (doc: Record<string, any>) => {
        const currentIds = this.normalizeIds(doc[field]);
        const filteredIds = currentIds.filter((id) => !itemIds.includes(id));
        if (filteredIds.length === currentIds.length) return;
        await (this.model(type) as any).findByIdAndUpdate(doc._id, { $set: { [field]: filteredIds } });
      }),
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // getFolders — mirrors getFolders() / getGrammarFolders() from adminService.js
  // Returns all folders sorted by `order` ascending.
  // ═════════════════════════════════════════════════════════════════════════

  async getFolders(type: AdminFolderType) {
    const docs = await (this.model(type) as any).find().lean();
    return docs
      .filter((d: any) => !d.isDeleted)
      .map((d: any) => normalizeFolder(d))
      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  }

  // ═════════════════════════════════════════════════════════════════════════
  // saveFolder — mirrors saveFolder() / saveGrammarFolder() from adminService.js
  // Creates or updates (upsert by _id). Generates _id if not provided.
  // ═════════════════════════════════════════════════════════════════════════

  async saveFolder(type: AdminFolderType, data: Record<string, any>) {
    const { _id, id, ...rest } = data;
    const folderId: string = _id || id || SYSTEM_ID();
    const isPublic = rest.isPublic ?? rest.public ?? false;
    const field = this.listField(type);
    const normalizedIds = field && Object.prototype.hasOwnProperty.call(rest, field)
      ? this.normalizeIds(rest[field])
      : null;
    const payload = {
      ...rest,
      ...(field && normalizedIds ? { [field]: normalizedIds } : {}),
      isPublic,
      public: isPublic,
      _id: folderId,
    };

    const updated = await (this.model(type) as any)
      .findByIdAndUpdate(
        folderId,
        { $set: payload },
        { new: true, upsert: true },
      )
      .lean();

    if (field && normalizedIds) {
      await this.enforceExclusiveItems(type, folderId, normalizedIds);
    }

    return normalizeFolder(updated);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // deleteFolder — mirrors deleteFolder() / deleteGrammarFolder() from adminService.js
  // Hard delete (same as original — topic_folders are hard-deleted in original).
  // ═════════════════════════════════════════════════════════════════════════

  async deleteFolder(type: AdminFolderType, id: string) {
    const deleted = await (this.model(type) as any).findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundException(`Folder "${id}" not found`);
    return { deleted: true, id };
  }

  // ═════════════════════════════════════════════════════════════════════════
  // reorderFolders — mirrors updateTopicFoldersOrder() / updateGrammarFoldersOrder()
  // Accepts array of { id, order } objects and bulk-updates order field.
  // Original uses Firestore writeBatch; here we use Promise.all with $set.
  // ═════════════════════════════════════════════════════════════════════════

  async reorderFolders(type: AdminFolderType, folders: Array<{ id: string; order: number }>) {
    if (!Array.isArray(folders) || folders.length === 0) {
      throw new BadRequestException('folders array must be non-empty');
    }
    await Promise.all(
      folders.map(({ id, order }) =>
        (this.model(type) as any).findByIdAndUpdate(id, { $set: { order } }),
      ),
    );
    return { updated: folders.length };
  }
}
