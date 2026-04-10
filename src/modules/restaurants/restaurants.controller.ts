/**
 * Restaurants Controller
 *
 * Expose API endpoint cho feature gợi ý nhà hàng nhóm.
 * Chỉ nhận request → gọi EngineService → trả response.
 *
 * Flow y hệt SchedulerController:
 *   - GuestSessionMiddleware tự động cấp guest_id qua cookie
 *   - Controller lấy guest_id từ req.guest_id
 *   - Truyền guest_id vào Service
 *
 * @module restaurants
 */

import { Controller, Post, Body, UsePipes, ValidationPipe, Req } from '@nestjs/common';
import type { Request } from 'express';
import { EngineService } from '../engine/engine.service';
import {
  GroupRecommendationDto,
  RestaurantResultDto,
} from './dto/group-recommendation.dto';

@Controller('restaurants')
export class RestaurantsController {
  /**
   * Inject EngineService qua constructor.
   */
  constructor(private readonly engineService: EngineService) {}

  /**
   * Gợi ý nhà hàng phù hợp nhất cho nhóm.
   *
   * Endpoint: POST /restaurants/recommend/group
   * Body: GroupRecommendationDto (validated bởi class-validator)
   * Response: RestaurantResultDto[] — top 5 nhà hàng
   *
   * Controller chỉ làm nhiệm vụ:
   *   1. Nhận và validate request body
   *   2. Lấy guest_id từ middleware (giống scheduler)
   *   3. Gọi engineService.getGroupRecommendations()
   *   4. Trả kết quả về client
   */
  @Post('recommend/group')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getGroupRecommendations(
    @Body() dto: GroupRecommendationDto,
    @Req() req: Request,
  ): Promise<RestaurantResultDto[]> {
    // Được lấy từ GuestSessionMiddleware (giống cách scheduler làm)
    const guestId = (req as any).guest_id;

    return this.engineService.getGroupRecommendations(dto, guestId);
  }
}
