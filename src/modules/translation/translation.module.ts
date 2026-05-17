import { Module } from '@nestjs/common';
import { TranslationService } from './translation.service';
import { TranslationController } from './translation.controller';
import { AchievementsModule } from '../achievements/achievements.module';

@Module({
    imports: [AchievementsModule],
    controllers: [TranslationController],
    providers: [TranslationService],
    exports: [TranslationService],
})
export class TranslationModule { }