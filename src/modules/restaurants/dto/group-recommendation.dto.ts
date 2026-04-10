/**
 * Group Recommendation DTOs
 *
 * Validate input từ API endpoint POST /restaurants/recommend/group.
 * Firebase Firestore schema:
 *   users: {uid, name, taste_vector: [], budget, allergies: [], ...}
 *
 * @module restaurants/dto
 */

import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO cho sở thích của một user trong nhóm.
 * Mapping Firebase: users collection.
 */
export class UserPreferenceDto {
  /**
   * Taste vector — 8 chiều, giá trị [0.0, 1.0].
   * [cay, ngot, man, chua, beo, thanh_dam, hai_san, chay]
   */
  @IsArray()
  @IsNumber({}, { each: true })
  @ArrayMinSize(1)
  taste_vector!: number[];

  /** Ngân sách tối đa (VND) — Constraint Feature */
  @IsNumber()
  @Min(1)
  budget!: number;

  /** Danh sách dị ứng / kiêng cữ */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergies?: string[];

  /** Khoảng cách tối đa chấp nhận (km) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  distance_tolerance?: number;

  /** Ngưỡng rating tối thiểu (0–5) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  min_rating?: number;
}

/**
 * DTO cho trọng số aggregation — tuỳ chọn.
 * Default: avgWeight=0.7, minWeight=0.3
 */
export class AggregationWeightsDto {
  /** Trọng số Average Score (default: 0.7) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  avgWeight?: number;

  /** Trọng số Least Misery / Min Score (default: 0.3) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minWeight?: number;
}

/**
 * DTO cho toạ độ GPS hiện tại.
 */
export class LocationDto {
  @IsNumber()
  @IsNotEmpty()
  lat!: number;

  @IsNumber()
  @IsNotEmpty()
  lng!: number;
}

/**
 * DTO tổng cho request gợi ý nhà hàng nhóm.
 */
export class GroupRecommendationDto {
  /** Danh sách người dùng trong nhóm (>= 1 người) */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserPreferenceDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(15, { message: 'Kích thước nhóm tối đa là 15 người để đảm bảo hiệu năng' })
  groupUsers!: UserPreferenceDto[];

  /** Toạ độ hiện tại của nhóm */
  @ValidateNested()
  @Type(() => LocationDto)
  @IsNotEmpty()
  currentLocation!: LocationDto;

  /** Trọng số aggregation (tuỳ chọn) */
  @IsOptional()
  @ValidateNested()
  @Type(() => AggregationWeightsDto)
  aggregationWeights?: AggregationWeightsDto;
}

/**
 * DTO kết quả — shape mỗi nhà hàng trong top K.
 */
export class RestaurantResultDto {
  /** Tên nhà hàng */
  name!: string;

  /**
   * Phân khúc giá (1-3).
   * 1: Rẻ, 2: Trung bình, 3: Sang trọng
   */
  priceRange!: number;

  /** Khoảng cách (km), làm tròn 2 chữ số */
  distance!: number;

  /** Đánh giá (0–5) */
  rating!: number;

  /** Điểm phù hợp tổng hợp (0–1), làm tròn 2 chữ số */
  matchedScore!: number;
}
