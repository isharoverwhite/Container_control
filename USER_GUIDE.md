# Hướng Dẫn Sử Dụng Container Control

Chào mừng bạn đến với **Container Control**! Đây là tài liệu hướng dẫn chi tiết cách cài đặt, khởi chạy và đăng nhập vào hệ thống quản lý Docker của bạn thông qua WebUI và ứng dụng di động.

---

## 1. Cài Đặt và Khởi Chạy

### Yêu cầu hệ thống
*   **Docker Desktop**: Đảm bảo Docker Desktop đang chạy trên máy tính của bạn.
*   **Node.js**: Phiên bản 18 trở lên (nếu chạy trực tiếp source code).

### Cách 1: Chạy bằng Docker (Khuyên dùng)
Đây là cách đơn giản nhất để chạy ứng dụng.

1.  **Build Image** (Chỉ cần làm lần đầu):
    ```bash
    # Tại thư mục gốc của dự án
    docker build -t container-control-server ./server
    ```

2.  **Chạy Container**:
    ```bash
    docker run -p 3000:3000 -p 8080:8080 -v /var/run/docker.sock:/var/run/docker.sock container-control-server
    ```
    *Lưu ý: `-v /var/run/docker.sock...` là bắt buộc để ứng dụng có thể điều khiển Docker của máy chủ.*

### Cách 2: Chạy Từ Source Code (Development)
Nếu bạn đang phát triển hoặc muốn chạy trực tiếp:

1.  Mở terminal tại thư mục `server`.
2.  Cài đặt thư viện (nếu chưa):
    ```bash
    npm install
    cd services/webui && npm install && cd ../..
    ```
3.  Khởi chạy chế độ Microservices:
    ```bash
    npm run dev
    ```

---

## 2. Cách Lấy Secret Key (Khóa Bí Mật)

Hệ thống bảo mật bằng **Secret Key**. Bạn cần khóa này để đăng nhập.

1.  Khi server khởi động, hãy nhìn vào màn hình **Terminal** (cửa sổ dòng lệnh).
2.  Tìm dòng chữ có biểu tượng chìa khóa 🔑:
    ```text
    Gateway: 🔑 SECRET KEY: EtxtnZLFRPXi
    ```
    *(Ví dụ khóa ở trên là `EtxtnZLFRPXi`. Khóa của bạn sẽ khác và thay đổi mỗi khi bạn reset server)*
3.  **Copy** chuỗi ký tự này.

---

## 3. Hướng Dẫn Đăng Nhập

### A. Đăng nhập trên WebUI (Trình duyệt)

1.  Mở trình duyệt web (Chrome, Safari, Edge...).
2.  Truy cập địa chỉ: [http://localhost:8080](http://localhost:8080).
3.  Màn hình đăng nhập sẽ hiện ra. Dán **Secret Key** bạn vừa copy vào ô trống.
4.  Nhấn **Access Dashboard**.
5.  Nếu thành công, bạn sẽ vào được giao diện quản lý Container.

> **Lỗi thường gặp:** "Invalid Secret Key"
> *   Kiểm tra lại xem bạn có copy thừa khoảng trắng không.
> *   Nếu bạn vừa reset server, hãy xóa cache trình duyệt hoặc thử tab ẩn danh để nhập khóa mới.

### B. Đăng nhập trên Mobile App (Flutter)

1.  Mở ứng dụng Container Control trên điện thoại.
2.  Nhập địa chỉ IP của máy chủ (Server IP):
    *   Nếu dùng máy ảo (Emulator): Nhập `10.0.2.2`.
    *   Nếu dùng điện thoại thật (chung Wifi): Nhập **IP LAN** của máy tính (ví dụ `192.168.1.5`).
    *   *Mẹo: Nhìn vào terminal khi server khởi động, nó sẽ liệt kê IP Local của bạn.*
3.  Nhập Port: **3000** (Lưu ý: App kết nối qua cổng API 3000, không phải 8080).
4.  Nhập **Secret Key** vào ô tương ứng.
5.  Nhấn **Connect**.

---

## 4. Các Tính Năng Chính

*   **Dashboard**: Xem tổng quan tài nguyên (CPU, RAM) và số lượng Container/Image.
*   **Containers**:
    *   Start/Stop/Restart: Nhấn vào menu hành động của từng container.
    *   Logs: Xem nhật ký hoạt động trực tiếp.
    *   Terminal (Exec): Truy cập dòng lệnh bên trong container.
*   **Images**: Quản lý, xóa hoặc pull image mới từ Docker Hub.
*   **Device Management** (Quản lý thiết bị):
    *   Mặc định, tính năng "Phê duyệt thiết bị" (Device Approval) đang **TẮT** để bạn dễ dàng kết nối lần đầu.
    *   Bạn có thể bật tính năng này trong phần Settings để kiểm soát ai được phép kết nối vào server.

---

## 5. Xử Lý Sự Cố

*   **Không kết nối được Docker**: Đảm bảo Docker Desktop đang chạy (icon cá voi trên thanh taskbar không bị xám).
*   **Quên Secret Key**: Tắt server và bật lại, key sẽ hiện ra trong terminal. Hoặc xem file `server/.env` nếu chưa reset.
