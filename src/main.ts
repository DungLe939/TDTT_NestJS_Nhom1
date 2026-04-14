import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // ----------------------------------------------------------------------
  // [HƯỚNG DẪN DÀNH CHO NHÓM] - LƯU Ý VỀ BẢO MẬT KHI DÙNG PINGGY
  // ----------------------------------------------------------------------
  // Tại sao phải có dòng app.enableCors() này?
  // Bình thường, React chạy ở `localhost:5173`, còn NestJS chạy ở `localhost:3000`.
  // Khi dùng Pinggy, NestJS biến thành link `https://xxx.a.pinggy.link`.
  // Trình duyệt sẽ chặn React vì nó cố giao tiếp với một "người lạ" khác địa chỉ.
  // Dòng code này chính là để cấp quyền "cho phép React đi qua cửa".
  // Đừng bao giờ xóa dòng này nếu bạn muốn test API trên internet nhé!
  // ----------------------------------------------------------------------
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: '*',
  });
  
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
