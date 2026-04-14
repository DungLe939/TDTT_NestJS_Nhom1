import { IsString, IsNumber, IsOptional } from 'class-validator';

/**
 * MenuItemDto: Đối tượng dữ liệu (DTO) đại diện cho một món ăn trong thực đơn.
 * Dùng để kiểm tra và định dạng dữ liệu món ăn nhận được hoặc gửi đi.
 */
export class MenuItemDto {
  // Tên của món ăn
  @IsString()
  name: string;

  // Giá của món ăn (đơn vị: VNĐ)
  @IsNumber()
  price: number;

  // Mô tả chi tiết món ăn (không bắt buộc)
  @IsOptional()
  @IsString()
  description?: string;

  // Phân loại món ăn (ví dụ: "hải sản", "bánh ngọt",...)
  @IsOptional()
  @IsString()
  category?: string;

  // Đánh dấu đây có phải là món ăn nhẹ/ăn vặt (snack) hay không
  //cái này hỗ trợ cho tính năng "chọn bữa ăn phụ" - tăng trải nghiệm người dùng
  @IsOptional()
  isSnack?: boolean;
}
