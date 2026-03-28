import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { SYSTEM_ID } from 'apps/common/src/utils';
import {
  SSTTeacherTopicFolders,
  SSTTeacherGrammarFolders,
  SSTTeacherExamFolders,
} from 'apps/common/src/database/mongodb/src/superstudy';

type TeacherFolderType = 'topics' | 'grammar' | 'exams';

@Injectable()
export class TeacherFoldersService {
  constructor(
    @InjectModel(SSTTeacherTopicFolders)
    private readonly topicFoldersModel: ReturnModelType<typeof SSTTeacherTopicFolders>,

    @InjectModel(SSTTeacherGrammarFolders)
    private readonly grammarFoldersModel: ReturnModelType<typeof SSTTeacherGrammarFolders>,

    @InjectModel(SSTTeacherExamFolders)
    private readonly examFoldersModel: ReturnModelType<typeof SSTTeacherExamFolders>,
  ) {}

  // ─── Model resolver ──────────────────────────────────────────────────────

  private model(type: TeacherFolderType) {
    switch (type) {
      case 'topics':  return this.topicFoldersModel;
      case 'grammar': return this.grammarFoldersModel;
      case 'exams':   return this.examFoldersModel;
      default:
        throw new BadRequestException(`Unknown folder type "${type}". Valid: topics | grammar | exams`);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // getTeacherFolders — mirrors getTeacherTopicFolders(teacherId) from teacherService.js
  // Returns folders for a specific teacher, sorted by order, excludes soft-deleted.
  // ═════════════════════════════════════════════════════════════════════════

  async getTeacherFolders(type: TeacherFolderType, teacherId: string) {
    if (!teacherId) throw new BadRequestException('teacherId is required');
    const docs = await (this.model(type) as any)
      .find({ teacherId, isDeleted: { $ne: true } })
      .lean();
    return docs.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  }

  // ═════════════════════════════════════════════════════════════════════════
  // getAllTeacherFolders — mirrors getAllTeacherTopicFolders() from teacherService.js
  // Returns ALL folders across all teachers (admin use), sorted by order, excludes deleted.
  // ═════════════════════════════════════════════════════════════════════════

  async getAllTeacherFolders(type: TeacherFolderType) {
    const docs = await (this.model(type) as any)
      .find({ isDeleted: { $ne: true } })
      .lean();
    return docs.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  }

  // ═════════════════════════════════════════════════════════════════════════
  // getDeletedTeacherFolders — mirrors getDeletedTeacherTopicFolders() from teacherService.js
  // Returns soft-deleted folders sorted by deletedAt descending.
  // ═════════════════════════════════════════════════════════════════════════

  async getDeletedTeacherFolders(type: TeacherFolderType, teacherId?: string) {
    const filter: Record<string, any> = { isDeleted: true };
    if (teacherId) filter.teacherId = teacherId;
    const docs = await (this.model(type) as any).find(filter).lean();
    return docs.sort((a: any, b: any) => {
      const tA = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
      const tB = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
      return tB - tA;
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // saveTeacherFolder — mirrors saveTeacherTopicFolder(teacherId, folderData) from teacherService.js
  // Creates a new folder (with auto-ID) or updates an existing one (if _id provided).
  // ═════════════════════════════════════════════════════════════════════════

  async saveTeacherFolder(type: TeacherFolderType, data: Record<string, any>) {
    const { _id, id, ...rest } = data;

    if (_id || id) {
      // Update existing
      const folderId = _id || id;
      const updated = await (this.model(type) as any)
        .findByIdAndUpdate(folderId, { $set: { ...rest } }, { new: true })
        .lean();
      if (!updated) throw new NotFoundException(`Folder "${folderId}" not found`);
      return updated;
    }

    // Create new — auto-generate ID (mirrors doc(collection(db, ...)) = auto-ID from Firestore)
    const newId = SYSTEM_ID();
    
    // Inject fallback DB references and required fields if missing from payload
    const properties = data.properties || 'SYSTEM';
    const propertiesBranches = data.propertiesBranches || 'SYSTEM';
    const createdBy = data.createdBy || data.teacherId || 'SYSTEM';
    
    // Ensure array and string defaults for old Firestore payloads
    const listField = type === 'topics' ? 'topicIds' : type === 'grammar' ? 'exerciseIds' : 'examIds';
    const listValues = data[listField] || [];

    try {
      const created = await (this.model(type) as any).create({ 
        _id: newId,
        ...rest,
        description: data.description || '',
        icon: data.icon || '📁',
        color: data.color || '#3b82f6',
        [listField]: listValues,
        properties,
        propertiesBranches,
        createdBy,
      });
      return created.toObject ? created.toObject() : created;
    } catch (error: any) {
      throw new BadRequestException(`Validation failed: ${error.message}`);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // reorderTeacherFolders — mirrors updateTeacherTopicFoldersOrder() from teacherService.js
  // Bulk-updates the `order` field for a list of folders.
  // ═════════════════════════════════════════════════════════════════════════

  async reorderTeacherFolders(
    type: TeacherFolderType,
    folders: Array<{ id: string; order: number }>,
  ) {
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

  // ═════════════════════════════════════════════════════════════════════════
  // softDeleteTeacherFolder — mirrors deleteTeacherTopicFolder() from teacherService.js
  // Sets isDeleted = true and deletedAt = now (soft delete).
  // ═════════════════════════════════════════════════════════════════════════

  async softDeleteTeacherFolder(type: TeacherFolderType, id: string) {
    const updated = await (this.model(type) as any)
      .findByIdAndUpdate(
        id,
        { $set: { isDeleted: true, deletedAt: new Date() } },
        { new: true },
      )
      .lean();
    if (!updated) throw new NotFoundException(`Folder "${id}" not found`);
    return { deleted: true, id };
  }

  // ═════════════════════════════════════════════════════════════════════════
  // restoreTeacherFolder — mirrors restoreTeacherTopicFolder() from teacherService.js
  // Clears isDeleted and deletedAt fields.
  // ═════════════════════════════════════════════════════════════════════════

  async restoreTeacherFolder(type: TeacherFolderType, id: string) {
    const updated = await (this.model(type) as any)
      .findByIdAndUpdate(
        id,
        { $unset: { isDeleted: '', deletedAt: '' } },
        { new: true },
      )
      .lean();
    if (!updated) throw new NotFoundException(`Folder "${id}" not found`);
    return { restored: true, id };
  }

  // ═════════════════════════════════════════════════════════════════════════
  // permanentDeleteTeacherFolder — mirrors permanentlyDeleteTeacherTopicFolder() from teacherService.js
  // Hard-deletes the folder document.
  // ═════════════════════════════════════════════════════════════════════════

  async permanentDeleteTeacherFolder(type: TeacherFolderType, id: string) {
    const deleted = await (this.model(type) as any).findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundException(`Folder "${id}" not found`);
    return { deleted: true, id };
  }
}
