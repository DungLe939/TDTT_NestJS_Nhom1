import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config'; // Thư viện hỗ trợ đọc cấu hình từ file .env
import { SchedulerModule } from './modules/scheduler/scheduler.module';

/**
 * AppModule là Module gốc của ứng dụng.
 * Mọi module khác, controller và service khởi đầu từ đây.
 */
@Module({
  imports: [
    /**
     * ConfigModule.forRoot: Nạp cấu hình từ file .env.
     * isGlobal: true giúp các biến môi trường có thể dùng ở bất kỳ đâu mà không cần import lại ConfigModule.
     */
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    /**
     * SchedulerModule: Module xử lý logic lập lịch và gợi ý địa điểm ăn uống.
     */
    SchedulerModule,
  ],
  controllers: [AppController], // Khai báo các Controller của module này
  providers: [AppService], // Khai báo các Service (Business Logic) của module này
})
export class AppModule {}
