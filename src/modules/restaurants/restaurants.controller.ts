import {
  BadRequestException,
  Controller,
  Post,
  Body,
  UsePipes,
  ValidationPipe,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { EngineService } from '../engine/engine.service';
import {
  GroupRecommendationDto,
  GroupRecommendationResponseDto,
} from './dto/group-recommendation.dto';

type GuestRequest = Request & { guest_id?: string };

@Controller('group')
export class RestaurantsController {
  constructor(private readonly engineService: EngineService) {}

  @Post('recommend')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  /**
   * Nhận request gợi ý nhóm và chuyển cho tầng engine xử lý.
   * @param dto Dữ liệu sở thích và ràng buộc của nhóm.
   * @param req Request đã được middleware gắn guest session.
   * @returns Danh sách nhà hàng được chấm điểm theo mức phù hợp nhóm.
   */
  getGroupRecommendations(
    @Body() dto: GroupRecommendationDto,
    @Req() req: GuestRequest,
  ): Promise<GroupRecommendationResponseDto> {
    const guestId = req.guest_id;
    if (!guestId) {
      throw new BadRequestException(
        'Missing guest session. Please retry with cookies enabled.',
      );
    }

    return this.engineService.getGroupRecommendations(dto, guestId);
  }
}
