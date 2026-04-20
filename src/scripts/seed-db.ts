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

const now = Date.now();

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


const POSTS = [
  // Page 1
  { id: 'post-1', authorId: 'user-2', content: 'Sushi ở Sushi Tei ngon cực! 🍣', tags: ['japanese'], restaurantId: 'rest-2', createdAt: new Date(now - 1 * 3600000).toISOString(), likesCount: 3, likedByUserIds: [], comments: [] },
  { id: 'post-2', authorId: 'user-1', content: 'Phở Thìn buổi sáng ☀️', tags: ['vietnamese'], restaurantId: 'rest-1', createdAt: new Date(now - 2 * 3600000).toISOString(), likesCount: 5, likedByUserIds: [], comments: [] },
  { id: 'post-3', authorId: 'user-3', content: 'Bún chả Hương Liên chuẩn vị!', tags: ['vietnamese'], restaurantId: 'rest-3', createdAt: new Date(now - 3 * 3600000).toISOString(), likesCount: 8, likedByUserIds: [], comments: [] },
  { id: 'post-4', authorId: 'user-2', content: 'Sakura set lunch ổn áp 🍱', tags: ['japanese'], restaurantId: 'rest-4', createdAt: new Date(now - 4 * 3600000).toISOString(), likesCount: 2, likedByUserIds: [], comments: [] },
  { id: 'post-5', authorId: 'user-1', content: 'Cơm tấm Sài Gòn linh hồn bữa sáng!', tags: ['vietnamese'], restaurantId: 'rest-5', createdAt: new Date(now - 5 * 3600000).toISOString(), likesCount: 6, likedByUserIds: [], comments: [] },
  
  // Page 2
  { id: 'post-6', authorId: 'user-3', content: 'Món Hàn ở đây cay xè nhưng ghiền 🌶️', tags: ['korean'], restaurantId: 'rest-2', createdAt: new Date(now - 6 * 3600000).toISOString(), likesCount: 1, likedByUserIds: [], comments: [] },
  { id: 'post-7', authorId: 'user-1', content: 'Bánh mì Huỳnh Hoa nhiều thịt quá!', tags: ['vietnamese', 'street-food'], restaurantId: 'rest-1', createdAt: new Date(now - 7 * 3600000).toISOString(), likesCount: 12, likedByUserIds: [], comments: [] },
  { id: 'post-8', authorId: 'user-2', content: 'Ramen Ippudo nước dùng béo ngậy 🍜', tags: ['japanese'], restaurantId: 'rest-4', createdAt: new Date(now - 8 * 3600000).toISOString(), likesCount: 4, likedByUserIds: [], comments: [] },
  { id: 'post-9', authorId: 'user-3', content: 'Pizza 4Ps chưa bao giờ thất vọng 🍕', tags: ['italian'], restaurantId: 'rest-3', createdAt: new Date(now - 9 * 3600000).toISOString(), likesCount: 15, likedByUserIds: [], comments: [] },
  { id: 'post-10', authorId: 'user-1', content: 'Gà rán Popeyes giòn tan!', tags: ['fast-food'], restaurantId: 'rest-5', createdAt: new Date(now - 10 * 3600000).toISOString(), likesCount: 7, likedByUserIds: [], comments: [] },
  
  // Page 3
  { id: 'post-11', authorId: 'user-2', content: 'Lẩu Haidilao múa mì vui ghê 😂', tags: ['chinese'], restaurantId: 'rest-2', createdAt: new Date(now - 11 * 3600000).toISOString(), likesCount: 20, likedByUserIds: [], comments: [] },
  { id: 'post-12', authorId: 'user-3', content: 'Ốc Đào Q1 đa dạng món 🐚', tags: ['vietnamese', 'street-food'], restaurantId: 'rest-1', createdAt: new Date(now - 12 * 3600000).toISOString(), likesCount: 9, likedByUserIds: [], comments: [] },
  { id: 'post-13', authorId: 'user-1', content: 'Dimsum San Fu Lou ngon mắt lẹ miệng.', tags: ['chinese'], restaurantId: 'rest-4', createdAt: new Date(now - 13 * 3600000).toISOString(), likesCount: 5, likedByUserIds: [], comments: [] },
  { id: 'post-14', authorId: 'user-2', content: 'Steak El Gaucho đẳng cấp 🥩', tags: ['western'], restaurantId: 'rest-3', createdAt: new Date(now - 14 * 3600000).toISOString(), likesCount: 11, likedByUserIds: [], comments: [] },
  { id: 'post-15', authorId: 'user-3', content: 'Trà sữa Phúc Long đậm trà 🍵', tags: ['vietnamese', 'drinks'], restaurantId: 'rest-5', createdAt: new Date(now - 15 * 3600000).toISOString(), likesCount: 30, likedByUserIds: [], comments: [] },
];

async function clearCollection(name: string) {
  const snap = await db.collection(name).get();
  const docs = snap.docs;
  if (docs.length === 0) return;

  const chunks: admin.firestore.QueryDocumentSnapshot[][] = [];
  for (let i = 0; i < docs.length; i += 500) {
    chunks.push(docs.slice(i, i + 500));
  }

  for (const chunk of chunks) {
    const batch = db.batch();
    chunk.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  console.log(`🗑️ Cleared ${name} (${docs.length} docs)`);
}

async function seed() {
  console.log('🚀 Starting seed process...');

  // Optional: Clear existing data first to avoid duplicates or mixed states
  // [SAFE] Restaurant collection is preserved and maintained independently.
  await clearCollection('posts');
  await clearCollection('rewards');
  await clearCollection('achievements');

  const batch = db.batch();

  console.log('📝 Adding to batch...');

  // [SAFE] Restaurants are managed via external API synchronization or emergency restoration script.
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
