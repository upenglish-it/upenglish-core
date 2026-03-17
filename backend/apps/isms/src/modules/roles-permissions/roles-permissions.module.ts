import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { RolesPermissionsService } from './roles-permissions.service';
import { RolesPermissionsController } from './roles-permissions.controller';
import { RolesPermissions } from 'apps/common';

@Module({
  imports: [TypegooseModule.forFeature([RolesPermissions])],
  controllers: [RolesPermissionsController],
  providers: [RolesPermissionsService],
})
export class RolesPermissionsModule {}
