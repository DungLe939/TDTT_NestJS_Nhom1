import { Injectable, InternalServerErrorException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as readline from 'readline';
import * as fs from 'fs/promises';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class MenuScanService implements OnModuleInit, OnModuleDestroy {
  private pythonProcess: ChildProcess | null = null;
  private isModelLoaded = false;
  private isShuttingDown = false;
  private pendingRequests: Array<{ resolve: Function; reject: Function }> = [];
  private ocrProvider: 'local' | 'gemini' = 'local';
  private genAI: GoogleGenerativeAI | null = null;
  private geminiModelName = '';
  private geminiModel: any | null = null;
  private readonly geminiFallbackModels: string[];

  constructor(private readonly configService: ConfigService) {
    this.geminiFallbackModels = this.resolveGeminiFallbackModels();
  }

  onModuleInit() {
    this.ocrProvider = this.resolveProvider();
    const apiKeyRaw = this.configService.get<string>('GEMINI_API_KEY');
    const apiKeySet = !!apiKeyRaw;

    console.log(
      `[MenuScanService] OCR provider: ${this.ocrProvider} (OCR_PROVIDER=${this.configService.get('OCR_PROVIDER') || 'undefined'}, GEMINI_API_KEY_LENGTH=${apiKeyRaw?.length || 0})`,
    );
    if (this.ocrProvider === 'gemini') {
      this.initGemini();
    } else {
      this.startPythonProcess();
    }
  }

  onModuleDestroy() {
    this.isShuttingDown = true;
    if (this.pythonProcess) {
      this.pythonProcess.kill();
    }
  }

  private resolveProvider(): 'local' | 'gemini' {
    const raw = (this.configService.get<string>('OCR_PROVIDER') || '')
      .trim()
      .toLowerCase()
      .replace(/^['"]|['"]$/g, '');
    if (raw === 'gemini' || raw === 'local') {
      return raw;
    }
    if (this.configService.get<string>('GEMINI_API_KEY')) {
      return 'gemini';
    }
    return 'local';
  }

  private initGemini() {
    const rawApiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!rawApiKey) {
      console.error('[MenuScanService] GEMINI_API_KEY missing, Gemini OCR disabled.');
      this.geminiModel = null;
      return;
    }

    // Sanitize API Key: remove potential quotes and whitespace
    const apiKey = rawApiKey.trim().replace(/^['"]|['"]$/g, '');

    const modelName = this.configService.get<string>('GEMINI_OCR_MODEL') || 'gemini-flash-latest';
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.geminiModelName = modelName;
    this.geminiModel = this.genAI.getGenerativeModel({ model: modelName });
    console.log(`[MenuScanService] Using Gemini OCR model: ${modelName}`);
    console.log(`[MenuScanService] API Key (sanitized): ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);

    // List available models to help debugging using direct REST call
    this.listAvailableModelsDirectly(apiKey);
  }

  private async listAvailableModelsDirectly(apiKey: string) {
    try {
      const axios = require('axios');
      console.log('[MenuScanService] Fetching available models list from Google API...');
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const response = await axios.get(url);
      const models = response.data.models || [];
      const modelNames = models.map((m: any) => m.name.replace('models/', ''));
      console.log('[MenuScanService] Available models for this key:', modelNames.join(', '));
      
      // Update candidates if needed or log if current model is missing
      if (modelNames.length > 0 && !modelNames.includes(this.geminiModelName)) {
        console.warn(`[MenuScanService] WARNING: Your primary model ${this.geminiModelName} is NOT in the available models list!`);
      }
    } catch (e) {
      console.error('[MenuScanService] Could not list models:', e.response?.data?.error?.message || e.message);
    }
  }

  private resolveGeminiFallbackModels(): string[] {
    const fromEnv = (this.configService.get<string>('GEMINI_OCR_MODELS') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const defaults = [
      'gemini-flash-latest',
      'gemini-2.0-flash',
      'gemini-2.5-flash',
      'gemini-pro-latest',
      'gemini-2.0-flash-lite',
    ];
    return Array.from(new Set([...fromEnv, ...defaults]));
  }

  private startPythonProcess() {
    // Determine correct script location (dist vs src)
    const isDist = __dirname.includes('dist');
    const pythonScriptPath = isDist
        ? path.join(__dirname, '../../python/menu_ocr_service.py')
        : path.join(process.cwd(), 'src/python/menu_ocr_service.py');

    console.log('[MenuScanService] Starting Persistent AI Service...', pythonScriptPath);
    this.pythonProcess = spawn('python', [pythonScriptPath], {
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
      },
    });

    if (this.pythonProcess.stdout) {
      // Sử dụng readline để đảm bảo đọc đúng từng dòng JSON hoàn chỉnh
      const rl = readline.createInterface({
        input: this.pythonProcess.stdout,
        terminal: false
      });

      rl.on('line', (line) => {
        if (!line.trim()) return;
        try {
          const result = JSON.parse(line);
          const request = this.pendingRequests.shift();
          if (request) {
            if (result.success) {
              request.resolve({ success: true, text: result.text });
            } else {
              request.reject(new InternalServerErrorException(result.error || 'AI Error'));
            }
          }
        } catch (e) {
          console.log('[Python Stdout (Non-JSON)]:', line);
        }
      });
    }

    if (this.pythonProcess.stderr) {
      this.pythonProcess.stderr.on('data', (data) => {
        const logMsg = data.toString();
        process.stderr.write(`[Python Log]: ${logMsg}`);

        // EasyOCR process reports this when lazy loading finishes.
        if (
          logMsg.toLowerCase().includes('easyocr models loaded successfully') ||
          logMsg.toLowerCase().includes('model loaded successfully')
        ) {
          this.isModelLoaded = true;
        }
      });
    }

    this.pythonProcess.on('close', (code) => {
      if (this.isShuttingDown) {
        return;
      }

      console.error(`[MenuScanService] Python process closed with code ${code}. Restarting...`);
      this.isModelLoaded = false;
      
      while (this.pendingRequests.length > 0) {
        const req = this.pendingRequests.shift();
        if (req) req.reject(new InternalServerErrorException('AI Service disconnected.'));
      }
      setTimeout(() => this.startPythonProcess(), 5000);
    });
  }

  async processMenuImage(imagePath: string) {
    console.log(`[MenuScanService] Processing menu image: ${imagePath} with provider: ${this.ocrProvider}`);
    if (this.ocrProvider === 'gemini') {
      return this.processWithGemini(imagePath);
    } else {
      return this.processWithLocalOcr(imagePath);
    }
  }

  private async processWithGemini(imagePath: string): Promise<any> {
    if (!this.geminiModel) {
      throw new InternalServerErrorException('Gemini OCR is not initialized. Check GEMINI_API_KEY.');
    }

    const buffer = await fs.readFile(imagePath);
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = this.getMimeType(ext);

    const prompt =
      this.configService.get<string>('GEMINI_OCR_PROMPT') ||
      'Hãy trích xuất toàn bộ văn bản trong hình ảnh. ' +
        'Giữ nguyên xuống dòng theo từng dòng menu, không thêm giải thích, không thêm ký tự thừa.';

    try {
      const candidates = [
        this.geminiModelName || 'gemini-flash-latest',
        ...this.geminiFallbackModels,
      ];

      let lastError: unknown = null;
      for (const candidate of Array.from(new Set(candidates))) {
        try {
          const model = this.genAI?.getGenerativeModel({ model: candidate }) || this.geminiModel;
          const result = await model.generateContent([
            prompt,
            {
              inlineData: {
                data: buffer.toString('base64'),
                mimeType,
              },
            },
          ]);

          if (candidate !== this.geminiModelName && this.genAI) {
            this.geminiModelName = candidate;
            this.geminiModel = this.genAI.getGenerativeModel({ model: candidate });
            console.log(`[MenuScanService] Gemini OCR switched model to: ${candidate}`);
          }

          const response = result.response;
          if (response.candidates && response.candidates[0]?.finishReason === 'SAFETY') {
            throw new Error(`Content blocked by Gemini safety filters (candidate ${candidate})`);
          }
          const text = response.text().replace(/```[\s\S]*?```/g, '').trim();
          return { success: true, text };
        } catch (err) {
          console.error(`[MenuScanService] Gemini candidate ${candidate} failed:`, err);
          lastError = err;
          const message = err instanceof Error ? err.message : String(err);
          
          // Only stop and throw immediately if it's an authentication error
          const isAuthError = message.includes('401') || message.includes('API_KEY_INVALID') || message.includes('Invalid API Key');
          if (isAuthError) {
            throw err;
          }
          
          // Otherwise, continue to next candidate (404, 429, 500, etc.)
          console.warn(`[MenuScanService] Retrying with next model due to error with ${candidate}...`);
        }
      }

      throw (
        lastError ||
        new Error(
          `No Gemini OCR model available. Tried: ${Array.from(new Set(candidates)).join(', ')}`,
        )
      );
    } catch (error) {
      console.error('[MenuScanService] Gemini OCR failed:', error);
      const message = error instanceof Error ? error.message : 'Unknown Gemini error';
      throw new InternalServerErrorException(`Gemini OCR error: ${message}`);
    }
  }

  private processWithLocalOcr(imagePath: string): Promise<any> {
    if (!this.isModelLoaded) {
      console.warn('[MenuScanService] Model is still loading...');
    }

    return new Promise((resolve, reject) => {
      if (!this.pythonProcess || !this.pythonProcess.stdin) {
        return reject(new InternalServerErrorException('AI Service not initialized.'));
      }

      this.pendingRequests.push({ resolve, reject });
      
      const payload = JSON.stringify({ image_path: imagePath });
      this.pythonProcess.stdin.write(payload + '\n');
    });
  }

  private getMimeType(ext: string): string {
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.webp':
        return 'image/webp';
      case '.bmp':
        return 'image/bmp';
      case '.png':
      default:
        return 'image/png';
    }
  }
}
