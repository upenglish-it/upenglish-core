// NestJs Imports
import mongoose from 'mongoose';
import { MongoClient } from 'mongodb';
import { APP_FILTER } from '@nestjs/core';
import { AgendaModule } from 'agenda-nest';
import { ConfigModule } from '@nestjs/config';
import { FirebaseModule } from 'nestjs-firebase';
import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { TypegooseModule, getConnectionToken } from 'nestjs-typegoose';
// Common Imports
import { FirebaseAdminConfig, HttpExceptionFilter } from 'apps/common';

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
    ConfigModule.forRoot({ envFilePath: `env/.superstudy.env` }),
    TypegooseModule.forRoot(process.env.MONGODB_URL),
    AgendaModule.forRootAsync({
      useFactory: (mongo: any) => ({
        mongo,
      }),
      inject: ['DATABASE_CONNECTION'],
      extraProviders: [DatabaseProvider],
    }),
    FirebaseModule.forRoot({ googleApplicationCredential: FirebaseAdminConfig }),
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
