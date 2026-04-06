import { Controller, Post, Body, InternalServerErrorException } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { SearchLocationDto } from './dto/search-location.dto';

@Controller('schedule')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) { }

  @Post('searchLocation')
  async searchLocation(@Body() searchDto: SearchLocationDto) {
    try {
      const guestId = 'guest_hcmus_01'; // Tạm thời

      // Truyền mỗi keyword vào Service, để Service tự lo phần tọa độ
      const result = await this.schedulerService.processSearchLocation(searchDto.keyword, guestId);

      if (!result) {
        return { success: false, message: 'Không tìm thấy tọa độ cho địa danh này!' };
      }

      return {
        success: true,
        message: `Đã cập nhật quán tại: ${searchDto.keyword}`,
        total: result.length,
        data: result,
      };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
}