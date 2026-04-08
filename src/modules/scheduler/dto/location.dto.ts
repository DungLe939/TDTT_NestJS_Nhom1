import { IsNumber } from 'class-validator';

/**
 * LocationDto: Đối tượng dữ liệu đại diện cho một tọa độ địa lý.
 */
export class LocationDto {
    // Kinh độ (Longitude)
    @IsNumber()
    lng: number;

    // Vĩ độ (Latitude)
    @IsNumber()
    lat: number;
}