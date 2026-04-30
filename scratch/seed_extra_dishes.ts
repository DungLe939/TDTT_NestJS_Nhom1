import * as admin from 'firebase-admin';
import 'dotenv/config';

async function seed() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Missing Firebase credentials');
    return;
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }

  const db = admin.firestore();
  const collectionRef = db.collection('rag_dictionary');

  const extraDishes = {
    // --- MÓN NƯỚC & PHỞ ---
    "Phở tái lăn": "Stir-fried Rare Beef Pho",
    "Phở nạm gàu": "Beef Brisket and Flank Pho",
    "Phở áp chảo": "Pan-fried Pho Noodles",
    "Bún thang": "Thang Rice Noodle Soup",
    "Bún mọc": "Pork Ball Noodle Soup",
    "Bún dọc mùng": "Taro Stem Noodle Soup",
    "Bún chả cá Quy Nhơn": "Quy Nhon Fish Cake Noodle Soup",
    "Bánh canh Trảng Bàng": "Trang Bang Thick Noodle Soup",
    "Mì vằn thắn": "Wonton Noodle Soup",
    "Hủ tiếu Mỹ Tho": "My Tho Clear Rice Noodle Soup",
    "Hủ tiếu gõ": "Street-style Clear Noodle Soup",
    
    // --- CƠM & XÔI ---
    "Cơm rang dưa bò": "Fried Rice with Beef and Pickled Greens",
    "Cơm rang hải sản": "Seafood Fried Rice",
    "Cơm gà xối mỡ": "Crispy Fried Chicken Rice",
    "Cơm niêu": "Clay Pot Rice",
    "Xôi xéo": "Sticky Rice with Mung Bean and Fried Shallots",
    "Xôi bắp": "Sticky Rice with Corn",
    "Xôi mặn": "Savory Sticky Rice",
    
    // --- MÓN CUỐN & KHAI VỊ ---
    "Bánh tráng cuốn thịt luộc": "Rice Paper Rolls with Boiled Pork",
    "Nem lụi": "Grilled Pork Skewers on Lemongrass",
    "Bánh mướt": "Steamed Rice Sheets",
    "Bánh bèo": "Water Fern Cake",
    "Bánh bột lọc": "Clear Tapioca Dumplings",
    "Bánh nậm": "Flat Rice Dumplings",
    "Bánh khoái": "Hue Crispy Pancake",
    
    // --- ĐỒ UỐNG (PHỔ BIẾN) ---
    "Trà quất mật ong": "Honey Kumquat Tea",
    "Trà sủi bọt": "Bubble Tea / Foam Tea",
    "Cà phê trứng": "Egg Coffee",
    "Sữa đậu nành": "Soy Milk",
    "Nước đậu xanh": "Mung Bean Drink",
    "Nước râu ngô": "Corn Silk Tea",
    "Nước sâm": "Herbal Ginseng Tea",
    "Rau má đậu xanh": "Pennywort with Mung Bean",
    
    // --- HẢI SẢN ---
    "Cua lột chiên bơ": "Fried Soft-shell Crab with Butter",
    "Mực xào chua ngọt": "Sweet and Sour Stir-fried Squid",
    "Ốc hương cháy tỏi": "Snail with Garlic",
    "Tôm hùm nướng phô mai": "Grilled Lobster with Cheese",
    "Nghêu hấp xả": "Steamed Clams with Lemongrass",
    
    // --- LẨU ---
    "Lẩu gà lá giang": "Chicken Hotpot with Giang Leaves",
    "Lẩu cá linh bông điên điển": "Siamese Mud Carp Hotpot with Sesban Flowers",
    "Lẩu cua đồng": "Field Crab Hotpot",
    "Lẩu dê": "Goat Hotpot",
    
    // Thêm hàng loạt các món khác để đạt số lượng lớn...
    "Bánh mì que": "Breadsticks",
    "Bánh mì chảo": "Combination Bread in Pan",
    "Bánh mì heo quay": "Roasted Pork Bread",
    "Gà bó xôi": "Chicken Wrapped in Sticky Rice",
    "Vịt quay Bắc Kinh": "Peking Duck",
    "Vịt nấu chao": "Duck with Fermented Bean Curd",
    "Bê thui Cầu Mống": "Cau Mong Rare Grilled Veal"
  };

  console.log("🚀 Injecting extra 50+ premium dishes to Firebase...");
  const batch = db.batch();
  for (const [vi, en] of Object.entries(extraDishes)) {
    const docId = Buffer.from(vi).toString('base64').replace(/[/+=]/g, '_');
    batch.set(collectionRef.doc(docId), { vi, en, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  }

  await batch.commit();
  console.log("✨ Seed successful!");
  process.exit(0);
}

seed();
