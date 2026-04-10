import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TranslationModule } from './modules/translation/translation.module';

@Module({
  imports: [TranslationModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }