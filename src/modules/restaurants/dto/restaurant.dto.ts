import { IsString, IsNumber, IsArray, IsOptional, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { MenuItemDto } from './menu-item.dto';

export class RestaurantDto {
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    address?: string;

    // Cấu trúc GeoJSON
    @ValidateNested()
    location: {
        type: string;
        coordinates: [number, number]; // [Longitude, Latitude]
    };

    @IsNumber()
    @Min(1)
    @Max(3)
    priceRange: number;

    @IsNumber()
    @IsOptional()
    rating?: number = 4.0;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MenuItemDto)
    menu: MenuItemDto[];

    @ValidateNested()
    openingHours: {
        open: string;  // "07:00"
        close: string; // "21:00"
    };

    @IsString()
    @IsOptional()
    guest_id?: string;
}