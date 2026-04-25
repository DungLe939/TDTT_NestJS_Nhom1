import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
dotenv.config();

async function fullTest() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

  const prompt = `CHỈ trả về JSON thuần túy, KHÔNG text khác:
[{"name":"Phở bò","category":"Phở"},{"name":"Cơm tấm","category":"Cơm"}]`;

  const configs = [
    { name: 'gemini-2.0-flash-lite (no JSON mode)', model: 'gemini-2.0-flash-lite', json: false },
    { name: 'gemini-2.0-flash-lite (JSON mode)', model: 'gemini-2.0-flash-lite', json: true },
    { name: 'gemini-2.0-flash (no JSON mode)', model: 'gemini-2.0-flash', json: false },
    { name: 'gemini-2.0-flash (JSON mode)', model: 'gemini-2.0-flash', json: true },
    { name: 'gemini-2.5-flash-lite (no JSON mode)', model: 'gemini-2.5-flash-lite', json: false },
    { name: 'gemini-2.5-flash (no JSON mode)', model: 'gemini-2.5-flash', json: false },
  ];

  for (const cfg of configs) {
    console.log(`\n--- ${cfg.name} ---`);
    try {
      const genConfig: any = {};
      if (cfg.json) genConfig.responseMimeType = 'application/json';

      const model = genAI.getGenerativeModel({
        model: cfg.model,
        generationConfig: Object.keys(genConfig).length > 0 ? genConfig : undefined,
      });

      const start = Date.now();
      const result = await model.generateContent(prompt);
      const elapsed = Date.now() - start;
      const text = result.response.text().substring(0, 150);
      console.log(`✅ ${elapsed}ms`);
      console.log(`   Response: ${text}`);
    } catch (e: any) {
      console.error(`❌ ${e.message.substring(0, 150)}`);
    }
  }
}

fullTest();
