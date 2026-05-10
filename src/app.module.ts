import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config'; // Thư viện hỗ trợ đọc cấu hình từ file .env
import { TranslationModule } from './modules/translation/translation.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { AchievementsModule } from './modules/achievements/achievements.module';
import { BlogModule } from './modules/blog/blog.module';
import { RestaurantsModule } from './modules/restaurants/restaurants.module';

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
     * TranslationModule: Module xử lý dịch thuật AI (VinAI, PhoBERT).
     */
    TranslationModule,

    /**
     * SchedulerModule: Module xử lý logic lập lịch và gợi ý địa điểm ăn uống.
     */
    SchedulerModule,

    /**
     * AchievementModule: Module xử lý logic về thành tích và phần thưởng.
     */
    AchievementsModule,

    /**
     * BlogModule: Module thao tác tạo bài và kết nối hệ thống achievements.
     */
    BlogModule,
    RestaurantsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
