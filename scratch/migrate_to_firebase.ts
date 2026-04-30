import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

async function migrate() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Missing Firebase credentials in .env');
    return;
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }

  const db = admin.firestore();
  const jsonPath = path.join(__dirname, '../src/python/knowledge_base.json');
  
  if (!fs.existsSync(jsonPath)) {
    console.error('❌ knowledge_base.json not found at', jsonPath);
    return;
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const collectionRef = db.collection('rag_dictionary');

  console.log(`🚀 Starting migration of ${Object.keys(data).length} items...`);

  const batch = db.batch();
  let count = 0;

  for (const [vi, en] of Object.entries(data)) {
    // Dùng chính từ tiếng Việt làm ID để tránh trùng lặp
    const docRef = collectionRef.doc(Buffer.from(vi).toString('base64').replace(/[/+=]/g, '_'));
    batch.set(docRef, { vi, en, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    count++;

    if (count % 400 === 0) {
      await batch.commit();
      console.log(`✅ Migrated ${count} items...`);
    }
  }

  await batch.commit();
  console.log(`✨ Finished! Total ${count} items migrated to Firebase.`);
  process.exit(0);
}

migrate();
