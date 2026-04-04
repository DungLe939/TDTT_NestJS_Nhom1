# 📋 Quy Tắc Code - TDTT NestJS Nhóm 1

> **Mục đích:** Đảm bảo code đồng nhất, dễ bảo trì và tránh xung đột khi làm việc nhóm.

---

## 1. 📦 Quản Lý Package (npm)

- **Luôn cài đặt với phiên bản chính xác** để tránh xung đột giữa các thành viên.
- Sử dụng flag `--save-exact` khi cài đặt package.

```bash
# ✅ Đúng
npm install class-validator@0.14.0 class-transformer@0.5.1 --save-exact

# ❌ Sai (không có --save-exact)
npm install class-validator
```

- **Không xoá** file `package-lock.json` — commit file này lên Git.
- Khi thêm package mới, **thông báo cho nhóm** để tránh conflict.

---

## 2. 🌿 Quy Tắc Git & Branch

### 2.1 Cấu trúc nhánh

```
main                                 ← Chỉ merge khi demo/nộp bài, luôn chạy được
│
develop                              ← Nhánh tích hợp chung, merge feature vào đây
│
├── feature/auth                     ← Quản lý người dùng, đăng nhập JWT
├── feature/quests                   ← Xử lý nhiệm vụ
├── feature/ai-integration           ← Tích hợp AI
│
└── fix/token-expired                ← Khi cần sửa lỗi trên develop
```

### 2.2 Quy tắc nhánh

| Nhánh | Ai được merge vào | Khi nào |
|-------|-------------------|---------|
| `main` | Chỉ **nhóm trưởng** | Khi demo / nộp bài |
| `develop` | Thành viên (qua PR) | Khi feature hoàn thành & được review |
| `feature/*` | Người phụ trách | Tự do commit khi đang phát triển |
| `fix/*` | Người sửa lỗi | Khi phát hiện bug trên `develop` |

> ⚠️ **KHÔNG BAO GIỜ** push trực tiếp lên `main` hoặc `develop` — luôn tạo Pull Request.

### 2.3 Commit message

Theo chuẩn: `[<TYPE>] mô tả bằng tiếng Việt`

| Type         | Ý nghĩa                         |
| ------------ | -------------------------------- |
| `[ADD]`      | Thêm tính năng / API / file mới |
| `[UPDATE]`   | Cập nhật, chỉnh sửa code / logic |
| `[FIX]`      | Sửa lỗi / Bug fix               |
| `[DELETE]`   | Xoá file / code không dùng      |
| `[REFACTOR]` | Tái cấu trúc, không đổi logic   |

---

## 3. 📁 Cấu Trúc Thư Mục

Cấu trúc dự án Backend (huong-vi-ban-dia-api) theo chuẩn của team:

```text
├── src/
│   │
│   ├── common/                        # Dùng chung toàn app
│   │   ├── guards/
│   │   │   └── firebase-auth.guard.ts # Xác thực Firebase Token
│   │   ├── interceptors/
│   │   │   ├── transform.interceptor.ts
│   │   │   └── logging.interceptor.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   └── decorators/
│   │       └── current-user.decorator.ts
│   │
│   ├── configs/
│   │   ├── app.config.ts
│   │   └── firebase.config.ts         # Firebase Admin SDK setup
│   │
│   ├── shared/                        # DTOs, Interfaces dùng chung
│   │   ├── dto/
│   │   │   ├── pagination.dto.ts
│   │   │   └── response.dto.ts
│   │   └── interfaces/
│   │       ├── user.interface.ts
│   │       └── restaurant.interface.ts
│   │
│   ├── modules/
│   │   │
│   │   ├── users/                     # 3.4 — Quản lý người dùng
│   │   │   ├── dto/
│   │   │   │   ├── create-user.dto.ts
│   │   │   │   └── update-taste.dto.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   └── users.module.ts
│   │   │
│   │   ├── restaurants/               # Quản lý nhà hàng
│   │   │   ├── dto/
│   │   │   │   └── filter-restaurant.dto.ts
│   │   │   ├── restaurants.controller.ts
│   │   │   ├── restaurants.service.ts
│   │   │   └── restaurants.module.ts
│   │   │
│   │   ├── scheduler/                 # 3.1 — Tối ưu lịch trình
│   │   │   ├── dto/
│   │   │   │   ├── create-schedule.dto.ts
│   │   │   │   └── schedule-input.dto.ts
│   │   │   ├── algorithms/
│   │   │   │   ├── kmeans.ts          # K-Means Clustering
│   │   │   │   └── budget-splitter.ts # Chia ngân sách sáng/trưa/tối
│   │   │   ├── scheduler.controller.ts
│   │   │   ├── scheduler.service.ts
│   │   │   └── scheduler.module.ts
│   │   │
│   │   ├── engine/                    # 3.4 — Cosine Similarity & Scoring
│   │   │   ├── algorithms/
│   │   │   │   ├── cosine-similarity.ts
│   │   │   │   ├── group-aggregation.ts  # avg + least misery
│   │   │   │   └── scoring.ts            # Hệ thống chấm điểm
│   │   │   ├── engine.service.ts
│   │   │   └── engine.module.ts
│   │   │
│   │   ├── ai-services/               # 3.2, 3.3 — Kết nối Python/LLM
│   │   │   ├── dto/
│   │   │   │   ├── recognize-food.dto.ts
│   │   │   │   └── translate-menu.dto.ts
│   │   │   ├── ai-services.controller.ts
│   │   │   ├── ai-services.service.ts  # Gọi Python local server
│   │   │   └── ai-services.module.ts
│   │   │
│   │   ├── achievements/              # 3.5 — Thành tựu & phần thưởng
│   │   │   ├── dto/
│   │   │   │   └── update-progress.dto.ts
│   │   │   ├── achievements.controller.ts
│   │   │   ├── achievements.service.ts  # Achievement Checker
│   │   │   ├── progress-tracker.service.ts
│   │   │   └── achievements.module.ts
│   │   │
│   │   └── community/                 # 3.5 — Blog & bài đăng
│   │       ├── dto/
│   │       │   ├── create-post.dto.ts
│   │       │   └── filter-post.dto.ts
│   │       ├── community.controller.ts
│   │       ├── community.service.ts
│   │       └── community.module.ts
│   │
│   ├── providers/
│   │   ├── firebase.provider.ts       # Firebase Admin singleton
│   │   └── http.provider.ts           # Axios gọi Python service
│   │
│   ├── app.module.ts                  # Root module
│   └── main.ts
│
├── test/
│   ├── kmeans.spec.ts
│   ├── cosine.spec.ts
│   └── scoring.spec.ts
│
├── .env
├── .env.example
├── .npmrc                             # save-exact=true
├── nest-cli.json
└── package.json
```

---

## 4. ✍️ Quy Tắc Đặt Tên

| Loại                | Quy tắc          | Ví dụ                                |
| ------------------- | ----------------- | ------------------------------------ |
| **Controller**      | PascalCase        | `AuthController`, `UsersController`  |
| **Service**         | PascalCase        | `AuthService`, `UsersService`        |
| **DTO**             | PascalCase        | `CreateUserDto`, `UpdatePasswordDto` |
| **File thường**     | kebab-case        | `auth.controller.ts`, `users.service.ts` |
| **Biến & Hàm**      | camelCase         | `getUserById()`, `accessToken`       |
| **Hằng số**         | UPPER_SNAKE_CASE  | `MAX_RETRY`, `JWT_EXPIRES_IN`        |

---

## 5. 🧹 Quy Tắc Viết Code (NestJS)

- **Sử dụng DTO & Validation:** Mọi input từ API phải được validate qua DTO dùng `class-validator`. Không lấy trực tiếp từ `req.body` quá thô sơ.
- **Tiêm phụ thuộc (Dependency Injection):** Phải dùng `constructor` của Service/Controller để gọi service khác, không khởi tạo bằng `new`.
- **Mỗi hàm/service chỉ làm một việc** (Single Responsibility).
- **Tránh logic nằm bên trong Controller:** Controller chỉ dùng để nhận request và trả response, gọi các logic tại Service.

```typescript
// ✅ Đúng (Logic ở Service)
@Post('login')
async login(@Body() loginDto: LoginDto) {
  return this.authService.login(loginDto);
}

// ❌ Sai (Logic thẳng ở Controller)
@Post('login')
async login(@Body() body: any) {
  const user = await this.userRepository.findOne(...);
  // ... xử lý băm mật khẩu ...
  return token;
}
```

---

## 6. 🔒 Bảo Mật & Môi Trường

- **Không commit file `.env`** lên Git — thêm vào `.gitignore`.
- Dùng `@nestjs/config` (ConfigModule) để truy cập biến môi trường thay vì dùng thẳng `process.env` (tuỳ ý nhưng khuyến khích).
- Mọi chuỗi kết nối DB, JWT secret, cổng API đều phải load từ `.env`.
- Cập nhật `.env.example` mỗi khi thêm biến cấu hình mới.

---

## 7. ✅ Checklist Trước Khi Tạo PR

- [ ] Code chạy không báo lỗi build (`npm run start:dev` / `npm run build`)
- [ ] Không có file rác, `console.log`
- [ ] Đã test các Endpoints bằng Postman / Swagger
- [ ] Tên branch, commit đúng quy chuẩn
- [ ] Kéo code từ `develop` về không bị conflict
