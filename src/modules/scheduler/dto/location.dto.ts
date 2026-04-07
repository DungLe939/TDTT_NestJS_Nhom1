import { IsNumber } from 'class-validator';

export class LocationDto {
    @IsNumber()
    lng: number;

    @IsNumber()
    lat: number;
}