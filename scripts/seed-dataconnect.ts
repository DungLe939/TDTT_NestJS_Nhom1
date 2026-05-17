import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

import * as http from 'http';

const DC_EMULATOR_URL = 'http://127.0.0.1:9399/v1/projects/smart-tourism-abf26/locations/asia-southeast1/services/smart-tourism-abf26-service/connectors/example:executeMutation';

const agent = new http.Agent({ keepAlive: false });

// Helper function để gọi Data Connect Emulator
async function executeMutation(operationName: string, variables: any) {
  const res = await axios.post(DC_EMULATOR_URL, {
    operationName,
    variables,
  }, { httpAgent: agent });
  if (res.data.errors) {
    throw new Error(JSON.stringify(res.data.errors));
  }
  return res.data;
}

// Helper function để tạo slug từ tên
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/([^0-9a-z-\s])/g, '')
    .replace(/(\s+)/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function seedData() {
  const dataPath = path.join(__dirname, '../data/shopeefood_geocoded.json');
  if (!fs.existsSync(dataPath)) {
    return;
  }

  const rawData = fs.readFileSync(dataPath, 'utf8');
  const parsedData = JSON.parse(rawData);
  const shops = parsedData.shops;

  // 1. Tạo danh sách Categories
  const categoryMap = new Map<string, string>();


  for (const shop of shops) {
    if (!shop.foods) continue;
    for (const food of shop.foods) {
      const categoryName = (food.name.split(' ')[0] || 'Khác').toLowerCase();
      const displayCategory = categoryName.charAt(0).toUpperCase() + categoryName.slice(1);
      if (!categoryMap.has(displayCategory)) {
        categoryMap.set(displayCategory, '');
      }
    }
  }

  for (const [name, _] of categoryMap) {
    const slug = generateSlug(name);
    try {
      const res = await executeMutation('CreateCategory', { name, slug });
      categoryMap.set(name, res.data.category_insert.id);
    } catch (e: any) {
    }
  }

  // 2. Chèn dữ liệu Shop và FoodItems
  for (const shop of shops) {
    try {
      const openTime = shop.opening_hours?.open || '07:00';
      const closeTime = shop.opening_hours?.close || '22:00';
      const priceMin = shop.price_range?.min || 0;
      const priceMax = shop.price_range?.max || 500000;
      const priceDisplay = shop.price_range?.display || `${priceMin}đ - ${priceMax}đ`;

      const shopRes = await executeMutation('CreateShop', {
        externalId: `shopee_${shop.id}`,
        name: shop.name,
        address: shop.address,
        city: 'ho-chi-minh',
        rating: shop.rating || 4.2,
        coverImage: shop.cover_image || null,
        url: shop.url || null,
        openTime,
        closeTime,
        priceMin,
        priceMax,
        priceDisplay,
        latitude: shop.location?.coordinates?.[1] || 10.762622,
        longitude: shop.location?.coordinates?.[0] || 106.660172,
      });

      const shopId = shopRes.data.shop_insert.id;

      if (shop.foods && shop.foods.length > 0) {
        let foodCount = 0;
        for (const food of shop.foods) {
          const categoryName = (food.name.split(' ')[0] || 'Khác').toLowerCase();
          const displayCategory = categoryName.charAt(0).toUpperCase() + categoryName.slice(1);
          const categoryId = categoryMap.get(displayCategory);

          if (!categoryId) {
            continue;
          }

          try {
            await executeMutation('CreateFoodItem', {
              name: food.name,
              description: food.description || null,
              price: food.price_value || food.price || 0,
              priceDisplay: food.price_display || `${food.price}đ`,
              imageUrl: food.image_url || null,
              thumbnailUrl: null,
              groupName: null,
              isPopular: false,
              totalLike: 0,
              shopId,
              categoryId,
            });
            foodCount++;
          } catch (e: any) {
          }
        }
      }
    } catch (e: any) {

    }
  }


}

seedData().catch(() => {});
