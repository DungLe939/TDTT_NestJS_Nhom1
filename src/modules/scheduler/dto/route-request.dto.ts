import { IsNumber } from 'class-validator';

/**
 * RouteRequestDto: Đối tượng dữ liệu gửi từ Client để yêu cầu tìm đường đi.
 * Bao gồm tọa độ điểm đi (User) và tọa độ điểm đến (Destination).
 */
export class RouteRequestDto {
  // Vĩ độ của vị trí xuất phát (Người dùng)
  @IsNumber()
  userLat: number;

  // Kinh độ của vị trí xuất phát (Người dùng)
  @IsNumber()
  userLng: number;

  // Vĩ độ của vị trí đích đến
  @IsNumber()
  destLat: number;

  // Kinh độ của vị trí đích đến
  @IsNumber()
  destLng: number;
}
