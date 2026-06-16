# lms

## Team DevChill

| STT | Tên                      | MSSV      | Task         |
| --- | ------------------------ | --------- | ------------ |
| 1   | Nguyễn Đức Tính (Leader) | 422210049 |              |
| 2   | Phạm Gia Khiêm           | 422210113 | Full Backend |
| 3   | Nguyễn Lê Thiên Phát     | 422210405 |              |
| 4   | Thái Đăng Quang          | 422210474 |              |
| 5   | Nguyễn Thanh Quang       | 422210363 |              |
| 6   | Lê Minh Khang            | 422210199 |              |

# Hướng Dẫn Cài Đặt Và Chạy Dự Án

## Cài Đặt

Clone source:

```bash
git clone https://github.com/KhiemPham16/lms.git && cd lms
```

Cài đặt dependencies:

```bash
cd client && npm i && cd ../server && npm i && cd ../
```

## Backend

### Cấu Hình Môi Trường

Tạo file `.env` tại thư mục gốc là server, file .env đã gửi vào nhóm

### Khởi Tạo Database

Generate Prisma Client:

```bash
npm run prisma:generate
```

Chạy migration:

```bash
npm run prisma:migrate
```

Chạy seed:

```bash
npm run prisma:seed
```

### Chạy Dự Án

Development:

```bash
npm run dev
```

Build:

### Swagger

Sau khi chạy thành công:

```txt
http://localhost:3500/api/docs
```

## Frontend

### Cấu Hình Môi Trường

Tạo file `.env` tại thư mục gốc là client, file .env đã gửi vào nhóm

### Chạy Dự Án

Development:

```bash
npm run dev
```

Sau khi chạy thành công:

```txt
http://localhost:5173
```

## Git Workflow

Tạo branch cá nhân từ `develop`:

```bash
git checkout develop
git pull origin develop

git checkout -b feat/chucnang-fe-tennguoilam
git checkout -b fix/chucnang-fe-tennguoilam
```

Ví dụ:

```bash
git checkout -b feat/home-fe-tinh
git checkout -b fix/login-fe-tinh
```

Không commit trực tiếp lên:

```txt
master
develop
```

Mọi thay đổi phải được merge thông qua Pull Request.
