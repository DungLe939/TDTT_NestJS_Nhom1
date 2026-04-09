import 'dotenv/config'; // Đảm bảo các biến từ file .env được nạp vào process.env

/**
 * Cấu hình kết nối Firebase dành cho Server-side (Firebase Admin SDK).
 * Các thông tin này được lấy từ Environment Variables trong file .env.
 */
export const firebaseConfig = {
  // ID của dự án Firebase
  projectId: process.env.FIREBASE_PROJECT_ID,

  // Email dịch vụ (Service Account Email)
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,

  /**
   * Private Key của Service Account.
   * Lưu ý: Khi lưu Private Key trong .env, các ký tự xuống dòng thường bị biến thành chuỗi "\\n".
   * Hàm .replace(/\\n/g, '\n') giúp chuyển chúng về định dạng xuống dòng thực tế để Firebase có thể đọc được.
   */
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};
