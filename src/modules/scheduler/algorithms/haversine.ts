/**
 * Hàm tính khoảng cách giữa 2 tọa độ địa lý (Sử dụng công thức Haversine).
 * Công thức này tính toán khoảng cách "đường chim bay" trên bề mặt hình cầu của Trái Đất.
 *
 * @param lat1 Vĩ độ điểm 1
 * @param lon1 Kinh độ điểm 1
 * @param lat2 Vĩ độ điểm 2
 * @param lon2 Kinh độ điểm 2
 * @returns Khoảng cách theo đơn vị mét (m)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Bán kính trung bình của Trái Đất (đơn vị: km)

  // Chuyển đổi tọa độ từ độ sang radian
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  // Công thức tính khoảng cách góc trên mặt cầu
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Kết quả tính ra km, nhân 1000 để chuyển sang mét
  return R * c * 1000;
}
