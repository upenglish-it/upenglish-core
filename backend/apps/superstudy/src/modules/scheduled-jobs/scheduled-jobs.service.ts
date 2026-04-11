import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { InjectQueue } from 'agenda-nest';
import * as nodemailer from 'nodemailer';
import {
  SSTAssignments,
  SSTExamAssignments,
  SSTExamSubmissions,
  SSTNotifications,
  SSTMailQueue,
} from 'apps/common/src/database/mongodb/src/superstudy';
import { Accounts } from 'apps/common/src/database/mongodb/src/isms';

// ─── SMTP helper ────────────────────────────────────────────────────────────
let transporter: nodemailer.Transporter | null = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }
  return transporter;
}

async function sendEmail(to: string, subject: string, html: string) {
  try {
    await getTransporter().sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'sUPerStudy'}" <${process.env.SMTP_EMAIL}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    Logger.warn(`[ScheduledJobs] Email to ${to} failed: ${err.message}`, 'ScheduledJobs');
  }
}

function buildEmailHtml({
  emoji = '📬', heading, headingColor = '#4f46e5', body,
  highlight = '', highlightBg = '#eef2ff', highlightBorder = '#4f46e5',
  ctaText = '', ctaColor = '#4f46e5', ctaColor2 = '#3b82f6', ctaLink = '', greeting = '',
}: Record<string, string>) {
  const logoUrl = 'https://upenglishvietnam.com/logo.png';
  const appUrl = 'https://upenglishvietnam.com/preview/superstudy';
  const finalCtaLink = ctaLink || appUrl;
  const highlightBlock = highlight ? `<div style="background:${highlightBg};padding:16px 20px;border-radius:12px;margin:16px 0;border-left:4px solid ${highlightBorder};">${highlight}</div>` : '';
  const greetingBlock = greeting ? `<p style="color:#334155;font-size:1.05rem;line-height:1.6;margin-bottom:4px;">${greeting}</p>` : '';
  const ctaBlock = ctaText ? `<div style="text-align:center;margin-top:28px;"><a href="${finalCtaLink}" style="display:inline-block;background:linear-gradient(135deg,${ctaColor},${ctaColor2});color:white;padding:13px 36px;border-radius:12px;text-decoration:none;font-weight:700;font-size:0.95rem;">${ctaText}</a></div>` : '';
  return `<div style="font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;max-width:540px;margin:0 auto;padding:0;background:#f8fafc;"><div style="text-align:center;padding:28px 24px 16px;"><img src="${logoUrl}" alt="UP English" style="height:48px;width:auto;margin-bottom:8px;" /></div><div style="background:#ffffff;margin:0 16px;padding:28px 24px;border-radius:16px;border:1px solid #e2e8f0;"><h2 style="color:${headingColor};margin:0 0 16px;font-size:1.35rem;text-align:center;">${emoji} ${heading}</h2>${greetingBlock}<div style="color:#334155;font-size:0.95rem;line-height:1.7;">${body}</div>${highlightBlock}${ctaBlock}</div><div style="text-align:center;padding:20px 24px 28px;"><p style="color:#94a3b8;font-size:0.75rem;margin:0;">Bạn nhận email này vì đang là thành viên của sUPerStudy.</p></div></div>`;
}

@Injectable()
export class ScheduledJobsService implements OnModuleInit {
  private readonly logger = new Logger(ScheduledJobsService.name);

  constructor(
    @InjectQueue() private readonly agenda: any,
    @InjectModel(SSTAssignments)
    private readonly assignmentsModel: ReturnModelType<typeof SSTAssignments>,
    @InjectModel(SSTExamAssignments)
    private readonly examAssignmentsModel: ReturnModelType<typeof SSTExamAssignments>,
    @InjectModel(SSTExamSubmissions)
    private readonly submissionsModel: ReturnModelType<typeof SSTExamSubmissions>,
    @InjectModel(SSTNotifications)
    private readonly notificationsModel: ReturnModelType<typeof SSTNotifications>,
    @InjectModel(SSTMailQueue)
    private readonly mailQueueModel: ReturnModelType<typeof SSTMailQueue>,
    @InjectModel(Accounts)
    private readonly accountsModel: ReturnModelType<typeof Accounts>,
  ) {}

  private normalizeEmail(value: any): string {
    return String(value ?? '').trim().toLowerCase();
  }

  private toSuperStudyRole(role?: string | null): string | null {
    if (!role) return null;
    return role === 'student' ? 'user' : role;
  }

  private getPrimaryEmail(user: any): string {
    const emailAddresses = Array.isArray(user?.emailAddresses) ? user.emailAddresses : [];
    return this.normalizeEmail(user?.email || emailAddresses[0] || '');
  }

  private normalizeAccountUser(account: any) {
    const uid = String(account?.accountId || account?._id || '').trim();
    return {
      _id: uid,
      uid,
      email: this.getPrimaryEmail(account),
      displayName: String(account?.displayName ?? '').trim()
        || [account?.firstName, account?.lastName].filter(Boolean).join(' ').trim()
        || this.getPrimaryEmail(account)
        || uid,
      role: this.toSuperStudyRole(account?.role),
      groupIds: Array.isArray(account?.groupIds) ? account.groupIds : [],
      emailPreferences: account?.emailPreferences || {},
      status: account?.status ?? (account?.active === false ? 'pending' : 'approved'),
      expiresAt: account?.expiresAt ?? null,
      expiryNotifiedAt: account?.expiryNotifiedAt ?? null,
      deleted: Boolean(account?.deleted),
    };
  }

  private normalizeLegacyUser(user: any) {
    return {
      ...user,
      _id: String(user?._id || user?.uid || '').trim(),
      uid: String(user?._id || user?.uid || '').trim(),
      email: this.normalizeEmail(user?.email),
      emailPreferences: user?.emailPreferences || {},
      groupIds: Array.isArray(user?.groupIds) ? user.groupIds : [],
      deleted: Boolean(user?.deleted),
    };
  }

  private mergeUsers(accounts: any[], legacyUsers: any[]) {
    const merged = new Map<string, any>();

    for (const account of accounts || []) {
      const normalized = this.normalizeAccountUser(account);
      if (!normalized.uid) continue;
      merged.set(normalized.uid, normalized);
    }

    for (const user of legacyUsers || []) {
      const legacy = this.normalizeLegacyUser(user);
      if (!legacy.uid) continue;
      const existing = merged.get(legacy.uid);
      merged.set(legacy.uid, {
        ...(existing || {}),
        ...legacy,
        _id: existing?._id || legacy._id,
        uid: existing?.uid || legacy.uid,
        email: legacy.email || existing?.email || '',
        displayName: legacy.displayName || existing?.displayName || legacy.email || existing?.email || legacy.uid,
        role: legacy.role || existing?.role,
        groupIds: Array.isArray(existing?.groupIds) && existing.groupIds.length > 0
          ? existing.groupIds
          : (legacy.groupIds || []),
        emailPreferences: Object.keys(existing?.emailPreferences || {}).length > 0
          ? existing.emailPreferences
          : (legacy.emailPreferences || {}),
        status: existing?.status || legacy.status,
        expiresAt: existing?.expiresAt ?? legacy.expiresAt ?? null,
        expiryNotifiedAt: existing?.expiryNotifiedAt ?? legacy.expiryNotifiedAt ?? null,
        deleted: existing?.deleted ?? legacy.deleted,
      });
    }

    return Array.from(merged.values()).filter((user) => !user.deleted);
  }

  private async getUsersByRoles(roles: string[]) {
    const accountRoles = roles.map((role) => role === 'user' ? 'student' : role);
    const accounts = await this.accountsModel
      .find({ role: { $in: accountRoles }, deleted: { $ne: true } })
      .lean();
    return this.mergeUsers(accounts, []);
  }

  private async getGroupUsersByRole(groupId: string, role: string) {
    const accountRole = role === 'user' ? 'student' : role;
    const accounts = await this.accountsModel
      .find({ groupIds: groupId, role: accountRole, deleted: { $ne: true } })
      .lean();
    return this.mergeUsers(accounts, []);
  }

  private async getExpiringUsers(now: Date, sevenDaysLater: Date) {
    const accounts = await this.accountsModel.find({
      expiresAt: { $gte: now, $lte: sevenDaysLater },
      status: 'approved',
      expiryNotifiedAt: { $in: [null] },
      deleted: { $ne: true },
    }).lean();
    return this.mergeUsers(accounts, []);
  }

  private async markUsersExpiryNotified(userIds: string[], notifiedAt: Date) {
    if (userIds.length === 0) return;

    const accountBackedIds = new Set(
      (await this.accountsModel
        .find({ accountId: { $in: userIds } })
        .select('accountId')
        .lean())
        .map((account: any) => String(account?.accountId || '').trim())
        .filter(Boolean),
    );

    const operations: Promise<any>[] = [
      this.accountsModel.updateMany(
        { accountId: { $in: userIds } },
        { $set: { expiryNotifiedAt: notifiedAt } },
      ),
    ];

    await Promise.all(operations);
  }

  // ─── Helper: create in-app notification ──────────────────────────────────
  private async createNotification(userId: string, data: {
    type: string; title: string; message: string; link?: string;
  }) {
    if (!userId) return;
    await this.notificationsModel.create({
      userId,
      type: data.type,
      title: data.title,
      message: data.message,
      link: data.link || '/',
      read: false,
      createdAt: new Date(),
    });
  }

  private async createNotificationForAdmins(data: {
    type: string; title: string; message: string; link?: string;
  }) {
    const admins = await this.getUsersByRoles(['admin', 'staff']);
    for (const admin of admins) {
      await this.createNotification(String(admin._id), data);
    }
  }

  // ─── Helper: queue an email ──────────────────────────────────────────────
  private async queueEmail(to: string, subject: string, html: string) {
    await this.mailQueueModel.create({ to, subject, html, status: 'pending', createdAt: new Date() });
  }

  // ─── Job definitions ─────────────────────────────────────────────────────

  /**
   * #8: checkDeadlineExpired — every 30 minutes
   * Notifies teachers when assignment deadlines have passed.
   */
  private async runCheckDeadlineExpired() {
    const now = new Date();

    // Vocab assignments
    try {
      const expired = await this.assignmentsModel.find({
        dueDate: { $lte: now },
        deadlineNotified: { $ne: true },
      }).lean();

      for (const asgn of expired) {
        const groupId = (asgn as any).groupId;
        const topicName = (asgn as any).topicName || 'bài luyện';
        if (!groupId) continue;

        const groupUsers = await this.getGroupUsersByRole(groupId, 'teacher');

        for (const teacher of groupUsers) {
          const uid = String((teacher as any)._id);
          await this.createNotification(uid, {
            type: 'deadline_expired',
            title: `⏰ Bài "${topicName}" đã hết hạn`,
            message: `Bài luyện "${topicName}" đã hết deadline. Hãy vào kiểm tra kết quả.`,
            link: '/teacher/groups',
          });
          const prefs = (teacher as any).emailPreferences;
          const wantsEmail = !prefs || prefs.deadline_expired !== false;
          if (wantsEmail && (teacher as any).email) {
            await this.queueEmail(
              (teacher as any).email,
              `Bài "${topicName}" đã hết hạn`,
              buildEmailHtml({
                emoji: '⏰', heading: 'Bài đã hết hạn', headingColor: '#ef4444',
                body: `<p>Bài luyện <strong>"${topicName}"</strong> đã hết deadline. Học viên đã nộp bài, hãy vào kiểm tra và đánh giá kết quả nhé!</p>`,
                ctaText: 'Vào kiểm tra', ctaColor: '#ef4444', ctaColor2: '#f87171',
                ctaLink: 'https://upenglishvietnam.com/preview/superstudy/teacher/groups',
              }),
            );
          }
        }

        await this.assignmentsModel.updateOne({ _id: (asgn as any)._id }, { deadlineNotified: true });
      }
    } catch (e) {
      this.logger.error('checkDeadlineExpired (vocab):', e.message);
    }

    // Exam assignments
    try {
      const expiredExam = await this.examAssignmentsModel.find({
        dueDate: { $lte: now },
        deadlineNotified: { $ne: true },
        isDeleted: { $ne: true },
        targetType: 'group',
      }).lean();

      for (const asgn of expiredExam) {
        const targetId = (asgn as any).targetId;
        const examName = (asgn as any).examName || (asgn as any).examTitle || 'bài';
        if (!targetId) continue;

        const groupUsers = await this.getGroupUsersByRole(targetId, 'teacher');

        for (const teacher of groupUsers) {
          const uid = String((teacher as any)._id);
          await this.createNotification(uid, {
            type: 'deadline_expired',
            title: `⏰ Bài "${examName}" đã hết hạn`,
            message: `Bài "${examName}" đã hết deadline. Hãy vào chấm bài cho học viên.`,
            link: '/teacher/groups',
          });
          const prefs = (teacher as any).emailPreferences;
          const wantsEmail = !prefs || prefs.deadline_expired !== false;
          if (wantsEmail && (teacher as any).email) {
            await this.queueEmail(
              (teacher as any).email,
              `Bài "${examName}" đã hết hạn — cần chấm`,
              buildEmailHtml({
                emoji: '⏰', heading: 'Bài đã hết hạn', headingColor: '#ef4444',
                body: `<p>Bài <strong>"${examName}"</strong> đã hết deadline. Học viên đã nộp bài, hãy vào chấm điểm nhé!</p>`,
                ctaText: 'Vào chấm bài', ctaColor: '#ef4444', ctaColor2: '#f87171',
                ctaLink: 'https://upenglishvietnam.com/preview/superstudy/teacher/groups',
              }),
            );
          }
        }

        await this.examAssignmentsModel.updateOne({ _id: (asgn as any)._id }, { deadlineNotified: true });
      }
    } catch (e) {
      this.logger.error('checkDeadlineExpired (exam):', e.message);
    }
  }

  /**
   * #12: monthlySkillReportReminder — day 28 of each month at 09:00 (Asia/Ho_Chi_Minh)
   * Reminds teachers to write monthly skill reports.
   */
  private async runMonthlySkillReportReminder() {
    try {
      const teachers = await this.getUsersByRoles(['teacher']);
      const month = new Date().toLocaleString('vi-VN', { month: 'long', year: 'numeric' });

      for (const teacher of teachers) {
        const uid = String((teacher as any)._id);
        await this.createNotification(uid, {
          type: 'skill_report_reminder',
          title: '📊 Nhắc nhở: Viết báo cáo kỹ năng',
          message: 'Đã gần cuối tháng! Hãy viết báo cáo đánh giá kỹ năng cho các học viên.',
          link: '/teacher/groups',
        });
        const prefs = (teacher as any).emailPreferences;
        const wantsEmail = !prefs || prefs.skill_report_reminder !== false;
        if (wantsEmail && (teacher as any).email) {
          await this.queueEmail(
            (teacher as any).email,
            `Nhắc nhở: Viết báo cáo kỹ năng tháng ${month}`,
            buildEmailHtml({
              emoji: '📊', heading: 'Nhắc nhở cuối tháng', headingColor: '#8b5cf6',
              body: `<p>Đã gần cuối tháng rồi! Bạn nhớ viết <strong>báo cáo đánh giá kỹ năng</strong> cho các học viên trong các lớp bạn phụ trách nhé.</p><p style="color:#64748b;font-size:0.9rem;">Vào <strong>Tiến trình học viên → Báo cáo kỹ năng</strong> để tạo báo cáo.</p>`,
              ctaText: 'Mở sUPerStudy', ctaColor: '#8b5cf6', ctaColor2: '#a78bfa',
              ctaLink: 'https://upenglishvietnam.com/preview/superstudy/teacher/groups',
            }),
          );
        }
      }

      this.logger.log(`monthlySkillReportReminder: notified ${teachers.length} teachers`);
    } catch (e) {
      this.logger.error('monthlySkillReportReminder:', e.message);
    }
  }

  /**
   * #15: checkExpiringAccounts — daily at 08:00 (Asia/Ho_Chi_Minh)
   * Emails admins about accounts expiring within 7 days.
   */
  private async runCheckExpiringAccounts() {
    try {
      const now = new Date();
      const sevenDaysLater = new Date(now.getTime() + 7 * 86400000);

      const expiringUsers = await this.getExpiringUsers(now, sevenDaysLater);

      if (expiringUsers.length === 0) return;

      const userList = expiringUsers
        .map((u: any) => `<li><strong>${u.displayName || u.email || 'N/A'}</strong> (${u.email || 'N/A'}) — hết hạn: ${new Date(u.expiresAt).toLocaleDateString('vi-VN')}</li>`)
        .join('');

      await this.createNotificationForAdmins({
        type: 'accounts_expiring',
        title: `⚠️ ${expiringUsers.length} tài khoản sắp hết hạn`,
        message: `Có ${expiringUsers.length} tài khoản sẽ hết hạn trong 7 ngày tới. Hãy vào kiểm tra và gia hạn.`,
        link: '/admin/users',
      });

      const admins = await this.getUsersByRoles(['admin', 'staff']);
      for (const admin of admins) {
        const prefs = (admin as any).emailPreferences;
        if (prefs && prefs.accounts_expiring === false) continue;
        if (!(admin as any).email) continue;
        await this.queueEmail(
          (admin as any).email,
          `${expiringUsers.length} tài khoản sắp hết hạn`,
          buildEmailHtml({
            emoji: '⚠️', heading: 'Tài khoản sắp hết hạn', headingColor: '#f59e0b',
            body: `<p>Các tài khoản sau sẽ hết hạn trong 7 ngày tới:</p><ul style="line-height:1.8;padding-left:20px;">${userList}</ul>`,
            ctaText: 'Gia hạn tài khoản', ctaColor: '#f59e0b', ctaColor2: '#fbbf24',
            ctaLink: 'https://upenglishvietnam.com/preview/superstudy/admin/users',
          }),
        );
      }

      // Mark as notified
      const ids = expiringUsers.map((u: any) => String(u._id));
      await this.markUsersExpiryNotified(ids, new Date());

      this.logger.log(`checkExpiringAccounts: sent alerts for ${expiringUsers.length} users`);
    } catch (e) {
      this.logger.error('checkExpiringAccounts:', e.message);
    }
  }

  /**
   * autoSubmitExpiredExams — every 2 minutes
   * Auto-submits in-progress exam submissions whose assignment deadline has passed.
   * Non-essay questions are auto-graded; essay/audio questions left for manual grading.
   */
  private async runAutoSubmitExpiredExams() {
    try {
      const now = new Date();

      // Find expired exam assignments
      const expiredAssignments = await this.examAssignmentsModel.find({
        dueDate: { $lte: now },
        isDeleted: { $ne: true },
      }).lean().select('_id dueDate _idStr');

      if (expiredAssignments.length === 0) return;

      const expiredIds = expiredAssignments.map((a: any) => String(a._id));

      // Find in-progress submissions for those assignments
      const inProgressSubs = await this.submissionsModel.find({
        assignmentId: { $in: expiredIds },
        status: 'in_progress',
      }).lean();

      for (const sub of inProgressSubs) {
        try {
          await this.submissionsModel.findByIdAndUpdate(
            (sub as any)._id,
            {
              $set: {
                status: 'submitted',
                submittedAt: new Date(),
                autoSubmitted: true,
                updatedAt: new Date(),
              },
            },
            { new: true },
          );
          this.logger.log(`autoSubmitExpiredExams: auto-submitted ${(sub as any)._id}`);
        } catch (subErr) {
          this.logger.error(`autoSubmitExpiredExams: failed for ${(sub as any)._id}: ${subErr.message}`);
        }
      }
    } catch (e) {
      this.logger.error('autoSubmitExpiredExams:', e.message);
    }
  }

  /**
   * processMailQueue — every 1 minute
   * Sends pending emails from the mail_queue collection.
   */
  private async runProcessMailQueue() {
    try {
      const pending = await this.mailQueueModel.find({ status: 'pending' }).limit(20).lean();
      for (const mail of pending) {
        try {
          await sendEmail((mail as any).to, (mail as any).subject, (mail as any).html);
          await this.mailQueueModel.findByIdAndUpdate((mail as any)._id, {
            status: 'sent', sentAt: new Date(),
          });
        } catch (e) {
          await this.mailQueueModel.findByIdAndUpdate((mail as any)._id, {
            status: 'failed', error: e.message,
          });
        }
      }
    } catch (e) {
      this.logger.error('processMailQueue:', e.message);
    }
  }

  // ─── OnModuleInit: define and schedule all jobs ──────────────────────────

  async onModuleInit() {
    // Start Agenda — this initialises _collection via _connect() internally.
    // Without this, any define/every call that tries to persist a job will
    // crash with "Cannot read properties of undefined (reading 'findOneAndUpdate')".
    await this.agenda.start();

    // Define job handlers
    this.agenda.define('checkDeadlineExpired', async () => {
      await this.runCheckDeadlineExpired();
    });

    this.agenda.define('monthlySkillReportReminder', async () => {
      await this.runMonthlySkillReportReminder();
    });

    this.agenda.define('checkExpiringAccounts', async () => {
      await this.runCheckExpiringAccounts();
    });

    this.agenda.define('autoSubmitExpiredExams', async () => {
      await this.runAutoSubmitExpiredExams();
    });

    this.agenda.define('processMailQueue', async () => {
      await this.runProcessMailQueue();
    });

    // Schedule recurring jobs
    await this.agenda.every('30 minutes', 'checkDeadlineExpired');
    await this.agenda.every('2 minutes', 'autoSubmitExpiredExams');
    await this.agenda.every('1 minute', 'processMailQueue');

    // Day 28 at 09:00 Asia/Ho_Chi_Minh (UTC+7 = 02:00 UTC)
    await this.agenda.every('0 2 28 * *', 'monthlySkillReportReminder');
    // Daily at 08:00 Asia/Ho_Chi_Minh (01:00 UTC)
    await this.agenda.every('0 1 * * *', 'checkExpiringAccounts');

    this.logger.log('✅ Scheduled jobs initialized: checkDeadlineExpired, autoSubmitExpiredExams, monthlySkillReportReminder, checkExpiringAccounts, processMailQueue');
  }
}
