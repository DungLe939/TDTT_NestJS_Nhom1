/**
 * Script geocode địa chỉ các shop từ ShopeeFood.
 * Sử dụng Nominatim (OpenStreetMap) API để chuyển đổi address → tọa độ (lat, lng).
 * Chạy 1 lần duy nhất: node scripts/geocode-shops.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT_FILE = join(__dirname, '..', 'data', 'shopeefood_shops.json');
const OUTPUT_FILE = join(__dirname, '..', 'data', 'shopeefood_geocoded.json');

// Delay helper để tránh rate limit Nominatim (1 request/giây)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Geocode một địa chỉ thành tọa độ (lat, lng) bằng Nominatim API.
 * Thêm ", Hồ Chí Minh, Việt Nam" vào cuối để tăng độ chính xác.
 */
async function geocodeAddress(address) {
  // Thêm context TP.HCM vào query để geocode chính xác hơn
  const query = `${address}, Hồ Chí Minh, Việt Nam`;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=vn`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Smart-Tourism-HCMUS-Geocoder/1.0' }
    });
    const data = await response.json();

    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        displayName: data[0].display_name,
      };
    }
    return null;
  } catch (error) {
    console.error(`  ❌ Lỗi geocode "${address}":`, error.message);
    return null;
  }
}

async function main() {
  console.log('📖 Đang đọc file ShopeeFood...');
  const rawData = JSON.parse(readFileSync(INPUT_FILE, 'utf-8'));
  const shops = rawData.shops;
  console.log(`📊 Tổng cộng ${shops.length} shops cần geocode.\n`);

  const geocodedShops = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < shops.length; i++) {
    const shop = shops[i];
    console.log(`[${i + 1}/${shops.length}] 🔍 Geocoding: ${shop.name}`);
    console.log(`   📍 Địa chỉ: ${shop.address}`);

    const coords = await geocodeAddress(shop.address);

    if (coords) {
      successCount++;
      console.log(`   ✅ Tọa độ: ${coords.lat}, ${coords.lng}`);

      geocodedShops.push({
        ...shop,
        location: {
          type: 'Point',
          coordinates: [coords.lng, coords.lat], // GeoJSON: [lng, lat]
        },
        geocodedAddress: coords.displayName,
      });
    } else {
      failCount++;
      console.log(`   ⚠️  Không tìm được tọa độ, sử dụng tọa độ mặc định (trung tâm HCM)`);

      // Fallback: dùng tọa độ trung tâm TP.HCM + random offset nhỏ
      const defaultLat = 10.7769 + (Math.random() - 0.5) * 0.05;
      const defaultLng = 106.7009 + (Math.random() - 0.5) * 0.05;

      geocodedShops.push({
        ...shop,
        location: {
          type: 'Point',
          coordinates: [defaultLng, defaultLat],
        },
        geocodedAddress: null,
      });
    }

    // Delay 1.1 giây giữa các request (Nominatim rate limit: 1 req/sec)
    if (i < shops.length - 1) {
      await delay(1100);
    }
  }

  // Ghi file kết quả
  const output = {
    scraped_at: rawData.scraped_at,
    city: rawData.city,
    total_shops: geocodedShops.length,
    total_foods: rawData.total_foods,
    geocoded_at: new Date().toISOString(),
    geocode_stats: {
      success: successCount,
      failed: failCount,
      total: shops.length,
    },
    shops: geocodedShops,
  };

  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8');

  console.log('\n' + '═'.repeat(50));
  console.log('📊 KẾT QUẢ GEOCODE');
  console.log('═'.repeat(50));
  console.log(`   ✅ Thành công: ${successCount}/${shops.length}`);
  console.log(`   ⚠️  Dùng mặc định: ${failCount}/${shops.length}`);
  console.log(`   📁 File output: ${OUTPUT_FILE}`);
  console.log('═'.repeat(50));
}

main().catch(console.error);
