import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { SSTUserGroups, SSTUsers } from 'apps/common/src/database/mongodb/src/superstudy';

@Injectable()
export class UserGroupsService {
  constructor(
    @InjectModel(SSTUserGroups)
    private readonly groupsModel: ReturnModelType<typeof SSTUserGroups>,
    @InjectModel(SSTUsers)
    private readonly usersModel: ReturnModelType<typeof SSTUsers>,
  ) {}

  /**
   * List all groups — mirrors adminService.getGroups
   * Hidden groups are filtered out unless includeHidden = true
   */
  async findAll(includeHidden = false) {
    const query: Record<string, any> = {};
    if (!includeHidden) query.isHidden = { $ne: true };
    const groups = await this.groupsModel.find(query).lean();
    return groups.sort((a, b) => {
      const tA = a['createdAt'] ? new Date(a['createdAt']).getTime() : 0;
      const tB = b['createdAt'] ? new Date(b['createdAt']).getTime() : 0;
      return tA - tB;
    });
  }

  async findOne(id: string) {
    const group = await this.groupsModel.findById(id).lean();
    if (!group) throw new NotFoundException(`Group ${id} not found`);
    return group;
  }

  /**
   * Get all students (role='user') in a group — mirrors teacherService.getStudentsInGroup
   */
  async getStudentsInGroup(groupId: string) {
    const students = await this.usersModel
      .find({ groupIds: groupId, role: 'user', deleted: { $ne: true } })
      .lean();
    return students.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
  }

  async create(data: Record<string, any>) {
    const group = await this.groupsModel.create(data);
    return group.toObject();
  }

  async update(id: string, data: Record<string, any>) {
    const updated = await this.groupsModel
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Group ${id} not found`);
    return updated;
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
    return updated;
  }
}
