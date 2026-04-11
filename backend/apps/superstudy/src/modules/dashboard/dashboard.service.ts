import { Injectable, Inject } from '@nestjs/common';
import { getConnectionToken } from 'nestjs-typegoose';
import mongoose from 'mongoose';

@Injectable()
export class DashboardService {
  constructor(
    @Inject(getConnectionToken()) private readonly connection: mongoose.Connection
  ) {}

  private normalizeEmail(value: any): string {
    return String(value ?? '').trim().toLowerCase();
  }

  private normalizeAccountUser(account: any) {
    const uid = String(account?.accountId || account?._id || '').trim();
    const emailAddresses = Array.isArray(account?.emailAddresses) ? account.emailAddresses : [];
    const email = this.normalizeEmail(account?.email || emailAddresses[0] || '');
    const displayName = String(account?.displayName ?? '').trim()
      || [account?.firstName, account?.lastName].filter(Boolean).join(' ').trim()
      || email
      || uid;

    return {
      uid,
      id: uid,
      email,
      displayName,
      role: account?.role === 'student' ? 'user' : account?.role,
      status: account?.status ?? (account?.active === false ? 'pending' : 'approved'),
      groupIds: Array.isArray(account?.groupIds) ? account.groupIds : [],
      deleted: Boolean(account?.deleted),
    };
  }

  private mergeUsers(accounts: any[]) {
    const merged = new Map<string, any>();

    for (const account of accounts || []) {
      const normalized = this.normalizeAccountUser(account);
      if (!normalized.uid) continue;
      merged.set(normalized.uid, normalized);
    }

    return Array.from(merged.values());
  }

  async getStats() {
    const db = this.connection.db;

    const accountsRaw = await db.collection<any>('accounts').find(
      { deleted: { $ne: true } },
      {
        projection: {
          _id: 1,
          accountId: 1,
          email: 1,
          emailAddresses: 1,
          displayName: 1,
          firstName: 1,
          lastName: 1,
          role: 1,
          status: 1,
          active: 1,
          groupIds: 1,
          deleted: 1,
        },
      },
    ).toArray();
    const usersList = this.mergeUsers(accountsRaw);
    
    const approvedUsersCount = usersList.filter((u: any) => u.status === 'approved').length;

    const [
        topicsCount,
        grammarDocsSnap,
        grammarSubSnap,
        examSubSnap,
        wordProgressSnap,
        grammarProgressSnap,
        systemExamsCount,
        teacherTopicsSnap,
        teacherExamsSnap,
        groupsSnap,
        examAssignmentsSnap,
        grammarAssignmentsSnap,
        vocabGrammarAssignmentsSnap
    ] = await Promise.all([
        db.collection<any>('sst-topics').countDocuments({ deleted: { $ne: true } }),
        db.collection<any>('sst-grammar-exercises').find(
          { deleted: { $ne: true } },
          { projection: { deleted: 1, teacherId: 1 } },
        ).toArray(),
        db.collection<any>('sst-grammar-submissions').find(
          { deleted: { $ne: true } },
          { projection: { deleted: 1, studentId: 1, createdAt: 1 } },
        ).toArray(),
        db.collection<any>('sst-exam-submissions').find(
          { deleted: { $ne: true } },
          {
            projection: {
              deleted: 1,
              studentId: 1,
              createdAt: 1,
              teacherId: 1,
              assignedBy: 1,
              status: 1,
              score: 1,
              examId: 1,
              'answers.errorCategory': 1,
              'answers.isCorrect': 1,
            },
          },
        ).toArray(),
        db.collection<any>('sst-word-progress').find(
          { deleted: { $ne: true } },
          { projection: { deleted: 1, studentId: 1, userId: 1, createdAt: 1, lastStudied: 1, topicId: 1, ref_path: 1 } },
        ).toArray(),
        db.collection<any>('sst-grammar-progress').find(
          { deleted: { $ne: true } },
          { projection: { deleted: 1, studentId: 1, userId: 1, createdAt: 1, lastStudied: 1, exerciseId: 1, ref_path: 1 } },
        ).toArray(),
        db.collection<any>('sst-exams').countDocuments({ createdByRole: 'admin', deleted: { $ne: true } }),
        db.collection<any>('sst-teacher-topics').find(
          { deleted: { $ne: true } },
          { projection: { deleted: 1, teacherId: 1, createdBy: 1 } },
        ).toArray(),
        db.collection<any>('sst-exams').find(
          { createdByRole: 'teacher', deleted: { $ne: true } },
          { projection: { deleted: 1, createdBy: 1, createdByRole: 1 } },
        ).toArray(),
        db.collection<any>('sst-user-groups').find(
          { deleted: { $ne: true } },
          { projection: { deleted: 1, isHidden: 1, name: 1, teacherId: 1, createdBy: 1 } },
        ).toArray(),
        db.collection<any>('sst-exam-assignments').find(
          { deleted: { $ne: true } },
          { projection: { deleted: 1, targetType: 1, targetId: 1, examId: 1, createdAt: 1 } },
        ).toArray(),
        db.collection<any>('sst-assignments').find(
          { isGrammar: true, deleted: { $ne: true } },
          { projection: { deleted: 1, isGrammar: 1, groupId: 1, topicId: 1, createdAt: 1 } },
        ).toArray(),
        db.collection<any>('sst-assignments').find(
          { deleted: { $ne: true } },
          { projection: { deleted: 1, isGrammar: 1, groupId: 1, topicId: 1, createdAt: 1 } },
        ).toArray(),
    ]);

    const teacherContentCount: Record<string, number> = {};
    const processTeacherDocs = (docs: any[]) => {
        docs.forEach((data: any) => {
            const tid = data.teacherId || data.createdBy;
            if (tid) {
                teacherContentCount[tid] = (teacherContentCount[tid] || 0) + 1;
            }
        });
    };

    let systemGrammarCount = 0;
    let teacherGrammarCount = 0;
    const teacherGrammarData: any[] = [];

    grammarDocsSnap.forEach((data: any) => {
        if (data.teacherId) {
            teacherGrammarCount++;
            teacherGrammarData.push(data);
        } else {
            systemGrammarCount++;
        }
    });

    processTeacherDocs(teacherTopicsSnap);
    processTeacherDocs(teacherGrammarData);
    processTeacherDocs(teacherExamsSnap);

    const topTeachers = Object.entries(teacherContentCount)
        .map(([uid, count]) => {
            const user = usersList.find((u: any) => u.uid === uid);
            return {
                id: uid,
                name: user?.displayName || user?.email || 'Giáo viên ẩn danh',
                count
            };
        })
        .sort((a, b) => b.count - a.count);

    const groupDocs = groupsSnap.map((g: any) => ({ id: g._id.toString(), ...g })).filter((g: any) => !g.isHidden);

    const visibleGroupIds = new Set(groupDocs.map((g: any) => g.id));
    const visibleStudentIds = new Set(
        usersList.filter((u: any) => u.role === 'user' && (u.groupIds || []).some((gid: string) => visibleGroupIds.has(gid))).map((u: any) => u.uid)
    );

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const getDocTs = (d: any) => {
        const ts = d.createdAt || d.lastStudied;
        if (!ts) return 0;
        return ts instanceof Date ? ts.getTime() : (typeof ts === 'number' ? ts : (ts.seconds ? ts.seconds * 1000 : 0));
    };

    const activeStudentIds = new Set<string>();
    grammarProgressSnap.forEach((data: any) => {
        if (getDocTs(data) >= sevenDaysAgo) {
            const sid = data.studentId || data.userId || (data.ref_path && data.ref_path.split('/')[1]);
            if (sid) activeStudentIds.add(sid);
        }
    });
    grammarSubSnap.forEach((data: any) => {
        if (getDocTs(data) >= sevenDaysAgo) activeStudentIds.add(data.studentId);
    });
    examSubSnap.forEach((data: any) => {
        if (getDocTs(data) >= sevenDaysAgo) activeStudentIds.add(data.studentId);
    });
    wordProgressSnap.forEach((data: any) => {
        if (getDocTs(data) >= sevenDaysAgo) {
            const sid = data.studentId || data.userId || (data.ref_path && data.ref_path.split('/')[1]);
            if (sid) activeStudentIds.add(sid);
        }
    });

    const topClasses = groupDocs
        .map((group: any) => {
            const totalStudents = usersList.filter((u: any) =>
                u.role === 'user' && (u.groupIds || []).includes(group.id)
            ).length;

            const teacherUser = usersList.find((u: any) => u.uid === (group.teacherId || group.createdBy))
                || usersList.find((u: any) => u.role === 'teacher' && (u.groupIds || []).includes(group.id));
            const teacherName = teacherUser?.displayName || teacherUser?.email || '';

            if (totalStudents === 0) return { id: group.id, name: group.name, teacherName, count: 0, total: 0, ratio: 0 };

            const activeStudents = usersList.filter((u: any) =>
                u.role === 'user' &&
                (u.groupIds || []).includes(group.id) &&
                activeStudentIds.has(u.uid)
            ).length;

            return {
                id: group.id,
                name: group.name,
                teacherName,
                count: activeStudents,
                total: totalStudents,
                ratio: (activeStudents / totalStudents) * 100
            };
        })
        .filter((c: any) => c.total > 0)
        .sort((a, b) => b.ratio - a.ratio || b.total - a.total)
        .slice(0, 5);

    // 1. Weekly Activity Trend
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const weeklyBuckets = Array.from({ length: 8 }, (_, i) => {
        const weekStart = now - (7 - i) * weekMs;
        const d = new Date(weekStart);
        return { label: `${d.getDate()}/${d.getMonth() + 1}`, grammar: 0, exam: 0, vocab: 0, total: 0 };
    });

    vocabGrammarAssignmentsSnap.forEach((data: any) => {
        const ts = getDocTs(data);
        const weekIdx = Math.floor((ts - (now - 8 * weekMs)) / weekMs);
        if (weekIdx >= 0 && weekIdx < 8) {
            if (data.isGrammar) weeklyBuckets[weekIdx].grammar++;
            else weeklyBuckets[weekIdx].vocab++;
            weeklyBuckets[weekIdx].total++;
        }
    });
    examAssignmentsSnap.forEach((data: any) => {
        const ts = getDocTs(data);
        const weekIdx = Math.floor((ts - (now - 8 * weekMs)) / weekMs);
        if (weekIdx >= 0 && weekIdx < 8) {
            weeklyBuckets[weekIdx].exam++;
            weeklyBuckets[weekIdx].total++;
        }
    });

    // 2. User Growth
    const monthBuckets = Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        return { label: `T${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`, month: d.getMonth(), year: d.getFullYear(), _activeSet: new Set() };
    });
    const addActivityToMonth = (ts: any, studentId: string) => {
        if (!ts || !studentId) return;
        const d = new Date(ts);
        const bucket = monthBuckets.find((b: any) => b.month === d.getMonth() && b.year === d.getFullYear());
        if (bucket) bucket._activeSet.add(studentId);
    };
    grammarSubSnap.forEach((data: any) => addActivityToMonth(getDocTs(data), data.studentId));
    examSubSnap.forEach((data: any) => addActivityToMonth(getDocTs(data), data.studentId));
    wordProgressSnap.forEach((data: any) => {
        const sid = data.userId || data.studentId || (data.ref_path && data.ref_path.split('/')[1]);
        addActivityToMonth(getDocTs(data), sid);
    });
    const finalMonthBuckets = monthBuckets.map(b => ({ label: b.label, count: b._activeSet.size }));

    // 3. Teacher Completion
    const groupToTeacher: Record<string, string> = {};
    usersList.filter((u: any) => u.role === 'teacher').forEach((t: any) => {
        (t.groupIds || []).forEach((gid: string) => { groupToTeacher[gid] = t.uid; });
    });

    const studentVocabTopics: Record<string, Set<string>> = {};
    wordProgressSnap.forEach((data: any) => {
        const sid = data.userId || data.studentId || (data.ref_path && data.ref_path.split('/')[1]);
        if (!sid || !data.topicId) return;
        if (!studentVocabTopics[sid]) studentVocabTopics[sid] = new Set();
        studentVocabTopics[sid].add(data.topicId);
    });

    const studentGrammarExercises: Record<string, Set<string>> = {};
    grammarProgressSnap.forEach((data: any) => {
        const sid = data.userId || data.studentId || (data.ref_path && data.ref_path.split('/')[1]);
        if (!sid || !data.exerciseId) return;
        if (!studentGrammarExercises[sid]) studentGrammarExercises[sid] = new Set();
        studentGrammarExercises[sid].add(data.exerciseId);
    });

    const studentExamIds: Record<string, Set<string>> = {};
    examSubSnap.forEach((data: any) => {
        if (data.examId && data.studentId) {
            const st = data.status;
            if (['submitted', 'graded', 'released', 'grading'].includes(st)) {
                if (!studentExamIds[data.studentId]) studentExamIds[data.studentId] = new Set();
                studentExamIds[data.studentId].add(data.examId);
            }
        }
    });

    const groupStudentsMap: Record<string, string[]> = {};
    groupDocs.forEach((g: any) => {
        groupStudentsMap[g.id] = usersList.filter((u: any) =>
            u.role === 'user' && (u.groupIds || []).includes(g.id)
        ).map((u: any) => u.uid);
    });

    const teacherCompletion: Record<string, { expected: number, completed: number }> = {};
    const addToTeacher = (tid: string, expected: number, completed: number) => {
        if (!tid) return;
        if (!teacherCompletion[tid]) teacherCompletion[tid] = { expected: 0, completed: 0 };
        teacherCompletion[tid].expected += expected;
        teacherCompletion[tid].completed += completed;
    };

    vocabGrammarAssignmentsSnap.forEach((data: any) => {
        const gid = data.groupId;
        if (!gid || !visibleGroupIds.has(gid)) return;
        const tid = groupToTeacher[gid];
        const students = groupStudentsMap[gid] || [];
        const topicId = data.topicId;
        if (!topicId || students.length === 0) return;
        let completed = 0;
        students.forEach((sid: string) => {
            if (data.isGrammar) {
                if (studentGrammarExercises[sid]?.has(topicId)) completed++;
            } else {
                if (studentVocabTopics[sid]?.has(topicId)) completed++;
            }
        });
        addToTeacher(tid, students.length, completed);
    });

    examAssignmentsSnap.forEach((data: any) => {
        if (data.targetType !== 'group') return;
        const gid = data.targetId;
        if (!gid || !visibleGroupIds.has(gid)) return;
        const tid = groupToTeacher[gid];
        const students = groupStudentsMap[gid] || [];
        const examId = data.examId;
        if (!examId || students.length === 0) return;
        let completed = 0;
        students.forEach((sid: string) => {
            if (studentExamIds[sid]?.has(examId)) completed++;
        });
        addToTeacher(tid, students.length, completed);
    });

    const teacherCompletionRank = Object.entries(teacherCompletion)
        .map(([tid, { expected, completed }]) => {
            const teacher = usersList.find((u: any) => u.uid === tid);
            return {
                name: teacher?.displayName || 'GV ' + tid.slice(0, 5),
                rate: expected > 0 ? Math.round((completed / expected) * 100) : 0,
                completed,
                expected
            };
        })
        .filter((t: any) => t.expected > 0)
        .sort((a, b) => b.rate - a.rate || b.completed - a.completed);

    // AI Summary logic
    const teachers = usersList.filter((u: any) => u.role === 'teacher');
    const students = usersList.filter((u: any) => u.role === 'user' && u.status === 'approved' && visibleStudentIds.has(u.uid));
    let aiSummary = `=== DỮ LIỆU HỆ THỐNG - CHỈ CÁC LỚP ĐANG HOẠT ĐỘNG (${new Date().toLocaleDateString('vi-VN')}) ===\n`;
    aiSummary += `Giáo viên: ${teachers.length}, Học viên: ${students.length}, Nhóm active: ${groupDocs.length}\n\n`;

    aiSummary += `--- GIÁO VIÊN ---\n`;
    teachers.forEach((t: any) => {
        const groups = groupDocs.filter((g: any) => g.teacherId === t.uid || g.createdBy === t.uid);
        const content = teacherContentCount[t.uid] || 0;
        aiSummary += `• ${t.displayName || t.email} | Nhóm: ${groups.map((g: any) => g.name).join(', ') || 'không'} | Bài tạo: ${content}\n`;
    });

    aiSummary += `\n--- THỐNG KÊ BÀI NỘP ---\n`;
    const teacherExamStats: Record<string, any> = {};
    examSubSnap.forEach((data: any) => {
        if (!visibleStudentIds.has(data.studentId)) return;
        const tid = data.teacherId || data.assignedBy;
        if (!tid) return;
        if (!teacherExamStats[tid]) teacherExamStats[tid] = { total: 0, onTime: 0, overdue: 0, totalScore: 0, scored: 0 };
        teacherExamStats[tid].total++;
        if (data.status === 'overdue') teacherExamStats[tid].overdue++;
        else teacherExamStats[tid].onTime++;
        if (data.score != null) { teacherExamStats[tid].totalScore += data.score; teacherExamStats[tid].scored++; }
    });
    Object.entries(teacherExamStats).forEach(([tid, st]) => {
        const t = usersList.find((u: any) => u.uid === tid);
        const avg = st.scored > 0 ? (st.totalScore / st.scored).toFixed(1) : 'N/A';
        aiSummary += `• ${t?.displayName || tid} | Nộp: ${st.total} | Đúng hạn: ${st.onTime} | Trễ: ${st.overdue} | ĐTB: ${avg}\n`;
    });

    aiSummary += `\n--- NHÓM HỌC ---\n`;
    groupDocs.forEach((g: any) => {
        const members = students.filter((u: any) => (u.groupIds || []).includes(g.id));
        aiSummary += `• ${g.name} | Sĩ số: ${members.length}\n`;
    });

    // Error cats analysis
    const errorCats: Record<string, number> = {};
    const errorCorrect: Record<string, number> = {};
    examSubSnap.forEach((data: any) => {
        if (!visibleStudentIds.has(data.studentId)) return;
        if (data.answers && Array.isArray(data.answers)) {
            data.answers.forEach((a: any) => {
                const cat = a.errorCategory || 'other';
                errorCats[cat] = (errorCats[cat] || 0) + 1;
                if (a.isCorrect) errorCorrect[cat] = (errorCorrect[cat] || 0) + 1;
            });
        }
    });

    if (Object.keys(errorCats).length > 0) {
        aiSummary += `\n--- LỖI THƯỜNG GẶP ---\n`;
        Object.entries(errorCats).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([cat, count]) => {
            const acc = Math.round(((errorCorrect[cat] || 0) / count) * 100);
            aiSummary += `• ${cat}: ${count} câu, ${acc}% đúng\n`;
        });
    }

    return {
        stats: {
            users: approvedUsersCount,
            groups: groupsSnap.length,
            topics: topicsCount,
            teacherTopics: teacherTopicsSnap.length,
            grammarExercises: systemGrammarCount,
            teacherGrammarExercises: teacherGrammarCount,
            systemExams: systemExamsCount,
            teacherExams: teacherExamsSnap.length
        },
        chartData: {
            topTeachers,
            topClasses,
            weeklyActivity: weeklyBuckets,
            userGrowth: finalMonthBuckets,
            teacherCompletionRank
        },
        aiSummary
    };
  }
}
