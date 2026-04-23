import {
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MenuItemDto } from './menu-item.dto';

/**
 * RestaurantDto: Đối tượng dữ liệu (DTO) đại diện cho thông tin một nhà hàng.
 * Bao gồm tên, địa chỉ, tọa độ, mức giá và thực đơn.
 */
export class RestaurantDto {
  // Tên nhà hàng
  @IsString()
  name: string;

  // Địa chỉ của nhà hàng (không bắt buộc)
  @IsOptional()
  @IsString()
  address?: string;

  /**
   * Tọa độ vị trí của nhà hàng theo chuẩn GeoJSON.
   * coordinates: [Kinh độ (Longitude), Vĩ độ (Latitude)]
   */
  @ValidateNested()
  location: {
    type: string;
    coordinates: [number, number];
  };

  /**
   * Phân khúc giá của nhà hàng.
   * 1: Rẻ, 2: Trung bình, 3: Sang trọng.
   */
  @IsNumber()
  @Min(1)
  @Max(3)
  priceRange: number;

  // Đánh giá của khách hàng
  @IsNumber()
  @IsOptional()
  rating?: number = 4.0;

  /**
   * Danh sách thực đơn của nhà hàng.
   * Sử dụng @Type(() => MenuItemDto) để NestJS có thể chuyển đổi và kiểm tra từng phần tử trong mảng.
   */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuItemDto)
  menu: MenuItemDto[];

  /**
   * Thời gian đóng/mở cửa của nhà hàng.
   * Ví dụ: open: "08:00", close: "22:00"
   */
  @ValidateNested()
  openingHours: {
    open: string;
    close: string;
  };

  // ID của khách hàng liên kết với nhà hàng này (dùng cho cache hoặc dữ liệu khách)
  // Cái này được tạo ra trong middleware
  @IsString()
  @IsOptional()
  guest_id?: string;
}
