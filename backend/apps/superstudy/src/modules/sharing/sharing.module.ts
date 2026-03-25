import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import {
  SSTUsers,
  SSTUserGroups,
  SSTTopics,
  SSTTeacherTopics,
  SSTExams,
  SSTGrammarExercises,
} from 'apps/common/src/database/mongodb/src/superstudy';
import { Accounts } from 'apps/common/src/database/mongodb/src/isms';
import { SharingController } from './sharing.controller';
import { SharingService } from './sharing.service';

/**
 * SharingModule — implements all 5 resource sharing modes from the original sUPerStudy:
 *  1. Public toggle (resource.isPublic)
 *  2. Admin teacher-visible toggle (resource.teacherVisible)
 *  3. Group access arrays (SSTUserGroups.topicAccess / grammarAccess / examAccess)
 *  4. Individual user access (SSTUsers.topicAccess / grammarAccess / examAccess)
 *  5. Teacher collaboration (collaboratorIds / collaboratorRoles / transferOwnership)
 *  6. Admin per-teacher sharing (resource.sharedWithTeacherIds)
 *
 * Schema-less: no new MongoDB collection — operates by patching existing documents.
 * User lookup by email goes to Accounts; access mutations go to SSTUsers.
 */
@Module({
  imports: [
    TypegooseModule.forFeature([
      Accounts,
      SSTUsers,
      SSTUserGroups,
      SSTTopics,
      SSTTeacherTopics,
      SSTExams,
      SSTGrammarExercises,
    ]),
  ],
  controllers: [SharingController],
  providers: [SharingService],
  exports: [SharingService],
})
export class SharingModule {}
