import re

file_path = "src/data/wordData.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

replacements = {
    'Chúng ta cần thương lượng một ___ với nhà cung cấp.': 'Chúng ta cần thương lượng một thỏa thuận với nhà cung cấp.',
    'Chúng ta phải ___ hạn chót cho dự án.': 'Chúng ta phải hoàn thành đúng hạn chót cho dự án.',
    'Công ty đã xoay xở để ___ thêm doanh thu trong quý này.': 'Công ty đã xoay xở để tạo ra thêm doanh thu trong quý này.',
    'Công ty đã quyết định triển khai một ___ tiếp thị mới.': 'Công ty đã quyết định triển khai một chiến lược tiếp thị mới.',
    'Chúng ta cần hợp tác ___ đội thiết kế trong dự án này.': 'Chúng ta cần hợp tác với đội thiết kế trong dự án này.',
    'Dự án được hoàn thành ___ ngân sách.': 'Dự án được hoàn thành trong ngân sách.',
    'Chúng ta cần tham khảo ý kiến của các ___ chính trước khi đưa ra bất kỳ quyết định nào.': 'Chúng ta cần tham khảo ý kiến của các bên liên quan chính trước khi đưa ra bất kỳ quyết định nào.',
    'Vui lòng ___ một đề xuất trước cuối tuần này.': 'Vui lòng nộp một đề xuất trước cuối tuần này.',
    'Vui lòng ___ hóa đơn cho các dịch vụ đã cung cấp.': 'Vui lòng phát hành hóa đơn cho các dịch vụ đã cung cấp.',
    'Chúng ta cần cải thiện ___ của dây chuyền sản xuất.': 'Chúng ta cần cải thiện hiệu suất của dây chuyền sản xuất.',
    'Một người quản lý giỏi biết cách giao phó ___ một cách hiệu quả.': 'Một người quản lý giỏi biết cách giao phó công việc một cách hiệu quả.',
    'Công ty này đã ___ một chuẩn mực mới về chất lượng.': 'Công ty này đã đặt ra một chuẩn mực mới về chất lượng.',
    'Chiến lược ___ mới của chúng ta đã được chốt vào hôm qua.': 'Chiến lược mua lại mới của chúng ta đã được chốt vào hôm qua.',
    'Tất cả nhân viên phải ___ thủ điều khoản (in compliance with) các chính sách của công ty.': 'Tất cả nhân viên phải tuân thủ điều khoản các chính sách của công ty.',
    'Phần mềm mới đã giúp ___ năng suất của nhóm chúng ta.': 'Phần mềm mới đã giúp tăng năng suất của nhóm chúng ta.',
    'Thuật toán ___ xử lý hàng tỷ truy vấn mỗi ngày.': 'Thuật toán tìm kiếm xử lý hàng tỷ truy vấn mỗi ngày.',
    'Chúng ta cần ___ cơ sở dữ liệu để lấy hồ sơ khách hàng.': 'Chúng ta cần truy vấn cơ sở dữ liệu để lấy hồ sơ khách hàng.',
    'Ứng dụng có giao diện người dùng rất ___.': 'Ứng dụng có giao diện người dùng rất trực quan.',
    'Chúng tôi sẽ ___ phiên bản mới lên môi trường thực tế vào tối nay.': 'Chúng tôi sẽ triển khai phiên bản mới lên môi trường thực tế vào tối nay.',
    'Tất cả dữ liệu nhạy cảm phải được ___ trước khi truyền đi.': 'Tất cả dữ liệu nhạy cảm phải được mã hóa trước khi truyền đi.',
    'Biến đổi khí hậu là một hiện tượng ___ đang ảnh hưởng đến toàn thế giới.': 'Biến đổi khí hậu là một hiện tượng toàn cầu đang ảnh hưởng đến toàn thế giới.',
    'Đã có sự gia tăng ___ về nhiệt độ vào năm ngoái.': 'Đã có sự gia tăng đáng kể về nhiệt độ vào năm ngoái.',
    'Nhiều yếu tố ___ vào sự nóng lên toàn cầu.': 'Nhiều yếu tố đóng góp vào sự nóng lên toàn cầu.'
}

for old_val, new_val in replacements.items():
    content = content.replace(f"sentenceVi: '{old_val}'", f"sentenceVi: '{new_val}'")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated translations successfully.")
