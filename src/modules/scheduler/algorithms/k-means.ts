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

        // --- BẮT ĐẦU THUẬT TOÁN CÂN BẰNG TỰ ĐỘNG ---
        const totalItems = rawRestaurants.length;
        const averagePerCluster = Math.max(1, Math.floor(totalItems / travelDays));
        // Lấy ngưỡng tự động (tối thiểu là 6, hoặc 40% của giá trị trung bình)
        const minThreshold = Math.max(6, Math.floor(averagePerCluster * 0.4));
        
        console.log(`[Balancing] Total: ${totalItems}, Avg: ${averagePerCluster}, Threshold: ${minThreshold}`);

        let keepBalancing = true;
        let attempts = 0;
        
        while (keepBalancing && attempts < 100) { 
            attempts++;
            
            // Tìm cụm nghèo nhất và cụm giàu nhất
            const sortedClusters = [...clusters].sort((a, b) => a.restaurants.length - b.restaurants.length);
            const poorest = sortedClusters[0];
            const richest = sortedClusters[sortedClusters.length - 1];

            // Nếu cụm nghèo nhất đã đạt tiêu chuẩn, hoặc chênh lệch giữa giàu và nghèo quá ít (<= 1) thì dừng cân bằng
            if (poorest.restaurants.length >= minThreshold || (richest.restaurants.length - poorest.restaurants.length <= 1)) {
                keepBalancing = false;
                break;
            }

            // Mượn 1 quán từ cụm richest
            let closestDist = Infinity;
            let bestIndexToSteal = -1;

            richest.restaurants.forEach((r, idx) => {
                const dist = this.getDistance(r.location.coordinates, poorest.centroid);
                if (dist < closestDist) {
                    closestDist = dist;
                    bestIndexToSteal = idx;
                }
            });

            if (bestIndexToSteal !== -1) {
                const stolenRestaurant = richest.restaurants.splice(bestIndexToSteal, 1)[0];
                poorest.restaurants.push(stolenRestaurant);
            } else {
                keepBalancing = false; 
            }
        }
        
        clusters.forEach(cluster => {
            console.log(`Cụm ${cluster.clusterId} sau cân bằng có ${cluster.restaurants.length} quán`);
        });
        // --- KẾT THÚC CÂN BẰNG ---

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