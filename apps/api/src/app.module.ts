import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { BodyProfileModule } from './body-profile/body-profile.module';
import { MannequinModule } from './mannequin/mannequin.module';
import { TryOnModule } from './tryon/tryon.module';
import { SubscriptionModule } from './subscription/subscription.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USERNAME ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'dresscode',
      autoLoadEntities: true,
      synchronize: false,
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),
    AuthModule,
    BodyProfileModule,
    MannequinModule,
    TryOnModule,
    SubscriptionModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
