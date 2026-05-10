/**
 * Haversine Utility
 *
 * Pure function tính khoảng cách (km) giữa 2 toạ độ GPS.
 *
 * @module utils
 */

/** Bán kính Trái Đất tính bằng km */
const EARTH_RADIUS_KM = 6371;

/**
 * Chuyển đổi độ (degree) sang radian.
 * @param degrees - Giá trị góc tính bằng độ
 * @returns Giá trị góc tính bằng radian
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Tính khoảng cách giữa 2 điểm GPS bằng công thức Haversine.
 *
 * Công thức:
 *   a = sin²(Δlat/2) + cos(lat1) · cos(lat2) · sin²(Δlng/2)
 *   c = 2 · atan2(√a, √(1−a))
 *   d = R · c
 *
 * @param lat1 - Vĩ độ điểm thứ nhất
 * @param lng1 - Kinh độ điểm thứ nhất
 * @param lat2 - Vĩ độ điểm thứ hai
 * @param lng2 - Kinh độ điểm thứ hai
 * @returns Khoảng cách tính bằng km, làm tròn 2 chữ số thập phân
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;

  return Math.round(distance * 100) / 100;
}
