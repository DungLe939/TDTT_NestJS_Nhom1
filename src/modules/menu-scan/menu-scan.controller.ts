import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MenuScanService } from './menu-scan.service';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as path from 'path';
import * as fs from 'fs';

// Tạo thư mục uploads nếu chưa có
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

@Controller('menu-scan')
export class MenuScanController {
  constructor(private readonly menuScanService: MenuScanService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // Giới hạn 10MB
      },
    }),
  )
  async scanMenu(@UploadedFile() file: Express.Multer.File) {
    console.log('[MenuScanController] Received request to /menu-scan');
    if (!file) {
      console.error('[MenuScanController] No file received!');
      throw new BadRequestException('No image file provided');
    }
    console.log('[MenuScanController] File received:', file.originalname, 'size:', file.size);

    try {
      const absolutePath = path.resolve(file.path);
      const result = await this.menuScanService.processMenuImage(absolutePath);
      // Xóa file sau khi xử lý xong
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      return result;
    } catch (error) {
      // Đảm bảo xóa file kể cả khi có lỗi
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw error;
    }
  }
}
