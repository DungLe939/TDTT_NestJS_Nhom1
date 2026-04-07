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
        guest_id: string
    ): Promise<any[]> {
        // Truy vấn cơ bản từ Firestore
        const snapshot = await db.collection('restaurants')
            .where('guest_id', '==', guest_id)
            .where('priceRange', '<=', globalMaxPriceRange)
            .get();

        console.log("snapshot: ", snapshot);

        if (snapshot.empty) {
            return [];
        }

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
                return isGoodRating && dist <= 15000; // Bán kính 10km
            })
            // Sắp xếp theo khoảng cách gần nhất
            .sort((a, b) => a.distance - b.distance)
            // Giới hạn 100 kết quả
            .slice(0, 100);

        return rawRestaurants;
    }
}