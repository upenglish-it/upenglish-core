import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { Accounts, PropertiesBranches, Properties, AccountsProperties } from 'apps/common';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';

@Module({
  imports: [TypegooseModule.forFeature([Accounts, AccountsProperties, Properties, PropertiesBranches])],
  controllers: [BranchesController],
  providers: [BranchesService],
})
export class BranchesModule {}
