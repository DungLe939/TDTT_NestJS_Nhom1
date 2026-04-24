import { Injectable } from '@nestjs/common';
import { RestaurantDto } from '../../restaurants/dto/restaurant.dto';
import { LocationDto } from '../dto/location.dto';
import { ClusterDto } from '../dto/cluster.dto';
const skmeans = require('skmeans');

/**
 * ClusteringHelper: Hỗ trợ phân cụm (clustering) các địa điểm dựa trên vị trí địa lý.
 * Sử dụng thuật toán K-means để nhóm các nhà hàng ở gần nhau vào cùng một ngày.
 */
@Injectable()
export class ClusteringHelper {
  /**
   * Tính khoảng cách Euclidean giữa 2 điểm trên mặt phẳng tọa độ.
   * Dùng để so sánh khoảng cách tương đối giữa các điểm.
   */
  private getDistance(p1: number[], p2: number[]): number {
    return Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
  }

  /**
   * Bước thực hiện phân cụm K-means và sắp xếp lộ trình theo ngày.
   *
   * @param rawRestaurants Danh sách nhà hàng thô đã qua lọc
   * @param travelDays Số ngày du lịch (tương ứng với số cụm K)
   * @param currentLocation Vị trí hiện tại của người dùng (điểm bắt đầu)
   */
  clusteringStep(
    rawRestaurants: RestaurantDto[], //danh sách nhà hàng
    travelDays: number, //số ngày đi du lịch
    currentLocation: LocationDto, //vị trí hiện tại
  ) {
    // 1. Trích xuất tọa độ [lng, lat] từ danh sách nhà hàng để nạp vào thuật toán
    const points: number[][] = rawRestaurants.map(
      (r) => r.location.coordinates,
    );

    /**
     * 2. Chạy thuật toán K-means.
     * Phân chia 'points' thành 'travelDays' cụm.
     * ví dụ đi 3 ngày thì chia thành 3 cụm
     * Thuật toán chọn ra 'travelDays' tâm, quán nào ở gần tâm nào nhất thì sẽ nằm trong cụm tương ứng
     * của tâm đó
     */
    const res = skmeans(points, travelDays);

    /**
     * 3. Mapping: Khởi tạo danh sách các cụm ClusterDto.
     * Mỗi cụm chứa một centroid (tâm cụm) và danh sách các nhà hàng thuộc cụm đó.
     */
    const clusters: ClusterDto[] = res.centroids.map(
      (centroid: [number, number], i: number) => {
        return {
          clusterId: i, //số thứ tự cụm
          centroid: centroid, //tọa độ tâm cụm
          restaurants: rawRestaurants.filter(
            (_, index) => res.idxs[index] === i,
          ), //danh sách nhà hàng
        };
      },
    );

    /**
     * 4. THUẬT TOÁN CÂN BẰNG TỰ ĐỘNG (Auto-Balancing)
     * Vấn đề của K-means: Có cụm quá nhiều quán, có cụm quá ít hoặc không có quán nào.
     * Giải pháp: Di chuyển quán từ cụm "giàu" sang cụm "nghèo" nhất.
     */
    const totalItems = rawRestaurants.length; //tổng số nhà hàng
    const averagePerCluster = Math.max(1, Math.floor(totalItems / travelDays)); // Số quán trung bình mỗi ngày(cụm)
    // Lấy ngưỡng tối thiểu (minThreshold) để đảm bảo mỗi ngày đều có đủ quán để gợi ý, không ngày nào có quá ít quán để chọn
    const minThreshold = Math.max(6, Math.floor(averagePerCluster * 0.4));

    let keepBalancing = true;
    let attempts = 0; //tính số lần thử

    // Vòng lặp cân bằng (giới hạn 100 lần thử để tránh lặp vô tận)
    while (keepBalancing && attempts < 100) {
      attempts++;

      // Tìm cụm "nghèo nhất" (ít quán nhất) và cụm "giàu nhất" (nhiều quán nhất)
      const sortedClusters = [...clusters].sort(
        (a, b) => a.restaurants.length - b.restaurants.length,
      );
      const poorest = sortedClusters[0]; //nghèo nhất
      const richest = sortedClusters[sortedClusters.length - 1]; //giàu nhất

      /**
       * Dừng cân bằng nếu:
       * - Cụm nghèo nhất đã đạt ngưỡng tối thiểu.
       * - Hoặc chênh lệch giữa giàu và nghèo không đáng kể (<= 1).
       */
      if (
        poorest.restaurants.length >= minThreshold ||
        richest.restaurants.length - poorest.restaurants.length <= 1
      ) {
        keepBalancing = false;
        break;
      }

      // Tìm nhà hàng trong cụm giàu nhất mà gần tâm của cụm nghèo nhất nhất
      let closestDist = Infinity; //lưu khoảng cách
      let bestIndexToSteal = -1; //lưu index khả thi nhất

      richest.restaurants.forEach((r, idx) => {
        const dist = this.getDistance(r.location.coordinates, poorest.centroid);
        if (dist < closestDist) {
          closestDist = dist;
          bestIndexToSteal = idx;
        }
      });

      // Thực hiện di chuyển nhà hàng từ cụm giàu sang cụm nghèo
      if (bestIndexToSteal !== -1) {
        const stolenRestaurant = richest.restaurants.splice(
          bestIndexToSteal,
          1,
        )[0];
        poorest.restaurants.push(stolenRestaurant);
      } else {
        keepBalancing = false;
      }
    }

    /**
     * 5. SẮP XẾP THỨ TỰ CÁC NGÀY (Greedy Approach)
     * Sắp xếp các cụm sao cho lộ trình di chuyển giữa các ngày là ngắn nhất.
     */
    const orderedPlan: any[] = [];
    const remainingClusters = [...clusters]; //danh sách các cụm

    // Điểm bắt đầu là vị trí hiện tại của người dùng
    // nếu người dùng không chấp nhận bật GPS thì mặc định lấy vị trí địa điểm du lịch thông qua api
    let currentPivot: number[] = [currentLocation.lng, currentLocation.lat];

    for (let i = 0; i < travelDays; i++) {
      let closestIndex = 0;
      let minDistance = Infinity; //lưu khoảng cách ngắn nhất

      // Tìm cụm có tâm gần nhất với vị trí hiện tại (pivot)
      remainingClusters.forEach((cluster, index) => {
        const dist = this.getDistance(currentPivot, cluster.centroid);
        if (dist < minDistance) {
          minDistance = dist;
          closestIndex = index;
        }
      });

      // đã chọn được cụm gần nhất => lưu vào mảng plan
      const selectedCluster = remainingClusters[closestIndex];
      orderedPlan.push({
        day: i + 1,
        cluster: selectedCluster,
      });

      // Cập nhật vị trí pivot sang tâm của cụm vừa chọn để tìm điểm tiếp theo cho ngày mai
      currentPivot = selectedCluster.centroid;

      // Xóa cụm đã chọn khỏi danh sách còn lại
      remainingClusters.splice(closestIndex, 1);
    }

    return orderedPlan;
  }
}
