import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

@Injectable()
export class TranslationService implements OnModuleInit, OnModuleDestroy {
    private pythonProcess: ChildProcess | null = null;
    private messageQueue: Array<{ resolve: Function; reject: Function }> = [];

    async onModuleInit() {
        this.startPythonProcess();
    }

    private startPythonProcess() {
        // Dùng __dirname để trỏ về dist/python (NestJS assets copy từ src/python)
        const pythonPath = path.join(__dirname, '../../python/translation_service.py');

        this.pythonProcess = spawn('python', [pythonPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        let buffer = '';

        if (this.pythonProcess.stdout) {
            this.pythonProcess.stdout.on('data', (data: Buffer) => {
                buffer += data.toString('utf-8');

                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                lines.forEach((line) => {
                    if (line.trim()) {
                        try {
                            const result = JSON.parse(line);
                            const pending = this.messageQueue.shift();
                            if (pending) {
                                pending.resolve(result);
                            }
                        } catch (e) {
                            const pending = this.messageQueue.shift();
                            if (pending) {
                                pending.reject(new Error(`Invalid JSON response: ${line}`));
                            }
                        }
                    }
                });
            });
        }

        if (this.pythonProcess.stderr) {
            this.pythonProcess.stderr.on('data', (data: Buffer) => {

            });
        }

        this.pythonProcess.on('error', (error) => {

        });
    }

    async translate(
        text: string,
        method: 'en2vi' | 'vi2en' = 'en2vi'
    ): Promise<{
        input: string;
        output: string;
        method: string;
        sentiment?: { label: string; score: number };
    }> {
        return new Promise((resolve, reject) => {
            if (!this.pythonProcess || !this.pythonProcess.stdin) {
                reject(new Error('Python process not initialized'));
                return;
            }

            this.pythonProcess.stdin.write(
                JSON.stringify({ text, method }) + '\n',
                'utf-8',
                (err) => {
                    if (err) reject(err);
                }
            );

            this.messageQueue.push({ resolve, reject });

            // ✅ FIX: Tăng từ 30s lên 120s (2 phút)
            setTimeout(() => {
                const pending = this.messageQueue.shift();
                if (pending) {
                    pending.reject(new Error('Translation timeout'));
                }
            }, 120000); // ← 120 giây
        });
    }

    async onModuleDestroy() {
        if (this.pythonProcess) {
            this.pythonProcess.kill();
        }
    }
}   