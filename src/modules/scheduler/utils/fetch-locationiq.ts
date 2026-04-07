import axios from 'axios';

// Định nghĩa Interface cho dữ liệu thô từ LocationIQ
interface LocationIQElement {
    place_id: string;
    name: string;
    display_name: string;
    lat: string;
    lon: string;
    type?: string;
    tag_type?: string;
    address?: {
        road?: string;
        house_number?: string;
        suburb?: string;
        city?: string;
    };
}

export const fetchNearbyRestaurants = async (lat: number, lon: number, radius = 5000): Promise<any[]> => {
    const API_KEY = process.env.LOCATIONIQ_KEY;
    const baseLat = lat || 21.0285;
    const baseLon = lon || 105.8542;

    // Mở rộng mô hình lưới 3x3 (9 điểm quét) cho diện rộng hơn
    const offset = 0.04;
    const scanPoints = [
        { lat: baseLat, lon: baseLon }, // Center
        { lat: baseLat + offset, lon: baseLon }, // N
        { lat: baseLat - offset, lon: baseLon }, // S
        { lat: baseLat, lon: baseLon + offset }, // E
        { lat: baseLat, lon: baseLon - offset }, // W
        { lat: baseLat + offset, lon: baseLon + offset }, // NE
        { lat: baseLat + offset, lon: baseLon - offset }, // NW
        { lat: baseLat - offset, lon: baseLon + offset }, // SE
        { lat: baseLat - offset, lon: baseLon - offset }  // SW
    ];

    const tags = ['restaurant', 'cafe', 'pub'];
    let allPlaces: any[] = [];
    let seenIds = new Set<string>();

    for (const point of scanPoints) {
        for (const tag of tags) {
            const url = `https://us1.locationiq.com/v1/nearby?key=${API_KEY}&lat=${point.lat}&lon=${point.lon}&tag=${tag}&radius=${radius}&limit=50&format=json`;

            try {
                const res = await axios.get(url);
                const data: LocationIQElement[] = res.data;

                if (Array.isArray(data)) {
                    data.forEach(el => {
                        const hasName = el.name && el.name.trim() !== "";
                        const hasAddress = el.display_name && el.display_name.trim() !== "";
                        const hasLocation = el.lat && el.lon;

                        if (hasName && hasAddress && hasLocation && !seenIds.has(el.place_id)) {
                            seenIds.add(el.place_id);

                            const addr = el.address || {};
                            let formattedAddress = el.display_name;

                            if (addr.road) {
                                const houseNum = addr.house_number ? `${addr.house_number} ` : "";
                                formattedAddress = `${houseNum}${addr.road}, ${addr.suburb || ""}, ${addr.city || ""}`.replace(/, ,/g, ',').trim();
                            }

                            allPlaces.push({
                                name: el.name,
                                address: formattedAddress,
                                location: {
                                    type: "Point",
                                    coordinates: [parseFloat(el.lon), parseFloat(el.lat)]
                                },
                            });
                        }
                    });
                }
            } catch (e) {
                // Bỏ qua lỗi rate limit hoặc không tìm thấy
            }
            // Delay để tránh bị block API (Rate Limit)
            await new Promise(r => setTimeout(r, 650));
        }
    }
    return allPlaces;
};