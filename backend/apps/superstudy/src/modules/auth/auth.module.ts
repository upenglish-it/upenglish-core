import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTUsers } from 'apps/common/src/database/mongodb/src/superstudy';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    TypegooseModule.forFeature([SSTUsers]),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
