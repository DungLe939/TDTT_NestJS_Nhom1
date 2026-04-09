/**
 * Restaurants Module
 *
 * @module restaurants
 */

import { Module } from '@nestjs/common';
import { RestaurantsController } from './restaurants.controller';
import { EngineModule } from '../engine/engine.module';

@Module({
  imports: [EngineModule],
  controllers: [RestaurantsController],
})
export class RestaurantsModule {}
