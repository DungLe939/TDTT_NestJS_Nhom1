/**
 * Engine Module
 *
 * Module chứa logic thuật toán recommendation.
 * Import RestaurantsService để EngineService có thể query Firestore.
 *
 * @module engine
 */

import { Module } from '@nestjs/common';
import { EngineService } from './engine.service';
import { RestaurantsService } from '../restaurants/restaurants.service';

@Module({
  providers: [EngineService, RestaurantsService],
  exports: [EngineService],
})
export class EngineModule {}
