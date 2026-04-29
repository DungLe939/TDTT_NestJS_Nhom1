import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { TranslationService } from './translation.service';
import { TranslateDto } from './dto/translate.dto';

@Controller('api/translate')
export class TranslationController {
    constructor(private translationService: TranslationService) { }

    @Post()
    async translate(@Body() translateDto: TranslateDto) {
        if (!translateDto.text?.trim()) {
            throw new BadRequestException('Text is required');
        }

        try {
            // Truyền 'source' xuống service để Python biết được nguồn gốc văn bản
            const result = await this.translationService.translate(
                translateDto.text,
                translateDto.method || 'en2vi',
                translateDto.source || 'chat'  // Mặc định là 'chat' nếu không truyền
            );

            return {
                success: true,
                data: result,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString(),
            };
        }
    }
}