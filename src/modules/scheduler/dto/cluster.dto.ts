import { RestaurantDto } from '../../restaurants/dto/restaurant.dto';

/**
 * ClusterDto: Đối tượng dữ liệu đại diện cho một cụm (cluster) các nhà hàng.
 * Được sử dụng trong thuật toán k-means.
 */
export class ClusterDto {
  // ID của cụm
  clusterId: number;

  // Tọa độ tâm của cụm [Longitude, Latitude]
  centroid: [number, number];

  // Danh sách các nhà hàng thuộc cụm này
  restaurants: RestaurantDto[];
}
