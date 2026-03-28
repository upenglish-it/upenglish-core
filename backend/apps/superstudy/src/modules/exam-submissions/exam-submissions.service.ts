import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import {
  SSTExamSubmissions,
  SSTExams,
  SSTExamQuestions,
  SSTUsers,
  SSTNotifications,
  SSTExamAssignments,
} from 'apps/common/src/database/mongodb/src/superstudy';
import { AiService } from '../ai/ai.service';

/** Question type labels (Vietnamese) — mirrors TYPE_LABELS in scheduledNotifications.js */
const TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Trắc nghiệm',
  fill_in_blank: 'Điền vào chỗ trống',
  essay: 'Tự luận',
  matching: 'Nối từ',
  ordering: 'Sắp xếp',
  categorization: 'Phân loại',
  audio_recording: 'Nói',
};

/** AI grading failure feedback — mirrors getAiGradingFailureFeedback() */
function getAiGradingFailureFeedback(err: any, fallback: string): string {
  if (err?.message?.includes('QUOTA_EXCEEDED')) {
    return 'Hệ thống AI đang quá tải. Giáo viên sẽ chấm thủ công.';
  }
  return fallback || 'Lỗi khi chấm bài bằng AI. Giáo viên sẽ chấm thủ công.';
}

@Injectable()
export class ExamSubmissionsService {
  private readonly logger = new Logger(ExamSubmissionsService.name);

  constructor(
    @InjectModel(SSTExamSubmissions)
    private readonly submissionsModel: ReturnModelType<typeof SSTExamSubmissions>,

    @InjectModel(SSTExams)
    private readonly examsModel: ReturnModelType<typeof SSTExams>,

    @InjectModel(SSTExamQuestions)
    private readonly examQuestionsModel: ReturnModelType<typeof SSTExamQuestions>,

    @InjectModel(SSTUsers)
    private readonly usersModel: ReturnModelType<typeof SSTUsers>,

    @InjectModel(SSTNotifications)
    private readonly notificationsModel: ReturnModelType<typeof SSTNotifications>,

    @InjectModel(SSTExamAssignments)
    private readonly examAssignmentsModel: ReturnModelType<typeof SSTExamAssignments>,

    private readonly aiService: AiService,
  ) {}

  async findAll(filters: { assignmentId?: string; studentId?: string }) {
    const query: Record<string, any> = {};
    if (filters.assignmentId) query.assignmentId = filters.assignmentId;
    if (filters.studentId) query.studentId = filters.studentId;
    const submissions = await this.submissionsModel.find(query).lean();
    return submissions.sort((a, b) => {
      const tA = a['createdAt'] ? new Date(a['createdAt']).getTime() : 0;
      const tB = b['createdAt'] ? new Date(b['createdAt']).getTime() : 0;
      return tB - tA;
    });
  }

  async findOne(id: string) {
    const sub = await this.submissionsModel.findById(id).lean();
    if (!sub) throw new NotFoundException(`Submission ${id} not found`);
    return sub;
  }

  /**
   * Start exam — create a new submission document
   * Business rule: a student cannot start the same assignment twice if not allowMultipleAttempts
   */
  async create(data: Record<string, any>) {
    const existing = await this.submissionsModel.findOne({
      assignmentId: data.assignmentId,
      studentId: data.studentId,
      status: { $ne: 'graded' },
    });
    if (existing) {
      throw new ConflictException(
        `Student already has an active submission for assignment ${data.assignmentId}`,
      );
    }

    const submission = await this.submissionsModel.create({
      ...data,
      status: 'in_progress',
      startedAt: new Date(),
      answers: data.answers ?? {},
      variationMap: data.variationMap ?? {},
      questionTimers: data.questionTimers ?? {},
      results: {},
      followUpAnswers: {},
      followUpResults: {},
      resultsReleased: false,
      viewedByStudent: false,
      tabSwitchCount: 0,
    });
    return submission.toObject();
  }

  /**
   * Update submission — covers save-in-progress AND submit
   */
  async update(id: string, data: Record<string, any>) {
    if (data.status === 'submitted' && !data.submittedAt) {
      data.submittedAt = new Date();
    }
    const updated = await this.submissionsModel
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Submission ${id} not found`);
    return updated;
  }

  /** Release results to student */
  async releaseResults(id: string, releasedBy: string, releasedByName?: string) {
    const updated = await this.submissionsModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            resultsReleased: true,
            releasedAt: new Date(),
            releasedBy,
            releasedByName: releasedByName ?? null,
          },
        },
        { new: true },
      )
      .lean();
    if (!updated) throw new NotFoundException(`Submission ${id} not found`);
    return updated;
  }

  /** Release follow-up results */
  async releaseFollowUpResults(id: string, releasedBy: string, releasedByName?: string) {
    const updated = await this.submissionsModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            followUpResultsReleased: true,
            followUpReleasedAt: new Date(),
            followUpReleasedBy: releasedBy,
            followUpReleasedByName: releasedByName ?? null,
          },
        },
        { new: true },
      )
      .lean();
    if (!updated) throw new NotFoundException(`Submission ${id} not found`);
    return updated;
  }

  async markViewed(id: string) {
    return this.submissionsModel
      .findByIdAndUpdate(id, { $set: { viewedByStudent: true } }, { new: true })
      .lean();
  }

  async markFollowUpViewed(id: string) {
    return this.submissionsModel
      .findByIdAndUpdate(id, { $set: { followUpResultsViewedByStudent: true } }, { new: true })
      .lean();
  }

  // ══════════════════════════════════════════════════════════════
  // SERVER-SIDE GRADING
  // Mirrors gradeSubmissionOnServer() from scheduledNotifications.js
  // ══════════════════════════════════════════════════════════════

  /**
   * Grade a submission server-side.
   * Handles all question types: multiple_choice, fill_in_blank, matching,
   * categorization, ordering, essay (AI), audio_recording.
   * Mirrors gradeSubmissionOnServer() from functions/scheduledNotifications.js exactly.
   *
   * @param submissionId - ID of the submission to grade
   * @param options - Optional override for exam/questions/teacher info (avoids extra DB lookups if already loaded)
   */
  async gradeSubmission(
    submissionId: string,
    options?: {
      subData?: Record<string, any>;
      questions?: any[];
      sections?: any[];
      teacherTitle?: string;
      studentTitle?: string;
    },
  ): Promise<{ results: Record<string, any>; totalScore: number; maxTotalScore: number }> {
    // Load submission if not provided
    const subData = options?.subData ?? (await this.submissionsModel.findById(submissionId).lean()) as any;
    if (!subData) throw new NotFoundException(`Submission ${submissionId} not found`);

    const examId = subData.examId;
    if (!examId) throw new NotFoundException(`Submission ${submissionId} has no examId`);

    // Load exam if not provided
    let examData: any;
    let questions: any[];
    let teacherTitle = options?.teacherTitle ?? '';
    let studentTitle = options?.studentTitle ?? '';
    const sections: any[] = options?.sections ?? [];

    if (!options?.questions) {
      const examDoc = await this.examsModel.findById(examId).lean() as any;
      if (!examDoc) throw new NotFoundException(`Exam ${examId} not found`);
      examData = examDoc;

      const questionsRaw = await this.examQuestionsModel.find({ examId } as any).lean();
      questions = questionsRaw.map((q: any) => ({ id: String(q._id), ...q }));

      // Resolve teacher titles
      if (examData.teacherTitle) {
        teacherTitle = examData.teacherTitle;
        studentTitle = examData.studentTitle || '';
      } else if (examData.createdBy) {
        const userDoc = await this.usersModel.findById(examData.createdBy).lean() as any;
        if (userDoc) {
          teacherTitle = userDoc.teacherTitle || '';
          studentTitle = userDoc.studentTitle || '';
        }
      }
    } else {
      questions = options.questions;
    }

    // Build sections map: { [sectionId]: contextHtml }
    const sectionsArr = sections.length ? sections : (examData?.sections || []);
    const sectionsMap: Record<string, string> = {};
    for (const sec of sectionsArr) {
      if (sec.id) sectionsMap[sec.id] = sec.context || sec.contextHtml || '';
    }

    const answers = subData.answers ?? {};
    const variationMap = subData.variationMap ?? {};

    const results: Record<string, any> = {};
    let totalScore = 0;
    let maxTotalScore = 0;
    let essayAudioIndex = 0;
    let questionCounter = 0;
    const previousResults: any[] = [];

    for (const question of questions) {
      const questionId = question.id || String(question._id);
      const maxScore: number = question.points || 1;
      maxTotalScore += maxScore;

      const answerData = answers[questionId];
      if (!answerData) continue;

      try {
        // Resolve variation from variationMap
        const variationIdx = variationMap[questionId] ?? 0;
        const variationsArr = Array.isArray(question.variations) ? question.variations : [question];
        const variation = variationsArr[variationIdx] ?? variationsArr[0] ?? question;
        const sectionId = question.sectionId || '';

        let score = 0;
        let isCorrect = false;
        let feedback = '';
        let teacherNote = '';
        let detectedErrors: string[] = [];

        // ─── Question type grading logic ───────────────────────────────────
        if (question.type === 'multiple_choice') {
          const correctAnswer = variation.correctAnswer ?? variation.correct_answer ?? null;
          const studentAnswer = answerData.answer ?? answerData.selectedIndex ?? null;
          isCorrect = correctAnswer !== null && String(studentAnswer) === String(correctAnswer);
          score = isCorrect ? maxScore : 0;
          feedback = isCorrect ? 'Chính xác!' : `Đáp án đúng: ${variation.options?.[correctAnswer] ?? correctAnswer}`;

        } else if (question.type === 'fill_in_blank') {
          const blanks: Array<{ answer: string; acceptedAnswers?: string[]; matchType?: string }> =
            Array.isArray(variation.blanks) ? variation.blanks : [];
          const studentBlanks: Record<number, string> = answerData.answer || {};
          const total = blanks.length;
          let correctCount = 0;

          blanks.forEach((blank, idx) => {
            const expected = (blank.answer || '').trim().toLowerCase();
            const accepted = (blank.acceptedAnswers || [blank.answer]).map((a: string) => a.trim().toLowerCase());
            const stu = (String(studentBlanks[idx] ?? studentBlanks[String(idx)] ?? '')).trim().toLowerCase();
            if (accepted.includes(stu)) correctCount++;
          });

          score = total > 0 ? Math.round((correctCount / total) * maxScore * 10) / 10 : 0;
          isCorrect = correctCount === total && total > 0;
          feedback = isCorrect ? 'Chính xác!' : `Bạn đã điền đúng ${correctCount}/${total} chỗ trống.`;

        } else if (question.type === 'matching') {
          const pairs: Array<{ left: string; right: string }> = Array.isArray(variation.pairs) ? variation.pairs : [];
          const total = pairs.length;
          let correctCount = 0;
          const studentMatches: Record<string, string> = answerData.answer || {};
          pairs.forEach((pair) => { if (studentMatches[pair.left] === pair.right) correctCount++; });
          score = total > 0 ? Math.round((correctCount / total) * maxScore * 10) / 10 : 0;
          isCorrect = correctCount === total && total > 0;
          feedback = isCorrect ? 'Chính xác!' : `Bạn đã ghép đúng ${correctCount}/${total} cặp.`;

        } else if (question.type === 'categorization') {
          const items: Array<{ text: string; group: string }> = variation.items || [];
          const total = items.length;
          let correctCount = 0;
          const studentAnswers: Record<string, string> = answerData.answer || {};
          items.forEach((item) => { if (studentAnswers[item.text] === item.group) correctCount++; });
          score = total > 0 ? Math.round((correctCount / total) * maxScore * 10) / 10 : 0;
          isCorrect = correctCount === total && total > 0;
          feedback = isCorrect ? 'Chính xác!' : `Bạn đã phân loại đúng ${correctCount}/${total} mục.`;

        } else if (question.type === 'ordering') {
          const correctItems: any[] = variation.items || [];
          const total = correctItems.length;
          let correctCount = 0;
          const studentOrder: any[] = Array.isArray(answerData.answer) ? answerData.answer : [];
          correctItems.forEach((item, i) => { if (studentOrder[i] === item) correctCount++; });
          score = total > 0 ? Math.round((correctCount / total) * maxScore * 10) / 10 : 0;
          isCorrect = correctCount === total && total > 0;
          feedback = isCorrect ? 'Chính xác!' : `Bạn đã xếp đúng vị trí ${correctCount}/${total} mục.`;

        } else if (question.type === 'essay') {
          try {
            const contextHtml = sectionsMap[sectionId] || '';
            const gradeResult = await this.aiService.gradeEssay({
              variation,
              studentAnswer: answerData.answer,
              purpose: question.purpose,
              type: question.type,
              specialRequirement: question.specialRequirement || '',
              contextHtml,
              teacherTitle,
              studentTitle,
              questionIndex: essayAudioIndex,
              previousResults,
            });
            essayAudioIndex++;
            const numericScore = parseInt(String(gradeResult.score), 10);
            score = Math.round((numericScore / 10) * maxScore * 10) / 10;
            isCorrect = numericScore >= 8;
            feedback = gradeResult.feedback || '';
            teacherNote = gradeResult.teacherNote || '';
            detectedErrors = Array.isArray(gradeResult.detectedErrors) ? gradeResult.detectedErrors : [];
          } catch (aiErr: any) {
            this.logger.error(`Server AI grading failed for question ${questionId}:`, aiErr?.message);
            score = 0;
            feedback = getAiGradingFailureFeedback(aiErr, 'Lỗi khi chấm bài bằng AI. Giáo viên sẽ chấm thủ công.');
          }

        } else if (question.type === 'audio_recording') {
          const audioAnswer = answerData.answer || {};
          if (audioAnswer.aiScore !== undefined) {
            const numericScore = parseFloat(String(audioAnswer.aiScore));
            score = numericScore;
            isCorrect = numericScore >= maxScore * 0.8;
            feedback = audioAnswer.aiFeedback || '';
          } else {
            score = 0;
            feedback = audioAnswer.transcript
              ? 'Bài thu âm chưa được AI chấm điểm. Giáo viên sẽ chấm thủ công.'
              : 'Học viên chưa thu âm câu trả lời.';
          }
        }

        totalScore += score;
        questionCounter++;

        const resultEntry: any = { score, maxScore, isCorrect, feedback, teacherOverride: null };
        if (teacherNote) resultEntry.teacherNote = teacherNote;
        if (detectedErrors.length > 0) resultEntry.detectedErrors = detectedErrors;
        results[questionId] = resultEntry;

        previousResults.push({
          questionNumber: questionCounter,
          typeName: TYPE_LABELS[question.type] || question.type,
          purpose: question.purpose || '',
          isCorrect,
          score,
          maxScore,
          feedback: feedback || '',
        });
      } catch (err: any) {
        this.logger.error(`Error grading question ${questionId}:`, err?.message);
        results[questionId] = {
          score: 0,
          maxScore,
          isCorrect: false,
          feedback: 'Lỗi khi chấm câu hỏi này.',
          teacherOverride: null,
        };
      }
    }

    // Mark unanswered questions as 0
    for (const question of questions) {
      const qId = question.id || String(question._id);
      if (!results[qId]) {
        results[qId] = {
          score: 0,
          maxScore: question.points || 1,
          isCorrect: false,
          feedback: '',
          teacherOverride: null,
        };
      }
    }

    totalScore = Math.round(totalScore * 10) / 10;

    // Update submission in DB
    await this.submissionsModel.findByIdAndUpdate(submissionId, {
      $set: {
        results,
        totalScore,
        maxTotalScore,
        status: 'graded',
        gradedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return { results, totalScore, maxTotalScore };
  }

  // ══════════════════════════════════════════════════════════════
  // AUTO-SUBMIT EXPIRED EXAMS (Agenda job helper)
  // Mirrors autoSubmitExpiredExams Cloud Function from scheduledNotifications.js
  // Called by the Agenda scheduler every 10 minutes
  // ══════════════════════════════════════════════════════════════

  /**
   * Find and auto-submit all expired in-progress exam submissions.
   * Mirrors the autoSubmitExpiredExams Cloud Function exactly.
   */
  async autoSubmitExpiredExams(): Promise<{ processed: number; errors: number }> {
    const now = new Date();
    let processed = 0;
    let errors = 0;

    const expiredSubs = await this.submissionsModel
      .find({
        status: 'in_progress',
        examEndTime: { $lte: now },
      } as any)
      .lean();

    if (!expiredSubs.length) return { processed: 0, errors: 0 };

    this.logger.log(`[AutoSubmit] Found ${expiredSubs.length} expired exam submissions.`);

    for (const sub of expiredSubs) {
      const submissionId = String((sub as any)._id);
      try {
        // 1. Mark as submitted
        await this.submissionsModel.findByIdAndUpdate(submissionId, {
          $set: {
            status: 'submitted',
            submittedAt: new Date(),
            autoSubmitted: true,
            updatedAt: new Date(),
          },
        });

        const examId = (sub as any).examId;
        if (!examId) {
          this.logger.warn(`[AutoSubmit] Submission ${submissionId} has no examId, skipping grading.`);
          continue;
        }

        const examDoc = await this.examsModel.findById(examId).lean() as any;
        if (!examDoc) {
          this.logger.warn(`[AutoSubmit] Exam ${examId} not found for submission ${submissionId}.`);
          continue;
        }

        const questionsRaw = await this.examQuestionsModel.find({ examId } as any).lean();
        const questions = questionsRaw.map((q: any) => ({ id: String(q._id), ...q }));

        // Resolve teacher titles
        let teacherTitle = '';
        let studentTitle = '';
        if (examDoc.teacherTitle) {
          teacherTitle = examDoc.teacherTitle;
          studentTitle = examDoc.studentTitle || '';
        } else if (examDoc.createdBy) {
          const userDoc = await this.usersModel.findById(examDoc.createdBy).lean() as any;
          if (userDoc) {
            teacherTitle = userDoc.teacherTitle || '';
            studentTitle = userDoc.studentTitle || '';
          }
        }

        // 2. Grade the submission
        await this.gradeSubmission(submissionId, {
          subData: sub as any,
          questions,
          sections: examDoc.sections || [],
          teacherTitle,
          studentTitle,
        });

        this.logger.log(`[AutoSubmit] Graded submission ${submissionId} successfully.`);

        // 3. Notify group teachers if assignment is group-based
        const assignmentId = (sub as any).assignmentId;
        if (assignmentId) {
          try {
            const asgnDoc = await this.examAssignmentsModel.findById(assignmentId).lean() as any;
            if (asgnDoc && asgnDoc.targetType === 'group' && asgnDoc.targetId) {
              // Resolve student name
              let studentName = 'Học viên';
              const studentId = (sub as any).studentId;
              if (studentId) {
                const studentDoc = await this.usersModel.findById(studentId).lean() as any;
                if (studentDoc) {
                  studentName = studentDoc.displayName || studentDoc.email || 'Học viên';
                }
              }

              const examName = asgnDoc.examName || asgnDoc.examTitle || examDoc.name || 'Bài tập';

              // Find teachers in the group
              const groupTeachers = await this.usersModel
                .find({ groupIds: asgnDoc.targetId, role: 'teacher', deleted: { $ne: true } } as any)
                .lean();

              const notifs = groupTeachers.map((t: any) => ({
                userId: String(t._id),
                type: 'exam_submitted',
                title: '📩 Bài tự động nộp',
                message: `Bài "${examName}" của ${studentName} đã được hệ thống tự động nộp do hết giờ.`,
                link: `/teacher/exam-submissions/${assignmentId}`,
                isRead: false,
                createdAt: new Date(),
              }));

              if (notifs.length) {
                await this.notificationsModel.insertMany(notifs as any);
              }
            }
          } catch (notifErr: any) {
            this.logger.error(`[AutoSubmit] Notification error for ${submissionId}:`, notifErr?.message);
          }
        }

        processed++;
      } catch (subErr: any) {
        this.logger.error(`[AutoSubmit] Error processing submission ${submissionId}:`, subErr?.message);
        errors++;
      }
    }

    return { processed, errors };
  }
}
