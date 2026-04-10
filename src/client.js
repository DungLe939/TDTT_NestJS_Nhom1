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
    console.log('🔄 Đang dịch...');
    const result = await translate('Hải sản ở đây rất tươi', 'vi2en');
    console.log('✅ Kết quả:', result);
})();