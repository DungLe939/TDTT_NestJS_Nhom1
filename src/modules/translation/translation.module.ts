import { Module } from '@nestjs/common';
import { TranslationService } from './translation.service';
import { TranslationController } from './translation.controller';
import { DictionarySyncService } from './dictionary-sync.service';

@Module({
    controllers: [TranslationController],
    providers: [TranslationService, DictionarySyncService],
    exports: [TranslationService],
})
export class TranslationModule { }