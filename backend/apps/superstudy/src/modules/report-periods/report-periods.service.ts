import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { SYSTEM_ID } from 'apps/common/src/utils';
import {
  SSTReportPeriods,
  SSTSettings,
  SSTSkillReports,
  SSTUserGroups
} from 'apps/common/src/database/mongodb/src/superstudy';
import { Accounts } from 'apps/common/src/database/mongodb/src/isms';

@Injectable()
export class ReportPeriodsService {
  constructor(
    @InjectModel(SSTReportPeriods) private readonly periodsModel: ReturnModelType<typeof SSTReportPeriods>,
    @InjectModel(SSTSettings) private readonly settingsModel: ReturnModelType<typeof SSTSettings>,
    @InjectModel(SSTSkillReports) private readonly reportsModel: ReturnModelType<typeof SSTSkillReports>,
    @InjectModel(Accounts) private readonly accountsModel: ReturnModelType<typeof Accounts>,
    @InjectModel(SSTUserGroups) private readonly groupsModel: ReturnModelType<typeof SSTUserGroups>,
  ) {}

  private mapDoc(doc: any) {
    if (!doc) return null;
    return { id: doc._id, ...doc };
  }

  private normalizeEmail(value?: string | null) {
    return String(value ?? '').trim().toLowerCase();
  }

  private normalizeAccountUser(account: any) {
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
      status: account?.status ?? (account?.active === false ? 'pending' : 'approved'),
      groupIds: Array.isArray(account?.groupIds) ? account.groupIds : [],
      deleted: Boolean(account?.deleted),
    };
  }

  private normalizeLegacyUser(user: any) {
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

  private mergeUsers(accounts: any[], legacyUsers: any[]) {
    const merged = new Map<string, any>();

    for (const account of accounts || []) {
      const normalized = this.normalizeAccountUser(account);
      if (!normalized?.uid) continue;
      merged.set(normalized.uid, normalized);
    }

    for (const legacyUser of legacyUsers || []) {
      const normalized = this.normalizeLegacyUser(legacyUser);
      if (!normalized?.uid) continue;
      const existing = merged.get(normalized.uid);
      merged.set(normalized.uid, {
        ...(existing || {}),
        ...normalized,
        _id: existing?._id || normalized._id,
        uid: existing?.uid || normalized.uid,
        id: existing?.id || normalized.id,
        email: normalized.email || existing?.email || '',
        displayName: normalized.displayName || existing?.displayName || normalized.email || existing?.email || normalized.uid,
        role: normalized.role || existing?.role,
        status: normalized.status || existing?.status,
        groupIds: Array.isArray(existing?.groupIds) && existing.groupIds.length > 0
          ? existing.groupIds
          : (normalized.groupIds || []),
        deleted: existing?.deleted ?? normalized.deleted,
      });
    }

    return Array.from(merged.values()).filter((user) => !user.deleted);
  }

  private shouldLoadLegacyUser(account: any) {
    if (!account) return true;

    const hasPrimaryEmail = Boolean(this.normalizeEmail(account?.email || account?.emailAddresses?.[0]));
    const hasDisplayName = Boolean(String(account?.displayName ?? '').trim())
      || Boolean([account?.firstName, account?.lastName].filter(Boolean).join(' ').trim());
    const hasCompatibilityMetadata = Array.isArray(account?.groupIds) && account.groupIds.length > 0;

    return !hasPrimaryEmail || !account?.role || !account?.status || !hasDisplayName || !hasCompatibilityMetadata;
  }

  private async getUsersByRole(role: 'teacher' | 'user') {
    const accountRole = role === 'user' ? 'student' : role;
    const accounts = await this.accountsModel
      .find({ role: accountRole, status: 'approved', deleted: { $ne: true } })
      .lean();
    return this.mergeUsers(accounts, []);
  }

  private async getUserById(userId: string) {
    const normalizedId = String(userId || '').trim();
    const account = await this.accountsModel
      .findOne({ $or: [{ accountId: normalizedId }, { _id: normalizedId }] })
      .lean();
    return this.mergeUsers(account ? [account] : [], [])[0] || null;
  }

  // ═══════════════════════════════════════════════
  // AUTO-CREATE & DEFAULTS
  // ═══════════════════════════════════════════════

  async getReportPeriodDefaults() {
    const doc = await this.settingsModel.findById('app').lean();
    return doc?.reportPeriodDefaults || null;
  }

  async saveReportPeriodDefaults(defaults: any) {
    await this.settingsModel.findByIdAndUpdate(
      'app',
      { $set: { reportPeriodDefaults: defaults, _id: 'app' } },
      { upsert: true }
    );
    return { success: true };
  }

  async computePeriodStatus(period: any) {
    if (!period?.startDate || !period?.endDate) return 'closed';
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(period.startDate + 'T00:00:00');
    const end = new Date(period.endDate + 'T23:59:59');
    const graceDays = period.graceDays || 0;
    const graceEnd = new Date(end);
    graceEnd.setDate(graceEnd.getDate() + graceDays);
    graceEnd.setHours(23, 59, 59, 999);

    if (today < start) return 'upcoming';
    if (today <= end) return 'active';
    if (today <= graceEnd) return 'grace';
    return 'closed';
  }

  async ensureCurrentPeriodExists() {
    const defaults = await this.getReportPeriodDefaults();
    if (!defaults || !defaults.enabled) return null;

    const { startDay, endDay, graceDays } = defaults;
    if (!startDay || !endDay) return null;

    const clampDay = (year, month, day) => {
      const lastDay = new Date(year, month + 1, 0).getDate();
      return new Date(year, month, Math.min(day, lastDay));
    };

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const periodStart = clampDay(year, month, startDay);
    const periodEnd = clampDay(year, month, endDay);
    if (endDay < startDay) periodEnd.setMonth(periodEnd.getMonth() + 1);

    const graceEnd = new Date(periodEnd);
    graceEnd.setDate(graceEnd.getDate() + (graceDays || 0));

    let targetStart, targetEnd;
    if (now > graceEnd) {
      const nextMonth = periodStart.getMonth() + 1;
      const nextYear = nextMonth > 11 ? periodStart.getFullYear() + 1 : periodStart.getFullYear();
      targetStart = clampDay(nextYear, nextMonth % 12, startDay);
      targetEnd = clampDay(nextYear, nextMonth % 12, endDay);
      if (endDay < startDay) targetEnd.setMonth(targetEnd.getMonth() + 1);
    } else {
      targetStart = periodStart;
      targetEnd = periodEnd;
    }

    const startStr = targetStart.toISOString().slice(0, 10);
    const endStr = targetEnd.toISOString().slice(0, 10);

    const existing = await this.getAllReportPeriods();
    if (existing.some(p => p.startDate === startStr && p.endDate === endStr)) return null;

    let hasActiveOrUpcoming = false;
    for (const p of existing) {
      const s = await this.computePeriodStatus(p);
      if (s === 'active' || s === 'grace' || s === 'upcoming') hasActiveOrUpcoming = true;
    }
    if (hasActiveOrUpcoming) return null;

    const monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
    const label = `Kỳ báo cáo ${monthNames[targetStart.getMonth()]}/${targetStart.getFullYear()}`;

    const rsd = defaults.ratingStartDay || 0;
    const red = defaults.ratingEndDay || 0;

    const data = {
      label,
      startDate: startStr,
      endDate: endStr,
      graceDays: graceDays || 0,
      dataStartDate: clampDay(targetStart.getFullYear(), targetStart.getMonth(), defaults.dataStartDay || startDay).toISOString().slice(0, 10),
      dataEndDate: clampDay(targetEnd.getFullYear(), targetEnd.getMonth(), defaults.dataEndDay || endDay).toISOString().slice(0, 10),
      ratingStartDate: rsd ? clampDay(targetStart.getFullYear(), targetStart.getMonth(), rsd).toISOString().slice(0, 10) : '',
      ratingEndDate: (() => {
        if (!red) return '';
        const rEnd = clampDay(targetStart.getFullYear(), targetStart.getMonth(), red);
        if (rsd && red < rsd) rEnd.setMonth(rEnd.getMonth() + 1);
        return rEnd.toISOString().slice(0, 10);
      })(),
      autoCreated: true
    };

    const newDoc = await this.createReportPeriod(data);
    return newDoc.id;
  }

  // ═══════════════════════════════════════════════
  // CRUD
  // ═══════════════════════════════════════════════

  async createReportPeriod(data: any) {
    const payload = { _id: SYSTEM_ID(), ...data };
    await this.periodsModel.create(payload);
    return this.mapDoc(payload);
  }

  async updateReportPeriod(id: string, data: any) {
    const updated = await this.periodsModel.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
    return this.mapDoc(updated);
  }

  async deleteReportPeriod(id: string) {
    const updated = await this.periodsModel.findByIdAndUpdate(id, { 
      $set: { isDeleted: true, deletedAt: new Date() } 
    }, { new: true }).lean();
    return this.mapDoc(updated);
  }

  async restoreReportPeriod(id: string) {
    const updated = await this.periodsModel.findByIdAndUpdate(id, {
      $set: { isDeleted: false, deletedAt: null }
    }, { new: true }).lean();
    return this.mapDoc(updated);
  }

  async permanentlyDeleteReportPeriod(id: string) {
    await this.periodsModel.findByIdAndDelete(id);
    return { success: true };
  }

  async getDeletedReportPeriods() {
    const docs = await this.periodsModel.find({ isDeleted: true }).sort({ deletedAt: -1 }).lean();
    return docs.map(d => this.mapDoc(d));
  }

  async purgeExpiredDeletedPeriods() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const result = await this.periodsModel.deleteMany({
      isDeleted: true,
      deletedAt: { $lt: thirtyDaysAgo }
    });
    return { purgedCount: result.deletedCount };
  }

  async getAllReportPeriods() {
    const docs = await this.periodsModel.find({ isDeleted: { $ne: true } }).sort({ startDate: -1 }).lean();
    return docs.map(d => Object.assign(this.mapDoc(d), { deleted: d.isDeleted }));
  }

  // ═══════════════════════════════════════════════
  // STATISTICS & METRICS (SQL-LIKE JOINS)
  // ═══════════════════════════════════════════════

  async getGroupReportStatus(groupId: string, startDate: string, endDate: string, periodId?: string) {
    const query: any = { groupId, status: 'sent' };
    const reports = await this.reportsModel.find(query).lean();
    const mapped = reports.map(r => this.mapDoc(r));

    const sentStudentIds = new Set<string>();
    const lateStudentIds = new Set<string>();
    const validReports = [];

    const periodStart = new Date(startDate + 'T00:00:00');
    const periodEnd = new Date(endDate + 'T23:59:59');

    for (const data of mapped) {
      if (!data.sentAt) continue;
      const sentAtDate = new Date(data.sentAt);

      if (periodId) {
        if (data.periodId !== periodId) continue;
      } else {
        if (sentAtDate < periodStart) continue;
      }

      sentStudentIds.add(data.studentId);
      validReports.push(data);

      if (sentAtDate > periodEnd) {
        lateStudentIds.add(data.studentId);
      }
    }

    return {
      sentStudentIds: Array.from(sentStudentIds),
      lateStudentIds: Array.from(lateStudentIds),
      reports: validReports,
    };
  }

  async getReportStatsForPeriod(startDate: string, endDate: string, periodId?: string) {
    const periodStart = new Date(startDate + 'T00:00:00');
    const periodEnd = new Date(endDate + 'T23:59:59');

    const [allTeachers, allStudents, allGroups, rawReports] = await Promise.all([
      this.getUsersByRole('teacher'),
      this.getUsersByRole('user'),
      this.groupsModel.find({ isHidden: { $ne: true }, deleted: { $ne: true } }).lean(),
      this.reportsModel.find({ status: 'sent' }).lean()
    ]);

    const groupMap = {};
    for (const g of allGroups) groupMap[g._id] = g;

    const periodReports = [];
    for (const r of rawReports) {
      if (!r.sentAt) continue;
      const sentAtDate = new Date(r.sentAt);
      if (periodId) {
        if ((r as any).periodId !== periodId) continue;
      } else {
        if (sentAtDate < periodStart) continue;
      }
      periodReports.push({ ...r, id: r._id, sentAt: sentAtDate });
    }

    const results = allTeachers.map(teacher => {
      const teacherGroupIds = ((teacher as any).groupIds || []).filter(gid => groupMap[gid]);
      const teacherGroupNames = teacherGroupIds.map(gid => groupMap[gid].name || gid);

      const teacherStudentIds = new Set<string>();
      for (const s of allStudents) {
        const studentGroups = (s as any).groupIds || [];
        for (const gid of studentGroups) {
          if (teacherGroupIds.includes(gid)) teacherStudentIds.add(s._id);
        }
      }

      const sentStudentIds = new Set<string>();
      const lateStudentIds = new Set<string>();
      for (const r of periodReports) {
        if (teacherGroupIds.includes(r.groupId)) {
          sentStudentIds.add(r.studentId);
          if (r.sentAt > periodEnd) lateStudentIds.add(r.studentId);
        }
      }

      return {
        teacherId: teacher._id,
        teacherName: (teacher as any).displayName || (teacher as any).email || 'N/A',
        groups: teacherGroupNames,
        sentCount: sentStudentIds.size,
        lateCount: lateStudentIds.size,
        totalStudents: teacherStudentIds.size
      };
    }).filter(t => t.totalStudents > 0);

    return results;
  }

  async getTeacherReportDetails(teacherId: string, startDate: string, endDate: string, periodId?: string) {
    const teacherDoc = await this.getUserById(teacherId);
    if (!teacherDoc) return [];

    const teacherGroupIds = (teacherDoc as any).groupIds || [];
    if (!teacherGroupIds.length) return [];

    const groupMap = {};
    const groupsRaw = await this.groupsModel.find({ _id: { $in: teacherGroupIds }, isHidden: { $ne: true }, deleted: { $ne: true } }).lean();
    for (const g of groupsRaw) groupMap[g._id] = (g as any).name || g._id;

    const validGroupIds = Object.keys(groupMap);
    if (!validGroupIds.length) return [];

    const students = [];
    const studentsRaw = await this.getUsersByRole('user');
    for (const u of studentsRaw) {
      const mgps = ((u as any).groupIds || []).filter(gid => validGroupIds.includes(gid));
      if (mgps.length > 0) students.push({ ...u, id: u._id, matchedGroupId: mgps[0] });
    }

    const periodStart = new Date(startDate + 'T00:00:00');
    const periodEnd = new Date(endDate + 'T23:59:59');

    const reportsRaw = await this.reportsModel.find({ status: 'sent', groupId: { $in: validGroupIds } }).lean();
    
    const reportMap = {};
    for (const r of reportsRaw) {
      if (!r.sentAt) continue;
      const sentAtDate = new Date(r.sentAt);
      if (periodId) {
        if ((r as any).periodId !== periodId) continue;
      } else {
        if (sentAtDate < periodStart) continue;
      }
      
      const sid = r.studentId;
      if (!reportMap[sid] || sentAtDate > new Date(reportMap[sid].sentAt)) {
        reportMap[sid] = { ...r, id: r._id, sentAt: sentAtDate };
      }
    }

    const compiled = students.map(s => {
      const report = reportMap[s.id];
      let status = 'pending';
      let sentAt = null;
      let reportId = null;

      if (report) {
        sentAt = report.sentAt;
        reportId = report.id;
        status = report.sentAt > periodEnd ? 'late' : 'sent';
      }

      return {
        studentId: s.id,
        studentName: (s as any).displayName || (s as any).email || 'N/A',
        groupName: groupMap[s.matchedGroupId] || '',
        groupId: s.matchedGroupId,
        status,
        sentAt,
        reportId
      };
    });

    const order = { pending: 0, late: 1, sent: 2 };
    compiled.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));
    return compiled;
  }
}
