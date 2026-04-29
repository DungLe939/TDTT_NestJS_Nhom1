import {
  Controller,
  Post,
  Body,
  InternalServerErrorException,
  HttpStatus,
  Res,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { SchedulerService } from './scheduler.service';
import { SearchLocationDto } from './dto/search-location.dto';
import { RouteRequestDto } from './dto/route-request.dto';

//định nghĩa prefix cho route /schedule
@Controller('schedule')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  // endpoint: /schedule/searchLocation
  // Lấy tọa độ dựa vào keyword(tên địa điểm du lịch) do user nhập vào
  @Post('searchLocation')
  async searchLocation(
    @Body() searchDto: SearchLocationDto,
    @Req() req: Request,
  ) {
    try {
      //Được lấy từ middleware
      const guestId = (req as any).guest_id;

      // Truyền keyword vào Service(ví dụ : "Vũng Tàu", "Đà Nẵng",...)
      const result = await this.schedulerService.processSearchLocation(
        searchDto.keyword,
        guestId,
      );

      if (!result) {
        return {
          success: false,
          message: 'Không tìm thấy tọa độ cho địa danh này!',
        };
      }

      return {
        success: true,
        message: `Đã cập nhật quán tại: ${searchDto.keyword}`,
        data: result.data,
        coords: result.coords,
      };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // endpoint: /schedule/autocomplete
  // Gợi ý địa điểm du lịch (Autocomplete) dựa theo từ khóa, nằm trong phạm vi VN
  @Post('autocomplete')
  async autocompleteLocation(@Body() searchDto: SearchLocationDto) {
    try {
      if (!searchDto.keyword || searchDto.keyword.length < 2) {
          return { success: true, data: [] };
      }
      const data = await this.schedulerService.getLocationSuggestions(searchDto.keyword);
      return { success: true, data };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // ============================================
  // STREAMING MODE: Endpoints tối ưu hiệu suất
  // ============================================

  // endpoint: /schedule/preparePlan
  // CHẠY NGẦM: Lọc thô + Phân cụm quán ăn
  // Giúp chuẩn bị dữ liệu sẵn sàng trên Server trước khi AI bắt đầu tạo từng ngày.
  @Post('preparePlan')
  async preparePlan(@Body() body: any, @Req() req: Request) {
    try {
      const guestId = (req as any).guest_id;
      console.log(`[PreparePlan] Bắt đầu chuẩn bị cho guest: ${guestId}`);
      const result = await this.schedulerService.preparePlanData(body, guestId);
      return result;
    } catch (error) {
      console.error('[PreparePlan Error]:', error);
      throw new InternalServerErrorException(error.message);
    }
  }

  // endpoint: /schedule/generateDayPlan
  // STREAMING: Tạo lịch trình cho một ngày cụ thể
  // Frontend sẽ gọi hàm này nhiều lần để lấy kết quả từng ngày và hiển thị ngay cho user.
  @Post('generateDayPlan')
  async generateDayPlan(@Body() body: any, @Req() req: Request) {
    try {
      const guestId = (req as any).guest_id;
      console.log(`[GenerateDayPlan] Bắt đầu tạo ngày ${body.dayIndex} cho guest: ${guestId}`);
      const result = await this.schedulerService.createSingleDayPlan(guestId, body.dayIndex);
      return { success: true, ...result };
    } catch (error) {
      console.error('[GenerateDayPlan Error]:', error);
      throw new InternalServerErrorException(error.message);
    }
  }

  // endpoint: /schedule/swapOptions
  // Lấy 30 món ăn tiềm năng nhất (Deduplicated) để cho user đổi món (Swap Feature)
  @Post('swapOptions')
  async swapOptions(@Body() body: any, @Req() req: Request) {
    try {
      const guestId = (req as any).guest_id;
      const { dayIndex, mealType, userLat, userLng } = body;
      
      const result = await this.schedulerService.getSwapOptions(
        guestId, 
        dayIndex, 
        mealType, 
        userLat, 
        userLng
      );
      return result;
    } catch (error) {
        console.error('[SwapOptions Error]:', error);
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
      ...result,
    };
  }

  // endpoint: /schedule/allDishes
  // Lấy toàn bộ danh sách quán ăn + món ăn cho tính năng "Thêm bữa ăn phụ"
  // Không còn lọc theo isSnack nữa — trả về TẤT CẢ, frontend tự filter theo category
  @Post('allDishes')
  async getAllDishes(@Req() req: Request) {
    try {
      const guestId = (req as any).guest_id;
      const dishes = await this.schedulerService.getAllDishes(guestId);
      return { success: true, data: dishes };
    } catch (error) {
      console.error('[AllDishes Error]:', error);
      throw new InternalServerErrorException(error.message);
    }
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
        routeDto.destLng,
        routeDto.mode,
        routeDto.steps,
      );

      if (!result) {
        return { success: false, message: 'Không thể tìm thấy lộ trình!' };
      }

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
}
