import { IsNumber, IsArray, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * PointDto: Tọa độ một điểm (Source hoặc Destination)
 */
class PointDto {
  @IsString()
  id: string;

  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;
}

/**
 * DistanceMatrixDto: Payload yêu cầu tính ma trận khoảng cách từ NHIỀU nguồn đến NHIỀU đích.
 */
export class DistanceMatrixDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PointDto)
  sources: PointDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PointDto)
  destinations: PointDto[];
}
