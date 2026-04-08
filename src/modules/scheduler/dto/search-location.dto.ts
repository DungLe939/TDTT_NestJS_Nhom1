import { IsString, IsNotEmpty } from 'class-validator';

/**
 * SearchLocationDto: Đối tượng dữ liệu dùng cho yêu cầu tìm kiếm địa điểm.
 * Nhận một từ khóa (keyword) từ người dùng để tìm tọa độ tương ứng.
 */
export class SearchLocationDto {
    // Từ khóa tìm kiếm (ví dụ: "Hồ Gươm", "Hà Nội")
    @IsString()
    @IsNotEmpty()
    keyword: string;
}