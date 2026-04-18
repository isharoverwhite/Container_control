# Quá Trình Phát Triển Dự Án Container Control

## 1. Khởi Nguồn Ý Tưởng (The Origin Story)

Câu chuyện của tôi bắt đầu từ một nhu cầu rất thực tế: Tôi muốn quản lý các container Docker trên server cá nhân (VPS/Home Lab) ngay trên chiếc điện thoại của mình khi đang di chuyển.

Khi tìm kiếm trên thị trường (App Store/Play Store), tôi nhận thấy hầu hết các ứng dụng quản lý Docker từ xa đều hoạt động theo một cơ chế chung: **Yêu cầu kết nối trực tiếp thông qua SSH**.

Điều này nảy sinh 2 vấn đề lớn khiến tôi không hài lòng:
1.  **Rủi ro bảo mật**: Để sử dụng app, tôi buộc phải cung cấp thông tin đăng nhập SSH (Root Password hoặc Private Key) cho một ứng dụng của bên thứ ba. Nếu ứng dụng đó bị hack hoặc code không an toàn, toàn bộ server của tôi sẽ bị lộ.
2.  **Bất tiện khi xác thực**: Server của tôi được cấu hình bảo mật cao, chỉ cho phép đăng nhập bằng SSH Key (file .pem / .ppk) và tắt hoàn toàn Password Login. Tuy nhiên, đa số các ứng dụng quản lý Docker trên điện thoại lại hỗ trợ rất kém hoặc không thể import được các file PEM key phức tạp này, khiến tôi không thể kết nối được.

Từ sự bất tiện đó, tôi nảy ra ý tưởng: **Tại sao không viết một "Agent" riêng?**
Một server trung gian chạy ngay trên máy chủ Docker, giao tiếp trực tiếp với Docker Socket nội bộ, và chỉ mở ra một cổng API được bảo vệ bằng một **Secret Key** đơn giản nhưng mạnh mẽ. Giải pháp này sẽ loại bỏ hoàn toàn việc phải lộ thông tin SSH ra ngoài.

## 2. Giải Pháp & Kiến Trúc

Thay vì SSH, tôi chọn hướng đi **Client-Server Architecture**:
*   **Server (Agent)**: Chạy bằng Node.js, được đóng gói trong Docker Container. Nó mount trực tiếp `/var/run/docker.sock` của máy chủ nên có toàn quyền điều khiển Docker mà không cần quyền SSH.
*   **Xác thực**: Sử dụng cơ chế **Secret Key** (Bearer Token).
    *   Hệ thống tự sinh ra một chuỗi ngẫu nhiên khi khởi động.
    *   Người dùng chỉ cấp chuỗi này cho Mobile App/WebUI.
    *   Nếu lộ Key, chỉ cần restart container server là có Key mới.
    *   Nếu cần chặn ai đó, tôi có thể dùng tính năng "Device Approval" (Phê duyệt thiết bị) để chặn IP.
    *   **Ưu điểm**: Không bao giờ lộ Password Root hay SSH Key của hệ điều hành.

## 3. Hành Trình Phát Triển (Development Journey)

### Giai đoạn 1: Prototype (Monolithic)
Ban đầu, tôi viết toàn bộ logic trong một file `index.js` duy nhất.
*   Sử dụng thư viện `dockerode` để gọi Docker API.
*   Dựng một HTTP Server đơn giản để nhận lệnh Start/Stop/List Containers.
*   Thử nghiệm kết nối thành công từ Postman mà không cần SSH.

### Giai đoạn 2: Tách Dịch Vụ (Microservices Lite)
Khi tính năng nhiều lên (Logs, Images, System Info), file code trở nên cồng kềnh. Tôi quyết định chia nhỏ hệ thống thành các module (giả lập Microservices chạy trên các port khác nhau):
*   **Gateway (Port 3000)**: Cổng chính, chịu trách nhiệm xác thực và điều hướng.
*   **Container Service**: Chuyên xử lý lệnh start/stop.
*   **Auth Service**: Quản lý device approval và blacklist.
*   Kiến trúc này giúp tôi dễ dàng debug từng phần và mở rộng sau này.

### Giai đoạn 3: Phát Triển Client (Đa nền tảng)
Sau khi Backend ổn định, tôi xây dựng Frontend:
*   **Web Dashboard**: Tôi chọn **Next.js** để tận dụng Server-Side Rendering và khả năng tích hợp tốt với Node.js. Tôi thêm tính năng **xterm.js** để có thể gõ lệnh (Exec) vào container ngay trên trình duyệt - điều mà SSH Client trên điện thoại làm rất khó khăn.
*   **Mobile App**: Sử dụng **Flutter** để build một lần ra cả iOS và Android. App sử dụng Socket.IO để nhận log realtime, giúp cảm giác điều khiển mượt mà như đang ngồi trước màn hình máy tính.

### Giai đoạn 4: Tối Ưu & Docker Hóa
Để cộng đồng có thể sử dụng dễ dàng, tôi tập trung vào việc đóng gói:
*   Viết **Dockerfile Multi-stage** để giảm dung lượng image tải về.
*   Hỗ trợ **Multi-arch (x86 & ARM64)** để ứng dụng có thể chạy trên cả VPS mạnh mẽ lẫn các máy Raspberry Pi nhỏ gọn.
*   Tích hợp SSL tự ký để đảm bảo dữ liệu truyền đi (đặc biệt là Secret Key) luôn được mã hóa.

## 4. Kết Quả

Hiện tại, **Container Control** đã trở thành một giải pháp khép kín. Tôi có thể cài đặt nó lên bất kỳ server mới nào chỉ bằng **1 lệnh Docker Run**. Không cần cấu hình SSH, không cần copy file PEM, chỉ cần copy Secret Key và bắt đầu quản lý ngay lập tức.
