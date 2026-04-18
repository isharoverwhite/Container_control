# Container Control

**Container Control** là giải pháp quản lý Docker toàn diện, đa nền tảng, cho phép bạn giám sát và điều khiển máy chủ Docker của mình từ mọi nơi thông qua giao diện Web (WebUI) hoặc ứng dụng di động (Mobile App).

Dự án được thiết kế với kiến trúc **Microservices** hiện đại, đảm bảo hiệu năng cao, khả năng mở rộng tốt và trải nghiệm người dùng mượt mà.

---

## 🚀 Tính Năng Chính

*   **Giám Sát Thời Gian Thực**: Theo dõi CPU, RAM, Disk Usage của hệ thống và từng Container trực quan.
*   **Quản Lý Container Toàn Diện**:
    *   Start / Stop / Restart / Kill / Remove containers.
    *   Xem **Logs** trực tiếp (Live Stream).
    *   **Terminal (Exec)**: Truy cập dòng lệnh của container ngay trên trình duyệt/điện thoại.
*   **Quản Lý Images**: Tìm kiếm trên Docker Hub, Pull image mới, Xóa image không dùng.
*   **Bảo Mật Cao**:
    *   Cơ chế xác thực bằng **Secret Key**.
    *   **Device Approval**: Kiểm soát thiết bị nào được phép kết nối (Whitelist/Blacklist).
    *   Hỗ trợ HTTPS tự ký (Self-signed SSL).
*   **Đa Nền Tảng**:
    *   **Server**: Node.js Microservices (Gateway, Auth, Containers, Images...).
    *   **Web UI**: Next.js 14, giao diện đẹp mắt, tối ưu trải nghiệm.
    *   **Mobile App**: Flutter (Android/iOS), điều khiển server trong mạng LAN.

---

## 🛠 Công Nghệ Sử Dụng

### Backend (Server)
*   **Node.js & Express**: Xây dựng Gateway và các Microservices.
*   **Dockerode**: Thư viện giao tiếp với Docker Engine API.
*   **Socket.IO**: Truyền tải dữ liệu thời gian thực (Logs, Stats, Terminal).
*   **Architecture**: Chia nhỏ thành các service độc lập (Gateway, Containers, Images, Volumes, Networks, System, Auth).

### Frontend (Web UI)
*   **Next.js**: Framework React mạnh mẽ cho Server-Side Rendering.
*   **Tailwind CSS**: Thiết kế giao diện hiện đại, responsive.
*   **xterm.js**: Giả lập terminal trên trình duyệt.

### Mobile App
*   **Flutter**: Xây dựng ứng dụng di động đa nền tảng hiệu năng cao.

---

## 📦 Cài Đặt Nhanh

Bạn có thể chạy toàn bộ hệ thống server (bao gồm WebUI) chỉ với 1 lệnh Docker:

```bash
docker run -p 3000:3000 -p 8080:8080 -v /var/run/docker.sock:/var/run/docker.sock ryzen30xx/container-control-server:latest
```

Sau đó truy cập: [http://localhost:8080](http://localhost:8080) và nhập Secret Key (xem trong terminal).

👉 *Xem hướng dẫn chi tiết tại [USER_GUIDE.md](./USER_GUIDE.md)*

👉 *Xem quá trình phát triển dự án tại [DEVELOPMENT_PROCESS.md](./DEVELOPMENT_PROCESS.md)*
