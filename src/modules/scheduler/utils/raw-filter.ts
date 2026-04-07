import { Injectable } from '@nestjs/common';
import { db } from '../../../providers/firebase.provider';
import { RestaurantDto } from '../../restaurants/dto/restaurant.dto';
import { LocationDto } from "../dto/location.dto";
import { calculateDistance } from '../algorithms/haversine';

@Injectable()
export class RawFilterHelper {
    async rawData(
        currentLocation: LocationDto,
        globalMaxPriceRange: number,
        guest_id: string,
        travelDays: number = 3
    ): Promise<any[]> {
        // Truy vấn cơ bản từ Firestore
        const snapshot = await db.collection('restaurants')
            .where('guest_id', '==', guest_id)
            .where('priceRange', '<=', globalMaxPriceRange)
            .get();

        console.log("snapshot: ", snapshot.docs.length);

        if (snapshot.empty) {
            return [];
        }

        // Bán kính động: 10km cơ sở + 2.5km mỗi ngày du lịch
        const maxRadius = 10000 + (travelDays * 2500);
        // Giới hạn số lượng cũng dựa theo số ngày (mỗi ngày lấy khoảng 40 quán dự phòng)
        const limitCount = Math.max(100, travelDays * 40);

        // Lọc thủ công (Match & GeoFilter) 
        const rawRestaurants = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as any))
            .filter(restaurant => {
                // Lọc rating >= 3.5
                const isGoodRating = (restaurant.rating || 4.0) >= 2.5;

                // Tính khoảng cách 
                const dist = calculateDistance(
                    currentLocation.lat,
                    currentLocation.lng,
                    restaurant.location.coordinates[1], // Latitude
                    restaurant.location.coordinates[0]  // Longitude
                );

                restaurant.distance = dist;
                return isGoodRating && dist <= maxRadius;
            })
            // Sắp xếp theo khoảng cách gần nhất
            .sort((a, b) => a.distance - b.distance)
            .slice(0, limitCount);

        return rawRestaurants;
    }
}