import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { FirebaseModule } from 'nestjs-firebase';
import { MongoClient } from 'mongodb';
import { TypegooseModule, getConnectionToken } from 'nestjs-typegoose';
import { FirebaseAdminConfig, HttpExceptionFilter } from 'apps/common';
import { AccountsModule } from './modules/accounts/accounts.module';
import { AuthModule } from './modules/auth/auth.module';
import { BranchesModule } from './modules/branches/branches.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { LockScreenModule } from './modules/lock-screen/lock-screen.module';
import { LanguageModule } from './modules/language/language.module';
import { FileManagerModule } from './modules/file-manager/file-manager.module';
import { StudentsModule } from './modules/students/students/students.module';
import { SmartFilterStudentsModule } from './modules/smart-filter/smart-filter-students/smart-filter-students.module';
import { ClassesModule } from './modules/classes/classes.module';
import { CoursesModule } from './modules/courses/courses/courses.module';
import { CoursesGroupsModule } from './modules/courses/courses-groups/courses-groups.module';
// import { StudentsModule } from './modules/students/students/students.module';
import { StaffsModule } from './modules/staffs/staffs.module';
import { ProfOfPaymentModule } from './modules/pop/pop.module';
// import { RolesPermissionsModule } from './modules/roles-permissions/roles-permissions.module';
// import { StudentsAttendanceModule } from './modules/students/students-attendance/students-attendance.module';
// import { StudentsTuitionAttendanceModule } from './modules/students/students-tuition-attendance/students-tuition-attendance.module';
import { MaterialModule } from './modules/materials/materials.module';
import { IncomeModule } from './modules/cashflow/income/income.module';
import { ExpensesModule } from './modules/cashflow/expeses/expeses.module';
import { TagsModule } from './modules/templates/tags/tags.module';
import { SourcesModule } from './modules/templates/sources/sources.module';
// import { NotificationsModule } from './modules/notifications/notifications.module';
// import { ChallengesModule } from './modules/challenges/challenges.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { ConnectionGateway } from './modules/gateway/connection.gateway';
import { CalendarsModule } from './modules/calendars/calendars.module';
import { SchedulesShiftsModule } from './modules/schedules/shifts/shifts.module';
import { LeavesModule } from './modules/leaves/leaves.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { PipelinesModule } from './modules/pipelines/pipelines.module';
import mongoose from 'mongoose';
import { AgendaModule } from 'agenda-nest';
import { DashboardAdminModule } from './modules/dashboard/admin/admin.module';
import { ActivityLogsModule } from './modules/activity-logs/activity-logs.module';
import { MigrationsModule } from './modules/migrations/migrations.module';
// import { DashboardModule } from './modules/dashboard/dashboard.module';
// import { ActivityLogsModule } from './modules/activity-logs/activity-logs.module';

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
    ConfigModule.forRoot({ envFilePath: `env/.upenglish.env` }),
    TypegooseModule.forRoot(process.env.MONGODB_URL),
    AgendaModule.forRootAsync({
      useFactory: (mongo: any) => ({
        mongo,
      }),
      inject: ['DATABASE_CONNECTION'],
      extraProviders: [DatabaseProvider],
    }),
    FirebaseModule.forRoot({ googleApplicationCredential: FirebaseAdminConfig }),
    AuthModule,
    AccountsModule,
    NotificationsModule,
    LockScreenModule,
    LanguageModule,
    BranchesModule,
    FileManagerModule,
    StudentsModule,
    SmartFilterStudentsModule,
    // StudentsModule,
    // StudentsAttendanceModule,
    // StudentsTuitionAttendanceModule,
    // // PermissionsModule,
    // // PropertiesModule,
    ClassesModule,
    CoursesModule,
    CoursesGroupsModule,
    StaffsModule,

    ProfOfPaymentModule,
    // RolesPermissionsModule,
    MaterialModule,
    IncomeModule,
    ExpensesModule,
    // NotificationsModule,
    // ChallengesModule,
    AnnouncementsModule,
    // DashboardModule,
    // ActivityLogsModule,

    TagsModule,
    SourcesModule,

    SchedulesModule,
    SchedulesShiftsModule,
    CalendarsModule,
    LeavesModule,
    TasksModule,
    PipelinesModule,
    DashboardAdminModule,

    ActivityLogsModule,

    MigrationsModule,
  ],
  providers: [
    ConnectionGateway,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class ISMSModule implements OnModuleInit {
  constructor(@Inject(getConnectionToken()) private readonly connection: mongoose.Connection) {}

  public onModuleInit(): void {
    /* listen mongoose connection */
    this.connection.on('connected', () => console.log(`MongoDB connected in ${process.env.NODE_ENV} ${process.env.MONGODB_URL}`));
    this.connection.on('disconnected', () => console.error(`MongoDB disconnected in ${process.env.NODE_ENV}`));
    this.connection.on('error', (event) => console.log(`MongoDB error in ${process.env.NODE_ENV}`, event));
  }
}
