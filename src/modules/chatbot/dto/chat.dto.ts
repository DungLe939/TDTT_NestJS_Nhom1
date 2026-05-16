import { IsString, IsArray, IsOptional, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO cho từng message trong conversation history.
 */
class ChatMessageDto {
  @IsIn(['user', 'assistant', 'system'])
  role: string;

  @IsString()
  content: string;
}

/**
 * DTO cho request gửi chat tới DeepSeek API.
 * Frontend chỉ gửi nội dung tin nhắn + context, backend sẽ tự thêm API key.
 */
export class ChatRequestDto {
  @IsString()
  message: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  @IsOptional()
  history?: ChatMessageDto[];

  @IsString()
  @IsOptional()
  userName?: string;

  @IsString()
  @IsOptional()
  userAllergies?: string;
}
