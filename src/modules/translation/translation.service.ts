import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

interface PendingRequest {
    resolve: Function;
    reject: Function;
    timeout: NodeJS.Timeout;
}

@Injectable()
export class TranslationService implements OnModuleInit, OnModuleDestroy {
    private pythonProcess: ChildProcess | null = null;
    private messageQueue: PendingRequest[] = [];

    constructor(private readonly configService: ConfigService) {}

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
                            
                            // Bỏ qua message khởi tạo từ Python
                            if (result.type === 'READY' || result.type === 'ERROR') {
                                console.log(`[Python Status]`, result.message);
                                return;
                            }

                            const pending = this.messageQueue.shift();
                            if (pending) {
                                clearTimeout(pending.timeout);
                                pending.resolve(result);
                            }
                        } catch (e) {
                            // Không shift() queue ở đây để tránh làm mất request khi có warning log không phải JSON
                            console.warn(`[Python stdout warning]: ${line}`);
                        }
                    }
                });
            });
        }

        if (this.pythonProcess.stderr) {
            this.pythonProcess.stderr.on('data', (data: Buffer) => {
                console.log(`[Python stderr] ${data.toString('utf-8')}`);
            });
        }

        this.pythonProcess.on('error', (error) => {
            console.error('Python process error:', error);
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

            // Timeout 120s
            const timeout = setTimeout(() => {
                const index = this.messageQueue.findIndex(p => p.timeout === timeout);
                if (index !== -1) {
                    const [pending] = this.messageQueue.splice(index, 1);
                    pending.reject(new Error('Translation timeout'));
                }
            }, 120000);

            this.messageQueue.push({ resolve, reject, timeout });
        });
    }

    async onModuleDestroy() {
        if (this.pythonProcess) {
            this.pythonProcess.kill();
        }
    }
}