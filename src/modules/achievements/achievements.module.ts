import { Module } from '@nestjs/common';
import { AchievementService } from './achievements.service';
import { ProgressTrackerService } from './progress-tracker.service';
import { AchievementsController } from './achievements.controller';
import { UserStatsService } from './user-stats.service';

@Module({
    controllers: [AchievementsController],
    providers: [AchievementService, ProgressTrackerService, UserStatsService],
    exports: [AchievementService] // Xuất ra ngoài nếu các modules khác cần handleActivityEvent
})
export class AchievementsModule { }

