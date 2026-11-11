# PROMPT: XÂY DỰNG BÁO CÁO ĐỒ ÁN KỸ THUẬT

Tôi cần bạn đóng vai trò là một kỹ sư IoT có kinh nghiệm trong thiết kế hệ thống nhúng (Embedded Systems), hệ thống giám sát và điều khiển tự động. Hãy hỗ trợ tôi xây dựng một báo cáo đồ án kỹ thuật với đề tài:

# HỆ THỐNG PHÒNG CHỐNG CHÁY NỔ VÀ RÒ RỈ KHÍ GAS SỬ DỤNG ESP32-S3 VÀ NỀN TẢNG THINGSBOARD

Báo cáo cần có văn phong học thuật, chuyên nghiệp, nội dung chuyên sâu, lập luận logic và phù hợp với tiêu chuẩn trình bày báo cáo đồ án đại học thuộc lĩnh vực Công nghệ thông tin, Điện tử - Viễn thông hoặc IoT.

---

# 1. TỔNG QUAN ĐỀ TÀI

## 1.1. Giới thiệu đề tài

Xây dựng một hệ thống giám sát, phát hiện và xử lý các tình huống nguy hiểm liên quan đến rò rỉ khí gas và cháy nổ trong môi trường sinh hoạt hoặc khu vực sử dụng khí gas.

Hệ thống sử dụng ESP32-S3 làm bộ xử lý trung tâm, có nhiệm vụ thu thập dữ liệu từ các cảm biến, xử lý các thông số môi trường, xác định trạng thái nguy hiểm và điều khiển các thiết bị chấp hành.

Hệ thống được thiết kế với hai chế độ hoạt động chính:

- **Online:** ESP32-S3 kết nối với nền tảng ThingsBoard thông qua giao thức MQTT để trao đổi dữ liệu với máy chủ. Backend tiếp nhận dữ liệu, xử lý logic nghiệp vụ, phối hợp với AI Analysis và cung cấp thông tin cho Frontend để giám sát, cấu hình và điều khiển thiết bị từ xa.
- **Offline:** Khi mất kết nối Internet, ThingsBoard hoặc Backend, ESP32-S3 tự động chuyển sang chế độ xử lý cục bộ. Việc thu thập dữ liệu, phát hiện nguy hiểm và điều khiển các thiết bị bảo vệ vẫn được duy trì theo các quy tắc an toàn đã được lập trình sẵn.

Mục tiêu quan trọng nhất là đảm bảo hệ thống vẫn có khả năng phát hiện và xử lý các tình huống nguy hiểm ngay cả khi không có kết nối với máy chủ.

## 1.2. Mục tiêu đề tài

- Xây dựng hệ thống giám sát khí gas, nhiệt độ và phát hiện ngọn lửa.
- Phát hiện sớm các dấu hiệu rò rỉ khí gas và cháy.
- Tự động điều khiển các thiết bị chấp hành khi phát hiện nguy hiểm.
- Xây dựng hệ thống giám sát từ xa thông qua nền tảng ThingsBoard.
- Xây dựng Backend và Frontend để quản lý, hiển thị và điều khiển thiết bị.
- Tích hợp AI Analysis nhằm hỗ trợ phân tích dữ liệu, nhận diện bất thường và đưa ra cảnh báo.
- Đảm bảo khả năng hoạt động độc lập của ESP32-S3 khi mất kết nối mạng.

---

# 2. PHẦN CỨNG SỬ DỤNG

## 2.1. Bộ xử lý trung tâm

**ESP32-S3**

Là vi điều khiển trung tâm của toàn bộ hệ thống, chịu trách nhiệm:

- Thu thập dữ liệu từ các cảm biến.
- Xử lý dữ liệu và xác định trạng thái môi trường.
- Thực hiện các thuật toán điều khiển thiết bị.
- Kết nối Wi-Fi và giao tiếp với ThingsBoard thông qua MQTT.
- Tiếp nhận lệnh điều khiển từ Backend.
- Quản lý trạng thái Online/Offline.
- Duy trì các chức năng bảo vệ cục bộ khi mất kết nối máy chủ.

## 2.2. Các cảm biến

### 2.2.1. MQ-2 – Cảm biến khí gas và khói

MQ-2 được sử dụng để phát hiện khí gas và khói trong môi trường.

Hệ thống sử dụng chân AO (Analog Output) của cảm biến để đưa tín hiệu analog về ESP32-S3.

ESP32-S3 đọc tín hiệu thông qua bộ chuyển đổi ADC (Analog-to-Digital Converter) và sử dụng giá trị ADC này làm chỉ số đánh giá mức độ khí trong môi trường.

Đặc điểm xử lý:

- Sử dụng giá trị ADC đọc từ chân AO để đánh giá mức khí.
- Ngưỡng cảnh báo được thiết lập thủ công và có thể thay đổi tùy theo nhu cầu sử dụng.
- Giá trị mặc định được sử dụng trong thiết kế ban đầu là 100.
- Khi giá trị ADC vượt quá ngưỡng đã cấu hình, hệ thống xác định môi trường có dấu hiệu xuất hiện khí gas hoặc khói vượt mức cho phép.
- Ngưỡng cấu hình có thể được thay đổi thông qua giao diện Frontend và được Backend chuyển xuống ESP32-S3.

Lưu ý: Giá trị 100 là ngưỡng ADC cấu hình, không phải nồng độ khí thực tế tính theo ppm. Báo cáo cần phân biệt rõ giá trị tín hiệu AO/ADC với nồng độ khí đã được hiệu chuẩn.

### 2.2.2. DS18B20 – Cảm biến nhiệt độ

DS18B20 được sử dụng để đo nhiệt độ môi trường.

Cảm biến giao tiếp với ESP32-S3 thông qua giao thức One-Wire.

Dữ liệu nhiệt độ được sử dụng để:

- Giám sát sự thay đổi nhiệt độ môi trường.
- Phát hiện tình trạng nhiệt độ tăng cao bất thường.
- Kết hợp với dữ liệu từ Flame Detector để xác định mức độ nguy hiểm.
- Làm cơ sở kích hoạt các cấp độ cảnh báo và điều khiển thiết bị.

DS18B20 chỉ có chức năng đo nhiệt độ, không có chức năng phát hiện ngọn lửa.

### 2.2.3. Flame Detector – Cảm biến phát hiện ngọn lửa

Flame Detector được sử dụng để phát hiện sự xuất hiện của ngọn lửa trong khu vực giám sát.

Cảm biến cung cấp tín hiệu nhận biết trạng thái có hoặc không có ngọn lửa để ESP32-S3 xử lý.

Dữ liệu từ Flame Detector được kết hợp với dữ liệu nhiệt độ của DS18B20 nhằm:

- Xác định tình trạng cháy.
- Phân biệt tình trạng nhiệt độ tăng cao thông thường với tình huống có dấu hiệu cháy.
- Kích hoạt các cấp độ cảnh báo.
- Điều khiển các thiết bị chấp hành tương ứng.

## 2.3. Các thiết bị chấp hành

Hệ thống sử dụng các thiết bị sau:

- **Quạt thông gió 5V:** Hỗ trợ thông gió khi phát hiện mức khí vượt ngưỡng cấu hình và không có điều kiện cháy yêu cầu tắt quạt.
- **Van điện từ 5V:** Điều khiển đóng/ngắt đường cấp gas. Trong thiết kế an toàn, ưu tiên sử dụng van thường đóng (Normally Closed - NC), có khả năng tự động đóng khi mất nguồn.
- **Còi cảnh báo 3V:** Phát tín hiệu âm thanh khi hệ thống phát hiện tình trạng nguy hiểm.

Các thiết bị chấp hành được điều khiển thông qua mạch driver hoặc mạch đóng cắt phù hợp. Không cấp nguồn trực tiếp cho các tải công suất từ chân GPIO của ESP32-S3.

---

# 3. NGUYÊN LÝ XỬ LÝ DỮ LIỆU VÀ ĐIỀU KHIỂN

ESP32-S3 liên tục thu thập dữ liệu từ MQ-2, DS18B20 và Flame Detector.

Sau khi thu thập, bộ xử lý thực hiện phân tích dữ liệu và xác định trạng thái môi trường dựa trên các ngưỡng cấu hình và điều kiện phát hiện ngọn lửa.

## 3.1. Các điều kiện xử lý

Hệ thống sử dụng các điều kiện cơ bản sau:

**Điều kiện 1: Phát hiện mức khí vượt ngưỡng**

Khi giá trị ADC đọc từ chân AO của MQ-2 lớn hơn ngưỡng khí gas được cấu hình thủ công:

- Xác định mức khí vượt ngưỡng cảnh báo.
- Bật quạt thông gió nếu không có điều kiện cháy yêu cầu tắt quạt.
- Gửi thông tin cảnh báo lên hệ thống Online nếu có kết nối.

Ngưỡng ban đầu là 100 và có thể được người dùng thay đổi.

**Điều kiện 2: Phát hiện cháy cấp 1**

Khi nhiệt độ đạt hoặc vượt 50°C và Flame Detector phát hiện ngọn lửa:

- Kích hoạt còi cảnh báo.
- Tắt quạt thông gió.
- Gửi trạng thái cảnh báo lên hệ thống nếu đang Online.

**Điều kiện 3: Phát hiện cháy cấp 2**

Khi nhiệt độ đạt hoặc vượt 70°C và Flame Detector phát hiện ngọn lửa:

- Kích hoạt cảnh báo ở mức nguy hiểm cao.
- Đóng van cấp gas.
- Tắt quạt thông gió.
- Duy trì cảnh báo cho đến khi tình trạng nguy hiểm được xử lý theo cơ chế an toàn.

## 3.2. Bảng quy tắc điều khiển

| Điều kiện | Quạt thông gió | Còi cảnh báo | Van gas |
|---|---|---|---|
| MQ-2 ADC > ngưỡng cấu hình | Bật | Không bắt buộc | Giữ trạng thái an toàn |
| Nhiệt độ >= 50°C và phát hiện lửa | Tắt | Cảnh báo | Giữ trạng thái an toàn |
| Nhiệt độ >= 70°C và phát hiện lửa | Tắt | Cảnh báo nguy hiểm | Đóng |

Trong trường hợp nhiều điều kiện xảy ra đồng thời, hệ thống phải áp dụng mức cảnh báo nguy hiểm cao nhất.

Điều kiện nhiệt độ >= 70°C và phát hiện lửa có mức ưu tiên cao hơn điều kiện nhiệt độ >= 50°C và phát hiện lửa.

## 3.3. Cơ chế cảnh báo bằng còi

Còi cảnh báo được sử dụng để thông báo cho người dùng khi phát hiện các tình huống nguy hiểm.

Đối với chế độ Offline, còi hoạt động theo cơ chế cảnh báo gián đoạn (Intermittent Alarm):

- Còi bật trong một khoảng thời gian xác định.
- Sau đó còi tắt trong một khoảng thời gian xác định.
- Chu kỳ bật/tắt được lặp lại khi điều kiện cảnh báo vẫn còn tồn tại.
- Khi điều kiện nguy hiểm không còn hoặc hệ thống chuyển sang trạng thái khác, bộ điều khiển cập nhật trạng thái còi tương ứng.

Thời gian bật và tắt còi cần được thiết kế thành các tham số có thể cấu hình trong chương trình ESP32-S3.

Việc điều khiển còi nên sử dụng cơ chế không chặn (non-blocking), chẳng hạn sử dụng hàm millis() thay vì delay(), nhằm đảm bảo ESP32-S3 vẫn có thể đọc cảm biến và xử lý các tác vụ khác trong lúc còi đang hoạt động.

---

# 4. KIẾN TRÚC HỆ THỐNG KHI ONLINE

Kiến trúc tổng thể:

**ESP32-S3 <-> ThingsBoard Cloud <-> Backend <-> Frontend**

Ngoài ra, hệ thống có thành phần AI Analysis phối hợp với Backend để phân tích dữ liệu.

## 4.1. ESP32-S3 và ThingsBoard

ESP32-S3 kết nối với ThingsBoard Cloud thông qua giao thức MQTT.

Nhiệm vụ:

- Gửi dữ liệu cảm biến lên máy chủ.
- Gửi trạng thái hoạt động của các thiết bị chấp hành.
- Nhận các lệnh điều khiển từ máy chủ.
- Nhận các thông số cấu hình mới từ hệ thống.
- Duy trì kết nối và theo dõi trạng thái Online/Offline.

ThingsBoard đóng vai trò nền tảng IoT Cloud, chịu trách nhiệm tiếp nhận, lưu trữ và quản lý dữ liệu thiết bị.

Các dữ liệu được lưu trữ bao gồm:

- Giá trị cảm biến MQ-2.
- Nhiệt độ từ DS18B20.
- Trạng thái phát hiện ngọn lửa.
- Trạng thái quạt, còi và van điện từ.
- Lịch sử dữ liệu telemetry.
- Các sự kiện và trạng thái cảnh báo.
- Các thông số cấu hình thiết bị.

## 4.2. ThingsBoard và Backend

Backend đóng vai trò trung gian xử lý nghiệp vụ giữa nền tảng ThingsBoard và Frontend.

Các nhiệm vụ chính:

- Tiếp nhận dữ liệu từ ThingsBoard.
- Xử lý và quản lý dữ liệu cảm biến.
- Quản lý trạng thái thiết bị.
- Quản lý lịch sử cảnh báo và hoạt động.
- Tiếp nhận các yêu cầu điều khiển từ Frontend.
- Kiểm tra tính hợp lệ của yêu cầu.
- Chuyển tiếp các lệnh điều khiển đến ESP32-S3 thông qua ThingsBoard và MQTT.
- Phối hợp với AI Analysis để phân tích dữ liệu và hỗ trợ ra quyết định.

Backend cần đảm bảo dữ liệu được xử lý nhất quán và các lệnh điều khiển không xung đột với cơ chế bảo vệ an toàn cục bộ trên ESP32-S3.

## 4.3. Backend và AI Analysis

Hệ thống tích hợp một thành phần AI Analysis nhằm hỗ trợ phân tích dữ liệu và lịch sử hoạt động.

Dữ liệu được cung cấp cho AI có thể bao gồm:

- Lịch sử nhiệt độ.
- Lịch sử giá trị ADC từ MQ-2.
- Trạng thái phát hiện ngọn lửa.
- Lịch sử cảnh báo.
- Trạng thái hoạt động của thiết bị.
- Các sự kiện bất thường.

AI Analysis có nhiệm vụ:

- Phân tích xu hướng thay đổi của dữ liệu cảm biến.
- Nhận diện các dấu hiệu bất thường.
- Hỗ trợ đánh giá tình trạng môi trường.
- Tổng hợp lịch sử sự kiện.
- Đưa ra nhận định và đề xuất phương án xử lý.
- Hỗ trợ người dùng hiểu rõ hơn về trạng thái hoạt động của hệ thống.

AI chỉ đóng vai trò hỗ trợ phân tích và ra quyết định. Các chức năng bảo vệ an toàn trực tiếp như phát hiện cháy, đóng van gas và tắt quạt phải được duy trì độc lập trên ESP32-S3.

## 4.4. Frontend

Frontend cung cấp giao diện trực quan cho người dùng để giám sát và điều khiển hệ thống.

Các chức năng chính:

**Giám sát dữ liệu:**
- Hiển thị giá trị ADC từ MQ-2.
- Hiển thị nhiệt độ từ DS18B20.
- Hiển thị trạng thái Flame Detector.
- Hiển thị trạng thái kết nối của ESP32-S3.
- Hiển thị trạng thái hoạt động của quạt, còi và van điện từ.

**Quản lý cảnh báo:**
- Hiển thị cảnh báo khí gas vượt ngưỡng.
- Hiển thị cảnh báo nhiệt độ cao.
- Hiển thị cảnh báo phát hiện ngọn lửa.
- Hiển thị lịch sử các sự kiện nguy hiểm.

**Điều khiển thủ công:**
- Cho phép bật/tắt quạt thông gió.
- Cho phép điều khiển van điện từ theo quyền và điều kiện an toàn.
- Cho phép kích hoạt hoặc kiểm tra còi cảnh báo nếu thiết kế cho phép.
- Cho phép cấu hình ngưỡng ADC của MQ-2.
- Cho phép cấu hình các tham số hoạt động phù hợp.

**Quản lý và cấu hình:**
- Quản lý thông tin thiết bị.
- Cấu hình các ngưỡng cảnh báo.
- Theo dõi lịch sử dữ liệu.
- Xem kết quả phân tích từ AI Analysis.

Mọi yêu cầu điều khiển từ Frontend phải được gửi đến Backend để kiểm tra và xử lý trước khi chuyển tiếp xuống ESP32-S3.

---

# 5. CƠ CHẾ HOẠT ĐỘNG ONLINE VÀ OFFLINE

## 5.1. Chế độ Online

Khi ESP32-S3 kết nối thành công với ThingsBoard Cloud thông qua MQTT, hệ thống hoạt động theo quy trình:

1. ESP32-S3 liên tục thu thập dữ liệu từ các cảm biến.
2. ESP32-S3 xử lý sơ bộ và gửi dữ liệu lên ThingsBoard.
3. ThingsBoard tiếp nhận và lưu trữ dữ liệu telemetry, trạng thái thiết bị và lịch sử sự kiện.
4. Backend tiếp nhận dữ liệu từ ThingsBoard.
5. Backend thực hiện xử lý dữ liệu và phối hợp với AI Analysis khi cần thiết.
6. Frontend nhận dữ liệu từ Backend và hiển thị cho người dùng.
7. Người dùng theo dõi thông số, lịch sử và trạng thái hệ thống.
8. Người dùng có thể gửi yêu cầu điều khiển thủ công hoặc thay đổi cấu hình thông qua Frontend.
9. Backend tiếp nhận yêu cầu, kiểm tra tính hợp lệ và chuyển tiếp lệnh xuống ThingsBoard.
10. ThingsBoard gửi lệnh đến ESP32-S3 thông qua MQTT.
11. ESP32-S3 tiếp nhận và kiểm tra lệnh.
12. Nếu lệnh hợp lệ và không xung đột với các điều kiện an toàn cục bộ, ESP32-S3 thực hiện điều khiển thiết bị chấp hành.
13. ESP32-S3 cập nhật trạng thái thiết bị lên hệ thống.

Luồng tổng quát:

ESP32-S3 -> MQTT -> ThingsBoard Cloud -> Backend -> Frontend.

Chiều điều khiển:

Frontend -> Backend -> ThingsBoard -> MQTT -> ESP32-S3 -> Thiết bị chấp hành.

## 5.2. Chế độ Offline

Khi ESP32-S3 mất kết nối với ThingsBoard hoặc Backend, hệ thống tự động chuyển sang chế độ xử lý cục bộ.

Trong chế độ này:

1. ESP32-S3 phát hiện trạng thái mất kết nối.
2. Chuyển sang chế độ Offline.
3. Tiếp tục thu thập dữ liệu từ MQ-2, DS18B20 và Flame Detector.
4. Sử dụng các ngưỡng và tham số cấu hình đã được lưu trên thiết bị.
5. Tự xử lý dữ liệu dựa trên các quy tắc điều khiển được lập trình sẵn.
6. Điều khiển quạt thông gió, còi cảnh báo và van điện từ mà không phụ thuộc vào máy chủ.
7. Còi cảnh báo hoạt động theo chu kỳ bật/tắt khi có tình huống nguy hiểm.
8. Tiếp tục duy trì khả năng phát hiện và xử lý sự cố cho đến khi kết nối được khôi phục.

### 5.2.1. Các quy tắc xử lý khi Offline

| Điều kiện | Hành động |
|---|---|
| MQ-2 ADC > ngưỡng cấu hình | Bật quạt thông gió nếu không có điều kiện cháy |
| Nhiệt độ >= 50°C và phát hiện lửa | Tắt quạt, kích hoạt còi theo chu kỳ |
| Nhiệt độ >= 70°C và phát hiện lửa | Tắt quạt, đóng van gas, duy trì cảnh báo theo chu kỳ |

Các quy tắc này phải được xử lý trực tiếp bởi ESP32-S3.

### 5.2.2. Cơ chế cảnh báo còi khi Offline

Khi phát hiện tình huống nguy hiểm trong chế độ Offline, còi cảnh báo hoạt động theo cơ chế bật/tắt luân phiên.

Ví dụ:

- Giai đoạn 1: Còi bật.
- Giai đoạn 2: Còi tắt.
- Giai đoạn 3: Còi bật trở lại.
- Tiếp tục lặp lại cho đến khi trạng thái cảnh báo được xử lý.

Thời gian bật và tắt được quản lý bằng các tham số cấu hình trong chương trình.

Cơ chế này giúp hệ thống phát tín hiệu cảnh báo rõ ràng nhưng không cần duy trì trạng thái còi liên tục.

## 5.3. Khôi phục kết nối và đồng bộ dữ liệu

Khi kết nối Internet và ThingsBoard được khôi phục:

- ESP32-S3 xác lập lại kết nối MQTT.
- Gửi trạng thái hiện tại của thiết bị lên ThingsBoard.
- Đồng bộ các thông số cảm biến.
- Cập nhật trạng thái quạt, còi và van điện từ.
- Đồng bộ các dữ liệu lịch sử đã được lưu cục bộ nếu hệ thống có triển khai bộ nhớ đệm.
- Tiếp tục nhận các cấu hình và lệnh điều khiển hợp lệ từ Backend.

Quá trình khôi phục kết nối không được làm thay đổi trạng thái an toàn của hệ thống hoặc khiến thiết bị chấp hành hoạt động ngoài ý muốn.

---

# 6. NGUYÊN TẮC ƯU TIÊN AN TOÀN

Đây là một trong những nguyên tắc thiết kế quan trọng nhất của hệ thống.

ESP32-S3 phải luôn giữ quyền thực thi các cơ chế bảo vệ an toàn cục bộ, bất kể hệ thống đang hoạt động Online hay Offline.

Các nguyên tắc:

1. Chức năng phát hiện và xử lý sự cố cơ bản không được phụ thuộc vào Backend, Frontend, ThingsBoard hoặc AI.
2. Các điều kiện bảo vệ an toàn cục bộ luôn có mức ưu tiên cao hơn các lệnh điều khiển thủ công.
3. Khi phát hiện cháy theo điều kiện đã thiết kế, quạt thông gió phải được tắt.
4. Khi phát hiện cháy ở mức nguy hiểm cao, van cấp gas phải được đóng.
5. Không cho phép lệnh điều khiển từ xa vô hiệu hóa các cơ chế bảo vệ quan trọng.
6. Khi mất điện, van cấp gas cần có khả năng tự động đóng nếu sử dụng loại van thường đóng (NC).
7. Khi kết nối được khôi phục, các lệnh cũ hoặc lệnh không còn phù hợp với trạng thái hiện tại phải được kiểm tra trước khi thực thi.

Cần thiết kế thuật toán quản lý trạng thái để tránh xung đột giữa chế độ tự động và chế độ điều khiển thủ công.

---

# 7. PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG

Hãy xây dựng và phân tích các nội dung sau:

## 7.1. Sơ đồ khối tổng thể

Thể hiện mối liên hệ giữa:

- Các cảm biến.
- ESP32-S3.
- ThingsBoard Cloud.
- Backend.
- AI Analysis.
- Frontend.
- Các thiết bị chấp hành.

Sơ đồ cần thể hiện rõ luồng dữ liệu cảm biến và luồng lệnh điều khiển.

## 7.2. Sơ đồ kết nối phần cứng

Phân tích cách kết nối giữa ESP32-S3 với từng cảm biến và thiết bị chấp hành.

Làm rõ:

- Chân ADC dành cho MQ-2.
- Chân giao tiếp One-Wire của DS18B20.
- Chân tín hiệu của Flame Detector.
- Các chân GPIO điều khiển quạt, còi và van.
- Mạch driver và nguồn cấp cho thiết bị.

Không tự ý xác định chân GPIO cụ thể nếu chưa có thông tin về sơ đồ đấu nối thực tế.

## 7.3. Thiết kế luồng dữ liệu

Phân tích luồng dữ liệu theo hai chiều:

**Chiều giám sát:**

Cảm biến -> ESP32-S3 -> MQTT -> ThingsBoard -> Backend -> Frontend.

**Chiều điều khiển:**

Frontend -> Backend -> ThingsBoard -> MQTT -> ESP32-S3 -> Thiết bị chấp hành.

Ngoài ra, cần mô tả luồng xử lý cục bộ khi Offline.

## 7.4. Thiết kế thuật toán

Phân tích và đề xuất:

- Thuật toán thu thập dữ liệu cảm biến.
- Thuật toán đọc và xử lý ADC từ MQ-2.
- Thuật toán đo nhiệt độ từ DS18B20.
- Thuật toán phát hiện ngọn lửa.
- Thuật toán xác định các cấp độ cảnh báo.
- Thuật toán điều khiển quạt, còi và van điện từ.
- Thuật toán cảnh báo còi theo chu kỳ.
- Thuật toán chuyển đổi Online/Offline.
- Thuật toán đồng bộ dữ liệu khi khôi phục kết nối.
- Thuật toán xử lý xung đột giữa lệnh điều khiển thủ công và cơ chế bảo vệ tự động.

---

# 8. TRIỂN KHAI HỆ THỐNG

Báo cáo cần trình bày quá trình triển khai các thành phần:

## 8.1. Triển khai phần cứng

- Kết nối cảm biến với ESP32-S3.
- Kết nối các thiết bị chấp hành.
- Thiết kế mạch điều khiển.
- Thiết kế nguồn cấp phù hợp.
- Kiểm tra khả năng hoạt động của từng linh kiện.

## 8.2. Lập trình ESP32-S3

- Khởi tạo các cảm biến.
- Thu thập và xử lý dữ liệu.
- Xây dựng thuật toán điều khiển tự động.
- Xây dựng cơ chế cảnh báo.
- Xây dựng kết nối Wi-Fi và MQTT.
- Xử lý dữ liệu gửi và nhận.
- Quản lý trạng thái Online/Offline.
- Lưu cấu hình và duy trì khả năng hoạt động độc lập.

## 8.3. Cấu hình ThingsBoard

- Tạo thiết bị trên ThingsBoard.
- Cấu hình thông tin xác thực MQTT.
- Tiếp nhận telemetry.
- Quản lý trạng thái thiết bị.
- Cấu hình RPC để gửi lệnh điều khiển xuống ESP32-S3.
- Quản lý các thuộc tính và thông số cấu hình.
- Xây dựng dashboard giám sát nếu cần thiết.

## 8.4. Xây dựng Backend

- Kết nối và trao đổi dữ liệu với ThingsBoard.
- Quản lý dữ liệu cảm biến.
- Quản lý thiết bị.
- Xử lý các yêu cầu từ Frontend.
- Chuyển tiếp lệnh điều khiển.
- Tích hợp AI Analysis.
- Quản lý lịch sử hoạt động và cảnh báo.

## 8.5. Xây dựng Frontend

- Giao diện giám sát.
- Giao diện hiển thị dữ liệu thời gian thực.
- Giao diện cảnh báo.
- Giao diện điều khiển thủ công.
- Giao diện cấu hình ngưỡng.
- Giao diện lịch sử dữ liệu.
- Giao diện hiển thị kết quả AI Analysis.

## 8.6. Tích hợp AI Analysis

- Kết nối Backend với module AI.
- Cung cấp dữ liệu cần thiết.
- Phân tích dữ liệu cảm biến.
- Phân tích lịch sử hoạt động.
- Nhận diện các dấu hiệu bất thường.
- Trả kết quả phân tích về Backend để hiển thị trên Frontend.

---

# 9. KIỂM THỬ VÀ ĐÁNH GIÁ

Xây dựng các kịch bản kiểm thử:

1. Kiểm thử cảm biến MQ-2.
2. Kiểm thử cảm biến DS18B20.
3. Kiểm thử Flame Detector.
4. Kiểm thử điều khiển quạt.
5. Kiểm thử điều khiển còi theo chu kỳ.
6. Kiểm thử điều khiển van điện từ.
7. Kiểm thử cảnh báo khí gas vượt ngưỡng.
8. Kiểm thử cảnh báo nhiệt độ >= 50°C kết hợp phát hiện lửa.
9. Kiểm thử cảnh báo nhiệt độ >= 70°C kết hợp phát hiện lửa.
10. Kiểm thử hệ thống khi hoạt động Online.
11. Kiểm thử hệ thống khi mất kết nối Internet.
12. Kiểm thử khả năng chuyển đổi Online/Offline.
13. Kiểm thử khôi phục kết nối và đồng bộ dữ liệu.
14. Kiểm thử xung đột giữa điều khiển thủ công và điều khiển tự động.

Đánh giá các tiêu chí:

- Độ chính xác của cảm biến.
- Thời gian phản hồi.
- Độ ổn định của kết nối MQTT.
- Khả năng xử lý cục bộ.
- Khả năng duy trì hoạt động khi mất kết nối.
- Độ tin cậy của cơ chế cảnh báo.
- Tính nhất quán của dữ liệu giữa các thành phần.

Không tự tạo ra số liệu thực nghiệm. Nếu chưa có kết quả kiểm thử thực tế, hãy trình bày dưới dạng phương pháp kiểm thử và bảng kết quả chờ bổ sung.

---

# 10. CẤU TRÚC BÁO CÁO

Hãy tổ chức báo cáo thành 6 chương chính:

**CHƯƠNG 1: TỔNG QUAN ĐỀ TÀI**
- 1.1. Đặt vấn đề.
- 1.2. Lý do lựa chọn đề tài.
- 1.3. Mục tiêu nghiên cứu.
- 1.4. Phạm vi nghiên cứu.
- 1.5. Phương pháp thực hiện.
- 1.6. Bố cục báo cáo.

**CHƯƠNG 2: CƠ SỞ LÝ THUYẾT VÀ CÔNG NGHỆ SỬ DỤNG**
- 2.1. Tổng quan về hệ thống IoT.
- 2.2. Vi điều khiển ESP32-S3.
- 2.3. Cảm biến MQ-2.
- 2.4. Cảm biến nhiệt độ DS18B20.
- 2.5. Cảm biến phát hiện ngọn lửa Flame Detector.
- 2.6. Các thiết bị chấp hành.
- 2.7. Giao thức MQTT.
- 2.8. Nền tảng ThingsBoard.
- 2.9. Kiến trúc Backend và Frontend.
- 2.10. Ứng dụng AI trong phân tích dữ liệu IoT.

**CHƯƠNG 3: PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG**
- 3.1. Phân tích yêu cầu hệ thống.
- 3.2. Yêu cầu chức năng.
- 3.3. Yêu cầu phi chức năng.
- 3.4. Sơ đồ khối tổng thể.
- 3.5. Thiết kế phần cứng.
- 3.6. Thiết kế kiến trúc phần mềm.
- 3.7. Thiết kế cơ chế Online/Offline.
- 3.8. Thiết kế thuật toán điều khiển.
- 3.9. Thiết kế cơ chế cảnh báo.
- 3.10. Thiết kế cơ chế bảo vệ an toàn.

**CHƯƠNG 4: TRIỂN KHAI HỆ THỐNG**
- 4.1. Triển khai phần cứng.
- 4.2. Lập trình ESP32-S3.
- 4.3. Cấu hình ThingsBoard.
- 4.4. Xây dựng Backend.
- 4.5. Xây dựng Frontend.
- 4.6. Tích hợp AI Analysis.
- 4.7. Tích hợp các thành phần.

**CHƯƠNG 5: KIỂM THỬ VÀ ĐÁNH GIÁ**
- 5.1. Môi trường kiểm thử.
- 5.2. Kiểm thử phần cứng.
- 5.3. Kiểm thử thuật toán.
- 5.4. Kiểm thử Online.
- 5.5. Kiểm thử Offline.
- 5.6. Kiểm thử các tình huống nguy hiểm.
- 5.7. Đánh giá kết quả.

**CHƯƠNG 6: KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN**
- 6.1. Kết quả đạt được.
- 6.2. Những hạn chế.
- 6.3. Hướng phát triển.

---

# 11. YÊU CẦU VỀ VĂN PHONG VÀ CHẤT LƯỢNG BÁO CÁO

Đây là những yêu cầu bắt buộc:

1. Sử dụng văn phong học thuật, nghiêm túc và chuyên nghiệp, phù hợp với báo cáo đồ án đại học.
2. Viết bằng tiếng Việt, sử dụng thuật ngữ kỹ thuật chính xác.
3. Không viết quá sơ sài dưới dạng danh sách gạch đầu dòng. Cần phát triển thành các đoạn văn có nội dung, giải thích và lập luận.
4. Trình bày theo cấu trúc phân cấp rõ ràng, có tiêu đề và đánh số mục nhất quán.
5. Phân tích nguyên lý hoạt động của từng thành phần và mối quan hệ giữa chúng.
6. Có bảng biểu để tổng hợp thông số, chức năng và điều kiện hoạt động khi cần thiết.
7. Có sơ đồ khối, sơ đồ luồng dữ liệu và lưu đồ thuật toán khi phù hợp.
8. Không tự ý bịa đặt thông số kỹ thuật, kết quả thực nghiệm hoặc công nghệ chưa được cung cấp.
9. Với thông tin chưa xác định, cần ghi rõ giả định hoặc đánh dấu cần bổ sung.
10. Sử dụng tài liệu tham khảo đáng tin cậy, ưu tiên datasheet của nhà sản xuất và tài liệu chính thức từ Espressif, ThingsBoard.
11. Đảm bảo tính nhất quán giữa phần cơ sở lý thuyết, thiết kế, triển khai và kiểm thử.
12. Không mô tả AI là thành phần trực tiếp quyết định các thao tác bảo vệ an toàn quan trọng.
13. Không nhầm lẫn giữa giá trị ADC của MQ-2 và nồng độ khí thực tế.
14. Không nhầm lẫn giữa chức năng đo nhiệt độ của DS18B20 và chức năng phát hiện ngọn lửa của Flame Detector.

---

# 12. QUY TRÌNH LÀM VIỆC VỚI TÔI

Không viết toàn bộ báo cáo ngay trong một lần.

Hãy thực hiện theo quy trình sau:

**Bước 1: Phân tích đề tài**

Đọc toàn bộ nội dung mô tả, xác định mục tiêu, phạm vi và kiến trúc hệ thống.

**Bước 2: Xác định thông tin còn thiếu**

Liệt kê những thông tin cần tôi cung cấp thêm, chẳng hạn:
- Phiên bản và sơ đồ kết nối phần cứng thực tế.
- Cách thức triển khai Backend và Frontend.
- Cơ chế giao tiếp cụ thể với ThingsBoard.
- Phương thức tích hợp AI Analysis.
- Các thông số kỹ thuật chưa được xác định.

Không tự ý giả định các thông tin này là sự thật.

**Bước 3: Hoàn thiện đề cương**

Đề xuất cấu trúc báo cáo chi tiết, điều chỉnh các mục nếu cần để phù hợp với nội dung thực tế của đề tài.

**Bước 4: Viết báo cáo theo từng chương**

Chỉ bắt đầu viết sau khi tôi xác nhận đề cương. Sau đó triển khai lần lượt từng chương, đảm bảo nội dung đầy đủ và có sự liên kết với các chương trước.

**Bước 5: Rà soát và hoàn thiện**

Sau khi hoàn thành các chương, kiểm tra:
- Tính chính xác của kiến thức kỹ thuật.
- Tính nhất quán của kiến trúc hệ thống.
- Tính logic của các thuật toán.
- Tính thống nhất của thuật ngữ.
- Văn phong và cách trình bày.
- Tài liệu tham khảo.

**YÊU CẦU CUỐI CÙNG:**

Trước tiên, hãy phân tích đề tài, đánh giá kiến trúc hệ thống và đưa ra đề cương báo cáo hoàn chỉnh. Đồng thời, liệt kê những thông tin còn thiếu cần tôi xác nhận.

Chưa viết nội dung chi tiết của bất kỳ chương nào cho đến khi tôi xác nhận.