import { IsString, IsNotEmpty, IsDateString, IsOptional, IsObject } from 'class-validator';
import type { ActivityEventType } from '../interfaces/achievement.interface';

export class LogActivityDto {
    @IsString()
    @IsNotEmpty()
    userId: string;

    @IsString()
    @IsNotEmpty()
    type: ActivityEventType;

    @IsDateString()
    @IsOptional()
    occurredAt?: string;

    @IsObject()
    @IsOptional()
    payload?: Record<string, unknown>;
}
