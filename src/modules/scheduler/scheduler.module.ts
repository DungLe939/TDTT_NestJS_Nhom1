import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { SchedulerController } from './scheduler.controller';

import { ClusteringHelper } from './algorithms/k-means';
import { SortingHelper } from './algorithms/sorting';
import { RawFilterHelper } from './utils/raw-filter';
import { ScoringHelper } from './utils/scoring';
import { GeminiScoringHelper } from './utils/gemini-scoring';
import { GeminiGenerateScheduleHelper } from './utils/gemini-generate-schelude';

@Module({
  controllers: [SchedulerController],
  providers: [
    SchedulerService,
    ClusteringHelper,
    SortingHelper,
    RawFilterHelper,
    ScoringHelper,
    GeminiScoringHelper,
    GeminiGenerateScheduleHelper
  ],
})
export class SchedulerModule { }
