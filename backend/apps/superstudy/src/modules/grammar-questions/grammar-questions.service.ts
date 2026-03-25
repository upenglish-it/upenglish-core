import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { SSTGrammarQuestions, SSTGrammarExercises } from 'apps/common/src/database/mongodb/src/superstudy';

@Injectable()
export class GrammarQuestionsService {
  constructor(
    @InjectModel(SSTGrammarQuestions)
    private readonly questionsModel: ReturnModelType<typeof SSTGrammarQuestions>,
    @InjectModel(SSTGrammarExercises)
    private readonly exercisesModel: ReturnModelType<typeof SSTGrammarExercises>,
  ) {}

  async findAll(exerciseId: string) {
    const questions = await this.questionsModel.find({ exerciseId }).lean();
    return questions.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  async findOne(id: string) {
    const q = await this.questionsModel.findById(id).lean();
    if (!q) throw new NotFoundException(`Grammar question ${id} not found`);
    return q;
  }

  async create(data: Record<string, any>) {
    const existingCount = await this.questionsModel.countDocuments({ exerciseId: data.exerciseId });
    const question = await this.questionsModel.create({ ...data, order: existingCount });

    // Update cachedQuestionCount on exercise
    this.exercisesModel
      .findByIdAndUpdate(data.exerciseId, { $inc: { cachedQuestionCount: 1 } })
      .catch(() => {});

    return question.toObject();
  }

  async update(id: string, data: Record<string, any>) {
    const updated = await this.questionsModel
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Grammar question ${id} not found`);
    return updated;
  }

  async remove(id: string) {
    const q = await this.questionsModel.findByIdAndDelete(id).lean();
    if (!q) throw new NotFoundException(`Grammar question ${id} not found`);

    // Decrement the cachedQuestionCount on the exercise
    if (q.exerciseId) {
      this.exercisesModel
        .findByIdAndUpdate(q.exerciseId, { $inc: { cachedQuestionCount: -1 } })
        .catch(() => {});
    }

    return { deleted: true };
  }

  async reorder(orderedItems: Array<{ id: string; order: number }>) {
    await Promise.all(
      orderedItems.map(({ id, order }) =>
        this.questionsModel.findByIdAndUpdate(id, { $set: { order } }),
      ),
    );
    return { reordered: orderedItems.length };
  }
}
