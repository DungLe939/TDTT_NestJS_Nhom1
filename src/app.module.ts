import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config'; // Để dùng file .env
import { SchedulerModule } from './modules/scheduler/scheduler.module';

@Module({
  imports: [
    // Cấu hình để nhận diện file .env toàn app
    ConfigModule.forRoot({
      isGlobal: true
    }),

    // Đăng ký các module nghiệp vụ
    SchedulerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
