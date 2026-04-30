import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config'; // Thư viện hỗ trợ đọc cấu hình từ file .env
import { TranslationModule } from './modules/translation/translation.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { MenuScanModule } from './modules/menu-scan/menu-scan.module';
import { RestaurantsModule } from './modules/restaurants/restaurants.module';
import * as path from 'path';

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
      envFilePath: [
        path.resolve(process.cwd(), '.env'),
        path.resolve(__dirname, '../.env'),
        path.resolve(__dirname, '../../.env'),
      ],
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
     * MenuScanModule: Module xử lý upload ảnh menu và trích xuất chữ bằng AI (Qwen2-VL).
     */
    MenuScanModule,

    /**
     * RestaurantsModule: Module xử lý gợi ý nhà hàng theo khẩu vị nhóm.
     */
    RestaurantsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
