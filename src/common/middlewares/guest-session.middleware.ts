import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GuestSessionMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        let guestId = req.cookies?.guest_id;
        
        if (!guestId) {
            guestId = uuidv4();
            // Lưu cookie trong 1 ngày
            res.cookie('guest_id', guestId, { 
                maxAge: 86400000, 
                httpOnly: true 
            });
        }
        
        // Gắn guestId vào request để các controller có thể sử dụng (yêu cầu ép kiểu về any hoặc tạo thẻ định dạng chuẩn)
        (req as any).guest_id = guestId;
        
        next();
    }
}
