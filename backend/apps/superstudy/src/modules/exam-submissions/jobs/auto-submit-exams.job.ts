import { Logger } from '@nestjs/common';
import { Queue, Define, Every } from 'agenda-nest';
import { ExamSubmissionsService } from '../exam-submissions.service';

export const AUTO_SUBMIT_EXPIRED_EXAMS_JOB = 'autoSubmitExpiredExams';

/**
 * Agenda queue for auto-submitting expired exam submissions.
 * Mirrors the Firebase Cloud Function autoSubmitExpiredExams (every 10 minutes).
 *
 * Uses agenda-nest's decorator-based API:
 *  @Queue() — marks this class as an Agenda job queue
 *  @Define() — registers method as a job handler
 *  @Every('10 minutes') — schedules the job at an interval
 */
@Queue()
export class AutoSubmitExamsJob {
  private readonly logger = new Logger(AutoSubmitExamsJob.name);

  constructor(private readonly examSubmissionsService: ExamSubmissionsService) {}

  @Define(AUTO_SUBMIT_EXPIRED_EXAMS_JOB)
  @Every('10 minutes')
  async autoSubmitExpiredExams() {
    this.logger.log(`[Job] ${AUTO_SUBMIT_EXPIRED_EXAMS_JOB} triggered`);
    try {
      const result = await this.examSubmissionsService.autoSubmitExpiredExams();
      this.logger.log(`[Job] ${AUTO_SUBMIT_EXPIRED_EXAMS_JOB} completed: ${JSON.stringify(result)}`);
    } catch (err: any) {
      this.logger.error(`[Job] ${AUTO_SUBMIT_EXPIRED_EXAMS_JOB} failed:`, err?.message);
      throw err;
    }
  }
}
