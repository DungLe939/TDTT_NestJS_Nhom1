import { Injectable } from '@nestjs/common';
import { RestaurantDto } from 'src/modules/restaurants/dto/restaurant.dto';
import { LocationDto } from 'src/modules/scheduler/dto/location.dto';
import { ClusterDto } from 'src/modules/scheduler/dto/cluster.dto';
const skmeans = require('skmeans');

@Injectable()
export class ClusteringHelper {

    /**
     * Tính khoảng cách Euclidean giữa 2 điểm tọa độ
     */
    private getDistance(p1: number[], p2: number[]): number {
        return Math.sqrt(
            Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2)
        );
    }

    /**
     * Thuật toán phân cụm K-means và sắp xếp lộ trình theo ngày
     */
    clusteringStep(
        rawRestaurants: RestaurantDto[],
        travelDays: number,
        currentLocation: LocationDto
    ) {
        // Trích xuất tọa độ để đưa vào skmeans
        const points: number[][] = rawRestaurants.map(r => r.location.coordinates);

        // Chạy thuật toán k-means với K = travelDays
        const res = skmeans(points, travelDays);

        // Mapping các quán vào cụm tương ứng
        const clusters: ClusterDto[] = res.centroids.map((centroid: [number, number], i: number) => {
            return {
                clusterId: i,
                centroid: centroid,
                restaurants: rawRestaurants.filter((_, index) => res.idxs[index] === i)
            };
        });

        // Kiểm tra số lượng quán tối thiểu mỗi ngày
        const MIN_RESTAURANTS_PER_DAY = 6;
        clusters.forEach(cluster => {
            if (cluster.restaurants.length < MIN_RESTAURANTS_PER_DAY) {
                console.warn(`Cụm ${cluster.clusterId} hơi ít quán (${cluster.restaurants.length})`);
            }
        });

        // Sắp xếp thứ tự ngày dựa trên khoảng cách (Greedy Approach)
        const orderedPlan: any[] = [];
        const remainingClusters = [...clusters];

        // Điểm bắt đầu là vị trí hiện tại của User
        let currentPivot: number[] = [currentLocation.lng, currentLocation.lat];

        for (let i = 0; i < travelDays; i++) {
            let closestIndex = 0;
            let minDistance = Infinity;

            remainingClusters.forEach((cluster, index) => {
                const dist = this.getDistance(currentPivot, cluster.centroid);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestIndex = index;
                }
            });

            const selectedCluster = remainingClusters[closestIndex];
            orderedPlan.push({
                day: i + 1,
                cluster: selectedCluster
            });

            // Cập nhật pivot sang tâm cụm vừa chọn để tìm điểm tiếp theo
            currentPivot = selectedCluster.centroid;

            // Xóa cụm đã chọn khỏi danh sách chờ
            remainingClusters.splice(closestIndex, 1);
        }

        return orderedPlan;
    }
}