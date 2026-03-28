import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { Accounts } from 'apps/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    TypegooseModule.forFeature([Accounts]),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
