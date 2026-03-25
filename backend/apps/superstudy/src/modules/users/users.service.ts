import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { SSTUsers } from 'apps/common/src/database/mongodb/src/superstudy';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(SSTUsers)
    private readonly usersModel: ReturnModelType<typeof SSTUsers>,
  ) {}

  async findAll(filters: { role?: string; status?: string } = {}) {
    const query: Record<string, any> = { deleted: { $ne: true } };
    if (filters.role) query.role = filters.role;
    if (filters.status) query.status = filters.status;
    return this.usersModel.find(query).lean();
  }

  async findOne(id: string) {
    const user = await this.usersModel.findById(id).lean();
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async findByEmail(email: string) {
    return this.usersModel.findOne({ email: email.toLowerCase().trim() }).lean();
  }

  async update(id: string, data: Record<string, any>) {
    const user = await this.usersModel
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean();
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  /**
   * Approve a pending user — mirrors adminService.approveUser
   */
  async approveUser(
    uid: string,
    role: string,
    durationDays?: number,
    customExpiresAt?: string,
  ) {
    let expiresAt: Date | null = null;
    if (customExpiresAt) {
      expiresAt = new Date(`${customExpiresAt}T23:59:59`);
    } else if (durationDays) {
      expiresAt = new Date(Date.now() + durationDays * 86400000);
    }

    const updated = await this.usersModel
      .findByIdAndUpdate(
        uid,
        {
          $set: {
            status: 'approved',
            role,
            approvedAt: new Date(),
            expiresAt,
          },
        },
        { new: true },
      )
      .lean();

    if (!updated) throw new NotFoundException(`User ${uid} not found`);
    return updated;
  }

  /**
   * Renew access for an approved user — mirrors adminService.renewUser
   */
  async renewUser(uid: string, durationDays?: number, customExpiresAt?: string) {
    let expiresAt: Date | null = null;
    if (customExpiresAt) {
      expiresAt = new Date(`${customExpiresAt}T23:59:59`);
    } else if (durationDays) {
      expiresAt = new Date(Date.now() + durationDays * 86400000);
    }

    const updated = await this.usersModel
      .findByIdAndUpdate(
        uid,
        { $set: { status: 'approved', approvedAt: new Date(), expiresAt } },
        { new: true },
      )
      .lean();

    if (!updated) throw new NotFoundException(`User ${uid} not found`);
    return updated;
  }

  /**
   * Reject a pending user — permanently deletes the document
   */
  async rejectUser(uid: string) {
    const result = await this.usersModel.findByIdAndDelete(uid).lean();
    if (!result) throw new NotFoundException(`User ${uid} not found`);
    return { deleted: true };
  }

  /**
   * Add user to a group — mirrors adminService.addUserToGroup
   */
  async addToGroup(uid: string, groupId: string) {
    const updated = await this.usersModel
      .findByIdAndUpdate(uid, { $addToSet: { groupIds: groupId } }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`User ${uid} not found`);
    return updated;
  }

  /**
   * Remove user from a group — mirrors adminService.removeUserFromGroup
   */
  async removeFromGroup(uid: string, groupId: string) {
    const updated = await this.usersModel
      .findByIdAndUpdate(uid, { $pull: { groupIds: groupId } }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`User ${uid} not found`);
    return updated;
  }

  /**
   * Get all users whose groupIds contains groupId
   */
  async getUsersInGroup(groupId: string, role?: string) {
    const query: Record<string, any> = {
      groupIds: groupId,
      deleted: { $ne: true },
    };
    if (role) query.role = role;
    return this.usersModel.find(query).lean();
  }

  /**
   * Update user access arrays (folderAccess, topicAccess, grammarAccess, examAccess)
   */
  async addAccess(uid: string, field: string, resourceId: string) {
    const updated = await this.usersModel
      .findByIdAndUpdate(uid, { $addToSet: { [field]: resourceId } }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`User ${uid} not found`);
    return updated;
  }

  async removeAccess(uid: string, field: string, resourceId: string) {
    const updated = await this.usersModel
      .findByIdAndUpdate(uid, { $pull: { [field]: resourceId } }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`User ${uid} not found`);
    return updated;
  }

  /**
   * Basic learning stats placeholder — full stats require the word_progress subcollection
   * which in the new backend would be a separate collection query.
   * Returns a summary structure matching original getUserLearningStats output.
   */
  async getLearningStats(_uid: string, _startDate?: string, _endDate?: string) {
    // TODO: integrate with word_progress collection when available
    return { totalWords: 0, learnedWords: 0, totalReviews: 0, totalCorrect: 0, totalWrong: 0 };
  }
}
