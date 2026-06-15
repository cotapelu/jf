# CONTRACT.md > **Hợp đồng nhiệm vụ giữa PARENT (người thuê) và CHILD (người làm).** Child bắt buộc đọc file này trước khi bắt đầu. Mọi thay đổi scope phải ghi lại ở đây.

---
<!-- PARENT: ĐIỀN KỸ TRƯỚC KHI SWITCH -->
## 1. Mission
<!-- 1 câu mô tả duy nhất mục tiêu cuối cùng -->

## 2. Inputs
<!-- Read-only: các file/tài liệu child ĐƯỢC PHÉP đọc -->
- `docs/SESSION_BUS.md` (phải đọc trước)
- 
<!-- Mẹ BỎ QUA phần này: chỉ để con đọc -->

## 2. Allowed Files
<!-- Danh sách files con ĐƯỢC PHÉP đọc/sửa - KHÔNG đọc bừa linh tinh ra ngoài phạm vi này -->
- 

## 3. Constraints
<!-- Điều cấm kỵ, boundaries, không được động vào -->
- 

## 4. Outputs
<!-- Con PHẢI ghi kết quả vào đúng paths này, Mẹ sẽ đọc từ đây sau khi về -->
- 

## 5. Done Criteria
<!-- Điều kiện "đã xong" - con mark `status: done` trong SESSION_BUS.md khi đủ -->
- [ ] 
- [ ] 

## 6. Communication Protocol
<!-- Quy tắc giao tiếp trong lúc làm việc -->
- Đọc `SESSION_BUS.md` mỗi lần switch vào để refresh mission
- Mỗi milestone: cập nhật `SESSION_BUS.md > Checkpoints` (dạng `- [x] ...`)
- Gặp blocker → cập nhật `SESSION_BUS.md > Active Children` field `note` và ghi rõ lý do, rồi mark `status: blocked`
- Xong → ghi `output` path, mark `status: done`, switch về parent
- KHÔNG tự ý switch về trước khi ghi kết quả

---

<!-- CHILD: ĐỌC, LÀM THEO, CẬP NHẬT SESSION_BUS.md, RỒI QUAY VỀ MẸ -->

## Template mẫu (xóa phần này khi dùng thật)
<!-- Ví dụ:
## 1. Mission
Làm tool scaffold component mới theo pattern Atomic Design hiện có

## 2. Inputs
- `docs/SESSION_BUS.md` (phải đọc trước)
- `AGENTS.md` → chỉ đọc phần "FRONTEND ARCHITECTURE"
- `src/components/atoms/Button.tsx`

## 2. Allowed Files
- `src/components/atoms/`
- `src/components/molecules/`
- `src/components/organisms/`
- `src/features/new-feature/` (tạo mới được phép)

## 3. Constraints
- KHÔNG sửa `src/pages/`
- KHÔNG xóa hoặc rename file hiện có
- Dùng typescript strict, không `any`

## 4. Outputs
- `docs/scaffold-result.md` mô tả file đã tạo và cấu trúc
- `src/features/new-feature/` folder mới

## 5. Done Criteria
- [ ] Folder `src/features/new-feature/` tồn tại với đủ atoms/molecules
- [ ] `docs/scaffold-result.md` viết rõ làm gì, làm ở đâu
- [ ] Mark done trong SESSION_BUS.md rồi switch về parent

## 6. Communication Protocol
- Đọc SESSION_BUS.md lúc vào, sau đó bắt đầu làm
- Mỗi thành phần xong: cập nhật checkpoint
- Xong hết: ghi output, mark done, switch về parent
-->
