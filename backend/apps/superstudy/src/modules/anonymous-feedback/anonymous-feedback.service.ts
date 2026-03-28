import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { SYSTEM_ID } from 'apps/common/src/utils';
import { SSTAnonymousFeedback } from 'apps/common/src/database/mongodb/src/superstudy';

@Injectable()
export class AnonymousFeedbackService {
  constructor(
    @InjectModel(SSTAnonymousFeedback)
    private readonly feedbackModel: ReturnModelType<typeof SSTAnonymousFeedback>,
  ) {}

  async getMyReceivedFeedback(uid: string) {
    if (!uid) throw new BadRequestException('uid is required');
    const docs = await this.feedbackModel
      .find({ targetType: 'direct', targetUid: uid, hiddenBy: { $ne: uid } })
      .sort({ createdAt: -1 })
      .lean();
    return docs.map(d => ({
        id: d._id,
        isRead: d.read, // Map schema read boolean to frontend isRead boolean
        ...d,
    }));
  }

  async getAdminFeedback() {
    // Return all feedback where targetType != 'direct' (e.g., targetType === 'admin' or undefined/null)
    const docs = await this.feedbackModel
      .find({ $or: [{ targetType: 'admin' }, { targetType: { $exists: false } }, { targetType: null }] as any })
      .sort({ createdAt: -1 })
      .lean();
    return docs.map(d => ({ id: d._id, isRead: d.read, ...d }));
  }

  async getDirectFeedback() {
    const docs = await this.feedbackModel
      .find({ targetType: 'direct' })
      .sort({ createdAt: -1 })
      .lean();
    return docs.map(d => ({ id: d._id, isRead: d.read, ...d }));
  }

  async getAllFeedback() {
    const docs = await this.feedbackModel
      .find()
      .sort({ createdAt: -1 })
      .lean();
    return docs.map(d => ({ id: d._id, isRead: d.read, ...d }));
  }

  async getUnreadFeedbackCount() {
    // Count all unread feedback submitted to admin
    return this.feedbackModel.countDocuments({ 
      read: false,
      $or: [{ targetType: 'admin' }, { targetType: { $exists: false } }, { targetType: null }] as any
    });
  }

  async getMyUnreadFeedbackCount(uid: string) {
    if (!uid) throw new BadRequestException('uid is required');
    return this.feedbackModel.countDocuments({ targetType: 'direct', targetUid: uid, read: false, hiddenBy: { $ne: uid } });
  }

  async deleteFeedback(id: string) {
    const deleted = await this.feedbackModel.findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundException('Feedback not found');
    return { success: true };
  }

  async submitFeedback(data: Record<string, any>) {
    const newId = SYSTEM_ID();
    const created = await this.feedbackModel.create({
      _id: newId,
      ...data,
      read: false,
    });
    return { id: newId };
  }

  async markFeedbackAsRead(id: string) {
    const updated = await this.feedbackModel.findByIdAndUpdate(id, { read: true }, { new: true }).lean();
    if (!updated) throw new NotFoundException('Feedback not found');
    return { success: true };
  }

  async hideFeedbackForUser(id: string, uid: string) {
    if (!uid) throw new BadRequestException('uid is required');
    const updated = await this.feedbackModel.findByIdAndUpdate(id, { $addToSet: { hiddenBy: uid } }, { new: true }).lean();
    if (!updated) throw new NotFoundException('Feedback not found');
    return { success: true };
  }
}
