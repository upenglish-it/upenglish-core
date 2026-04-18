import { Injectable } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { SSTNotifications } from 'apps/common/src/database/mongodb/src/superstudy';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(SSTNotifications)
    private readonly notificationsModel: ReturnModelType<typeof SSTNotifications>,
  ) {}

  async findAll(userId: string, unreadOnly = false) {
    const query: Record<string, any> = { userId };
    if (unreadOnly) query.isRead = false;
    const notifications = await this.notificationsModel.find(query).lean();
    return notifications.sort((a, b) => {
      const tA = a['createdAt'] ? new Date(a['createdAt']).getTime() : 0;
      const tB = b['createdAt'] ? new Date(b['createdAt']).getTime() : 0;
      return tB - tA; // newest first
    });
  }

  /**
   * Internal helper to create notifications
   * Mirrors notificationService.createNotification
   */
  async create(data: Record<string, any>) {
    const notification = await this.notificationsModel.create({
      ...data,
      isRead: false,
    });
    return notification.toObject();
  }

  /**
   * Create notifications for multiple user IDs (fan-out)
   * Mirrors notificationService.createGroupNotification
   */
  async createForMany(userIds: string[], data: Omit<Record<string, any>, 'userId'>) {
    const docs = userIds.map((userId) => ({ ...data, userId, isRead: false }));
    return this.notificationsModel.insertMany(docs);
  }

  async markRead(id: string) {
    return this.notificationsModel
      .findByIdAndUpdate(id, { $set: { isRead: true, readAt: new Date() } }, { new: true })
      .lean();
  }

  /**
   * Mark all notifications as read for a user
   * Mirrors notificationService.markAllNotificationsRead
   */
  async markAllRead(userId: string) {
    const result = await this.notificationsModel.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );
    return { modifiedCount: result.modifiedCount };
  }

  async unreadCount(userId: string) {
    const count = await this.notificationsModel.countDocuments({ userId, isRead: false });
    return { count };
  }

  async clearAll(userId: string) {
    const result = await this.notificationsModel.deleteMany({ userId });
    return { deletedCount: result.deletedCount ?? 0 };
  }
}
