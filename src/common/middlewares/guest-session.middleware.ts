import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

/**
 * GuestSessionMiddleware: Middleware xử lý phiên làm việc của user.
 * Tự động tạo và quản lý guest_id thông qua Cookie nếu người dùng chưa đăng nhập.
 * Tức là khi user chưa đăng nhập, mà họ vào phần /schedule thì sẽ tự động cấp
 * cho họ 1 cái id để lưu vào database
 * Cái id này sẽ lưu kèm với restaurent để sau này tiện truy vấn theo user
 */
@Injectable()
export class GuestSessionMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Kiểm tra xem trong cookie đã có guest_id chưa
    let guestId = (req.cookies as Record<string, string> | undefined)?.guest_id;

    if (!guestId) {
      // Nếu chưa có, tạo một UUID mới
      guestId = crypto.randomUUID();

      // Lưu guest_id vào cookie của trình duyệt
      // maxAge: 86400000ms = 24 giờ (1 ngày)
      // httpOnly: true để ngăn JavaScript phía client truy cập vào cookie (bảo mật)
      res.cookie('guest_id', guestId, {
        maxAge: 86400000,
        httpOnly: true,
      });
    }

    // Gắn guestId vào đối tượng request để các controller hoặc service có thể truy cập dễ dàng
    (req as Request & { guest_id?: string }).guest_id = guestId;

    // Chuyển tiếp request sang bước tiếp theo trong pipeline
    next();
  }
}
