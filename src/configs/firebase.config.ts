import 'dotenv/config'; // Load .env trước khi Firebase đọc biến môi trường

export const firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'), // Fix lỗi xuống dòng của Private Key
};