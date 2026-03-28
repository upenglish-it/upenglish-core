import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTMiniGames } from 'apps/common/src/database/mongodb/src/superstudy';
import { MiniGamesController } from './mini-games.controller';
import { MiniGamesService } from './mini-games.service';

@Module({
  imports: [TypegooseModule.forFeature([SSTMiniGames])],
  controllers: [MiniGamesController],
  providers: [MiniGamesService],
  exports: [MiniGamesService],
})
export class MiniGamesModule {}
