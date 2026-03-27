import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { SYSTEM_ID } from 'apps/common/src/utils';
import { SSTTeacherPrompts } from 'apps/common/src/database/mongodb/src/superstudy';

@Injectable()
export class TeacherPromptsService {
  constructor(
    @InjectModel(SSTTeacherPrompts)
    private readonly teacherPromptsModel: ReturnModelType<typeof SSTTeacherPrompts>,
  ) {}

  async getTeacherPrompts(teacherId: string) {
    if (!teacherId) throw new BadRequestException('teacherId is required');
    const docs = await this.teacherPromptsModel
      .find({ createdBy: teacherId })
      .sort({ createdAt: -1 })
      .lean();
    return docs;
  }

  async getAllPrompts() {
    return this.teacherPromptsModel.find().sort({ createdAt: -1 }).lean();
  }

  async getPromptById(id: string) {
    const doc = await this.teacherPromptsModel.findById(id).lean();
    if (!doc) throw new NotFoundException(`Prompt ${id} not found`);
    return doc;
  }

  async createPrompt(data: Record<string, any>) {
    const { _id, id, ...rest } = data;
    const newId = _id || id || SYSTEM_ID();
    
    // Inject fallback DB references if missing from payload
    const properties = data.properties || 'SYSTEM';
    const propertiesBranches = data.propertiesBranches || 'SYSTEM';

    const created = await this.teacherPromptsModel.create({
      _id: newId,
      ...rest,
      properties,
      propertiesBranches,
    });
    return created.toObject ? created.toObject() : created;
  }

  async updatePrompt(id: string, data: Record<string, any>) {
    const updated = await this.teacherPromptsModel
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Prompt ${id} not found`);
    return updated;
  }

  async deletePrompt(id: string) {
    const deleted = await this.teacherPromptsModel.findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundException(`Prompt ${id} not found`);
    return { deleted: true, id };
  }
}
