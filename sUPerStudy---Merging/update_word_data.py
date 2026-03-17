import re

file_path = "src/data/wordData.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

translations = {
    'We need to negotiate a ___ with the supplier.': 'Chúng ta cần thương lượng một ___ với nhà cung cấp.',
    'We must ___ the deadline for the project.': 'Chúng ta phải ___ hạn chót cho dự án.',
    'The company managed to ___ more revenue this quarter.': 'Công ty đã xoay xở để ___ thêm doanh thu trong quý này.',
    'The company decided to implement a new marketing ___.': 'Công ty đã quyết định triển khai một ___ tiếp thị mới.',
    'We need to collaborate ___ the design team on this project.': 'Chúng ta cần hợp tác ___ đội thiết kế trong dự án này.',
    'The project was completed ___ budget.': 'Dự án được hoàn thành ___ ngân sách.',
    'We need to consult with the key ___ before making any decisions.': 'Chúng ta cần tham khảo ý kiến của các ___ chính trước khi đưa ra bất kỳ quyết định nào.',
    'Please ___ a proposal by the end of this week.': 'Vui lòng ___ một đề xuất trước cuối tuần này.',
    'Please ___ an invoice for the services rendered.': 'Vui lòng ___ hóa đơn cho các dịch vụ đã cung cấp.',
    'We need to improve the ___ of our production line.': 'Chúng ta cần cải thiện ___ của dây chuyền sản xuất.',
    'A good manager knows how to delegate ___ effectively.': 'Một người quản lý giỏi biết cách giao phó ___ một cách hiệu quả.',
    'This company has ___ a new benchmark for quality.': 'Công ty này đã ___ một chuẩn mực mới về chất lượng.',
    'Our new ___ strategy was finalized yesterday.': 'Chiến lược ___ mới của chúng ta đã được chốt vào hôm qua.',
    'All employees must be ___ compliance with company policies.': 'Tất cả nhân viên phải ___ thủ điều khoản (in compliance with) các chính sách của công ty.',
    'The new software helped ___ our team\'s productivity.': 'Phần mềm mới đã giúp ___ năng suất của nhóm chúng ta.',
    'The ___ algorithm processes billions of queries daily.': 'Thuật toán ___ xử lý hàng tỷ truy vấn mỗi ngày.',
    'We need to ___ the database for customer records.': 'Chúng ta cần ___ cơ sở dữ liệu để lấy hồ sơ khách hàng.',
    'The app has a very ___ user interface.': 'Ứng dụng có giao diện người dùng rất ___.',
    'We will ___ the new version to production tonight.': 'Chúng tôi sẽ ___ phiên bản mới lên môi trường thực tế vào tối nay.',
    'All sensitive data must be ___ before transmission.': 'Tất cả dữ liệu nhạy cảm phải được ___ trước khi truyền đi.',
    'Climate change is a ___ phenomenon affecting the entire world.': 'Biến đổi khí hậu là một hiện tượng ___ đang ảnh hưởng đến toàn thế giới.',
    'There was a ___ increase in temperature last year.': 'Đã có sự gia tăng ___ về nhiệt độ vào năm ngoái.',
    'Many factors ___ to global warming.': 'Nhiều yếu tố ___ vào sự nóng lên toàn cầu.'
}

for k, v in translations.items():
    k_escaped = k.replace("'", "\\'")
    v_escaped = v.replace("'", "\\'")
    sentence_pattern = f"sentence: '{k_escaped}',\n"
    replacement = f"sentence: '{k_escaped}',\n                sentenceVi: '{v_escaped}',\n"
    content = content.replace(sentence_pattern, replacement)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
