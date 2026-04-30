
import { getDataConnect } from 'firebase-admin/data-connect';
import * as admin from 'firebase-admin';
import { connectorConfig } from '../dataconnect-admin-generated/index.cjs.js';

/**
 * Khởi tạo Firebase Admin App nếu chưa tồn tại.
 */
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

/**
 * Cấu hình Emulator cho Admin SDK.
 * QUAN TRỌNG: Phải đặt TRƯỚC khi khởi tạo Data Connect.
 */
if (process.env.NODE_ENV !== 'production') {
  process.env.DATA_CONNECT_EMULATOR_HOST = '127.0.0.1:9399';
}

/**
 * Khởi tạo Data Connect Admin instance.
 */
export const dc = getDataConnect(connectorConfig);

