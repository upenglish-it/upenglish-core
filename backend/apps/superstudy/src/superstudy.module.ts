// NestJs Imports
import mongoose from 'mongoose';
import { MongoClient } from 'mongodb';
import { APP_FILTER } from '@nestjs/core';
import { AgendaModule } from 'agenda-nest';
import { ConfigModule } from '@nestjs/config';
import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { TypegooseModule, getConnectionToken } from 'nestjs-typegoose';
// Common Imports
import { HttpExceptionFilter } from 'apps/common';
// Feature Modules
import { UsersModule } from './modules/users/users.module';
import { UserGroupsModule } from './modules/user-groups/user-groups.module';
import { ExamsModule } from './modules/exams/exams.module';
import { ExamQuestionsModule } from './modules/exam-questions/exam-questions.module';
import { ExamAssignmentsModule } from './modules/exam-assignments/exam-assignments.module';
import { ExamSubmissionsModule } from './modules/exam-submissions/exam-submissions.module';
import { GrammarExercisesModule } from './modules/grammar-exercises/grammar-exercises.module';
import { GrammarQuestionsModule } from './modules/grammar-questions/grammar-questions.module';
import { TopicsModule } from './modules/topics/topics.module';
import { TeacherTopicsModule } from './modules/teacher-topics/teacher-topics.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { EmailWhitelistModule } from './modules/email-whitelist/email-whitelist.module';
import { AiModule } from './modules/ai/ai.module';
import { WordProgressModule } from './modules/word-progress/word-progress.module';
import { SharingModule } from './modules/sharing/sharing.module';
import { AdminFoldersModule } from './modules/admin-folders/admin-folders.module';
import { TeacherFoldersModule } from './modules/teacher-folders/teacher-folders.module';
import { TeacherPromptsModule } from './modules/teacher-prompts/teacher-prompts.module';
import { TeacherRatingsModule } from './modules/teacher-ratings/teacher-ratings.module';
import { AnonymousFeedbackModule } from './modules/anonymous-feedback/anonymous-feedback.module';
import { MiniGamesModule } from './modules/mini-games/mini-games.module';
import { ReportPeriodsModule } from './modules/report-periods/report-periods.module';
import { AuthModule } from './modules/auth/auth.module';

const DatabaseProvider = {
  provide: 'DATABASE_CONNECTION',
  useFactory: async () => {
    const client = new MongoClient(process.env.MONGODB_URL);
    await client.connect();
    return client.db();
  },
};

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: `apps/env/.superstudy.env` }),
    TypegooseModule.forRoot(process.env.MONGODB_URL),
    AgendaModule.forRootAsync({
      useFactory: (mongo: any) => ({
        mongo,
      }),
      inject: ['DATABASE_CONNECTION'],
      extraProviders: [DatabaseProvider],
    }),
    // Feature Modules
    UsersModule,
    UserGroupsModule,
    ExamsModule,
    ExamQuestionsModule,
    ExamAssignmentsModule,
    ExamSubmissionsModule,
    GrammarExercisesModule,
    GrammarQuestionsModule,
    TopicsModule,
    TeacherTopicsModule,
    AssignmentsModule,
    NotificationsModule,
    // New modules
    EmailWhitelistModule,
    AiModule,
    WordProgressModule,
    SharingModule,
    AdminFoldersModule,
    TeacherFoldersModule,
    TeacherPromptsModule,
    TeacherRatingsModule,
    AnonymousFeedbackModule,
    MiniGamesModule,
    ReportPeriodsModule,
    AuthModule,
  ],

  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class SuperStudyModule implements OnModuleInit {
  constructor(@Inject(getConnectionToken()) private readonly connection: mongoose.Connection) {}

  public onModuleInit(): void {
    /* listen mongoose connection */
    this.connection.on('connected', () => console.log(`MongoDB connected in ${process.env.NODE_ENV}`));
    this.connection.on('disconnected', () => console.error(`MongoDB disconnected in ${process.env.NODE_ENV}`));
    this.connection.on('error', (event) => console.log(`MongoDB error in ${process.env.NODE_ENV}`, event));
  }
}
