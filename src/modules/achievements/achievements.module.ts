import { Module } from '@nestjs/common';
import { AchievementService } from './achievements.service';
import { ProgressTrackerService } from './progress-tracker.service';
import { AchievementsController } from './achievements.controller';

@Module({
    controllers: [AchievementsController],
    providers: [AchievementService, ProgressTrackerService],
    exports: [AchievementService] // Xuat ra ngoai neu cac modules khac can handleActivityEvent
})
export class AchievementsModule { }
