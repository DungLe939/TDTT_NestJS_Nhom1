import { Injectable } from '@nestjs/common';
import { db } from '../../providers/firebase.provider';
import { fetchNearbyRestaurants } from './utils/fetch-locationiq';
import { fakeRemainingData } from './utils/fake-data';
import axios from 'axios'; // Dùng axios trong NestJS cho chuyên nghiệp

@Injectable()
export class SchedulerService {

    // Hàm lấy tọa độ từ Keyword (Geocoding)
    private async getCoordsFromKeyword(keyword: string) {
        try {
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(keyword)}&format=json&limit=1`;
            const response = await axios.get(url, {
                headers: { 'User-Agent': 'Smart-Tourism-App-HCMUS' } // Nominatim yêu cầu User-Agent
            });

            const data = response.data;
            if (data && data.length > 0) {
                return {
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon),
                };
            }
            return null;
        } catch (error) {
            console.error("Lỗi Geocoding:", error);
            return null;
        }
    }

    async processSearchLocation(keyword: string, guestId: string) {
        // 1. Tự lấy tọa độ từ keyword
        const coords = await this.getCoordsFromKeyword(keyword);
        if (!coords) return null;

        const { lat, lng } = coords;

        // 2. Xóa dữ liệu cũ của guest này trong Firestore
        const batch = db.batch();
        const oldDocs = await db.collection('restaurants')
            .where('guest_id', '==', guestId)
            .get();

        oldDocs.forEach((doc) => batch.delete(doc.ref));

        // 3. Lấy dữ liệu quán ăn từ Overpass
        const rawData = await fetchNearbyRestaurants(lat, lng);

        // 4. Fake dữ liệu cho đủ Schema
        const fullData = fakeRemainingData(rawData, guestId);

        // 5. Lưu vào Firestore
        fullData.forEach((item) => {
            const docRef = db.collection('restaurants').doc();
            batch.set(docRef, item);
        });

        await batch.commit();

        return fullData;
    }
}