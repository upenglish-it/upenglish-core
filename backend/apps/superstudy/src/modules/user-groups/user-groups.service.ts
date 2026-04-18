import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { SSTUserGroups } from 'apps/common/src/database/mongodb/src/superstudy';
import { Accounts } from 'apps/common/src/database/mongodb/src/isms';

@Injectable()
export class UserGroupsService {
  constructor(
    @InjectModel(SSTUserGroups)
    private readonly groupsModel: ReturnModelType<typeof SSTUserGroups>,
    @InjectModel(Accounts)
    private readonly accountsModel: ReturnModelType<typeof Accounts>,
  ) {}

  private normalizeGroup(group: any) {
    if (!group) return group;
    return {
      ...group,
      id: String(group._id || group.id || ''),
    };
  }

  private normalizeEmail(value?: string | null) {
    return String(value ?? '').trim().toLowerCase();
  }

  private normalizeAccountStudent(account: any) {
    const uid = String(account?.accountId || account?._id || '').trim();
    if (!uid) return null;

    return {
      _id: uid,
      uid,
      id: uid,
      email: this.normalizeEmail(account?.email || account?.emailAddresses?.[0]),
      displayName:
        String(account?.displayName ?? '').trim()
        || [account?.firstName, account?.lastName].filter(Boolean).join(' ').trim()
        || this.normalizeEmail(account?.email || account?.emailAddresses?.[0])
        || uid,
      role: account?.role === 'student' ? 'user' : account?.role,
      groupIds: Array.isArray(account?.groupIds) ? account.groupIds : [],
      deleted: Boolean(account?.deleted),
    };
  }

  private normalizeLegacyStudent(user: any) {
    const uid = String(user?._id || user?.uid || '').trim();
    if (!uid) return null;

    return {
      ...user,
      _id: uid,
      uid,
      id: uid,
      email: this.normalizeEmail(user?.email),
      deleted: Boolean(user?.deleted),
    };
  }

  /**
   * List all groups — mirrors adminService.getGroups
   * Hidden groups are filtered out unless includeHidden = true
   */
  async findAll(includeHidden = false) {
    const query: Record<string, any> = {};
    if (!includeHidden) query.isHidden = { $ne: true };
    const groups = await this.groupsModel.find(query).lean();
    return groups.map((group) => this.normalizeGroup(group)).sort((a, b) => {
      const tA = a['createdAt'] ? new Date(a['createdAt']).getTime() : 0;
      const tB = b['createdAt'] ? new Date(b['createdAt']).getTime() : 0;
      return tA - tB;
    });
  }

  async findByIds(ids: string[]) {
    const uniqueIds = [...new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean))];
    if (uniqueIds.length === 0) {
      return [];
    }

    const groups = await this.groupsModel
      .find({ _id: { $in: uniqueIds }, isHidden: { $ne: true } })
      .lean();

    return groups
      .map((group) => this.normalizeGroup(group))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  async findOne(id: string) {
    const group = await this.groupsModel.findById(id).lean();
    if (!group) throw new NotFoundException(`Group ${id} not found`);
    return this.normalizeGroup(group);
  }

  /**
   * Get all students (role='user') in a group — mirrors teacherService.getStudentsInGroup
   */
  async getStudentsInGroup(groupId: string) {
    const accountStudents = await this.accountsModel
      .find({ groupIds: groupId, role: 'student', deleted: { $ne: true } })
      .lean();

    return accountStudents
      .map((accountStudent) => this.normalizeAccountStudent(accountStudent))
      .filter(Boolean)
      .sort((a, b) => (a.email || '').localeCompare(b.email || ''));
  }

  async create(data: Record<string, any>) {
    const group = await this.groupsModel.create(data);
    return this.normalizeGroup(group.toObject());
  }

  async update(id: string, data: Record<string, any>) {
    const updated = await this.groupsModel
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Group ${id} not found`);
    return this.normalizeGroup(updated);
  }

  async remove(id: string) {
    const result = await this.groupsModel.findByIdAndDelete(id).lean();
    if (!result) throw new NotFoundException(`Group ${id} not found`);
    return { deleted: true };
  }

  /**
   * Add/remove topicAccess, grammarAccess, examAccess, folderAccess
   * Mirrors adminService.shareResourceToGroup / unshareResourceFromGroup
   */
  async updateAccess(id: string, field: string, resourceId: string, action: 'add' | 'remove') {
    const update =
      action === 'add'
        ? { $addToSet: { [field]: resourceId } }
        : { $pull: { [field]: resourceId } };
    const updated = await this.groupsModel.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!updated) throw new NotFoundException(`Group ${id} not found`);
    return this.normalizeGroup(updated);
  }
}
