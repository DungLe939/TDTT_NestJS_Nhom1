import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { SchedulerController } from './scheduler.controller';
import { GuestSessionMiddleware } from '../../common/middlewares/guest-session.middleware';

import { ClusteringHelper } from './algorithms/k-means';
import { SortingHelper } from './algorithms/sorting';
import { RawFilterHelper } from './utils/raw-filter';
import { ScoringHelper } from './utils/scoring';
import { GeminiScoringHelper } from './utils/gemini-scoring';
import { GeminiGenerateScheduleHelper } from './utils/gemini-generate-schelude';
import { PlanCacheHelper } from './utils/plan-cache';

@Module({
  controllers: [SchedulerController],
  providers: [
    SchedulerService,
    ClusteringHelper,
    SortingHelper,
    RawFilterHelper,
    ScoringHelper,
    GeminiScoringHelper,
    GeminiGenerateScheduleHelper,
    PlanCacheHelper
  ],
})
export class SchedulerModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(GuestSessionMiddleware)
      .forRoutes(SchedulerController);
  }
}
