/**
 * Script geocode NÂNG CAO cho địa chỉ ShopeeFood.
 * Thử nhiều chiến lược khác nhau để tăng tỷ lệ thành công:
 * 1. Geocode nguyên địa chỉ
 * 2. Chỉ lấy tên đường + quận
 * 3. Chỉ lấy tên đường
 * 4. Fallback tọa độ quận/huyện
 * 
 * Chạy: node scripts/geocode-shops-v2.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT_FILE = join(__dirname, '..', 'data', 'shopeefood_shops.json');
const OUTPUT_FILE = join(__dirname, '..', 'data', 'shopeefood_geocoded.json');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Tọa độ mặc định của các quận/huyện TP.HCM (dùng làm fallback)
const DISTRICT_COORDS = {
  'quận 1':     { lat: 10.7756, lng: 106.7019 },
  'quận 2':     { lat: 10.7870, lng: 106.7500 },
  'quận 3':     { lat: 10.7850, lng: 106.6880 },
  'quận 4':     { lat: 10.7585, lng: 106.7060 },
  'quận 5':     { lat: 10.7540, lng: 106.6660 },
  'quận 6':     { lat: 10.7480, lng: 106.6360 },
  'quận 7':     { lat: 10.7340, lng: 106.7220 },
  'quận 8':     { lat: 10.7400, lng: 106.6280 },
  'quận 9':     { lat: 10.8400, lng: 106.7850 },
  'quận 10':    { lat: 10.7730, lng: 106.6680 },
  'quận 11':    { lat: 10.7630, lng: 106.6500 },
  'quận 12':    { lat: 10.8670, lng: 106.6530 },
  'bình thạnh': { lat: 10.8050, lng: 106.7100 },
  'tân bình':   { lat: 10.8010, lng: 106.6520 },
  'tân phú':    { lat: 10.7920, lng: 106.6280 },
  'phú nhuận':  { lat: 10.7990, lng: 106.6820 },
  'gò vấp':     { lat: 10.8380, lng: 106.6650 },
  'bình tân':   { lat: 10.7650, lng: 106.6030 },
  'bình chánh': { lat: 10.6870, lng: 106.6100 },
  'thủ đức':    { lat: 10.8530, lng: 106.7590 },
  'thành phố thủ đức': { lat: 10.8530, lng: 106.7590 },
  'hóc môn':    { lat: 10.8860, lng: 106.5940 },
  'củ chi':     { lat: 10.9740, lng: 106.4940 },
  'nhà bè':     { lat: 10.6780, lng: 106.7270 },
  'cần giờ':    { lat: 10.4110, lng: 106.9530 },
};

/**
 * Trích xuất tên đường và quận từ address.
 * Ví dụ: "285/39 Phan Văn Hớn, P. Tân Thới Nhất, Quận 12, TP. HCM"
 * → { street: "Phan Văn Hớn", district: "Quận 12" }
 */
function extractAddressParts(address) {
  const parts = address.split(',').map(s => s.trim());
  
  // Tìm quận/huyện
  let district = null;
  for (const part of parts) {
    const lower = part.toLowerCase().replace(/\./g, '').trim();
    for (const key of Object.keys(DISTRICT_COORDS)) {
      if (lower.includes(key)) {
        district = key;
        break;
      }
    }
    if (district) break;
  }
  
  // Tìm tên đường (phần đầu tiên, bỏ số nhà/hẻm)
  let street = parts[0] || '';
  // Bỏ số nhà phức tạp (285/39, 119/41/11, A6/8C, Hẻm 438/34, 52/21a)
  street = street
    .replace(/^(Hẻm\s+)?[\d]+[a-zA-Z]?(\/[\d]+[a-zA-Z]?)*(\/[\d]+)?\s*/i, '')
    .replace(/^[\d]+\s+/, '')  // "168  Bà Hạt" → "Bà Hạt"
    .replace(/^0*(\d+)\s+/, '') // "06 Nguyễn Cửu Vân" → "Nguyễn Cửu Vân"
    .trim();
  
  return { street, district, rawParts: parts };
}

/**
 * Gọi Nominatim API với query cho sẵn.
 */
async function nominatimSearch(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=vn`;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Smart-Tourism-HCMUS-Geocoder/2.0' }
    });
    const data = await response.json();
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      // Kiểm tra tọa độ nằm trong khu vực TP.HCM (10.3 - 11.2 lat, 106.3 - 107.1 lng)
      if (lat >= 10.3 && lat <= 11.2 && lng >= 106.3 && lng <= 107.1) {
        return { lat, lng, source: 'nominatim' };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Geocode với nhiều chiến lược fallback.
 */
async function geocodeWithRetry(address) {
  const { street, district } = extractAddressParts(address);

  // Chiến lược 1: Địa chỉ gốc + HCM context
  let result = await nominatimSearch(`${address}, Hồ Chí Minh, Việt Nam`);
  if (result) return { ...result, strategy: 'full_address' };
  await delay(1100);

  // Chiến lược 2: Chỉ tên đường + quận + HCM
  if (street && district) {
    result = await nominatimSearch(`${street}, ${district}, Hồ Chí Minh`);
    if (result) return { ...result, strategy: 'street_district' };
    await delay(1100);
  }

  // Chiến lược 3: Chỉ tên đường + Hồ Chí Minh
  if (street && street.length > 3) {
    result = await nominatimSearch(`${street}, Hồ Chí Minh`);
    if (result) return { ...result, strategy: 'street_only' };
    await delay(1100);
  }

  // Chiến lược 4: Dùng tọa độ mặc định của quận + random offset nhỏ
  if (district && DISTRICT_COORDS[district]) {
    const base = DISTRICT_COORDS[district];
    // Random offset ~200-500m để các quán cùng quận không chồng nhau
    const offsetLat = (Math.random() - 0.5) * 0.008;
    const offsetLng = (Math.random() - 0.5) * 0.008;
    return {
      lat: base.lat + offsetLat,
      lng: base.lng + offsetLng,
      source: 'district_fallback',
      strategy: 'district_center',
    };
  }

  // Chiến lược 5: Fallback cuối cùng - trung tâm HCM
  return {
    lat: 10.7769 + (Math.random() - 0.5) * 0.03,
    lng: 106.7009 + (Math.random() - 0.5) * 0.03,
    source: 'default_fallback',
    strategy: 'hcm_center',
  };
}

async function main() {
  console.log('📖 Đang đọc file ShopeeFood...');
  const rawData = JSON.parse(readFileSync(INPUT_FILE, 'utf-8'));
  const shops = rawData.shops;
  console.log(`📊 Tổng cộng ${shops.length} shops cần geocode.\n`);

  const geocodedShops = [];
  const stats = { nominatim: 0, district_fallback: 0, default_fallback: 0 };

  for (let i = 0; i < shops.length; i++) {
    const shop = shops[i];
    console.log(`[${i + 1}/${shops.length}] 🔍 ${shop.name}`);
    console.log(`   📍 ${shop.address}`);

    const coords = await geocodeWithRetry(shop.address);

    const icon = coords.source === 'nominatim' ? '✅' : coords.source === 'district_fallback' ? '📍' : '⚠️';
    console.log(`   ${icon} (${coords.strategy}) → ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);

    if (coords.source === 'nominatim') stats.nominatim++;
    else if (coords.source === 'district_fallback') stats.district_fallback++;
    else stats.default_fallback++;

    geocodedShops.push({
      ...shop,
      location: {
        type: 'Point',
        coordinates: [coords.lng, coords.lat],
      },
      geocodeStrategy: coords.strategy,
    });
  }

  // Ghi file kết quả
  const output = {
    scraped_at: rawData.scraped_at,
    city: rawData.city,
    total_shops: geocodedShops.length,
    total_foods: rawData.total_foods,
    geocoded_at: new Date().toISOString(),
    geocode_stats: {
      nominatim_exact: stats.nominatim,
      district_fallback: stats.district_fallback,
      default_fallback: stats.default_fallback,
      total: shops.length,
    },
    shops: geocodedShops,
  };

  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8');

  console.log('\n' + '═'.repeat(50));
  console.log('📊 KẾT QUẢ GEOCODE V2');
  console.log('═'.repeat(50));
  console.log(`   ✅ Nominatim chính xác: ${stats.nominatim}/${shops.length}`);
  console.log(`   📍 Fallback quận/huyện: ${stats.district_fallback}/${shops.length}`);
  console.log(`   ⚠️  Fallback HCM center: ${stats.default_fallback}/${shops.length}`);
  console.log(`   📁 Output: ${OUTPUT_FILE}`);
  console.log('═'.repeat(50));
}

main().catch(console.error);
