import { IsNumber } from 'class-validator';

export class RouteRequestDto {
  @IsNumber()
  userLat: number;

  @IsNumber()
  userLng: number;

  @IsNumber()
  destLat: number;

  @IsNumber()
  destLng: number;
}
