import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { SYSTEM_ID } from 'apps/common/src/utils';
import { SSTMiniGames } from 'apps/common/src/database/mongodb/src/superstudy';

@Injectable()
export class MiniGamesService {
  constructor(
    @InjectModel(SSTMiniGames)
    private readonly model: ReturnModelType<typeof SSTMiniGames>,
  ) {}

  private mapDoc(doc: any) {
    if (!doc) return null;
    return { id: doc._id, ...doc, createdAt: doc.createdAt ? { seconds: Math.floor(new Date(doc.createdAt).getTime() / 1000) } : null };
  }

  async getAll() {
    const docs = await this.model.find().sort({ createdAt: -1 }).lean();
    return docs.map(d => this.mapDoc(d));
  }

  async getMyGames(userId: string) {
    const docs = await this.model.find({ createdBy: userId }).sort({ createdAt: -1 }).lean();
    return docs.map(d => this.mapDoc(d));
  }

  async getApprovedGames() {
    const docs = await this.model.find({ status: 'approved', isActive: true }).lean();
    return docs.map(d => this.mapDoc(d));
  }

  async getPendingGames() {
    const docs = await this.model.find({ status: 'pending_review' }).sort({ submittedAt: -1 }).lean();
    return docs.map(d => this.mapDoc(d));
  }

  async getPendingGamesCount() {
    const count = await this.model.countDocuments({ status: 'pending_review' });
    return { count };
  }

  async getById(id: string) {
    const doc = await this.model.findById(id).lean();
    return this.mapDoc(doc);
  }

  async createGame(data: Record<string, any>) {
    const newId = SYSTEM_ID();
    const payload = {
      _id: newId,
      ...data,
      status: 'draft',
      isActive: false,
      properties: '',
      propertiesBranches: '',
      changeLog: [{
        action: 'created',
        at: new Date().toISOString(),
        by: data.createdBy
      }]
    };
    await this.model.create(payload);
    return this.mapDoc(payload);
  }

  async updateGame(id: string, data: Record<string, any>) {
    // Exclude protected fields
    const { _id, createdAt, createdBy, status, changeLog, ...updateData } = data;
    const updated = await this.model.findByIdAndUpdate(id, { $set: updateData }, { new: true }).lean();
    if (!updated) throw new NotFoundException('Game not found');
    return this.mapDoc(updated);
  }

  async deleteGame(id: string) {
    const deleted = await this.model.findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundException('Game not found');
    return { success: true };
  }

  async submitForReview(id: string, userId: string) {
    const logEntry = { action: 'submitted', at: new Date().toISOString(), by: userId };
    const updated = await this.model.findByIdAndUpdate(id, {
      $set: { status: 'pending_review', submittedAt: new Date() },
      $push: { changeLog: logEntry }
    }, { new: true }).lean();
    return this.mapDoc(updated);
  }

  async approveGame(id: string, adminId: string) {
    const logEntry = { action: 'approved', at: new Date().toISOString(), by: adminId };
    const updated = await this.model.findByIdAndUpdate(id, {
      $set: { status: 'approved', isActive: true, reviewedBy: adminId, reviewedAt: new Date(), reviewNote: '' },
      $push: { changeLog: logEntry }
    }, { new: true }).lean();
    return this.mapDoc(updated);
  }

  async rejectGame(id: string, adminId: string, note: string = '') {
    const logEntry = { action: 'rejected', at: new Date().toISOString(), by: adminId, note };
    const updated = await this.model.findByIdAndUpdate(id, {
      $set: { status: 'rejected', isActive: false, reviewedBy: adminId, reviewedAt: new Date(), reviewNote: note },
      $push: { changeLog: logEntry }
    }, { new: true }).lean();
    return this.mapDoc(updated);
  }
}
