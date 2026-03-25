import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { SSTGrammarExercises, SSTGrammarQuestions } from 'apps/common/src/database/mongodb/src/superstudy';

@Injectable()
export class GrammarExercisesService {
  constructor(
    @InjectModel(SSTGrammarExercises)
    private readonly exercisesModel: ReturnModelType<typeof SSTGrammarExercises>,
    @InjectModel(SSTGrammarQuestions)
    private readonly questionsModel: ReturnModelType<typeof SSTGrammarQuestions>,
  ) {}

  async findAll(createdByRole?: string) {
    const query: Record<string, any> = { isDeleted: { $ne: true } };
    if (createdByRole) query.createdByRole = createdByRole;
    const exercises = await this.exercisesModel.find(query).lean();
    return exercises.sort((a, b) => {
      const tA = a['createdAt'] ? new Date(a['createdAt']).getTime() : 0;
      const tB = b['createdAt'] ? new Date(b['createdAt']).getTime() : 0;
      return tB - tA;
    });
  }

  async findOne(id: string) {
    const ex = await this.exercisesModel.findById(id).lean();
    if (!ex) throw new NotFoundException(`Grammar exercise ${id} not found`);
    return ex;
  }

  async findShared(grammarAccessIds: string[] = []) {
    const conditions: Record<string, any>[] = [{ isPublic: true }, { teacherVisible: true }];
    if (grammarAccessIds.length > 0) conditions.push({ _id: { $in: grammarAccessIds } });

    const exercises = await this.exercisesModel.find({ $or: conditions }).lean();
    const seen = new Set<string>();
    return exercises
      .filter((e) => {
        const id = String(e._id);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .sort((a, b) => {
        const tA = a['createdAt'] ? new Date(a['createdAt']).getTime() : 0;
        const tB = b['createdAt'] ? new Date(b['createdAt']).getTime() : 0;
        return tB - tA;
      });
  }

  async findDeleted() {
    const exercises = await this.exercisesModel.find({ isDeleted: true }).lean();
    return exercises.sort((a, b) => {
      const tA = a['deletedAt'] ? new Date(a['deletedAt']).getTime() : 0;
      const tB = b['deletedAt'] ? new Date(b['deletedAt']).getTime() : 0;
      return tB - tA;
    });
  }

  async create(data: Record<string, any>) {
    const ex = await this.exercisesModel.create({ ...data, isDeleted: false, cachedQuestionCount: 0 });
    return ex.toObject();
  }

  async update(id: string, data: Record<string, any>) {
    const updated = await this.exercisesModel
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Grammar exercise ${id} not found`);
    return updated;
  }

  async softDelete(id: string) {
    const updated = await this.exercisesModel
      .findByIdAndUpdate(id, { $set: { isDeleted: true, deletedAt: new Date() } }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Grammar exercise ${id} not found`);
    return updated;
  }

  async restore(id: string) {
    const updated = await this.exercisesModel
      .findByIdAndUpdate(id, { $set: { isDeleted: false }, $unset: { deletedAt: '' } }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Grammar exercise ${id} not found`);
    return updated;
  }

  async permanentDelete(id: string) {
    await this.questionsModel.deleteMany({ exerciseId: id });
    await this.exercisesModel.findByIdAndDelete(id);
    return { deleted: true, exerciseId: id };
  }
}
