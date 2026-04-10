/**
 * Restaurants Module
 *
 * Module quản lý nhà hàng — expose API cho group recommendation.
 * Import EngineModule để sử dụng EngineService trong controller.
 *
 * Áp dụng GuestSessionMiddleware giống SchedulerModule
 * để tự động cấp guest_id cho mỗi request.
 *
 * @module restaurants
 */

import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { RestaurantsController } from './restaurants.controller';
import { RestaurantsService } from './restaurants.service';
import { EngineModule } from '../engine/engine.module';
import { GuestSessionMiddleware } from '../../common/middlewares/guest-session.middleware';

@Module({
  imports: [EngineModule],
  controllers: [RestaurantsController],
  providers: [RestaurantsService],
  exports: [RestaurantsService],
})
export class RestaurantsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(GuestSessionMiddleware).forRoutes(RestaurantsController);
  }
}
