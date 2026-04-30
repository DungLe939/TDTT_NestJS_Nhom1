import { getDataConnect } from 'firebase-admin/data-connect';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Tìm đường dẫn chính xác của file cấu hình Data Connect.
 * Ưu tiên tìm trong src (cho Dev) và ngoài src (cho Prod/Dist).
 */
const getConnectorConfig = () => {
  const rootDir = process.cwd();
  const potentialPaths = [
    path.join(rootDir, 'src/dataconnect-admin-generated/index.cjs.js'), // Vị trí trong code nguồn
    path.join(rootDir, 'dataconnect-admin-generated/index.cjs.js'),     // Vị trí trong thư mục dist (ngang hàng src)
    path.join(rootDir, 'dist/src/dataconnect-admin-generated/index.cjs.js'), // Vị trí copy dự phòng
  ];

  for (const p of potentialPaths) {
    if (fs.existsSync(p)) {
      return require(p).connectorConfig;
    }
  }
  
  // Nếu không thấy file .js, thử tìm file .cjs.js tương ứng
  throw new Error(`[DataConnect] Không tìm thấy file index.cjs.js tại các vị trí: ${potentialPaths.join(', ')}`);
};

// Khởi tạo Firebase Admin App nếu chưa tồn tại
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

// Cấu hình Emulator cho Admin SDK
if (process.env.NODE_ENV !== 'production') {
  process.env.DATA_CONNECT_EMULATOR_HOST = '127.0.0.1:9399';
}

/**
 * Khởi tạo Data Connect Admin instance
 */
export const dc = getDataConnect(getConnectorConfig());
