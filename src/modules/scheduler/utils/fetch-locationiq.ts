import axios from 'axios';

/**
 * Interface định nghĩa cấu trúc dữ liệu thô trả về từ API LocationIQ.
 */
interface LocationIQElement {
    place_id: string;      // ID duy nhất của địa điểm
    name: string;          // Tên địa điểm (ví dụ: "Phở Thìn")
    display_name: string;   // Địa chỉ đầy đủ (dạng chuỗi)
    lat: string;           // Vĩ độ (dạng chuỗi)
    lon: string;           // Kinh độ (dạng chuỗi)
    type?: string;         // Loại địa điểm
    tag_type?: string;     // Gắn thẻ loại
    address?: {            // Chi tiết địa chỉ (nếu có)
        road?: string;
        house_number?: string;
        suburb?: string;
        city?: string;
    };
}

/**
 * fetchNearbyRestaurants: Hàm lấy danh sách các địa điểm ăn uống xung quanh một tọa độ.
 * Sử dụng API LocationIQ để tìm kiếm nhà hàng, quán cà phê, quán nhậu.
 * 
 * @param lat Vĩ độ trung tâm
 * @param lon Kinh độ trung tâm
 * @param radius Bán kính tìm kiếm (mặc định 5000m)
 */
export const fetchNearbyRestaurants = async (lat: number, lon: number, radius = 5000): Promise<any[]> => {
    const API_KEY = process.env.LOCATIONIQ_KEY;
    // Tọa độ mặc định là Hà Nội nếu không có đầu vào (tránh crash server)
    const baseLat = lat || 21.0285;
    const baseLon = lon || 105.8542;

    /**
     * TỐI ƯU HÓA:
     * Thay vì quét 9 điểm (mô hình 3x3), ta rút xuống còn 5 điểm (1 tâm + 4 góc) để giảm số lần gọi API.
     * Với 5 điểm * 3 tag = 15 requests. Giúp giảm thời gian chờ từ ~18s xuống còn ~10s.
     */
    const offset = 0.05; // Khoảng cách lệch giữa các điểm quét (~5.5km)
    const scanPoints = [
        { lat: baseLat, lon: baseLon }, // Trung tâm
        { lat: baseLat + offset, lon: baseLon + offset }, // Đông Bắc
        { lat: baseLat + offset, lon: baseLon - offset }, // Tây Bắc
        { lat: baseLat - offset, lon: baseLon + offset }, // Đông Nam
        { lat: baseLat - offset, lon: baseLon - offset }  // Tây Nam
    ];

    const tags = ['restaurant', 'cafe', 'pub']; // Các loại địa điểm cần tìm
    let allPlaces: any[] = [];
    let seenIds = new Set<string>(); // Bộ nhớ đệm để tránh trùng lặp địa điểm

    for (const point of scanPoints) {
        for (const tag of tags) {
            // Xây dựng URL yêu cầu tới LocationIQ
            const url = `https://us1.locationiq.com/v1/nearby?key=${API_KEY}&lat=${point.lat}&lon=${point.lon}&tag=${tag}&radius=${radius}&limit=50&format=json`;

            try {
                const res = await axios.get(url);
                const data: LocationIQElement[] = res.data;

                if (Array.isArray(data)) {
                    data.forEach(el => {
                        // Kiểm tra tính hợp lệ của dữ liệu
                        const hasName = el.name && el.name.trim() !== "";
                        const hasAddress = el.display_name && el.display_name.trim() !== "";
                        const hasLocation = el.lat && el.lon;

                        //Nếu có đầy đủ 3 trường: tên, địa chỉ và tọa độ thì chấp nhận cho lưu vào DB
                        if (hasName && hasAddress && hasLocation && !seenIds.has(el.place_id)) {
                            seenIds.add(el.place_id); // thêm vào set để tránh trùng lập dữ liệu

                            const addr = el.address || {};
                            let formattedAddress = el.display_name;

                            // Định dạng lại địa chỉ cho ngắn gọn và dễ đọc hơn
                            if (addr.road) {
                                const houseNum = addr.house_number ? `${addr.house_number} ` : "";
                                formattedAddress = `${houseNum}${addr.road}, ${addr.suburb || ""}, ${addr.city || ""}`.replace(/, ,/g, ',').trim();
                            }

                            //trả ra đủ 3 trường : tên, địa chỉ, tọa độ quán
                            // các trường còn lại thì được fake
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
                // Bỏ qua lỗi (thường là lỗi 404 không tìm thấy địa điểm hoặc lỗi giới hạn API)
            }

            /**
             * Delay 650ms giữa các lần gọi API.
             * Lý do: LocationIQ (bản miễn phí) giới hạn số lượng yêu cầu mỗi giây (Rate Limit).
             */
            await new Promise(r => setTimeout(r, 650));
        }
    }
    return allPlaces;
};
