import { Controller, Post, Body, InternalServerErrorException, HttpStatus, Res, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SchedulerService } from './scheduler.service';
import { SearchLocationDto } from './dto/search-location.dto';

@Controller('schedule')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) { }

  @Post('searchLocation')
  async searchLocation(@Body() searchDto: SearchLocationDto, @Req() req: Request) {
    try {
      const guestId = (req as any).guest_id;

      // Truyền keyword vào Service
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

  @Post('generatePlan')
  async generatePlan(@Body() body: any, @Req() req: Request) {
    const guestId = (req as any).guest_id;

    const result = await this.schedulerService.createTravelPlan(body, guestId);

    // NestJS tự động hiểu return object là trả về JSON với status 201 (hoặc 200)
    return {
      success: true,
      ...result
    };
  }
}