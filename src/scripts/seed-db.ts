import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config();

const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
  if (firebaseConfig.projectId && firebaseConfig.clientEmail && firebaseConfig.privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert(firebaseConfig),
    });
    console.log('✅ Firebase Admin SDK initialized.');
  } else {
    console.error('❌ Firebase credentials missing in .env');
    process.exit(1);
  }
}

const db = admin.firestore();

// --- DATA FROM MOCKDATA.TS ---

const RESTAURANTS = [
  {
    id: 'rest-1',
    name: 'Phở Thìn',
    cuisineType: 'vietnamese',
    location: '13 Lò Đúc, Hai Bà Trưng, Hà Nội',
    priceRange: 'budget',
    rating: 4.7,
    openingHours: '06:00 – 22:00',
    updatedAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'rest-2',
    name: 'Sushi Tei',
    cuisineType: 'japanese',
    location: '72 Trần Hưng Đạo, Q1, TP.HCM',
    priceRange: 'mid-range',
    rating: 4.4,
    openingHours: '11:00 – 22:00',
    updatedAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'rest-3',
    name: 'Bún Chả Hương Liên',
    cuisineType: 'vietnamese',
    location: '24 Lê Văn Hưu, Hai Bà Trưng, Hà Nội',
    priceRange: 'budget',
    rating: 4.8,
    openingHours: '08:00 – 20:00',
    updatedAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'rest-4',
    name: 'Sakura Japanese Restaurant',
    cuisineType: 'japanese',
    location: '55 Pasteur, Q3, TP.HCM',
    priceRange: 'fine-dining',
    rating: 4.6,
    openingHours: '11:30 – 22:30',
    updatedAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'rest-5',
    name: 'Cơm Tấm Sài Gòn',
    cuisineType: 'vietnamese',
    location: '84 Đinh Tiên Hoàng, Q1, TP.HCM',
    priceRange: 'budget',
    rating: 4.5,
    openingHours: '07:00 – 21:00',
    updatedAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const REWARDS = [
  { id: 'reward-1', type: 'badge', value: 0, description: 'Huy hiệu: Người Đăng Đầu Tiên 🏅' },
  { id: 'reward-2', type: 'points', value: 50, description: '50 điểm thưởng ⭐' },
  { id: 'reward-3', type: 'points', value: 100, description: '100 điểm thưởng ⭐⭐' },
  { id: 'reward-4', type: 'points', value: 50, description: '50 điểm thưởng ⭐' },
  {
    id: 'reward-5', type: 'voucher', value: 10, description: 'Voucher giảm 10% 🎫',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  },
  { id: 'reward-6', type: 'badge', value: 0, description: 'Huy hiệu: Tín Đồ Ramen 🍜' },
  { id: 'reward-7', type: 'points', value: 75, description: '75 điểm thưởng ⭐' },
  { id: 'reward-8', type: 'badge', value: 0, description: 'Huy hiệu: Thám Tử Ẩm Thực 🔍' },
];

const ACHIEVEMENTS = [
  {
    id: 'ach-1', name: 'First Post!', icon: '📝',
    description: 'Đăng bài viết đầu tiên của bạn',
    condition: { eventType: 'POST_CREATED', requiredCount: 1 },
    rewardId: 'reward-1', isActive: true,
  },
  {
    id: 'ach-2', name: 'Food Explorer', icon: '🗺️',
    description: 'Ghé thăm 3 nhà hàng',
    condition: { eventType: 'RESTAURANT_VISITED', requiredCount: 3 },
    rewardId: 'reward-2', isActive: true,
  },
  {
    id: 'ach-3', name: 'Foodie', icon: '🍴',
    description: 'Ghé thăm 10 nhà hàng',
    condition: { eventType: 'RESTAURANT_VISITED', requiredCount: 10 },
    rewardId: 'reward-3', isActive: true,
  },
  {
    id: 'ach-4', name: 'Social Butterfly', icon: '🦋',
    description: 'Thích 5 bài viết của người khác',
    condition: { eventType: 'POST_LIKED', requiredCount: 5 },
    rewardId: 'reward-4', isActive: true,
  },
  {
    id: 'ach-5', name: 'Japanese Aficionado', icon: '🍣',
    description: 'Ghé thăm 3 nhà hàng Nhật Bản',
    condition: { eventType: 'RESTAURANT_VISITED', requiredCount: 3, filters: { cuisineType: 'japanese' } },
    rewardId: 'reward-5', isActive: true,
  },
  {
    id: 'ach-6', name: 'Ramen Lover', icon: '🍜',
    description: 'Đăng 3 bài viết gắn thẻ "japanese"',
    condition: { eventType: 'POST_CREATED', requiredCount: 3, filters: { tag: 'japanese' } },
    rewardId: 'reward-6', isActive: true,
  },
  {
    id: 'ach-7', name: 'Street Food King', icon: '🛵',
    description: 'Ghé thăm 5 quán ăn đường phố',
    condition: { eventType: 'RESTAURANT_VISITED', requiredCount: 5, filters: { tag: 'street-food' } },
    rewardId: 'reward-7', isActive: true,
  },
  {
    id: 'ach-8', name: 'Scanner', icon: '🔍',
    description: 'Nhận diện 1 món ăn bằng camera (Feature 2)',
    condition: { eventType: 'FOOD_SCANNED', requiredCount: 1 },
    rewardId: 'reward-8', isActive: true,
  },
];

const now = Date.now();
const POSTS = [
  {
    id: 'post-1',
    authorId: 'user-2',
    content: 'Vừa thử sushi ở Sushi Tei, ngon tuyệt vời! Cá hồi tươi, cơm dẻo vừa phải 🍣. Giá hơi cao nhưng xứng đáng!',
    tags: ['japanese', 'fine-dining'],
    restaurantId: 'rest-2',
    createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    likesCount: 3,
    likedByUserIds: ['user-1', 'user-3', 'user-2'],
    comments: [],
  },
  {
    id: 'post-2',
    authorId: 'user-1',
    content: 'Phở Thìn buổi sáng là không thể thiếu ☀️ Nước dùng đậm đà, thịt bò mềm. Chỉ 50k/bát mà no đến tận trưa!',
    tags: ['vietnamese', 'budget', 'breakfast'],
    restaurantId: 'rest-1',
    createdAt: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
    likesCount: 5,
    likedByUserIds: ['user-2', 'user-3'],
    comments: [],
  },
  {
    id: 'post-3',
    authorId: 'user-3',
    content: 'Bún chả Hương Liên nổi tiếng từ thời ông Obama ghé thăm 😄 Chả nướng thơm, bún tươi, nước mắm chua ngọt rất chuẩn vị.',
    tags: ['vietnamese', 'lunch', 'budget'],
    restaurantId: 'rest-3',
    createdAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
    likesCount: 8,
    likedByUserIds: ['user-1', 'user-2'],
    comments: [],
  },
];

async function clearCollection(name: string) {
  const snap = await db.collection(name).get();
  const batch = db.batch();
  snap.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  console.log(`🗑️ Cleared ${name}`);
}

async function seed() {
  console.log('🚀 Starting seed process...');

  // Optional: Clear existing data first to avoid duplicates or mixed states
  await clearCollection('restaurants');
  await clearCollection('posts');
  await clearCollection('rewards');
  await clearCollection('achievements');

  const batch = db.batch();

  console.log('📝 Adding to batch...');

  RESTAURANTS.forEach(r => batch.set(db.collection('restaurants').doc(r.id), r));
  REWARDS.forEach(r => batch.set(db.collection('rewards').doc(r.id), r));
  ACHIEVEMENTS.forEach(a => batch.set(db.collection('achievements').doc(a.id), a));
  POSTS.forEach(p => batch.set(db.collection('posts').doc(p.id), p));

  console.log('⏳ Committing batch...');
  await batch.commit();

  console.log('✅ Seeding completed successfully!');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
