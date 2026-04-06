import { IsString, IsNotEmpty } from 'class-validator';

export class SearchLocationDto {
    @IsString()
    @IsNotEmpty()
    keyword: string;
}