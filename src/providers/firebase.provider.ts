import * as admin from 'firebase-admin';
import { firebaseConfig } from '../configs/firebase.config';

// Kiểm tra nếu app chưa được khởi tạo thì mới init
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: firebaseConfig.projectId,
            clientEmail: firebaseConfig.clientEmail,
            privateKey: firebaseConfig.privateKey,
        }),
    });
}

// Export Firestore instance để các Service sử dụng
export const db = admin.firestore();

// Export Auth instance nếu bạn cần làm tính năng Login/Register
export const auth = admin.auth();