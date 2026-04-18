import {
  Injectable, Logger, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import {
  SSTUserGroups,
  SSTNotifications,
  SSTTopics,
  SSTTopicFolders,
  SSTTeacherTopics,
  SSTTeacherTopicFolders,
  SSTExams,
  SSTExamFolders,
  SSTGrammarExercises,
  SSTGrammarFolders,
  SSTTeacherExamFolders,
  SSTTeacherGrammarFolders,
} from 'apps/common/src/database/mongodb/src/superstudy';
import { Accounts } from 'apps/common/src/database/mongodb/src/isms';

// â”€â”€â”€ Constants matching the original Firestore collection names â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const RESOURCE_TYPE_MAP: Record<string, string> = {
  folder: 'topic_folders',
  topic: 'topics',
  teacher_topic: 'teacher_topics',
  teacher_topic_folder: 'teacher_topic_folders',
  grammar: 'grammar_exercises',
  grammar_folder: 'grammar_folders',
  exam: 'exams',
  exam_folder: 'exam_folders',
  teacher_grammar_folder: 'teacher_grammar_folders',
  teacher_exam_folder: 'teacher_exam_folders',
};

const ACCESS_FIELD_MAP: Record<string, string> = {
  folder: 'folderAccess',
  topic: 'topicAccess',
  teacher_topic: 'topicAccess',
  grammar: 'grammarAccess',
  exam: 'examAccess',
  grammar_folder: 'folderAccess',
  exam_folder: 'folderAccess',
  teacher_topic_folder: 'folderAccess',
  teacher_grammar_folder: 'folderAccess',
  teacher_exam_folder: 'folderAccess',
};

const TYPE_LABELS: Record<string, string> = {
  teacher_topic: 'bÃ i tá»« vá»±ng',
  grammar: 'bÃ i Ká»¹ nÄƒng',
  exam: 'bÃ i táº­p vÃ  kiá»ƒm tra',
};

@Injectable()
export class SharingService {
  private readonly logger = new Logger(SharingService.name);

  constructor(
    @InjectModel(Accounts)
    private readonly accountsModel: ReturnModelType<typeof Accounts>,

    @InjectModel(SSTUserGroups)
    private readonly groupsModel: ReturnModelType<typeof SSTUserGroups>,

    @InjectModel(SSTNotifications)
    private readonly notificationsModel: ReturnModelType<typeof SSTNotifications>,

    @InjectModel(SSTTopics)
    private readonly topicsModel: ReturnModelType<typeof SSTTopics>,

    @InjectModel(SSTTopicFolders)
    private readonly topicFoldersModel: ReturnModelType<typeof SSTTopicFolders>,

    @InjectModel(SSTTeacherTopics)
    private readonly teacherTopicsModel: ReturnModelType<typeof SSTTeacherTopics>,

    @InjectModel(SSTTeacherTopicFolders)
    private readonly teacherTopicFoldersModel: ReturnModelType<typeof SSTTeacherTopicFolders>,

    @InjectModel(SSTExams)
    private readonly examsModel: ReturnModelType<typeof SSTExams>,

    @InjectModel(SSTExamFolders)
    private readonly examFoldersModel: ReturnModelType<typeof SSTExamFolders>,

    @InjectModel(SSTGrammarExercises)
    private readonly grammarModel: ReturnModelType<typeof SSTGrammarExercises>,

    @InjectModel(SSTGrammarFolders)
    private readonly grammarFoldersModel: ReturnModelType<typeof SSTGrammarFolders>,

    @InjectModel(SSTTeacherGrammarFolders)
    private readonly teacherGrammarFoldersModel: ReturnModelType<typeof SSTTeacherGrammarFolders>,

    @InjectModel(SSTTeacherExamFolders)
    private readonly teacherExamFoldersModel: ReturnModelType<typeof SSTTeacherExamFolders>,
  ) {}

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Helper â€” resolve the Typegoose model for a given resource type
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private resourceModel(resourceType: string) {
    switch (resourceType) {
      case 'folder':         return this.topicFoldersModel;
      case 'topic':         return this.topicsModel;
      case 'teacher_topic': return this.teacherTopicsModel;
      case 'teacher_topic_folder': return this.teacherTopicFoldersModel;
      case 'grammar':       return this.grammarModel;
      case 'grammar_folder': return this.grammarFoldersModel;
      case 'exam':          return this.examsModel;
      case 'exam_folder':   return this.examFoldersModel;
      case 'teacher_grammar_folder': return this.teacherGrammarFoldersModel;
      case 'teacher_exam_folder': return this.teacherExamFoldersModel;
      default:
        throw new BadRequestException(
          `Unknown resourceType "${resourceType}". Valid: folder | topic | teacher_topic | teacher_topic_folder | grammar | grammar_folder | exam | exam_folder | teacher_grammar_folder | teacher_exam_folder`,
        );
    }
  }

  private isFolderResource(resourceType: string) {
    return ACCESS_FIELD_MAP[resourceType] === 'folderAccess';
  }

  private normalizeEmail(value?: string | null) {
    return String(value ?? '').trim().toLowerCase();
  }

  private toSuperStudyRole(role?: string | null) {
    if (!role) return null;
    return role === 'student' ? 'user' : role;
  }

  private getAccountPrimaryEmail(account: any) {
    const emailAddresses = Array.isArray(account?.emailAddresses) ? account.emailAddresses : [];
    return this.normalizeEmail(account?.email || emailAddresses[0] || '');
  }

  private getAccountDisplayName(account: any) {
    return String(account?.displayName ?? '').trim()
      || [account?.firstName, account?.lastName].filter(Boolean).join(' ').trim()
      || this.getAccountPrimaryEmail(account)
      || String(account?.accountId || account?._id || '');
  }

  private normalizeAccountSummary(account: any) {
    if (!account) return null;

    const uid = String(account.accountId || account._id || '').trim();
    if (!uid) return null;

    return {
      uid,
      id: uid,
      email: this.getAccountPrimaryEmail(account),
      displayName: this.getAccountDisplayName(account),
      role: this.toSuperStudyRole(account.role),
      groupIds: Array.isArray(account.groupIds) ? account.groupIds : [],
      folderAccess: Array.isArray(account.folderAccess) ? account.folderAccess : [],
      topicAccess: Array.isArray(account.topicAccess) ? account.topicAccess : [],
      grammarAccess: Array.isArray(account.grammarAccess) ? account.grammarAccess : [],
      examAccess: Array.isArray(account.examAccess) ? account.examAccess : [],
      emailPreferences: account.emailPreferences || {},
      teacherTitle: account.teacherTitle ?? null,
      studentTitle: account.studentTitle ?? null,
      photoURL: account.photoURL ?? account.profilePhoto ?? null,
      disabled: Boolean(account.disabled ?? account.deleted),
      status: account.status ?? (account.active === false ? 'pending' : 'approved'),
    };
  }

  private async findAccountByUserId(userId: string) {
    const normalizedId = String(userId || '').trim();
    if (!normalizedId) return null;

    return this.accountsModel
      .findOne({
        $or: [{ accountId: normalizedId }, { _id: normalizedId }],
      })
      .lean();
  }

  private async getResolvedUser(userId: string) {
    const normalizedId = String(userId || '').trim();
    const account = await this.findAccountByUserId(normalizedId);
    const summary = this.normalizeAccountSummary(account);

    return {
      normalizedUserId: String(account?.accountId || normalizedId),
      account,
      legacyUser: null,
      summary,
    };
  }

  private async updateUserAccessField(userId: string, field: string, action: 'add' | 'remove', resourceId: string) {
    const resolved = await this.getResolvedUser(userId);
    const normalizedUserId = resolved.normalizedUserId;
    if (!resolved.account) {
      throw new NotFoundException(`User "${normalizedUserId}" not found`);
    }

    const update =
      action === 'add'
        ? { $addToSet: { [field]: resourceId } }
        : { $pull: { [field]: resourceId } };

    const operations: Promise<any>[] = [];

    if (resolved.account) {
      operations.push(
        this.accountsModel.updateMany(
          { $or: [{ accountId: normalizedUserId }, { _id: normalizedUserId }] },
          update,
        ),
      );
    }

    await Promise.all(operations);

    return this.getResolvedUser(normalizedUserId);
  }

  private async getUserSummaryById(userId: string) {
    const resolved = await this.getResolvedUser(userId);
    return resolved.summary;
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // User lookup
  // Mirrors findTeacherByEmail + a student version from teacherService.js
  // Uses account-backed records for lookup across all roles
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Find a user by email address.
   * Resolves against the shared account record used by SuperStudy.
   * roleFilter: 'teacher' | 'student' | 'user' | 'admin' â€” optional
   */
  async findUserByEmail(email: string, roleFilter?: string) {
    if (!email) throw new BadRequestException('email is required');
    const normalizedEmail = this.normalizeEmail(email);

    const account = await this.accountsModel.findOne({ emailAddresses: normalizedEmail }).lean();
    const summary = this.normalizeAccountSummary(account);

    if (summary) {
      if (roleFilter && summary.role !== roleFilter) return null;
      return {
        id: summary.id,
        uid: summary.uid,
        email: summary.email,
        displayName: summary.displayName,
        role: summary.role,
        source: 'accounts',
      };
    }

    return null;
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Mode 1: Public toggle
  // resource.isPublic = true | false
  // Mirrors teacherService.saveTeacherTopic / examService / grammarService
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async togglePublic(resourceType: string, resourceId: string, isPublic: boolean) {
    const model = this.resourceModel(resourceType);
    const updateSet = this.isFolderResource(resourceType)
      ? { isPublic, public: isPublic }
      : { isPublic };
    const updated = await (model as any)
      .findByIdAndUpdate(resourceId, { $set: updateSet }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`${resourceType} "${resourceId}" not found`);
    return { updated: true, isPublic };
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Mode 2: Teacher-visible toggle (admin resources only)
  // resource.teacherVisible = true | false
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async toggleTeacherVisible(resourceType: string, resourceId: string, teacherVisible: boolean) {
    const model = this.resourceModel(resourceType);
    const updated = await (model as any)
      .findByIdAndUpdate(resourceId, { $set: { teacherVisible } }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`${resourceType} "${resourceId}" not found`);
    return { updated: true, teacherVisible };
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Mode 3: Group access
  // Adds/removes resourceId from group.topicAccess / grammarAccess / examAccess
  // createAssignment() calls addGroupAccess internally (auto-share)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
   * Sync group access â€” given a resource and a desired final list of group IDs,
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Mode 4: Individual user access
  // Adds/removes resourceId from Accounts.topicAccess / grammarAccess / examAccess
  // Looks up user via email if needed
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    const resolved = await this.updateUserAccessField(userId, field, 'add', resourceId);
    const user = resolved.summary;
    return {
      updated: true,
      userId: resolved.normalizedUserId,
      field,
      resourceId,
      uid: user?.uid || resolved.normalizedUserId,
      id: user?.id || resolved.normalizedUserId,
      email: user?.email,
      displayName: user?.displayName,
      role: user?.role,
    };
  }

  async removeUserAccess(userId: string, resourceType: string, resourceId: string) {
    const field = ACCESS_FIELD_MAP[resourceType];
    if (!field) throw new BadRequestException(`No access array for resourceType "${resourceType}"`);

    const resolved = await this.updateUserAccessField(userId, field, 'remove', resourceId);
    return { updated: true, userId: resolved.normalizedUserId, field, resourceId };
  }

  async getUserAccess(userId: string) {
    const user = await this.getUserSummaryById(userId);
    if (!user) throw new NotFoundException(`User "${userId}" not found`);
    return {
      userId: user.uid || userId,
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

    const accountUsersWithAccess = await this.accountsModel.find({ [field]: resourceId }).lean();

    const userMap = new Map<string, any>();
    for (const accountUser of accountUsersWithAccess) {
      const summary = this.normalizeAccountSummary(accountUser);
      if (!summary?.uid) continue;
      userMap.set(summary.uid, {
        uid: summary.uid,
        email: summary.email,
        displayName: summary.displayName,
        role: summary.role,
      });
    }
    const users = Array.from(userMap.values());

    const groupsWithAccess = await this.groupsModel.find({ [field]: resourceId }).lean();
    const groups = groupsWithAccess.map((g: any) => ({
      id: String(g._id),
      name: g.name
    }));

    return { users, groups };
  }


  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Mode 5: Teacher collaboration
  // Mirrors addCollaborator / removeCollaborator / updateCollaboratorRole /
  //         transferOwnership / getCollaboratedResources from teacherService.js
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    const collabUser = await this.getUserSummaryById(collabId);
    const collabName = collabUser?.displayName || collabUser?.email || 'Teacher';

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
      title: 'ðŸ¤ Báº¡n Ä‘Æ°á»£c má»i há»£p tÃ¡c',
      message: `Báº¡n Ä‘Æ°á»£c má»i ${role === 'viewer' ? 'xem & sá»­ dá»¥ng' : 'cá»™ng tÃ¡c chá»‰nh sá»­a'} ${TYPE_LABELS[resourceType] || 'bÃ i há»c'} "${resource['name'] || resource['title'] || ''}"`,
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
      title: 'ÄÃ£ bá»‹ gá»¡ khá»i danh sÃ¡ch cá»™ng tÃ¡c',
      message: `Báº¡n Ä‘Ã£ bá»‹ gá»¡ khá»i danh sÃ¡ch cá»™ng tÃ¡c viÃªn cá»§a ${TYPE_LABELS[resourceType] || 'bÃ i há»c'} "${resource['name'] || resource['title'] || ''}"`,
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

  private async transferOfficialTopicToTeacher(topicId: string, newOwnerId: string, newOwnerName: string) {
    const topic = await this.topicsModel.findById(topicId).lean();
    if (!topic) throw new NotFoundException(`topic "${topicId}" not found`);

    const payload: Record<string, any> = {
      ...topic,
      teacherId: newOwnerId,
      createdBy: newOwnerId,
      createdByName: newOwnerName,
      createdByRole: 'teacher',
      transferredAt: new Date(),
      transferredFromOfficial: topicId,
      isDeleted: false,
      deletedAt: null,
      isPublic: false,
      collaboratorIds: [],
      collaboratorNames: [],
      collaboratorRoles: [],
      sharedWithTeacherIds: [],
      properties: (topic as any).properties || 'SYSTEM',
      propertiesBranches: (topic as any).propertiesBranches || 'SYSTEM',
    };

    delete payload._id;
    const created = await this.teacherTopicsModel.create(payload);
    await this.topicsModel.findByIdAndDelete(topicId);
    return String(created._id);
  }

  private async transferOfficialFolderToTeacher(folderId: string, newOwnerId: string, newOwnerName: string) {
    const folder = await this.topicFoldersModel.findById(folderId).lean();
    if (!folder) throw new NotFoundException(`folder "${folderId}" not found`);

    const sourceTopicIds = Array.isArray(folder.topicIds) ? folder.topicIds : [];
    const transferredTopicIds: string[] = [];

    for (const topicId of sourceTopicIds) {
      try {
        const existingTransferredTopic = await this.teacherTopicsModel
          .findOne({
            transferredFromOfficial: String(topicId),
            teacherId: newOwnerId,
          })
          .lean();

        if (existingTransferredTopic?._id) {
          transferredTopicIds.push(String(existingTransferredTopic._id));
          continue;
        }

        const transferredId = await this.transferOfficialTopicToTeacher(String(topicId), newOwnerId, newOwnerName);
        transferredTopicIds.push(transferredId);
      } catch (error) {
        this.logger.error(`Failed to transfer official topic "${topicId}"`, error as any);
      }
    }

    const payload: Record<string, any> = {
      ...folder,
      teacherId: newOwnerId,
      createdBy: newOwnerId,
      createdByName: newOwnerName,
      createdByRole: 'teacher',
      transferredAt: new Date(),
      transferredFromOfficial: folderId,
      topicIds: transferredTopicIds,
      icon: folder.icon || '📁',
      color: folder.color || '#3b82f6',
      appSystemFolder: false,
      ownFolder: true,
      isDeleted: false,
      deletedAt: null,
      isPublic: false,
      public: false,
      teacherVisible: false,
      sharedWithTeacherIds: [],
      properties: (folder as any).properties || 'SYSTEM',
      propertiesBranches: (folder as any).propertiesBranches || 'SYSTEM',
    };

    delete payload._id;
    const created = await this.teacherTopicFoldersModel.create(payload);
    await this.topicFoldersModel.findByIdAndDelete(folderId);
    return String(created._id);
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
    const newOwnerId = await this.resolveUserId(params.newOwnerId, params.newOwnerEmail);
    const newOwnerUser = await this.getUserSummaryById(newOwnerId);
    const newOwnerName = params.newOwnerName || newOwnerUser?.displayName || 'Teacher';
    const oldOwnerName = params.oldOwnerName || 'Teacher';

    if (resourceType === 'topic') {
      const targetDocId = await this.transferOfficialTopicToTeacher(resourceId, newOwnerId, newOwnerName);
      return { updated: true, resourceId, newOwnerId, targetDocId, ownerField: 'teacherId' };
    }

    if (resourceType === 'folder') {
      const targetDocId = await this.transferOfficialFolderToTeacher(resourceId, newOwnerId, newOwnerName);
      return { updated: true, resourceId, newOwnerId, targetDocId, ownerField: 'teacherId' };
    }

    if (!['teacher_topic', 'grammar', 'exam'].includes(resourceType)) {
      throw new BadRequestException('transferOwnership only supports: topic | folder | teacher_topic | grammar | exam');
    }

    const model = this.resourceModel(resourceType);
    const resource = await (model as any).findById(resourceId).lean();
    if (!resource) throw new NotFoundException(`${resourceType} "${resourceId}" not found`);

    const ownerField = resourceType === 'exam' ? 'createdBy' : 'teacherId';
    const currentCollabIds: string[] = resource['collaboratorIds'] || [];
    const updatedCollabIds = currentCollabIds.filter(id => id !== newOwnerId);
    if (oldOwnerId && !updatedCollabIds.includes(oldOwnerId)) updatedCollabIds.push(oldOwnerId);

    const updatedNames = { ...(resource['collaboratorNames'] || {}) };
    delete updatedNames[newOwnerId];
    if (oldOwnerId) updatedNames[oldOwnerId] = oldOwnerName;

    const updatedRoles = { ...(resource['collaboratorRoles'] || {}) };
    delete updatedRoles[newOwnerId];
    if (oldOwnerId) updatedRoles[oldOwnerId] = 'editor';

    await (model as any).findByIdAndUpdate(resourceId, {
      $set: {
        [ownerField]: newOwnerId,
        collaboratorIds: updatedCollabIds,
        collaboratorNames: updatedNames,
        collaboratorRoles: updatedRoles,
      },
    });

    const label = TYPE_LABELS[resourceType] || 'bài học';
    this.sendCollabNotification(newOwnerId, {
      type: 'ownership_received',
      title: 'Bạn đã được chuyển nhượng quyền sở hữu',
      message: `Bạn đã nhận quyền sở hữu ${label} "${resourceName}" từ ${oldOwnerName}.`,
    });
    if (oldOwnerId) {
      this.sendCollabNotification(oldOwnerId, {
        type: 'ownership_transferred',
        title: 'Đã chuyển nhượng quyền sở hữu',
        message: `Bạn đã chuyển nhượng quyền sở hữu ${label} "${resourceName}" cho ${newOwnerName}. Bạn vẫn là cộng tác viên.`,
      });
    }

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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Mode 6: Admin per-teacher sharing
  // resource.sharedWithTeacherIds = []  (admin content: topics, grammar, exams)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

    const teacher = await this.getUserSummaryById(teacherId);
    return {
      updated: true,
      resourceId,
      teacherId,
      uid: teacher?.uid || teacherId,
      id: teacher?.id || teacherId,
      email: teacher?.email,
      displayName: teacher?.displayName,
      role: teacher?.role,
    };
  }

  async removeTeacherShare(resourceType: string, resourceId: string, teacherId: string) {
    const model = this.resourceModel(resourceType);
    await (model as any).findByIdAndUpdate(resourceId, {
      $pull: { sharedWithTeacherIds: teacherId },
    });
    return { updated: true, resourceId, teacherId };
  }

  async getTeacherShares(resourceType: string, resourceId: string) {
    const model = this.resourceModel(resourceType);
    const resource = await (model as any).findById(resourceId).lean();
    if (!resource) throw new NotFoundException(`${resourceType} "${resourceId}" not found`);

    const teacherIds = Array.isArray(resource['sharedWithTeacherIds']) ? resource['sharedWithTeacherIds'] : [];
    const teachers = await Promise.all(
      teacherIds.map((teacherId: string) => this.getUserSummaryById(String(teacherId))),
    );
    return teachers.filter(Boolean);
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Private helpers
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Resolve a user ID from either a provided ID or email lookup.
   * Resolves against account-backed user records.
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
   * Sharing writes directly through the notifications model to avoid a circular
   * dependency on NotificationsService while still using the real Nest model.
   */
  private sendCollabNotification(
    userId: string,
    payload: { type: string; title: string; message: string; link?: string },
  ) {
    this.notificationsModel
      .create({
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

