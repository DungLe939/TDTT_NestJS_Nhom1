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
  // CHẠY NGẦM: Lọc thô + Phân cụm quán ăn (Clustering)
  // [NEW OPTIMIZATION]: Tách logic chuẩn bị dữ liệu ra khỏi việc gọi AI.
  // 1. Lọc các quán phù hợp ngân sách, khoảng cách.
  // 2. Chia các quán vào các "cụm" (clusters) theo từng ngày dựa trên vị trí địa lý.
  // 3. Lưu vào In-Memory Cache (RAM) để tái sử dụng.
  @Post('preparePlan')
  async preparePlan(@Body() body: any, @Req() req: Request) {
    try {
      const guestId = (req as any).guest_id;
      const result = await this.schedulerService.preparePlanData(body, guestId);
      return result;
    } catch (error) {
      console.error('[PreparePlan Error]:', error);
      throw new InternalServerErrorException(error.message);
    }
  }

  // endpoint: /schedule/generateDayPlan
  // STREAMING: Tạo lịch trình cho một ngày cụ thể (Dùng Gemini)
  // [NEW OPTIMIZATION]:
  // 1. Đọc dữ liệu cụm (cluster) của ngày hiện tại từ Cache.
  // 2. Gọi Gemini AI với prompt RÚT GỌN (chỉ yêu cầu chấm điểm 3 bữa, KHÔNG sinh metadata).
  // 3. Merge điểm của AI với dữ liệu gốc (ShopeeFood) để tạo lịch trình hoàn chỉnh.
  // 4. Lưu kết quả chấm điểm vào Cache để dùng cho tính năng "Đổi món".
  // Frontend sẽ gọi API này lặp lại cho từng ngày (0, 1, 2...) để hiển thị UI dần dần (Streaming).
  @Post('generateDayPlan')
  async generateDayPlan(@Body() body: any, @Req() req: Request) {
    try {
      const guestId = (req as any).guest_id;
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
  // [NEW OPTIMIZATION]: 
  // - Không còn lọc theo isSnack bằng AI.
  // - Trả về TẤT CẢ quán ăn từ ShopeeFood. Frontend tự map và filter theo "category" gốc.
  // - Nhanh hơn, chuẩn xác hơn và giảm phụ thuộc vào AI.
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
