const http = require('http');

function translate(text, method = 'en2vi') {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ text, method });

        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/translate',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
            },
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => {
                resolve(JSON.parse(body));
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

// Test
(async () => {
    const fs = require('fs');
    console.log('🔄 Đang dịch...');
    const result = await translate('I am very hungry', 'en2vi');
    console.log('✅ Kết quả:', result);

    const resultPath = 'translation_result.json';
    
    // Ghi đè trực tiếp chỉ 1 kết quả duy nhất, xoá sạch mớ cũ đi
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`📁 Đã xoá kết quả cũ và lưu kết quả mới nhất vào file "${resultPath}"`);
})();