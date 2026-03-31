# Hệ Thống Báo Cáo Kỹ Năng Học Viên

Xây dựng hệ thống phân tích điểm mạnh/điểm yếu của học viên dựa trên dữ liệu học từ vựng, ngữ pháp, và bài kiểm tra. AI viết báo cáo → Giáo viên duyệt → Gửi cho học viên.

---

## Proposed Changes

### Phase 1: Thêm `targetSkill` Dropdown vào Question Editors

#### [MODIFY] [ExamEditorPage.jsx](file:///Users/quantheclam/Downloads/Siêu%20app%20học%20từ%20vựng/src/pages/admin/ExamEditorPage.jsx)

Thêm dropdown `targetSkill` vào form câu hỏi (sau trường `purpose`, ~line 1508):
- Options: `listening`, `speaking`, `reading`, `writing`, `grammar`, `vocabulary`
- Cập nhật `formData` state thêm `targetSkill: ''`
- Đảm bảo `targetSkill` được lưu khi submit (đã có cơ chế spread `...questionData`)

#### [MODIFY] [TeacherGrammarEditorPage.jsx](file:///Users/quantheclam/Downloads/Siêu%20app%20học%20từ%20vựng/src/pages/teacher/TeacherGrammarEditorPage.jsx)

Tương tự: thêm dropdown `targetSkill` vào form câu hỏi ngữ pháp (sau trường `purpose`, ~line 1048).

---

### Phase 2: Skill Analysis Service

#### [NEW] [skillAnalysisService.js](file:///Users/quantheclam/Downloads/Siêu%20app%20học%20từ%20vựng/src/services/skillAnalysisService.js)

**`analyzeStudentSkills(uid, { startDate, endDate, topicIds, grammarExerciseIds, examAssignmentIds })`**

Thu thập dữ liệu từ 3 nguồn:

| Nguồn | Dữ liệu | Mapping kỹ năng |
|-------|---------|-----------------|
| `word_progress` | `stepMastery[0-5]` | listening(0), speaking(1), reading(2), writing(3), vocab retention |
| `grammar_progress` | passCount/failCount + question `targetSkill` | grammar + targetSkill |
| `exam_submissions` | score per question + question `targetSkill` | targetSkill mapping |

**Return:** `{ skills: { listening, speaking, reading, writing, grammar, vocabulary }, strengths, weaknesses, vocabRetentionRate, grammarAccuracyRate }`

---

### Phase 3: AI Report Generation + Persistence

#### [NEW] [skillReportService.js](file:///Users/quantheclam/Downloads/Siêu%20app%20học%20từ%20vựng/src/services/skillReportService.js)

| Function | Mô tả |
|----------|--------|
| `generateSkillReport(studentName, skillData)` | Gọi `chatCompletion` → AI viết báo cáo tiếng Việt |
| `saveSkillReport(data)` | Lưu vào `skill_reports/{id}` |
| `getSkillReports(groupId, studentId)` | Lấy danh sách reports cho 1 học viên trong group |
| `getStudentSkillReports(studentId)` | Lấy reports đã gửi cho student (dashboard) |
| `deleteSkillReport(reportId)` | Xóa report |

**Firestore schema `skill_reports/{reportId}`:**
```
studentId, groupId, teacherId,
startDate, endDate,           // Custom date range (tuỳ chọn)
skillData: { ... },           // Raw scores từ analysis
aiReport: { ... },            // AI generated content
teacherEdits: "",             // Chỉnh sửa của giáo viên
finalReport: "",              // Nội dung cuối cùng
status: "draft" | "sent",
createdAt, sentAt, updatedAt
```

---

### Phase 4: Trang Chi Tiết Học Viên (nâng cấp popup → dedicated page)

#### [NEW] [StudentProgressPage.jsx](file:///Users/quantheclam/Downloads/Siêu%20app%20học%20từ%20vựng/src/pages/teacher/StudentProgressPage.jsx)

Nâng cấp popup "Xem tiến độ" (hiện ở lines 1462-1784 trong `TeacherGroupDetailPage.jsx`) thành trang riêng.

**Route:** `/admin/groups/:groupId/students/:studentId` và `/teacher/groups/:groupId/students/:studentId`

**Nội dung trang:**

1. **Header:** Tên học viên + nút quay lại group
2. **Thống kê tổng quan:** (từ vựng đã thuộc, đang học, ôn tập) — giữ nguyên từ popup
3. **Tiến độ chi tiết:** Vocab progress + Grammar progress + Exam results — giữ nguyên từ popup
4. **Phần mới — Báo cáo kỹ năng:**
   - Date range picker (tuỳ chọn khoảng thời gian)
   - Nút "🤖 Tạo báo cáo AI"
   - **Diamond/Radar chart 6 kỹ năng** (dùng Recharts `RadarChart` + `PolarGrid`)
   - Nội dung báo cáo AI (editable textarea)
   - Nút "Duyệt & Gửi cho học viên" → status = sent + notification
   - Danh sách báo cáo đã tạo trước đó (có thể xem lại/xoá)

#### [NEW] [StudentProgressPage.css](file:///Users/quantheclam/Downloads/Siêu%20app%20học%20từ%20vựng/src/pages/teacher/StudentProgressPage.css)

CSS cho trang chi tiết học viên + radar chart + report editor.

#### [MODIFY] [TeacherGroupDetailPage.jsx](file:///Users/quantheclam/Downloads/Siêu%20app%20học%20từ%20vựng/src/pages/teacher/TeacherGroupDetailPage.jsx)

- Thay đổi nút "Xem tiến độ" từ `onClick={handleViewStudent}` → `<Link>` tới route mới
- Xoá popup `selectedStudent` modal (lines 1462-1784)
- Xoá các state/function liên quan: `selectedStudent`, `studentStats`, `studentTopicProgress`, `handleViewStudent()`, `toggleTopicDetail()`, etc.

#### [MODIFY] [App.jsx](file:///Users/quantheclam/Downloads/Siêu%20app%20học%20từ%20vựng/src/App.jsx)

Thêm routes:
```jsx
// Admin
<Route path="groups/:groupId/students/:studentId" element={<StudentProgressPage />} />

// Teacher
<Route path="groups/:groupId/students/:studentId" element={<StudentProgressPage />} />
```

---

### Phase 5: Student Dashboard — Report Card

#### [MODIFY] [DashboardPage.jsx](file:///Users/quantheclam/Downloads/Siêu%20app%20học%20từ%20vựng/src/pages/DashboardPage.jsx)

- Thêm card "📊 Báo cáo kỹ năng mới" khi có report `status === 'sent'`
- Click → modal hiển thị **diamond/radar chart** + nội dung báo cáo + điểm mạnh/yếu

---

### Phase 6: Firestore Rules + Routing

#### [MODIFY] [firestore.rules](file:///Users/quantheclam/Downloads/Siêu%20app%20học%20từ%20vựng/firestore.rules)

```
match /skill_reports/{reportId} {
  allow read: if isAdmin() || isTeacher()
               || (isAuthenticated() && resource.data.studentId == request.auth.uid
                   && resource.data.status == 'sent');
  allow create, update: if isAdmin() || isTeacher();
  allow delete: if isAdmin() || isTeacher();
}
```

---

## Verification Plan

1. **targetSkill dropdown:** Mở Exam/Grammar editor → kiểm tra dropdown hiện + lưu giá trị
2. **Student Progress Page:** Click "Xem tiến độ" → navigate tới trang mới (thay vì popup)
3. **Skill Analysis:** Tạo báo cáo AI → kiểm tra radar chart + nội dung
4. **Gửi báo cáo:** Bấm "Gửi" → notification tạo cho học viên
5. **Student Dashboard:** Đăng nhập học viên → thấy card + radar chart
6. **Build:** `npm run build` → không lỗi
