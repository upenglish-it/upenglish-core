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
