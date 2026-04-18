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
    const finalResults = {};

    console.log('🔄 Đang dịch EN → VI...');
    const result1 = await translate('The seafood is fresh', 'en2vi');
    console.log('✅ Kết quả 1:', JSON.stringify(result1, null, 2));
    finalResults['en2vi_test'] = result1;

    console.log('\n🔄 Đang dịch VI → EN...');
    const result2 = await translate('Hải sản rất tươi', 'vi2en');
    console.log('✅ Kết quả 2:', JSON.stringify(result2, null, 2));
    finalResults['vi2en_test'] = result2;

    // Lưu kết quả vào file json
    fs.writeFileSync('translation_result.json', JSON.stringify(finalResults, null, 2), 'utf-8');
    console.log('\n📁 Đã lưu toàn bộ kết quả vào file "translation_result.json" tại thư mục gốc!');
})();