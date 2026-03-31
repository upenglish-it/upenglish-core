const fs = require('fs');
let code = fs.readFileSync('src/data/wordData.js', 'utf8');

const mapping = {
    'We negotiated WITH the client.': 'Chúng tôi đã đàm phán VỚI khách hàng.',
    'The deadline IS next Monday.': 'Hạn chót là thứ Hai tuần tới.',
    'Revenue HAS increased significantly.': 'Doanh thu ĐÃ tăng đáng kể.',
    'We need to implement THIS plan.': 'Chúng ta cần thực hiện kế hoạch NÀY.',
    'We collaborated WITH the marketing team.': 'Chúng tôi đã cộng tác VỚI nhóm tiếp thị.',
    'The budget FOR the project is $10,000.': 'Ngân sách CHO dự án là 10.000 đô la.',
    'The stakeholders ARE concerned about the delay.': 'Các bên liên quan ĐANG lo ngại về sự chậm trễ.',
    'She made a proposal TO the committee.': 'Cô ấy đã trình bày đề xuất VỚI ủy ban.',
    'Please pay the invoice WITHIN 30 days.': 'Vui lòng thanh toán hóa đơn TRONG VÒNG 30 ngày.',
    'We need to improve OUR efficiency.': 'Chúng ta cần cải thiện hiệu quả CỦA MÌNH.',
    'He delegated the task TO his colleague.': 'Anh ấy đã giao phó công việc CHO đồng nghiệp.',
    'We use this AS a benchmark.': 'Chúng tôi sử dụng điều này NHƯ LÀ một tiêu chuẩn.',
    'The acquisition OF the company was approved.': 'Việc mua lại CỦA công ty đã được phê duyệt.',
    'We are IN compliance WITH the law.': 'Chúng tôi TUÂN THỦ theo luật pháp.',
    'Productivity HAS increased.': 'Năng suất ĐÃ tăng lên.',
    'The algorithm RUNS efficiently.': 'Thuật toán CHẠY hiệu quả.',
    'The data IS stored in the database.': 'Dữ liệu ĐƯỢC lưu trữ trong cơ sở dữ liệu.',
    'The user interface IS easy to navigate.': 'Giao diện người dùng RẤT DỄ điều hướng.',
    'We deployed the app TO production.': 'Chúng tôi đã triển khai ứng dụng LÊN môi trường thực tế.',
    'The data IS encrypted.': 'Dữ liệu ĐƯỢC mã hóa.',
    'These PHENOMENA are fascinating.': 'Những HIỆN TƯỢNG này thật hấp dẫn.',
    'This is SIGNIFICANTLY different.': 'Điều này khác biệt ĐÁNG KỂ.',
    'This contributes TO the problem.': 'Điều này góp phần VÀO vấn đề.'
};

let replaced = 0;
for (const [correct, vi] of Object.entries(mapping)) {
    const correctLine = `correct: '${correct}'`;
    const index = code.indexOf(correctLine);

    if (index !== -1) {
        // Find the next 'wrong:' after this 'correct:'
        const wrongIndex = code.indexOf('wrong:', index);
        if (wrongIndex !== -1 && wrongIndex - index < 150) {
            const part1 = code.slice(0, wrongIndex);
            const part2 = code.slice(wrongIndex);

            // Ensure we haven't already inserted 'vi:' here
            if (!part1.includes(`vi: '`)) {
                code = part1 + `vi: '${vi}',\n                    ` + part2;
                replaced++;
            }
        }
    } else {
        console.log('Could not find:', correctLine);
    }
}

console.log(`Replaced ${replaced} items.`);
fs.writeFileSync('src/data/wordData.js', code);
