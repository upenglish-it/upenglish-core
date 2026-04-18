import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTGrammarSubmissions } from 'apps/common/src/database/mongodb/src/superstudy';
import { GrammarSubmissionsController } from './grammar-submissions.controller';
import { GrammarSubmissionsService } from './grammar-submissions.service';

@Module({
  imports: [TypegooseModule.forFeature([SSTGrammarSubmissions])],
  controllers: [GrammarSubmissionsController],
  providers: [GrammarSubmissionsService],
  exports: [GrammarSubmissionsService],
})
export class GrammarSubmissionsModule {}
