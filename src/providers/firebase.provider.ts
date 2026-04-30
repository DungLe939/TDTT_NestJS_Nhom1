import * as admin from 'firebase-admin';
import { firebaseConfig } from '../configs/firebase.config';

// Kiểm tra nếu app chưa được khởi tạo thì mới init
if (!admin.apps.length) {
  // ----------------------------------------------------------------------
  // [BẢO VỆ] - KIỂM TRA CREDENTIAL TRƯỚC KHI INIT
  // Nếu thiếu một trong các biến FIREBASE_PROJECT_ID, CLIENT_EMAIL hoặc PRIVATE_KEY
  // thì bỏ qua bước init thay vì làm sập (crash) server.
  // ----------------------------------------------------------------------
  if (firebaseConfig.projectId && firebaseConfig.clientEmail && firebaseConfig.privateKey) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: firebaseConfig.projectId,
          clientEmail: firebaseConfig.clientEmail,
          privateKey: firebaseConfig.privateKey,
        }),
      });
    } catch (error) {
    }
  } else {
  }
}

// Export Firestore instance để các Service sử dụng
// [BẢO VỆ] - Nếu không có Firebase app thì gán null (ép kiểu để không lỗi TS)
export const db = (admin.apps.length ? admin.firestore() : null) as any;

// Export Auth instance nếu bạn cần làm tính năng Login/Register
// [BẢO VỆ] - Nếu không có Firebase app thì gán null (ép kiểu để không lỗi TS)
export const auth = (admin.apps.length ? admin.auth() : null) as any;
