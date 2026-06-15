# SESSION WORKFLOW GUIDE > **Cách LLM dùng `session` + filesystem để giao tiếp giữa Parent & Child một cách có cấu trúc.**

---
## 📋 Workflow tổng quan
``` PARENT → [write SESSION_BUS.md + CONTRACT.md] └── create child "Task A" └── write SESSION_BUS.md mission → save ngữ cảnh cần thiết └── switch sang child └── CHILD └── đọc SESSION_BUS.md + CONTRACT.md └── làm việc, ghi kết quả └── cập nhật SESSION_BUS.md └── switch về parent └── PARENT └── đọc SESSION_BUS.md └── biết ngay kết quả ```

---
## 📝 Step-by-step cho PARENT ### Bước 1: Chuẩn bị file
``` Mở `docs/SESSION_BUS.md`, ghi:
- `Current Mission`: nhiệm vụ chính đang làm
- `Active Children`: tạo entry mới với `status: todo` ``` Viết `docs/CONTRACT.md`: - `Mission`: 1 câu mô tả mục tiêu child - `Allowed Files`: danh sách file CON ĐƯỢC động vào - `Constraints`: điều cấm kỵ - `Outputs`: path kết quả child phải ghi - `Done Criteria`: checklist điều kiện xong ### Bước 2: Tạo và giao nhiệm vụ
Bằng tool `session`: ```json {"operation": "create", "name": "Tên task child", "tags": ["tag1"]} ``` Ghi lại ID trả về (VD: `abc-123`), cập nhật vào `SESSION_BUS.md`: ``` - `abc-123` | Tên task | status: in-progress | created: 2026-06-15 | output: docs/output.md | note: đang làm ``` ### Bước 3: Ghi "di chúc" rồi switch
Sau khi ghi đầy đủ, **QUAN TRỌNG** – ghi tiếp vào `SESSION_BUS.md` phần: ``` ## [SESSION:abc-123] Plan - Đọc file: ... - Cần output: ... - Done khi: ... ``` Rồi mới switch: ```json {"operation": "switch", "sessionId": "abc-123"} ``` ### Bước 4: Chờ và review
Switch về parent sau khi child done: ```json {"operation": "switch", "sessionId": "parent"} ``` Đọc `SESSION_BUS.md` → check: - `Active Children`: entry đó đã `status: done` chưa? - `output` path có kết quả không? - Đọc tiếp file output để review --- ## 📝 Step-by-step cho CHILD ### Bước 1: Nhận nhiệm vụ
Ngay khi active, đọc: 1. `docs/SESSION_BUS.md` → xem mình được giao gì 2. `docs/CONTRACT.md` → xem ràng buộc ### Bước 2: Làm việc
- Chỉ đọc/sửa files trong `CONTRACT.md > Allowed Files` - Mỗi milestone, cập nhật `SESSION_BUS.md > Checkpoints`: `- [x] ...` ### Bước 3: Gặp blocker
- Cập nhật `SESSION_BUS.md > Active Children`: đổi `status: blocked`, ghi rõ lý do ở `note` - **ĐỪNG tự ý switch về** – chờ mẹ đọc và quyết định ### Bước 4: Hoàn thành
- Ghi kết quả đúng path trong `CONTRACT.md > Outputs` - Cập nhật `SESSION_BUS.md > Active Children`:
  - `status: done`
  - `output`: path file kết quả - Ghi `Decisions Log` nếu có quyết định quan trọng - **Switch về parent**:
  ```json {"operation": "switch", "sessionId": "parent"} ``` --- ## 🚫 Anti-patterns (KHÔNG LÀM)
❌ **Không** lưu thông tin quan trọng trong memory/context (vì mất khi switch) ❌ **Không** tự ý đọc files ngoài `Allowed Files` (tránh data leak) ❌ **Không** switch về trước khi ghi output (mẹ sẽ không biết kết quả đâu) ❌ **Không** tạo child mà không có `SESSION_BUS.md` và `CONTRACT.md` (sẽ thành "orphaned task") ❌ **Không** để 2 child cùng ghi 1 file (nếu cần, dùng folder khác nhau) --- ## 📂 Cấu trúc thư mục đề xuất ``` /home/quangtynu/Qcoder/jf/docs/ SESSION_BUS.md # Bus chính, mẹ quản lý CONTRACT.md # Contract mẫu (template) SESSION_WORKFLOW.md # File này contracts/ # Khi nào làm mẹ-child song song nhiều nhóm con auth-contract.md # Cho child "auth" api-contract.md # Cho child "api" reports/ # Kết quả child ghi vào đây auth-findings.md api-analysis.md ``` --- ## ⚡ Quick Command Reference
| Hành động | Command |
|------------|---------|
| Tạo child | `{"operation": "create", "name": "Task X", "tags": ["x"]}` |
| Switch child | `{"operation": "switch", "sessionId": "ID"}` |
| Switch về mẹ | `{"operation": "switch", "sessionId": "parent"}` |
| Set tag | `{"operation": "tag", "sessionId": "ID", "tags": ["done"], "tagAction": "add"}` |
| Export child | `{"operation": "export", "sessionId": "ID", "exportFormat": "json"}` |
| Xem info | `{"operation": "info", "sessionId": "ID"}` |
| List children | `{"operation": "list", "filterState": "inactive"}` | --- ## 🎯 Best Practice Tổng 1. **Ghi trước, switch sau** – Mẹ ghi đầy đủ vào files TRƯỚC khi switch 2. **Đọc ngay khi vào** – Child đọc `SESSION_BUS.md` + `CONTRACT.md` NGAY khi active 3. **Cập nhật liên tục** – Mỗi milestone đều ghi vào `SESSION_BUS.md` Checkpoints 4. **Ghi output chuẩn** – Theo đúng path trong `CONTRACT.md > Outputs` 5. **Review ngay khi về** – Mẹ switch về → đọc `SESSION_BUS.md` → biết ngay kết quả
