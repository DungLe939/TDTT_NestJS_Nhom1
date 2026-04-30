import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../../providers/firebase.provider';

@Injectable()
export class DictionarySyncService implements OnModuleInit {
  private readonly logger = new Logger(DictionarySyncService.name);
  private readonly jsonPath = path.join(process.cwd(), 'src/python/knowledge_base.json');
  private isSyncing = false;

  async onModuleInit() {
    this.logger.log('🚀 Initializing Dictionary Sync Service...');
    
    // 1. Tải dữ liệu từ Firebase về local trước khi app chạy RAG
    await this.syncFirestoreToLocal();

    // 2. Bắt đầu giám sát file JSON để đẩy lên Firebase khi có món mới
    this.watchLocalFile();
  }

  /**
   * Tải toàn bộ từ điển từ Firestore về file local
   */
  private async syncFirestoreToLocal() {
    if (!db) {
      this.logger.warn('⚠️ Firebase not initialized. Skipping Firestore sync.');
      return;
    }

    try {
      this.logger.log('📥 Downloading dictionary from Firestore...');
      const snapshot = await db.collection('rag_dictionary').get();
      const remoteData = {};
      
      snapshot.forEach(doc => {
        const item = doc.data();
        if (item.vi && item.en) {
          remoteData[item.vi] = item.en;
        }
      });

      // Đọc dữ liệu local hiện tại
      let localData = {};
      if (fs.existsSync(this.jsonPath)) {
        try {
          localData = JSON.parse(fs.readFileSync(this.jsonPath, 'utf-8'));
        } catch (e) {
          localData = {};
        }
      }

      // Hợp nhất dữ liệu (Ưu tiên Firebase)
      const mergedData = { ...localData, ...remoteData };
      
      // Ghi lại vào file JSON (ở cả src và dist để Python thấy ngay)
      this.saveToLocal(mergedData);
      
      this.logger.log(`✅ Synced ${Object.keys(mergedData).length} items to local storage.`);
    } catch (error) {
      this.logger.error('❌ Failed to sync from Firestore:', error.message);
    }
  }

  /**
   * Lưu dữ liệu vào file JSON cục bộ
   */
  private saveToLocal(data: any) {
    try {
      const content = JSON.stringify(data, null, 4);
      
      // Ghi vào thư mục src
      fs.writeFileSync(this.jsonPath, content, 'utf-8');
      
      // Ghi vào thư mục dist (nếu đang chạy từ dist)
      const distPath = this.jsonPath.replace('src', 'dist');
      if (fs.existsSync(path.dirname(distPath))) {
        fs.writeFileSync(distPath, content, 'utf-8');
      }
    } catch (e) {
      this.logger.error('❌ Failed to save to local JSON:', e.message);
    }
  }

  /**
   * Giám sát file JSON và đẩy lên Firebase khi có thay đổi
   */
  private watchLocalFile() {
    this.logger.log(`👀 Watching ${this.jsonPath} for changes...`);
    
    let debounceTimer: NodeJS.Timeout;
    
    fs.watch(this.jsonPath, (eventType) => {
      if (eventType === 'change') {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => this.handleFileChange(), 2000); // Đợi 2s để file ghi xong hoàn toàn
      }
    });
  }

  private async handleFileChange() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      this.logger.log('🔄 Local file changed. Syncing new items to Firestore...');
      const localData = JSON.parse(fs.readFileSync(this.jsonPath, 'utf-8'));
      
      const batch = db.batch();
      let newItemsCount = 0;

      // Chỉ đẩy những món chưa có hoặc có thay đổi (Thực tế là set đè cũng được vì Firestore nhanh)
      // Để tối ưu, ta có thể so sánh, nhưng ở đây ta cứ push batch cho đơn giản
      const collectionRef = db.collection('rag_dictionary');
      
      for (const [vi, en] of Object.entries(localData)) {
        const docId = Buffer.from(vi as string).toString('base64').replace(/[/+=]/g, '_');
        const docRef = collectionRef.doc(docId);
        batch.set(docRef, { vi, en, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        newItemsCount++;
        
        if (newItemsCount >= 450) break; // Firestore limit 500 per batch
      }

      await batch.commit();
      this.logger.log(`✅ Successfully synced ${newItemsCount} items to Firestore.`);
    } catch (error) {
      this.logger.error('❌ Failed to upload to Firestore:', error.message);
    } finally {
      this.isSyncing = false;
    }
  }
}
