import { Controller, Post, Body, InternalServerErrorException, HttpStatus, Res, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SchedulerService } from './scheduler.service';
import { SearchLocationDto } from './dto/search-location.dto';
import { RouteRequestDto } from './dto/route-request.dto';

//định nghĩa prefix cho route /schedule
@Controller('schedule')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) { }

  // endpoint: /schedule/searchLocation
  // Lấy tọa độ dựa vào keyword(tên địa điểm du lịch) do user nhập vào
  @Post('searchLocation')
  async searchLocation(@Body() searchDto: SearchLocationDto, @Req() req: Request) {
    try {
      //Được lấy từ middleware
      const guestId = (req as any).guest_id;

      // Truyền keyword vào Service(ví dụ : "Vũng Tàu", "Đà Nẵng",...)
      const result = await this.schedulerService.processSearchLocation(searchDto.keyword, guestId);

      if (!result) {
        return { success: false, message: 'Không tìm thấy tọa độ cho địa danh này!' };
      }

      return {
        success: true,
        message: `Đã cập nhật quán tại: ${searchDto.keyword}`,
        data: result.data,
        coords: result.coords
      };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // endpoint: /schedule/generatePlan
  // Tạo ra lộ trình các món ăn phù hợp
  @Post('generatePlan')
  async generatePlan(@Body() body: any, @Req() req: Request) {
    //Được lấy từ middleware
    const guestId = (req as any).guest_id;

    //Trả về lộ trình 3 bữa chính/ngày + danh sách các quán ăn có món ăn vặt tìm năng
    const result = await this.schedulerService.createTravelPlan(body, guestId);

    return {
      success: true,
      ...result
    };
  }

  // endpoint: /schedule/route
  // Tìm đường đi ngắn nhất giữa 2 điểm
  @Post('route')
  async getRoute(@Body() routeDto: RouteRequestDto) {
    try {
      // input là tọa độ 2 điểm
      // output là list chi tiết các tọa độ trên đường đi tìm được
      const result = await this.schedulerService.getShortestPath(
        routeDto.userLat,
        routeDto.userLng,
        routeDto.destLat,
        routeDto.destLng
      );

      if (!result) {
        return { success: false, message: 'Không thể tìm thấy lộ trình!' };
      }

      return {
        success: true,
        ...result
      };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
}