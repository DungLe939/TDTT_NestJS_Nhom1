# Hướng Dẫn Setup Dự Án - TDTT Backend Nhóm 1 (NestJS)

Đây là kho lưu trữ cho Backend Server của dự án Thể Dục Thể Thao Nhóm 1, được phát triển bằng framework NestJS.

## 🚀 1. Yêu cầu cài đặt
Để chạy được ứng dụng này, hãy chắc chắn máy của bạn đã cài:
- [Node.js](https://nodejs.org/) (Khuyên dùng v18.x trở lên)
- Trình quản lý gói `npm` (đi kèm Node.js)
- Database/Service tuỳ thuộc vào biến môi trường (MongoDB/MySQL...)

## 📦 2. Hướng dẫn thiết lập chạy Code
### Bước 1: Clone project về máy (hoặc nhánh hiện tại của bạn)
```bash
git clone <url-repo-cua-ban>
cd TDTT_NestJS_Nhom_1
```

### Bước 2: Cài đặt thư viện (Dependencies)
Cài đặt chính xác các thư viện trong package.json:
```bash
npm install
```

### Bước 3: Cấu hình biến môi trường
Môi trường backend cần các cấu hình ẩn thông qua file `.env`. 
Copy file `.env.example` để tạo ra file `.env` cục bộ cho bạn:
```bash
# Trên Windows CMD/PowerShell: 
copy .env.example .env
```
Mở file `.env` vừa tạo và điền các giá trị thích hợp (ví dụ Password DB).
> ⚠️ Tuyệt đối KHÔNG commit file `.env` lên Github.

### Bước 4: Chạy server
Chạy môi trường phát triển (tự động reload khi có thay đổi file):
```bash
npm run start:dev
```
Server chuẩn sẽ chạy trên cổng `http://localhost:3000` (hoặc cổng cấu hình trong file .env).

## 🔥 3. Các Lệnh Hữu Ích Khác
```bash
# Build mã nguồn cho môi trường production
npm run build

# Chạy server ở chế độ Production
npm run start:prod

# Xem trạng thái lỗi cú pháp (ESLint)
npm run lint

# Tạo một service hoặc module mới tự động (NestJS CLI)
npx nest g module users
npx nest g controller users
npx nest g service users
```

## 📖 4. Tham Khảo Quy Tắc Code Nhóm
Trước khi bắt đầu code tính năng mới, MỌI NGƯỜI **BẮT BUỘC** PHẢI ĐỌC QUA:
👉 [Quy Tắc Code Backend - Rule_Code.md](./Rule_Code.md)

Chúng ta có chung Setup PR Template trên Github và Convention theo chuẩn NestJS.

