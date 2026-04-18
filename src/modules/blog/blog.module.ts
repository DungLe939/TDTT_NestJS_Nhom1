import { Module } from '@nestjs/common';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';
import { AchievementsModule } from '../achievements/achievements.module';

@Module({
    imports: [AchievementsModule], // Needs access to AchievementService for handleActivityEvent
    controllers: [BlogController],
    providers: [BlogService],
})
export class BlogModule {}
