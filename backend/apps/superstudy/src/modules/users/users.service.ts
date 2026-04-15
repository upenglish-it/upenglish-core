import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import {
  SSTAssignments,
  SSTExamAssignments,
  SSTExamSubmissions,
  SSTTeacherRatings,
  SSTTeacherRatingSummaries,
  SSTSkillReports,
  SSTRedFlags,
  SSTNotifications,
  SSTAnonymousFeedback,
  SSTMailQueue,
  SSTEmailWhitelist,
  SSTRewardPoints,
} from 'apps/common/src/database/mongodb/src/superstudy';
import { Accounts, Properties, PropertiesBranches } from 'apps/common/src/database/mongodb/src/isms';

@Injectable()
export class UsersService {
  private readonly superStudyAccountProjection =
    'accountId email emailAddresses displayName firstName lastName photoURL profilePhoto role status groupIds folderAccess topicAccess grammarAccess examAccess emailPreferences teacherTitle studentTitle adminLanguage approvedAt expiresAt expiryNotifiedAt active disabled deleted deletedAt createdBy createdAt updatedAt';

  constructor(
    @InjectModel(Accounts)
    private readonly accountsModel: ReturnModelType<typeof Accounts>,
    @InjectModel(Properties)
    private readonly propertiesModel: ReturnModelType<typeof Properties>,
    @InjectModel(PropertiesBranches)
    private readonly propertiesBranchesModel: ReturnModelType<typeof PropertiesBranches>,
    @InjectModel(SSTAssignments)
    private readonly assignmentsModel: ReturnModelType<typeof SSTAssignments>,
    @InjectModel(SSTExamAssignments)
    private readonly examAssignmentsModel: ReturnModelType<typeof SSTExamAssignments>,
    @InjectModel(SSTExamSubmissions)
    private readonly examSubmissionsModel: ReturnModelType<typeof SSTExamSubmissions>,
    @InjectModel(SSTTeacherRatings)
    private readonly teacherRatingsModel: ReturnModelType<typeof SSTTeacherRatings>,
    @InjectModel(SSTTeacherRatingSummaries)
    private readonly teacherRatingSummariesModel: ReturnModelType<typeof SSTTeacherRatingSummaries>,
    @InjectModel(SSTSkillReports)
    private readonly skillReportsModel: ReturnModelType<typeof SSTSkillReports>,
    @InjectModel(SSTRedFlags)
    private readonly redFlagsModel: ReturnModelType<typeof SSTRedFlags>,
    @InjectModel(SSTNotifications)
    private readonly notificationsModel: ReturnModelType<typeof SSTNotifications>,
    @InjectModel(SSTAnonymousFeedback)
    private readonly anonymousFeedbackModel: ReturnModelType<typeof SSTAnonymousFeedback>,
    @InjectModel(SSTMailQueue)
    private readonly mailQueueModel: ReturnModelType<typeof SSTMailQueue>,
    @InjectModel(SSTEmailWhitelist)
    private readonly emailWhitelistModel: ReturnModelType<typeof SSTEmailWhitelist>,
    @InjectModel(SSTRewardPoints)
    private readonly rewardPointsModel: ReturnModelType<typeof SSTRewardPoints>
  ) {}

  private normalizeEmail(email?: string | null): string {
    return String(email ?? '')
      .trim()
      .toLowerCase();
  }

  private toAccountRole(role?: string | null): string {
    if (!role) return 'student';
    return role === 'user' ? 'student' : role;
  }

  private toSuperStudyRole(role?: string | null): string | null {
    if (!role) return null;
    return role === 'student' ? 'user' : role;
  }

  private defaultNotificationSettings() {
    return {
      softwareUpdates: true,
      payslip: false,
      leadConversation: false,
      salaryModification: false,
      wonLose: false,
      leadCreation: false,
      leaveApproval: false,
    };
  }

  private defaultLockScreen() {
    return {
      enable: false,
      code: null,
      idleDuration: 600,
    };
  }

  private splitDisplayName(displayName?: string | null, email?: string | null) {
    const fallbackName = this.normalizeEmail(email).split('@')[0] || 'User';
    const cleanedDisplayName = String(displayName ?? '').trim() || fallbackName;
    const parts = cleanedDisplayName.split(/\s+/).filter(Boolean);
    const firstName = parts.shift() || 'User';
    const lastName = parts.join(' ');
    return { firstName, lastName };
  }

  private getPrimaryAccountEmail(account: any): string {
    const emailAddresses = Array.isArray(account?.emailAddresses) ? account.emailAddresses : [];
    return this.normalizeEmail(account?.email || emailAddresses[0] || '');
  }

  private getAccountDisplayName(account: any): string {
    const displayName = String(account?.displayName ?? '').trim();
    if (displayName) return displayName;

    const composedName = [account?.firstName, account?.lastName].filter(Boolean).join(' ').trim();
    if (composedName) return composedName;

    return this.getPrimaryAccountEmail(account) || String(account?.accountId || account?._id || 'User');
  }

  private accountToSuperStudyUser(account: any) {
    if (!account) return null;

    const uid = String(account.accountId || account._id || '').trim();
    const primaryEmail = this.getPrimaryAccountEmail(account);
    const displayName = this.getAccountDisplayName(account);
    const role = this.toSuperStudyRole(account.role);

    return {
      _id: uid,
      uid,
      id: uid,
      email: primaryEmail,
      displayName,
      photoURL: account.photoURL ?? account.profilePhoto ?? null,
      profilePhoto: account.profilePhoto ?? account.photoURL ?? null,
      role,
      status: account.status ?? (account.active === false ? 'pending' : 'approved'),
      groupIds: Array.isArray(account.groupIds) ? account.groupIds : [],
      folderAccess: Array.isArray(account.folderAccess) ? account.folderAccess : [],
      topicAccess: Array.isArray(account.topicAccess) ? account.topicAccess : [],
      grammarAccess: Array.isArray(account.grammarAccess) ? account.grammarAccess : [],
      examAccess: Array.isArray(account.examAccess) ? account.examAccess : [],
      emailPreferences: account.emailPreferences || {},
      teacherTitle: account.teacherTitle ?? null,
      studentTitle: account.studentTitle ?? null,
      adminLanguage: account.adminLanguage ?? null,
      approvedAt: account.approvedAt ?? null,
      expiresAt: account.expiresAt ?? null,
      expiryNotifiedAt: account.expiryNotifiedAt ?? null,
      active: account.active !== false,
      disabled: Boolean(account.disabled ?? account.deleted),
      deleted: Boolean(account.deleted),
      deletedAt: account.deletedAt ?? null,
      createdBy: account.createdBy ?? null,
      createdAt: account.createdAt ?? account.updatedAt ?? null,
    };
  }

  private dedupeAccountsByAccountId(accounts: any[] = []) {
    const deduped = new Map<string, any>();

    for (const account of accounts) {
      const uid = String(account?.accountId || account?._id || '').trim();
      if (!uid) continue;

      const existing = deduped.get(uid);
      if (!existing) {
        deduped.set(uid, account);
        continue;
      }

      const existingUpdated = existing?.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      const nextUpdated = account?.updatedAt ? new Date(account.updatedAt).getTime() : 0;
      if (nextUpdated >= existingUpdated) {
        deduped.set(uid, account);
      }
    }

    return Array.from(deduped.values());
  }

  private async getDefaultPropertyContext() {
    const property = await this.propertiesModel.findOne().lean();
    const branch = property
      ? await this.propertiesBranchesModel.findOne({ properties: property._id }).lean()
      : await this.propertiesBranchesModel.findOne().lean();

    return {
      propertyId: property?._id ?? null,
      branchId: branch?._id ?? null,
    };
  }

  private async syncSuperStudyFieldsToAccount(uid: string, data: Record<string, any>) {
    const updates: Record<string, any> = {};

    if (data.email !== undefined) {
      const normalizedEmail = this.normalizeEmail(data.email);
      if (normalizedEmail) {
        updates.email = normalizedEmail;
        updates.emailAddresses = [normalizedEmail];
      }
    }
    if (data.displayName !== undefined) updates.displayName = data.displayName || null;
    if (data.status !== undefined) updates.status = data.status;
    if (data.approvedAt !== undefined) updates.approvedAt = data.approvedAt ?? null;
    if (data.expiresAt !== undefined) updates.expiresAt = data.expiresAt ?? null;
    if (data.expiryNotifiedAt !== undefined) updates.expiryNotifiedAt = data.expiryNotifiedAt ?? null;
    if (data.folderAccess !== undefined) updates.folderAccess = data.folderAccess || [];
    if (data.topicAccess !== undefined) updates.topicAccess = data.topicAccess || [];
    if (data.grammarAccess !== undefined) updates.grammarAccess = data.grammarAccess || [];
    if (data.examAccess !== undefined) updates.examAccess = data.examAccess || [];
    if (data.groupIds !== undefined) updates.groupIds = data.groupIds || [];
    if (data.emailPreferences !== undefined) updates.emailPreferences = data.emailPreferences || {};
    if (data.teacherTitle !== undefined) updates.teacherTitle = data.teacherTitle ?? null;
    if (data.studentTitle !== undefined) updates.studentTitle = data.studentTitle ?? null;
    if (data.photoURL !== undefined) {
      updates.profilePhoto = data.photoURL ?? null;
      updates.photoURL = data.photoURL ?? null;
    }
    if (data.deleted !== undefined) updates.deleted = Boolean(data.deleted);
    if (data.deletedAt !== undefined) updates.deletedAt = data.deletedAt ?? null;
    if (data.adminLanguage !== undefined) updates.adminLanguage = data.adminLanguage ?? null;
    if (data.createdBy !== undefined) updates.createdBy = data.createdBy ?? null;
    if (data.role !== undefined) updates.role = this.toAccountRole(data.role);
    if (data.disabled !== undefined) {
      updates.disabled = Boolean(data.disabled);
    }
    if (data.active !== undefined) updates.active = Boolean(data.active);

    if (Object.keys(updates).length === 0) return;

    await this.accountsModel.updateMany({ accountId: uid }, { $set: updates });
  }

  private async getResolvedSuperStudyUser(uid: string) {
    const normalizedUid = String(uid ?? '').trim();
    if (!normalizedUid) {
      return { account: null, mergedUser: null };
    }

    const account = await this.accountsModel.findOne({ accountId: normalizedUid }).select(this.superStudyAccountProjection).lean();

    return {
      account,
      mergedUser: this.accountToSuperStudyUser(account),
    };
  }

  async findAll(filters: { role?: string; status?: string; groupId?: string; includeDeleted?: boolean } = {}) {
    const accountQuery: Record<string, any> = {};

    if (!filters.includeDeleted) {
      accountQuery.deleted = { $ne: true };
    }

    if (filters.role) {
      accountQuery.role = this.toAccountRole(filters.role);
    }
    if (filters.status) {
      accountQuery.status = filters.status;
    }
    if (filters.groupId) {
      accountQuery.groupIds = String(filters.groupId).trim();
    }

    const accounts = this.dedupeAccountsByAccountId(await this.accountsModel.find(accountQuery).select(this.superStudyAccountProjection).lean());
    return accounts.map((account: any) => this.accountToSuperStudyUser(account)).filter(Boolean);
  }

  async getAllIsmsAccounts(search: string = '', limit: number = 50) {
    const matchStage: any = { deleted: { $ne: true } };
    if (search && search.trim() !== '') {
      const q = search.trim();
      matchStage.$or = [
        { emailAddresses: { $regex: q, $options: 'i' } },
        { displayName: { $regex: q, $options: 'i' } },
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        {
          $expr: {
            $regexMatch: {
              input: {
                $trim: {
                  input: {
                    $concat: [{ $ifNull: ['$firstName', ''] }, ' ', { $ifNull: ['$lastName', ''] }],
                  },
                },
              },
              regex: q,
              options: 'i',
            },
          },
        },
      ];
    }

    return this.accountsModel.aggregate([
      { $match: matchStage },
      { $limit: Number(limit) },
      {
        $project: {
          uid: '$accountId',
          email: { $arrayElemAt: ['$emailAddresses', 0] },
          displayName: {
            $trim: {
              input: {
                $concat: [{ $ifNull: ['$firstName', ''] }, ' ', { $ifNull: ['$lastName', ''] }],
              },
            },
          },
          role: '$role',
          photoURL: '$profilePhoto',
          groupIds: { $ifNull: ['$groupIds', []] },
          active: '$active',
        },
      },
    ]);
  }

  async findOne(id: string) {
    const normalizedId = String(id ?? '').trim();
    const normalizedEmail = this.normalizeEmail(id);
    const lookupQuery =
      normalizedEmail && normalizedEmail.includes('@')
        ? { emailAddresses: normalizedEmail }
        : {
            $or: [{ accountId: normalizedId }, { _id: normalizedId }],
          };

    const account = await this.accountsModel.findOne(lookupQuery).select(this.superStudyAccountProjection).lean();
    if (account) return this.accountToSuperStudyUser(account);

    throw new NotFoundException(`User ${id} not found`);
  }

  async findByEmail(email: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const account = await this.accountsModel.findOne({ emailAddresses: normalizedEmail }).select(this.superStudyAccountProjection).lean();
    return this.accountToSuperStudyUser(account);
  }

  async update(id: string, data: Record<string, any>) {
    const { account } = await this.getResolvedSuperStudyUser(id);
    if (!account) throw new NotFoundException(`User ${id} not found`);

    await this.syncSuperStudyFieldsToAccount(id, data);
    return this.findOne(id);
  }

  /**
   * Sync SSO user profile from frontend (create if not exists).
   * Uses upsert to bypass strict schema validation on first login.
   */
  async syncUser(id: string, data: Record<string, any>) {
    const account = await this.accountsModel.findOne({ accountId: id }).lean();
    if (!account) {
      const normalizedEmail = this.normalizeEmail(data.email);
      const { propertyId, branchId } = await this.getDefaultPropertyContext();
      const { firstName, lastName } = this.splitDisplayName(data.displayName, normalizedEmail);

      await this.accountsModel.create({
        accountId: id,
        firstName,
        lastName,
        displayName: data.displayName || null,
        emailAddresses: normalizedEmail ? [normalizedEmail] : [],
        email: normalizedEmail || null,
        contactNumbers: [],
        notification: this.defaultNotificationSettings(),
        lockScreen: this.defaultLockScreen(),
        language: 'en',
        selectedBranch: branchId,
        properties: propertyId,
        propertiesBranches: branchId ? [branchId] : [],
        sourceBranch: branchId,
        role: this.toAccountRole(data.role),
        createdFrom: 'superstudy',
        active: data.active !== false,
        deleted: false,
        disabled: Boolean(data.disabled),
        deletedAt: data.deletedAt ?? null,
        status: data.status ?? 'approved',
        approvedAt: data.approvedAt ?? null,
        expiresAt: data.expiresAt ?? null,
        expiryNotifiedAt: data.expiryNotifiedAt ?? null,
        folderAccess: data.folderAccess || [],
        topicAccess: data.topicAccess || [],
        grammarAccess: data.grammarAccess || [],
        examAccess: data.examAccess || [],
        groupIds: data.groupIds || [],
        emailPreferences: data.emailPreferences || {},
        teacherTitle: data.teacherTitle ?? null,
        studentTitle: data.studentTitle ?? null,
        profilePhoto: data.photoURL ?? null,
        photoURL: data.photoURL ?? null,
        adminLanguage: data.adminLanguage ?? null,
        createdBy: data.createdBy ?? null,
      });
    } else {
      await this.syncSuperStudyFieldsToAccount(id, data);
    }

    return this.findOne(id);
  }

  /**
   * Approve a pending user — mirrors adminService.approveUser
   */
  async approveUser(uid: string, role: string, durationDays?: number, customExpiresAt?: string) {
    let expiresAt: Date | null = null;
    if (customExpiresAt) {
      expiresAt = new Date(`${customExpiresAt}T23:59:59`);
    } else if (durationDays) {
      expiresAt = new Date(Date.now() + durationDays * 86400000);
    }

    const { account } = await this.getResolvedSuperStudyUser(uid);
    if (!account) throw new NotFoundException(`User ${uid} not found`);

    await this.syncSuperStudyFieldsToAccount(uid, {
      status: 'approved',
      role,
      approvedAt: new Date(),
      expiresAt,
      active: true,
      disabled: false,
    });

    return this.findOne(uid);
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

    const { account } = await this.getResolvedSuperStudyUser(uid);
    if (!account) throw new NotFoundException(`User ${uid} not found`);

    await this.syncSuperStudyFieldsToAccount(uid, {
      status: 'approved',
      approvedAt: new Date(),
      expiresAt,
      active: true,
      disabled: false,
    });
    return this.findOne(uid);
  }

  /**
   * Reject a pending user — permanently deletes the document
   */
  async rejectUser(uid: string) {
    const accountResult = await this.accountsModel.findOneAndDelete({ accountId: uid }).lean();
    if (!accountResult) throw new NotFoundException(`User ${uid} not found`);
    return { deleted: true };
  }

  async addToGroup(uid: string, groupId: string) {
    const { account } = await this.getResolvedSuperStudyUser(uid);
    if (!account) throw new NotFoundException(`User ${uid} not found`);

    await this.syncSuperStudyFieldsToAccount(uid, {
      groupIds: [...new Set([...(Array.isArray(account.groupIds) ? account.groupIds : []), groupId])],
      status: 'approved',
      active: true,
      disabled: false,
      approvedAt: account.approvedAt ?? new Date(),
    });

    return this.findOne(uid);
  }

  /**
   * Remove user from a group — mirrors adminService.removeUserFromGroup
   */
  async removeFromGroup(uid: string, groupId: string) {
    const { account } = await this.getResolvedSuperStudyUser(uid);
    if (!account) throw new NotFoundException(`User ${uid} not found`);

    await this.syncSuperStudyFieldsToAccount(uid, {
      groupIds: (Array.isArray(account.groupIds) ? account.groupIds : []).filter((id: string) => id !== groupId),
    });

    return this.findOne(uid);
  }

  /**
   * Get all users whose groupIds contains groupId
   */
  async getUsersInGroup(groupId: string, role?: string) {
    const accountQuery: Record<string, any> = {
      groupIds: groupId,
      deleted: { $ne: true },
    };

    if (role) {
      accountQuery.role = this.toAccountRole(role);
    }

    const accounts = this.dedupeAccountsByAccountId(await this.accountsModel.find(accountQuery).select(this.superStudyAccountProjection).lean());
    return accounts.map((account: any) => this.accountToSuperStudyUser(account)).filter(Boolean);
  }

  /**
   * Update user access arrays (folderAccess, topicAccess, grammarAccess, examAccess)
   */
  async addAccess(uid: string, field: string, resourceId: string) {
    const { account, mergedUser } = await this.getResolvedSuperStudyUser(uid);
    if (!account || !mergedUser) throw new NotFoundException(`User ${uid} not found`);

    const currentValues = Array.isArray(mergedUser?.[field]) ? mergedUser[field] : [];
    const nextValues = [...new Set([...currentValues, resourceId])];

    await this.syncSuperStudyFieldsToAccount(uid, { [field]: nextValues });
    return this.findOne(uid);
  }

  async removeAccess(uid: string, field: string, resourceId: string) {
    const { account, mergedUser } = await this.getResolvedSuperStudyUser(uid);
    if (!account || !mergedUser) throw new NotFoundException(`User ${uid} not found`);

    const currentValues = Array.isArray(mergedUser?.[field]) ? mergedUser[field] : [];
    const nextValues = currentValues.filter((value: string) => value !== resourceId);

    await this.syncSuperStudyFieldsToAccount(uid, { [field]: nextValues });
    return this.findOne(uid);
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Cascading Permanent Delete — mirrors Firebase deleteUser Cloud Function
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Permanently delete a user and ALL related data.
   * Cascade order mirrors functions/index.js#deleteUser:
   *  1. Clean assignments (remove student from assignedStudentIds, delete if empty)
   *  2. Clean exam_assignments (individual + group-based)
   *  3. Delete exam_submissions
   *  4. Delete teacher_ratings + recalculate affected teacher_rating_summaries
   *  5. Delete skill_reports, red_flags, notifications, anonymous_feedback
   *  6. Delete mail_queue entries for user email
   *  7. Delete email_whitelist entry
   *  8. Delete reward_points
   *  9. Delete ISMS account
   * 10. Delete the account record
   */
  async permanentDeleteUser(uid: string) {
    const { account, mergedUser } = await this.getResolvedSuperStudyUser(uid);
    const targetData: Record<string, any> = mergedUser || this.accountToSuperStudyUser(account) || {};
    const targetEmail = this.normalizeEmail(targetData.email || this.getPrimaryAccountEmail(account));
    const groupIds: string[] = [...(Array.isArray(targetData.groupIds) ? targetData.groupIds : [])].filter((v, i, a) => v && a.indexOf(v) === i);

    // 1. Clean regular assignments — pull studentId from assignedStudentIds
    if (groupIds.length > 0) {
      const assignments = await this.assignmentsModel.find({ groupId: { $in: groupIds } }).lean();
      for (const a of assignments) {
        const doc = a as any;
        const ids: string[] = Array.isArray(doc.assignedStudentIds) ? doc.assignedStudentIds : [];
        const hasStudent = ids.includes(uid);
        const remaining = ids.filter((id: string) => id !== uid);
        if (!hasStudent) continue;
        if (remaining.length === 0) {
          await this.assignmentsModel.findByIdAndDelete(doc._id);
        } else {
          const upd: Record<string, any> = { assignedStudentIds: remaining };
          if (doc.studentDeadlines && doc.studentDeadlines[uid] !== undefined) {
            delete upd[`studentDeadlines.${uid}`];
            // Use $unset for nested field deletion
            await this.assignmentsModel.findByIdAndUpdate(doc._id, {
              $set: { assignedStudentIds: remaining },
              $unset: { [`studentDeadlines.${uid}`]: '' },
            });
            continue;
          }
          await this.assignmentsModel.findByIdAndUpdate(doc._id, { $set: upd });
        }
      }
    }

    // 2. Clean exam_assignments (individual + group-based)
    await this.examAssignmentsModel.deleteMany({
      targetType: 'individual',
      targetId: uid,
    });
    if (groupIds.length > 0) {
      const groupExamAssignments = await this.examAssignmentsModel.find({ targetType: 'group', targetId: { $in: groupIds } }).lean();
      for (const a of groupExamAssignments) {
        const doc = a as any;
        const ids: string[] = Array.isArray(doc.assignedStudentIds) ? doc.assignedStudentIds : [];
        const hasStudent = ids.includes(uid);
        const remaining = ids.filter((id: string) => id !== uid);
        if (!hasStudent) continue;
        if (remaining.length === 0) {
          await this.examAssignmentsModel.findByIdAndDelete(doc._id);
        } else {
          await this.examAssignmentsModel.findByIdAndUpdate(doc._id, {
            $set: { assignedStudentIds: remaining },
            $unset: { [`studentDeadlines.${uid}`]: '' },
          });
        }
      }
    }

    // 3. Delete exam submissions
    await this.examSubmissionsModel.deleteMany({ studentId: uid });

    // 4. Delete teacher_ratings and recalculate affected summaries
    const deletedRatings = await this.teacherRatingsModel.find({ studentId: uid }).lean();
    const summaryIdsToDelete = new Set<string>();
    for (const r of deletedRatings) {
      const doc = r as any;
      if (doc.periodId && doc.teacherId) {
        summaryIdsToDelete.add(`${doc.periodId}_${doc.teacherId}`);
      }
    }
    await this.teacherRatingsModel.deleteMany({ studentId: uid });
    if (summaryIdsToDelete.size > 0) {
      await this.teacherRatingSummariesModel.deleteMany({
        _id: { $in: [...summaryIdsToDelete] },
      });
    }

    // 5. Delete related records in parallel
    await Promise.all([
      this.skillReportsModel.deleteMany({ studentId: uid }),
      this.redFlagsModel.deleteMany({ studentId: uid }),
      this.notificationsModel.deleteMany({ userId: uid }),
      this.anonymousFeedbackModel.deleteMany({
        $or: [{ senderUid: uid }, { targetUid: uid }],
      }),
    ]);

    // 6. Delete mail_queue entries for the user's email
    if (targetEmail) {
      await this.mailQueueModel.deleteMany({ to: targetEmail });
    }

    // 7. Delete email_whitelist entry
    if (targetEmail) {
      await this.emailWhitelistModel.deleteMany({ email: targetEmail });
    }

    // 8. Delete reward_points for this user
    await this.rewardPointsModel.deleteMany({ userId: uid });

    // 9. Delete ISMS account (mirrors Firebase Auth deletion)
    try {
      await this.accountsModel.deleteMany({ accountId: uid });
    } catch {
      // Not critical if account not in ISMS
    }

    return {
      success: true,
      message: `Đã xóa vĩnh viễn tài khoản ${uid} và toàn bộ dữ liệu liên quan khỏi hệ thống.`,
    };
  }

  /**
   * Change user email — updates the account-backed email fields.
   * Mirrors Firebase changeUserEmail Cloud Function.
   */
  async changeUserEmail(uid: string, newEmail: string) {
    if (!newEmail) throw new BadRequestException('Email is required.');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) throw new BadRequestException('Invalid email format.');

    const normalizedEmail = newEmail.toLowerCase().trim();
    const { account } = await this.getResolvedSuperStudyUser(uid);
    if (!account) throw new NotFoundException(`User ${uid} not found`);

    // Update ISMS account email addresses
    try {
      await this.accountsModel.updateMany({ accountId: uid }, { $set: { emailAddresses: [normalizedEmail], email: normalizedEmail } });
    } catch {
      // Log but don't fail — user doc is already updated
    }

    return {
      success: true,
      message: `Đã đổi email thành công sang ${newEmail}. Người dùng cần đăng nhập lại bằng email mới.`,
    };
  }
}
