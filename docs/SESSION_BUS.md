# SESSION_BUS.md > **Filesystem communication bus giữa các sessions.** Phiên cha và con đọc/ghi chung file này để trao đổi thông tin. Không dùng context/__memory__: mọi thứ phải persist vào file.

---
<!-- PARENT: ĐIỀN TRƯỚC KHI SWITCH SANG CHILD -->
## Current Mission
<!-- Mô tả ngắn gọn nhiệm vụ đang được xử lý -->

## Active Children
<!-- Mẹ điền khi CHƯA tạo hoặc vừa tạo child -->
<!-- Con CẬP NHẬT khi làm xong hoặc gặp blocker -->
<!-- Format: `[ID] Name | status | created | output | note` -->
- `` |  | status: `todo` | created:  | output: `` | note:  
- `` |  | status: `todo` | created:  | output: `` | note:  

## Checkpoints
<!-- Con ghi checkpoint mỗi milestone, Mẹ đọc sau khi switch về để biết tiến độ -->
- [ ] 

## Decisions Log
<!-- Ghi các quyết định quan trọng để cả 2 bên tham chiếu -->
- : 

---
<!-- CHILD: ĐỌC PHẦN NÀY, KHÔNG SỬA PHẦN TRÊN -->
## My Briefing
<!-- Con đọc, làm theo, CẬP NHẬT status khi xong, rồi QUAY VỀ MẸ -->
Đọc `CONTRACT.md` để biết chi tiết nhiệm vụ của bạn.
Sau khi xong: cập nhật `Active Children` → `status: done`, ghi `output` là đường dẫn kết quả, rồi `{"operation": "switch", "sessionId": "parent"}`.

---

## Template mẫu (xóa phần này khi dùng thật)
<!-- Ví dụ 1 task hoàn chỉnh:
## Current Mission
Tạo module xử lý upload file + tạo child để fix bug nhập liệu song song

## Active Children
- `upload-lib` | Upload lib | status: in-progress | created: 2026-06-15 | output: README | note: đang viết README
- `input-validation` | Fix input validation bug | status: blocked | created: 2026-06-15 | output: docs/input-validation-fix.md | note: đang fix rule regex cho ZIP code

## Checkpoints
- [x] Upload lib: viết xong code
- [x] Upload lib: viết xong test
- [ ] Input validation: chưa fix xong → mẹ review lại file rules

## Decisions Log
- 2026-06-15: Mẹ đi fix login bug, giao upload cho child
- 2026-06-15: Child report regex mới fail với ZIP+4, chuyển về mẹ quyết định
-->
