import {
  Injectable, Logger, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import {
  SSTUsers,
  SSTUserGroups,
  SSTTopics,
  SSTTeacherTopics,
  SSTExams,
  SSTGrammarExercises,
} from 'apps/common/src/database/mongodb/src/superstudy';
import { Accounts } from 'apps/common/src/database/mongodb/src/isms';

// ─── Constants matching the original Firestore collection names ───────────────
const RESOURCE_TYPE_MAP: Record<string, string> = {
  topic: 'topics',
  teacher_topic: 'teacher_topics',
  grammar: 'grammar_exercises',
  exam: 'exams',
};

const ACCESS_FIELD_MAP: Record<string, string> = {
  topic: 'topicAccess',
  grammar: 'grammarAccess',
  exam: 'examAccess',
};

const TYPE_LABELS: Record<string, string> = {
  teacher_topic: 'bài từ vựng',
  grammar: 'bài Kỹ năng',
  exam: 'bài tập và kiểm tra',
};

@Injectable()
export class SharingService {
  private readonly logger = new Logger(SharingService.name);

  constructor(
    @InjectModel(Accounts)
    private readonly accountsModel: ReturnModelType<typeof Accounts>,

    @InjectModel(SSTUsers)
    private readonly sstUsersModel: ReturnModelType<typeof SSTUsers>,

    @InjectModel(SSTUserGroups)
    private readonly groupsModel: ReturnModelType<typeof SSTUserGroups>,

    @InjectModel(SSTTopics)
    private readonly topicsModel: ReturnModelType<typeof SSTTopics>,

    @InjectModel(SSTTeacherTopics)
    private readonly teacherTopicsModel: ReturnModelType<typeof SSTTeacherTopics>,

    @InjectModel(SSTExams)
    private readonly examsModel: ReturnModelType<typeof SSTExams>,

    @InjectModel(SSTGrammarExercises)
    private readonly grammarModel: ReturnModelType<typeof SSTGrammarExercises>,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Helper — resolve the Typegoose model for a given resource type
  // ─────────────────────────────────────────────────────────────────────────

  private resourceModel(resourceType: string) {
    switch (resourceType) {
      case 'topic':         return this.topicsModel;
      case 'teacher_topic': return this.teacherTopicsModel;
      case 'grammar':       return this.grammarModel;
      case 'exam':          return this.examsModel;
      default:
        throw new BadRequestException(
          `Unknown resourceType "${resourceType}". Valid: topic | teacher_topic | grammar | exam`,
        );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // User lookup
  // Mirrors findTeacherByEmail + a student version from teacherService.js
  // Uses Accounts (not SSTUsers) for lookup — covers all roles
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Find a user by email address.
   * First checks the SST user collection (for role/access data),
   * then falls back to Accounts (for cross-app lookup).
   * roleFilter: 'teacher' | 'student' | 'user' | 'admin' — optional
   */
  async findUserByEmail(email: string, roleFilter?: string) {
    if (!email) throw new BadRequestException('email is required');
    const normalizedEmail = email.toLowerCase().trim();

    // Try SSTUsers first (has role context)
    const sstUser = await this.sstUsersModel.findOne({ email: normalizedEmail }).lean();
    if (sstUser) {
      if (roleFilter && sstUser.role !== roleFilter) return null;
      return {
        id: (sstUser as any)._id,
        email: sstUser.email,
        displayName: sstUser.displayName || sstUser.email,
        role: sstUser.role,
        source: 'sst',
      };
    }

    // Fall back to Accounts
    const account = await this.accountsModel
      .findOne({ emailAddresses: normalizedEmail })
      .lean();
    if (account) {
      if (roleFilter && (account as any).role !== roleFilter) return null;
      return {
        id: (account as any)._id,
        email: normalizedEmail,
        displayName: `${account.firstName} ${account.lastName}`.trim() || normalizedEmail,
        role: (account as any).role,
        source: 'accounts',
      };
    }

    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Mode 1: Public toggle
  // resource.isPublic = true | false
  // Mirrors teacherService.saveTeacherTopic / examService / grammarService
  // ─────────────────────────────────────────────────────────────────────────

  async togglePublic(resourceType: string, resourceId: string, isPublic: boolean) {
    const model = this.resourceModel(resourceType);
    const updated = await (model as any)
      .findByIdAndUpdate(resourceId, { $set: { isPublic } }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`${resourceType} "${resourceId}" not found`);
    return { updated: true, isPublic };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Mode 2: Teacher-visible toggle (admin resources only)
  // resource.teacherVisible = true | false
  // ─────────────────────────────────────────────────────────────────────────

  async toggleTeacherVisible(resourceType: string, resourceId: string, teacherVisible: boolean) {
    const model = this.resourceModel(resourceType);
    const updated = await (model as any)
      .findByIdAndUpdate(resourceId, { $set: { teacherVisible } }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`${resourceType} "${resourceId}" not found`);
    return { updated: true, teacherVisible };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Mode 3: Group access
  // Adds/removes resourceId from group.topicAccess / grammarAccess / examAccess
  // createAssignment() calls addGroupAccess internally (auto-share)
  // ─────────────────────────────────────────────────────────────────────────

  async addGroupAccess(groupId: string, resourceType: string, resourceId: string) {
    const field = ACCESS_FIELD_MAP[resourceType];
    if (!field) throw new BadRequestException(`resourceType "${resourceType}" does not have a group access array. Valid: topic | grammar | exam`);

    const group = await this.groupsModel.findById(groupId);
    if (!group) throw new NotFoundException(`Group "${groupId}" not found`);

    await this.groupsModel.findByIdAndUpdate(groupId, { $addToSet: { [field]: resourceId } });
    return { updated: true, groupId, field, resourceId };
  }

  async removeGroupAccess(groupId: string, resourceType: string, resourceId: string) {
    const field = ACCESS_FIELD_MAP[resourceType];
    if (!field) throw new BadRequestException(`No access array for resourceType "${resourceType}"`);

    await this.groupsModel.findByIdAndUpdate(groupId, { $pull: { [field]: resourceId } });
    return { updated: true, groupId, field, resourceId };
  }

  /**
   * Sync group access — given a resource and a desired final list of group IDs,
   * adds the resource to groups that don't already have it, and removes from groups
   * that lost access. Mirrors the ShareModal group toggle behavior.
   */
  async syncGroupAccess(resourceType: string, resourceId: string, desiredGroupIds: string[]) {
    const field = ACCESS_FIELD_MAP[resourceType];
    if (!field) throw new BadRequestException(`No access array for resourceType "${resourceType}"`);

    // Find all groups currently containing this resourceId in their access array
    const currentGroups = await this.groupsModel.find({ [field]: resourceId }).lean();
    const currentGroupIds = currentGroups.map((g: any) => String(g._id));

    const toAdd = desiredGroupIds.filter(id => !currentGroupIds.includes(id));
    const toRemove = currentGroupIds.filter(id => !desiredGroupIds.includes(id));

    const ops: Promise<any>[] = [];
    for (const gId of toAdd) {
      ops.push(this.groupsModel.findByIdAndUpdate(gId, { $addToSet: { [field]: resourceId } }));
    }
    for (const gId of toRemove) {
      ops.push(this.groupsModel.findByIdAndUpdate(gId, { $pull: { [field]: resourceId } }));
    }
    await Promise.all(ops);

    return { added: toAdd.length, removed: toRemove.length, addedGroupIds: toAdd, removedGroupIds: toRemove };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Mode 4: Individual user access
  // Adds/removes resourceId from SSTUsers.topicAccess / grammarAccess / examAccess
  // Looks up user via email if needed
  // ─────────────────────────────────────────────────────────────────────────

  async addUserAccess(params: {
    userEmail?: string;
    userId?: string;
    resourceType: string;
    resourceId: string;
  }) {
    const { resourceType, resourceId } = params;
    const field = ACCESS_FIELD_MAP[resourceType];
    if (!field) throw new BadRequestException(`No access array for resourceType "${resourceType}"`);

    const userId = await this.resolveUserId(params.userId, params.userEmail);

    await this.sstUsersModel.findByIdAndUpdate(userId, { $addToSet: { [field]: resourceId } });
    return { updated: true, userId, field, resourceId };
  }

  async removeUserAccess(userId: string, resourceType: string, resourceId: string) {
    const field = ACCESS_FIELD_MAP[resourceType];
    if (!field) throw new BadRequestException(`No access array for resourceType "${resourceType}"`);

    await this.sstUsersModel.findByIdAndUpdate(userId, { $pull: { [field]: resourceId } });
    return { updated: true, userId, field, resourceId };
  }

  async getUserAccess(userId: string) {
    const user = await this.sstUsersModel.findById(userId).lean();
    if (!user) throw new NotFoundException(`User "${userId}" not found in SST users`);
    return {
      userId,
      topicAccess: user.topicAccess || [],
      grammarAccess: user.grammarAccess || [],
      examAccess: user.examAccess || [],
      folderAccess: user.folderAccess || [],
      groupIds: user.groupIds || [],
    };
  }

  async getResourceAccess(resourceType: string, resourceId: string) {
    const field = ACCESS_FIELD_MAP[resourceType];
    if (!field) throw new BadRequestException(`No access array for resourceType "${resourceType}"`);

    const usersWithAccess = await this.sstUsersModel.find({ [field]: resourceId }).lean();
    const users = usersWithAccess.map((u: any) => ({
      uid: String(u._id),
      email: u.email,
      displayName: u.displayName || u.email,
      role: u.role
    }));

    const groupsWithAccess = await this.groupsModel.find({ [field]: resourceId }).lean();
    const groups = groupsWithAccess.map((g: any) => ({
      id: String(g._id),
      name: g.name
    }));

    return { users, groups };
  }


  // ─────────────────────────────────────────────────────────────────────────
  // Mode 5: Teacher collaboration
  // Mirrors addCollaborator / removeCollaborator / updateCollaboratorRole /
  //         transferOwnership / getCollaboratedResources from teacherService.js
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Add a collaborator to a teacher resource.
   * Updates resource.collaboratorIds[], collaboratorNames{}, collaboratorRoles{}.
   * Sends in-app notification to the collaborator.
   */
  async addCollaborator(params: {
    resourceType: string;
    resourceId: string;
    collaboratorEmail?: string;
    collaboratorId?: string;
    role?: 'editor' | 'viewer';
  }) {
    const { resourceType, resourceId, role = 'editor' } = params;
    if (!['teacher_topic', 'grammar', 'exam'].includes(resourceType)) {
      throw new BadRequestException('addCollaborator only supports: teacher_topic | grammar | exam');
    }
    if (!['editor', 'viewer'].includes(role)) throw new BadRequestException('role must be editor | viewer');

    const collabId = await this.resolveUserId(params.collaboratorId, params.collaboratorEmail);
    const collabUser = await this.sstUsersModel.findById(collabId).lean();
    const collabName = collabUser?.displayName || collabUser?.email || 'Giáo viên';

    const model = this.resourceModel(resourceType);
    const resource = await (model as any).findById(resourceId).lean();
    if (!resource) throw new NotFoundException(`${resourceType} "${resourceId}" not found`);

    await (model as any).findByIdAndUpdate(resourceId, {
      $addToSet: { collaboratorIds: collabId },
      $set: {
        [`collaboratorNames.${collabId}`]: collabName,
        [`collaboratorRoles.${collabId}`]: role,
      },
    });

    // In-app notification (non-blocking, best effort)
    this.sendCollabNotification(collabId, {
      type: 'collab_invite',
      title: '🤝 Bạn được mời hợp tác',
      message: `Bạn được mời ${role === 'viewer' ? 'xem & sử dụng' : 'cộng tác chỉnh sửa'} ${TYPE_LABELS[resourceType] || 'bài học'} "${resource['name'] || resource['title'] || ''}"`,
    });

    return { updated: true, resourceId, collaboratorId: collabId, role };
  }

  /**
   * Remove a collaborator from a teacher resource.
   * Removes entry from collaboratorIds, collaboratorNames, collaboratorRoles maps.
   */
  async removeCollaborator(resourceType: string, resourceId: string, collaboratorId: string) {
    if (!['teacher_topic', 'grammar', 'exam'].includes(resourceType)) {
      throw new BadRequestException('removeCollaborator only supports: teacher_topic | grammar | exam');
    }
    const model = this.resourceModel(resourceType);
    const resource = await (model as any).findById(resourceId).lean();
    if (!resource) throw new NotFoundException(`${resourceType} "${resourceId}" not found`);

    const updatedNames = { ...(resource['collaboratorNames'] || {}) };
    delete updatedNames[collaboratorId];
    const updatedRoles = { ...(resource['collaboratorRoles'] || {}) };
    delete updatedRoles[collaboratorId];

    await (model as any).findByIdAndUpdate(resourceId, {
      $pull: { collaboratorIds: collaboratorId },
      $set: {
        collaboratorNames: updatedNames,
        collaboratorRoles: updatedRoles,
      },
    });

    this.sendCollabNotification(collaboratorId, {
      type: 'collab_removed',
      title: 'Đã bị gỡ khỏi danh sách cộng tác',
      message: `Bạn đã bị gỡ khỏi danh sách cộng tác viên của ${TYPE_LABELS[resourceType] || 'bài học'} "${resource['name'] || resource['title'] || ''}"`,
    });

    return { updated: true, resourceId, collaboratorId };
  }

  /**
   * Update a collaborator's role (viewer / editor).
   */
  async updateCollaboratorRole(
    resourceType: string,
    resourceId: string,
    collaboratorId: string,
    role: 'editor' | 'viewer',
  ) {
    if (!['editor', 'viewer'].includes(role)) throw new BadRequestException('role must be editor | viewer');
    const model = this.resourceModel(resourceType);
    await (model as any).findByIdAndUpdate(resourceId, {
      $set: { [`collaboratorRoles.${collaboratorId}`]: role },
    });
    return { updated: true, resourceId, collaboratorId, role };
  }

  /**
   * Transfer ownership of a resource to a new owner.
   * The old owner becomes an 'editor' collaborator.
   * Mirrors transferOwnership() from teacherService.js exactly:
   *  - For exams: owner field is 'createdBy'
   *  - For teacher_topics / grammar: owner field is 'teacherId'
   */
  async transferOwnership(params: {
    resourceType: string;
    resourceId: string;
    oldOwnerId: string;
    oldOwnerName?: string;
    newOwnerEmail?: string;
    newOwnerId?: string;
    newOwnerName?: string;
    resourceName?: string;
  }) {
    const { resourceType, resourceId, oldOwnerId, resourceName = '' } = params;
    if (!['teacher_topic', 'grammar', 'exam'].includes(resourceType)) {
      throw new BadRequestException('transferOwnership only supports: teacher_topic | grammar | exam');
    }

    const newOwnerId = await this.resolveUserId(params.newOwnerId, params.newOwnerEmail);
    const newOwnerUser = await this.sstUsersModel.findById(newOwnerId).lean();
    const newOwnerName = params.newOwnerName || newOwnerUser?.displayName || 'Giáo viên';
    const oldOwnerName = params.oldOwnerName || 'Giáo viên';

    const model = this.resourceModel(resourceType);
    const resource = await (model as any).findById(resourceId).lean();
    if (!resource) throw new NotFoundException(`${resourceType} "${resourceId}" not found`);

    // Determine owner field (mirrors original JS: exams use 'createdBy', others use 'teacherId')
    const ownerField = resourceType === 'exam' ? 'createdBy' : 'teacherId';

    // Build updated collaborator maps: remove new owner, add old owner as editor
    const currentCollabIds: string[] = resource['collaboratorIds'] || [];
    const updatedCollabIds = currentCollabIds.filter(id => id !== newOwnerId);
    if (!updatedCollabIds.includes(oldOwnerId)) updatedCollabIds.push(oldOwnerId);

    const updatedNames = { ...(resource['collaboratorNames'] || {}) };
    delete updatedNames[newOwnerId];
    updatedNames[oldOwnerId] = oldOwnerName;

    const updatedRoles = { ...(resource['collaboratorRoles'] || {}) };
    delete updatedRoles[newOwnerId];
    updatedRoles[oldOwnerId] = 'editor';

    await (model as any).findByIdAndUpdate(resourceId, {
      $set: {
        [ownerField]: newOwnerId,
        collaboratorIds: updatedCollabIds,
        collaboratorNames: updatedNames,
        collaboratorRoles: updatedRoles,
      },
    });

    // Notifications (non-blocking)
    const label = TYPE_LABELS[resourceType] || 'bài học';
    this.sendCollabNotification(newOwnerId, {
      type: 'ownership_received',
      title: '🎉 Bạn đã được chuyển nhượng quyền sở hữu',
      message: `Bạn đã nhận quyền sở hữu ${label} "${resourceName}" từ ${oldOwnerName}.`,
    });
    this.sendCollabNotification(oldOwnerId, {
      type: 'ownership_transferred',
      title: 'Đã chuyển nhượng quyền sở hữu',
      message: `Bạn đã chuyển nhượng quyền sở hữu ${label} "${resourceName}" cho ${newOwnerName}. Bạn vẫn là cộng tác viên.`,
    });

    return { updated: true, resourceId, newOwnerId, oldOwnerOwnerId: oldOwnerId, ownerField };
  }

  /**
   * Get all resources of a type where a teacher is a collaborator.
   * Mirrors getCollaboratedResources() from teacherService.js.
   */
  async getCollaboratedResources(resourceType: string, teacherId: string) {
    const model = this.resourceModel(resourceType);
    const results = await (model as any)
      .find({ collaboratorIds: teacherId })
      .lean();
    return results;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Mode 6: Admin per-teacher sharing
  // resource.sharedWithTeacherIds = []  (admin content: topics, grammar, exams)
  // ─────────────────────────────────────────────────────────────────────────

  async addTeacherShare(params: {
    resourceType: string;
    resourceId: string;
    teacherEmail?: string;
    teacherId?: string;
  }) {
    const { resourceType, resourceId } = params;
    const model = this.resourceModel(resourceType);
    const resource = await (model as any).findById(resourceId).lean();
    if (!resource) throw new NotFoundException(`${resourceType} "${resourceId}" not found`);

    const teacherId = await this.resolveUserId(params.teacherId, params.teacherEmail);
    await (model as any).findByIdAndUpdate(resourceId, {
      $addToSet: { sharedWithTeacherIds: teacherId },
    });

    return { updated: true, resourceId, teacherId };
  }

  async removeTeacherShare(resourceType: string, resourceId: string, teacherId: string) {
    const model = this.resourceModel(resourceType);
    await (model as any).findByIdAndUpdate(resourceId, {
      $pull: { sharedWithTeacherIds: teacherId },
    });
    return { updated: true, resourceId, teacherId };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Resolve a user ID from either a provided ID or email lookup.
   * Checks SSTUsers first, then Accounts.
   */
  private async resolveUserId(userId?: string, email?: string): Promise<string> {
    if (userId) return userId;
    if (!email) throw new BadRequestException('Either userId or email must be provided');

    const found = await this.findUserByEmail(email);
    if (!found) throw new NotFoundException(`No user found with email "${email}"`);
    return found.id;
  }

  /**
   * Non-blocking in-app notification helper.
   * Notifications are stored in the sst-notifications collection.
   * This directly creates a notification document without importing NotificationsService
   * to keep the sharing module self-contained (same pattern as the original JS code
   * which imported notificationService lazily).
   */
  private sendCollabNotification(
    userId: string,
    payload: { type: string; title: string; message: string; link?: string },
  ) {
    // Non-blocking best-effort (fire-and-forget, like the original JS)
    // Notifications module handles its own schema — we use raw mongoose here
    // to avoid circular imports. SharingService intentionally doesn't inject
    // NotificationsService to keep the dependency graph clean.
    this.sstUsersModel.db
      .collection('sst-notifications')
      .insertOne({
        userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        link: payload.link || '/teacher',
        isRead: false,
        createdAt: new Date(),
      })
      .catch(err => this.logger.error('Failed to create collab notification', err));
  }
}
