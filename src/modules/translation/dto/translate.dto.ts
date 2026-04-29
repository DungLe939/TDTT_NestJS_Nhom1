import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class TranslateDto {
    @IsString()
    @IsNotEmpty()
    text: string;

    @IsOptional()
    @IsEnum(['en2vi', 'vi2en'])
    method?: 'en2vi' | 'vi2en';

    /**
     * Nguồn gốc văn bản:
     * - 'scan': Văn bản đến từ tính năng quét ảnh Menu (FoodScan) → Ưu tiên dùng RAG
     * - 'chat': Người dùng tự nhập trực tiếp → Bỏ qua RAG, dùng VinAI trực tiếp cho nhanh
     */
    @IsOptional()
    @IsEnum(['scan', 'chat'])
    source?: 'scan' | 'chat';
}