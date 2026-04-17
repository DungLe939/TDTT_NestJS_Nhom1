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
 * Sở thích và ràng buộc của một thành viên trong nhóm.
 */
export class UserPreferenceDto {
  /** ID thành viên để trả về điểm chi tiết theo từng người. */
  @IsOptional()
  @IsString()
  userId?: string;

  /** Vector khẩu vị 8 chiều, cùng không gian với nhà hàng. */
  @IsArray()
  @IsNumber({}, { each: true })
  @ArrayMinSize(8)
  @ArrayMaxSize(8)
  tasteVector!: number[];

  /** Ngân sách tối đa (VND). */
  @IsNumber()
  @Min(1)
  budget!: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergies?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  distance_tolerance?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  min_rating?: number;
}

export class AggregationWeightsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  avgWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minWeight?: number;
}

export class LocationDto {
  @IsNumber()
  @IsNotEmpty()
  lat!: number;

  @IsNumber()
  @IsNotEmpty()
  lng!: number;
}

export class GroupRecommendationDto {
  /** Danh sách thành viên tham gia gợi ý nhóm. */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserPreferenceDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(15)
  users!: UserPreferenceDto[];

  /** Vị trí hiện tại để tính khoảng cách tới nhà hàng. */
  @ValidateNested()
  @Type(() => LocationDto)
  @IsNotEmpty()
  currentLocation!: LocationDto;

  /** Trọng số tùy chỉnh cho chiến lược tổng hợp điểm nhóm. */
  @IsOptional()
  @ValidateNested()
  @Type(() => AggregationWeightsDto)
  aggregationWeights?: AggregationWeightsDto;
}

/** Điểm tương đồng của một thành viên cho một nhà hàng. */
export class UserScoreDetailDto {
  userId!: string;
  similarity!: number;
}

/** Thông tin nhà hàng hiển thị trong kết quả gợi ý. */
export class RestaurantInfoDto {
  id!: string;
  name!: string;
  price!: number;
  rating!: number;
  location!: { lat: number; lng: number };
  distance!: number;
  tags?: string[];
}

/** Kết quả chấm điểm cho một nhà hàng. */
export class ScoreResultDto {
  restaurant!: RestaurantInfoDto;
  finalScore!: number;
  avgSimilarity!: number;
  minSimilarity!: number;
  userScores!: UserScoreDetailDto[];
}

/** Payload trả về từ API gợi ý nhóm. */
export class GroupRecommendationResponseDto {
  totalCandidates!: number;
  filteredCount!: number;
  recommendations!: ScoreResultDto[];
}
