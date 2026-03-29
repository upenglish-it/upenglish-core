import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { SSTUsers } from 'apps/common/src/database/mongodb/src/superstudy';
import { Accounts, Properties, PropertiesBranches } from 'apps/common/src/database/mongodb/src/isms';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(SSTUsers)
    private readonly usersModel: ReturnModelType<typeof SSTUsers>,
    @InjectModel(Accounts)
    private readonly accountsModel: ReturnModelType<typeof Accounts>,
    @InjectModel(Properties)
    private readonly propertiesModel: ReturnModelType<typeof Properties>,
    @InjectModel(PropertiesBranches)
    private readonly propertiesBranchesModel: ReturnModelType<typeof PropertiesBranches>,
  ) {}

  async findAll(filters: { role?: string; status?: string } = {}) {
    const query: Record<string, any> = { deleted: { $ne: true } };
    if (filters.role) query.role = filters.role;
    if (filters.status) query.status = filters.status;
    return this.usersModel.find(query).lean();
  }

  async getAllIsmsAccounts(search: string = '', limit: number = 50) {
    const matchStage: any = { deleted: { $ne: true } };
    if (search && search.trim() !== '') {
      const q = search.trim();
      matchStage.$or = [
        { emailAddresses: { $regex: q, $options: 'i' } },
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
      ];
    }

    return this.accountsModel.aggregate([
      { $match: matchStage },
      { $limit: Number(limit) },
      {
        $lookup: {
          from: 'sst-users',
          localField: 'accountId',
          foreignField: '_id',
          as: 'sstUser',
        },
      },
      {
        $addFields: {
          sstUser: { $arrayElemAt: ['$sstUser', 0] },
        },
      },
      {
        $project: {
          uid: '$accountId',
          email: { $arrayElemAt: ['$emailAddresses', 0] },
          displayName: {
            $trim: {
              input: {
                $concat: [
                  { $ifNull: ['$firstName', ''] },
                  ' ',
                  { $ifNull: ['$lastName', ''] }
                ]
              }
            }
          },
          role: '$role',
          photoURL: '$profilePhoto',
          groupIds: { $ifNull: ['$sstUser.groupIds', []] },
          active: '$active',
        },
      },
    ]);
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
   * Sync SSO user profile from frontend (create if not exists).
   * Uses upsert to bypass strict schema validation on first login.
   */
  async syncUser(id: string, data: Record<string, any>) {
    const user = await this.usersModel
      .findByIdAndUpdate(id, { $set: data }, { new: true, upsert: true })
      .lean();
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

    if (updated.email) {
      const emailLower = updated.email.toLowerCase().trim();
      const existingAccount = await this.accountsModel
        .findOne({ emailAddresses: emailLower })
        .lean();

      if (!existingAccount) {
        // Fetch a default property/branch to satisfy schema requirements
        const property = await this.propertiesModel.findOne().lean();
        const branch = property
          ? await this.propertiesBranchesModel.findOne({ properties: property._id }).lean()
          : null;

        await this.accountsModel.create({
          accountId: uid,
          firstName: updated.displayName || 'Vô danh',
          lastName: '',
          emailAddresses: [emailLower],
          contactNumbers: [],
          notification: { email: true, app: true },
          lockScreen: { enable: false, code: null, idleDuration: 600 },
          language: 'vi',
          properties: property?._id || 'default_property_must_exist',
          propertiesBranches: [branch?._id || 'default_branch_must_exist'],
          sourceBranch: branch?._id || 'default_branch_must_exist',
          role: role === 'user' ? 'student' : role, // map superstudy user -> student
          createdFrom: 'system',
          active: true,
          deleted: false,
        });
      }
    }

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

  async addToGroup(uid: string, groupId: string) {
    let sstUser = await this.usersModel.findById(uid).lean();
    if (!sstUser) {
      // Create user from ISMS Accounts automatically
      const account = await this.accountsModel.findOne({ accountId: uid }).lean();
      if (!account) throw new NotFoundException(`User ${uid} not found in ISMS`);

      const email = account.emailAddresses?.[0] || 'no-email@test.com';
      const displayName = [account.firstName, account.lastName].filter(Boolean).join(' ') || 'User';

      sstUser = (await this.usersModel.create({
        _id: account.accountId,
        email,
        displayName,
        role: account.role === 'student' ? 'user' : account.role,
        status: 'approved',
        groupIds: [groupId],
        approvedAt: new Date(),
      })) as any;
      
      return sstUser;
    } else {
      const updated = await this.usersModel
        .findByIdAndUpdate(uid, { $addToSet: { groupIds: groupId } }, { new: true })
        .lean();
      if (!updated) throw new NotFoundException(`User ${uid} not found`);
      return updated;
    }
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
