---
description: Build dist và zip backup cả dự án lại với tên dễ nhớ
---

// turbo-all

1. Build production bundle:
```
cd "/Users/quantheclam/Downloads/Siêu app học từ vựng - Merging" && npx vite build 2>&1 | tail -5
```

2. Tạo tên backup dựa trên ngày và mô tả ngắn gọn về thay đổi gần nhất. Format: `sUPerStudy-backup-<mô-tả>-<ngày>.zip`. Ví dụ: `sUPerStudy-backup-fix-speaking-audio-20mar2026.zip`. Tên file dist cũng tương tự nhưng thêm `-dist`: `sUPerStudy-dist-<mô-tả>-<ngày>.zip`.

3. Zip nội dung bên trong dist (KHÔNG bao gồm thư mục dist, chỉ các file bên trong):
```
cd "/Users/quantheclam/Downloads/Siêu app học từ vựng - Merging/dist" && zip -r "../../<tên-file-dist>" . -x "./Archive.zip" 2>&1 | tail -3
```

4. Zip backup toàn bộ dự án (loại trừ node_modules, .git, dist):
```
cd "/Users/quantheclam/Downloads/Siêu app học từ vựng - Merging" && cd .. && zip -r "<tên-file-backup>" "Siêu app học từ vựng - Merging" -x "Siêu app học từ vựng - Merging/node_modules/*" "Siêu app học từ vựng - Merging/.git/*" "Siêu app học từ vựng - Merging/dist/*" 2>&1 | tail -3
```

5. Báo kết quả cho user: đường dẫn cả 2 file zip và dung lượng.
