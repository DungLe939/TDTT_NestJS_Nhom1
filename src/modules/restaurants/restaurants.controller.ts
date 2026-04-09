/**
 * Restaurants Controller
 *
 * Expose API endpoint cho feature gợi ý nhà hàng nhóm.
 * Chỉ nhận request → gọi EngineService → trả response.
 *
 * @module restaurants
 */

import { Controller, Post, Body, UsePipes, ValidationPipe } from '@nestjs/common';
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
   *   2. Gọi engineService.getGroupRecommendations()
   *   3. Trả kết quả về client
   */
  @Post('recommend/group')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  getGroupRecommendations(
    @Body() dto: GroupRecommendationDto,
  ): RestaurantResultDto[] {
    return this.engineService.getGroupRecommendations(dto);
  }
}
