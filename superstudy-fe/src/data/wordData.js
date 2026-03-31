// dữ liệu chi tiết từ vựng cho từng chủ đề
// Mỗi từ có đầy đủ data cho 6 bước học

const wordData = {
    business: [
        {
            word: 'negotiate',
            phonetic: '/nɪˈɡoʊ.ʃi.eɪt/',
            partOfSpeech: 'verb',
            vietnameseMeaning: 'thương lượng, đàm phán',
            explanation: 'Hành động trao đổi, thảo luận với đối tác nhằm đi đến một thỏa hiệp hoặc thống nhất về hợp đồng, giá cả.',
            distractors: ['navigate', 'negligent', 'nominate'],
            pronunciationTip: 'Nhấn trọng âm ở âm tiết thứ 2: ne-GO-shi-ate',
            collocations: [
                { phrase: 'negotiate a deal', vietnamese: 'thương lượng một thỏa thuận' },
                { phrase: 'negotiate terms', vietnamese: 'thương lượng điều khoản' },
                { phrase: 'negotiate with', vietnamese: 'thương lượng với ai đó' },
            ],
            collocationExercise: {
                sentence: 'We need to negotiate a ___ with the supplier.',
                sentenceVi: 'Chúng ta cần thương lượng một thỏa thuận với nhà cung cấp.',
                options: ['deal', 'term', 'price', 'product'],
                answer: 'deal',
            },
            exampleSentences: [
                { en: 'They spent weeks negotiating the contract.', vi: 'Họ đã dành nhiều tuần để đàm phán hợp đồng.' },
            ],
            sentenceSequence: {
                en: 'We negotiated with the client.',
                vi: 'Chúng tôi đã đàm phán với khách hàng.',
            },
        },
        {
            word: 'deadline',
            phonetic: '/ˈdɛd.laɪn/',
            partOfSpeech: 'noun',
            vietnameseMeaning: 'hạn chót, thời hạn',
            explanation: 'Mốc thời gian cuối cùng mà bạn bắt buộc phải hoàn thành và nộp lại một công việc hoặc dự án nào đó.',
            distractors: ['dateline', 'decline', 'headline'],
            pronunciationTip: 'Nhấn âm tiết đầu: DEAD-line',
            collocations: [
                { phrase: 'meet a deadline', vietnamese: 'hoàn thành đúng hạn' },
                { phrase: 'miss a deadline', vietnamese: 'trễ hạn' },
                { phrase: 'set a deadline', vietnamese: 'đặt thời hạn' },
            ],
            collocationExercise: {
                sentence: 'We must ___ the deadline for the project.',
                sentenceVi: 'Chúng ta phải hoàn thành đúng hạn chót cho dự án.',
                options: ['meet', 'do', 'make', 'take'],
                answer: 'meet',
            },
            exampleSentences: [
                { en: 'The deadline for the report is next Friday.', vi: 'Hạn chót nộp báo cáo là thứ Sáu tuần sau.' },
            ],
            sentenceSequence: {
                en: 'The deadline is next Monday.',
                vi: 'Hạn chót là thứ Hai tuần tới.',
            },
        },
        {
            word: 'revenue',
            phonetic: '/ˈrɛv.ən.juː/',
            partOfSpeech: 'noun',
            vietnameseMeaning: 'doanh thu',
            explanation: 'Tổng số tiền mà một công ty thu được từ các hoạt động kinh doanh, bán hàng trước khi trừ đi chi phí.',
            distractors: ['review', 'reverse', 'revenge'],
            pronunciationTip: 'Nhấn âm tiết đầu: REV-en-ue',
            collocations: [
                { phrase: 'generate revenue', vietnamese: 'tạo ra doanh thu' },
                { phrase: 'annual revenue', vietnamese: 'doanh thu hàng năm' },
                { phrase: 'revenue growth', vietnamese: 'tăng trưởng doanh thu' },
            ],
            collocationExercise: {
                sentence: 'The company managed to ___ more revenue this quarter.',
                sentenceVi: 'Công ty đã xoay xở để tạo ra thêm doanh thu trong quý này.',
                options: ['generate', 'make', 'do', 'create'],
                answer: 'generate',
            },
            exampleSentences: [
                { en: 'Our annual revenue increased by 20%.', vi: 'Doanh thu hàng năm của chúng tôi tăng 20%.' },
            ],
            sentenceSequence: {
                en: 'Revenue has increased significantly.',
                vi: 'Doanh thu đã tăng đáng kể.',
            },
        },
        {
            word: 'implement',
            phonetic: '/ˈɪm.plɪ.ment/',
            partOfSpeech: 'verb',
            vietnameseMeaning: 'thực hiện, triển khai',
            explanation: 'Đưa một kế hoạch, ý tưởng hoặc hệ thống mới vào áp dụng thực tế để nó bắt đầu hoạt động.',
            distractors: ['imply', 'import', 'improve'],
            pronunciationTip: 'Nhấn âm tiết đầu: IM-pli-ment',
            collocations: [
                { phrase: 'implement a plan', vietnamese: 'thực hiện kế hoạch' },
                { phrase: 'implement changes', vietnamese: 'triển khai thay đổi' },
                { phrase: 'implement a strategy', vietnamese: 'triển khai chiến lược' },
            ],
            collocationExercise: {
                sentence: 'The company decided to implement a new marketing ___.',
                sentenceVi: 'Công ty đã quyết định triển khai một chiến lược tiếp thị mới.',
                options: ['strategy', 'idea', 'thought', 'decision'],
                answer: 'strategy',
            },
            exampleSentences: [
                { en: 'We plan to implement the new system next month.', vi: 'Chúng tôi dự kiến triển khai hệ thống mới vào tháng sau.' },
            ],
            sentenceSequence: {
                en: 'We need to implement this plan.',
                vi: 'Chúng ta cần thực hiện kế hoạch này.',
            },
        },
        {
            word: 'collaborate',
            phonetic: '/kəˈlæb.ə.reɪt/',
            partOfSpeech: 'verb',
            vietnameseMeaning: 'cộng tác, hợp tác',
            explanation: 'Hành động làm việc cùng nhau giữa hai hay nhiều người hoặc tổ chức để đạt được một mục tiêu chung.',
            distractors: ['celebrate', 'calibrate', 'elaborate'],
            pronunciationTip: 'Nhấn âm tiết thứ 2: co-LAB-o-rate',
            collocations: [
                { phrase: 'collaborate with', vietnamese: 'hợp tác với' },
                { phrase: 'collaborate on a project', vietnamese: 'cộng tác trong dự án' },
                { phrase: 'closely collaborate', vietnamese: 'hợp tác chặt chẽ' },
            ],
            collocationExercise: {
                sentence: 'We need to collaborate ___ the design team on this project.',
                sentenceVi: 'Chúng ta cần hợp tác với đội thiết kế trong dự án này.',
                options: ['with', 'to', 'for', 'about'],
                answer: 'with',
            },
            exampleSentences: [
                { en: 'The two companies collaborated on a new product.', vi: 'Hai công ty đã hợp tác phát triển sản phẩm mới.' },
            ],
            sentenceSequence: {
                en: 'We collaborated with the marketing team.',
                vi: 'Chúng tôi đã cộng tác với nhóm tiếp thị.',
            },
        },
        {
            word: 'budget',
            phonetic: '/ˈbʌdʒ.ɪt/',
            partOfSpeech: 'noun',
            vietnameseMeaning: 'ngân sách',
            explanation: 'Bản kế hoạch dự kiến về số tiền sẽ thu vào và chi ra trong một khoảng thời gian nhất định cho một dự án cụ thể.',
            distractors: ['bucket', 'buffet', 'blanket'],
            pronunciationTip: 'Nhấn âm tiết đầu: BUD-get',
            collocations: [
                { phrase: 'within budget', vietnamese: 'trong ngân sách' },
                { phrase: 'budget allocation', vietnamese: 'phân bổ ngân sách' },
                { phrase: 'over budget', vietnamese: 'vượt ngân sách' },
            ],
            collocationExercise: {
                sentence: 'The project was completed ___ budget.',
                sentenceVi: 'Dự án được hoàn thành trong ngân sách.',
                options: ['within', 'inside', 'into', 'at'],
                answer: 'within',
            },
            exampleSentences: [
                { en: 'We need to stay within the budget.', vi: 'Chúng ta cần giữ trong ngân sách cho phép.' },
            ],
            sentenceSequence: {
                en: 'The budget for the project is $10,000.',
                vi: 'ngân sách cho dự án là 10.000 đô la.',
            },
        },
        {
            word: 'stakeholder',
            phonetic: '/ˈsteɪk.hoʊl.dər/',
            partOfSpeech: 'noun',
            vietnameseMeaning: 'bên liên quan, các bên có lợi ích',
            explanation: 'Cá nhân hoặc tổ chức có quyền lợi, bị ảnh hưởng hoặc có thể ảnh hưởng đến kết quả hoạt động của một dự án hay doanh nghiệp.',
            distractors: ['shareholder', 'storekeeper', 'shopkeeper'],
            pronunciationTip: 'Nhấn âm tiết đầu: STAKE-hold-er',
            collocations: [
                { phrase: 'key stakeholder', vietnamese: 'bên liên quan chính' },
                { phrase: 'stakeholder engagement', vietnamese: 'sự tham gia của các bên liên quan' },
                { phrase: 'stakeholder meeting', vietnamese: 'cuộc họp các bên liên quan' },
            ],
            collocationExercise: {
                sentence: 'We need to consult with the key ___ before making any decisions.',
                sentenceVi: 'Chúng ta cần tham khảo ý kiến của các bên liên quan chính trước khi đưa ra bất kỳ quyết định nào.',
                options: ['stakeholders', 'players', 'members', 'managers'],
                answer: 'stakeholders',
            },
            exampleSentences: [
                { en: 'All stakeholders were invited to the meeting.', vi: 'Tất cả các bên liên quan được mời dự họp.' },
            ],
            sentenceSequence: {
                en: 'The stakeholders are concerned about the delay.',
                vi: 'các bên liên quan đang lo ngại về sự chậm trễ.',
            },
        },
        {
            word: 'proposal',
            phonetic: '/prəˈpoʊ.zəl/',
            partOfSpeech: 'noun',
            vietnameseMeaning: 'đề xuất, bản đề nghị',
            explanation: 'Một kế hoạch hoặc ý tưởng được trình bày chính thức để người khác xem xét và quyết định có chấp thuận hay không.',
            distractors: ['purpose', 'disposal', 'approval'],
            pronunciationTip: 'Nhấn âm tiết thứ 2: pro-PO-sal',
            collocations: [
                { phrase: 'submit a proposal', vietnamese: 'nộp đề xuất' },
                { phrase: 'accept a proposal', vietnamese: 'chấp nhận đề xuất' },
                { phrase: 'business proposal', vietnamese: 'đề xuất kinh doanh' },
            ],
            collocationExercise: {
                sentence: 'Please ___ a proposal by the end of this week.',
                sentenceVi: 'Vui lòng nộp một đề xuất trước cuối tuần này.',
                options: ['submit', 'send', 'give', 'put'],
                answer: 'submit',
            },
            exampleSentences: [
                { en: 'The proposal was accepted by the board.', vi: 'đề xuất đã được hội đồng chấp nhận.' },
            ],
            sentenceSequence: {
                en: 'She made a proposal to the committee.',
                vi: 'Cô ấy đã trình bày đề xuất với ủy ban.',
            },
        },
        {
            word: 'invoice',
            phonetic: '/ˈɪn.vɔɪs/',
            partOfSpeech: 'noun',
            vietnameseMeaning: 'hóa đơn',
            explanation: 'Giấy tờ liệt kê chi tiết các mặt hàng hoặc dịch vụ đã cung cấp cùng với số tiền mà người mua cần phải thanh toán.',
            distractors: ['invest', 'invite', 'involve'],
            pronunciationTip: 'Nhấn âm tiết đầu: in-voice',
            collocations: [
                { phrase: 'issue an invoice', vietnamese: 'phát hành hóa đơn' },
                { phrase: 'pay an invoice', vietnamese: 'thanh toán hóa đơn' },
                { phrase: 'outstanding invoice', vietnamese: 'hóa đơn chưa thanh toán' },
            ],
            collocationExercise: {
                sentence: 'Please ___ an invoice for the services rendered.',
                sentenceVi: 'Vui lòng phát hành hóa đơn cho các dịch vụ đã cung cấp.',
                options: ['issue', 'make', 'do', 'create'],
                answer: 'issue',
            },
            exampleSentences: [
                { en: 'The invoice was sent to the client yesterday.', vi: 'hóa đơn đã được gửi cho khách hàng hôm qua.' },
            ],
            sentenceSequence: {
                en: 'Please pay the invoice within 30 days.',
                vi: 'Vui lòng thanh toán hóa đơn within 30 days.',
            },
        },
        {
            word: 'efficiency',
            phonetic: '/ɪˈfɪʃ.ən.si/',
            partOfSpeech: 'noun',
            vietnameseMeaning: 'hiệu quả, hiệu suất',
            explanation: 'Khả năng hoàn thành công việc tốt và nhanh chóng mà không lãng phí quá nhiều thời gian, tiền bạc hay sức lực.',
            distractors: ['emergency', 'elegance', 'evidence'],
            pronunciationTip: 'Nhấn âm tiết thứ 2: e-FI-cien-cy',
            collocations: [
                { phrase: 'improve efficiency', vietnamese: 'cải thiện hiệu suất' },
                { phrase: 'energy efficiency', vietnamese: 'hiệu suất năng lượng' },
                { phrase: 'operational efficiency', vietnamese: 'hiệu quả vận hành' },
            ],
            collocationExercise: {
                sentence: 'We need to improve the ___ of our production line.',
                sentenceVi: 'Chúng ta cần cải thiện hiệu suất của dây chuyền sản xuất.',
                options: ['efficiency', 'efficient', 'effort', 'effect'],
                answer: 'efficiency',
            },
            exampleSentences: [
                { en: 'The new system has greatly improved efficiency.', vi: 'Hệ thống mới đã cải thiện hiệu suất rất nhiều.' },
            ],
            sentenceSequence: {
                en: 'We need to improve our efficiency.',
                vi: 'Chúng ta cần cải thiện hiệu quả của mình.',
            },
        },
        {
            word: 'delegate',
            phonetic: '/ˈdɛl.ɪ.ɡeɪt/',
            partOfSpeech: 'verb',
            vietnameseMeaning: 'ủy thác, giao phó',
            explanation: 'Trao quyền quyết định hoặc phân công một nhiệm vụ cụ thể cho người khác (thường là cấp dưới) thực hiện thay mình.',
            distractors: ['dedicate', 'delicate', 'deliberate'],
            pronunciationTip: 'Nhấn âm tiết đầu: DEL-e-gate',
            collocations: [
                { phrase: 'delegate tasks', vietnamese: 'giao phó công việc' },
                { phrase: 'delegate responsibility', vietnamese: 'ủy thác trách nhiệm' },
                { phrase: 'delegate authority', vietnamese: 'ủy quyền' },
            ],
            collocationExercise: {
                sentence: 'A good manager knows how to delegate ___ effectively.',
                sentenceVi: 'Một người quản lý giỏi biết cách giao phó công việc một cách hiệu quả.',
                options: ['tasks', 'works', 'jobs', 'duties'],
                answer: 'tasks',
            },
            exampleSentences: [
                { en: 'She delegated the work to her assistant.', vi: 'Cô ấy giao công việc cho trợ lý.' },
            ],
            sentenceSequence: {
                en: 'He delegated the task to his colleague.',
                vi: 'Anh ấy đã giao phó công việc cho đồng nghiệp.',
            },
        },
        {
            word: 'benchmark',
            phonetic: '/ˈbɛntʃ.mɑːrk/',
            partOfSpeech: 'noun',
            vietnameseMeaning: 'chuẩn đối sánh, tiêu chuẩn',
            explanation: 'Một mức độ, tiêu chuẩn hoặc điểm tham chiếu được dùng để đánh giá và so sánh chất lượng, hiệu suất của những thứ khác tương tự.',
            distractors: ['trademark', 'landmark', 'bookmark'],
            pronunciationTip: 'Nhấn âm tiết đầu: BENCH-mark',
            collocations: [
                { phrase: 'set a benchmark', vietnamese: 'đặt tiêu chuẩn' },
                { phrase: 'industry benchmark', vietnamese: 'tiêu chuẩn ngành' },
                { phrase: 'benchmark performance', vietnamese: 'đánh giá hiệu suất theo chuẩn' },
            ],
            collocationExercise: {
                sentence: 'This company has ___ a new benchmark for quality.',
                sentenceVi: 'Công ty này đã đặt ra một chuẩn mực mới về chất lượng.',
                options: ['set', 'made', 'done', 'put'],
                answer: 'set',
            },
            exampleSentences: [
                { en: 'The software became the benchmark for the industry.', vi: 'Phần mềm đó trở thành chuẩn mực của ngành.' },
            ],
            sentenceSequence: {
                en: 'We use this as a benchmark.',
                vi: 'Chúng tôi sử dụng điều này như là một tiêu chuẩn.',
            },
        },
        {
            word: 'acquisition',
            phonetic: '/ˌæk.wɪˈzɪʃ.ən/',
            partOfSpeech: 'noun',
            vietnameseMeaning: 'sự mua lại, sự thu mua',
            explanation: 'Hành động một phần hoặc toàn bộ tài sản, công ty hoặc kỹ năng để biến nó thành của mình.',
            distractors: ['accusation', 'application', 'association'],
            pronunciationTip: 'Nhấn âm tiết thứ 3: ac-qui-ZI-tion',
            collocations: [
                { phrase: 'corporate acquisition', vietnamese: 'mua lại doanh nghiệp' },
                { phrase: 'talent acquisition', vietnamese: 'tuyển dụng nhân tài' },
                { phrase: 'acquisition strategy', vietnamese: 'chiến lược mua lại' },
            ],
            collocationExercise: {
                sentence: 'Our new ___ strategy was finalized yesterday.',
                sentenceVi: 'Chiến lược mua lại mới của chúng ta đã được chốt vào hôm qua.',
                options: ['acquisition', 'acquire', 'adding', 'admission'],
                answer: 'acquisition',
            },
            exampleSentences: [
                { en: 'The acquisition cost $2 billion.', vi: 'Thương vụ mua lại trị giá 2 tỷ đô la.' },
            ],
            sentenceSequence: {
                en: 'The acquisition of the company was approved.',
                vi: 'Việc mua lại của công ty đã được phê duyệt.',
            },
        },
        {
            word: 'compliance',
            phonetic: '/kəmˈplaɪ.əns/',
            partOfSpeech: 'noun',
            vietnameseMeaning: 'sự tuân thủ',
            explanation: 'Hành động tuân theo, làm đúng với các quy định, luật lệ, nghị quyết hoặc yêu cầu nào đó đã được ban hành.',
            distractors: ['compliment', 'complaint', 'competence'],
            pronunciationTip: 'Nhấn âm tiết thứ 2: com-PLI-ance',
            collocations: [
                { phrase: 'in compliance with', vietnamese: 'tuân thủ theo' },
                { phrase: 'regulatory compliance', vietnamese: 'tuân thủ quy định' },
                { phrase: 'compliance officer', vietnamese: 'nhân viên tuân thủ' },
            ],
            collocationExercise: {
                sentence: 'All employees must be ___ compliance with company policies.',
                sentenceVi: 'Tất cả nhân viên phải tuân thủ điều khoản các chính sách của công ty.',
                options: ['in', 'on', 'at', 'with'],
                answer: 'in',
            },
            exampleSentences: [
                { en: 'The company ensured full compliance with the regulations.', vi: 'Công ty đảm bảo tuân thủ đầy đủ các quy định.' },
            ],
            sentenceSequence: {
                en: 'We are in compliance with the law.',
                vi: 'Chúng tôi tuân thủ theo luật pháp.',
            },
        },
        {
            word: 'productivity',
            phonetic: '/ˌprɒd.ʌkˈtɪv.ɪ.ti/',
            partOfSpeech: 'noun',
            vietnameseMeaning: 'năng suất',
            explanation: 'Mức độ hoặc tỷ lệ sản xuất ra hàng hóa, dịch vụ so với lượng thời gian, công sức và tài nguyên đã bỏ ra.',
            distractors: ['profitability', 'possibility', 'creativity'],
            pronunciationTip: 'Nhấn âm tiết thứ 3: pro-duc-TIV-i-ty',
            collocations: [
                { phrase: 'boost productivity', vietnamese: 'tăng năng suất' },
                { phrase: 'employee productivity', vietnamese: 'năng suất nhân viên' },
                { phrase: 'productivity tools', vietnamese: 'công cụ năng suất' },
            ],
            collocationExercise: {
                sentence: 'The new software helped ___ our team\'s productivity.',
                sentenceVi: 'Phần mềm mới đã giúp tăng năng suất của nhóm chúng ta.',
                options: ['boost', 'rise', 'grow', 'lift'],
                answer: 'boost',
            },
            exampleSentences: [
                { en: 'Remote work can increase productivity for many employees.', vi: 'Làm việc từ xa có thể tăng năng suất cho nhiều nhân viên.' },
            ],
            sentenceSequence: {
                en: 'Productivity has increased.',
                vi: 'năng suất đã tăng lên.',
            },
        },
    ],

    technology: [
        {
            word: 'algorithm',
            phonetic: '/ˈæl.ɡə.rɪð.əm/',
            partOfSpeech: 'noun',
            vietnameseMeaning: 'thuật toán',
            explanation: 'Một tập hợp các quy tắc toán học hoặc quy trình logic từng bước được máy tính giải quyết để thực hiện một tác vụ cụ thể.',
            distractors: ['logarithm', 'altruism', 'mechanism'],
            pronunciationTip: 'Nhấn âm tiết đầu: AL-go-rithm',
            collocations: [
                { phrase: 'search algorithm', vietnamese: 'thuật toán tìm kiếm' },
                { phrase: 'sorting algorithm', vietnamese: 'thuật toán sắp xếp' },
                { phrase: 'machine learning algorithm', vietnamese: 'thuật toán máy học' },
            ],
            collocationExercise: {
                sentence: 'The ___ algorithm processes billions of queries daily.',
                sentenceVi: 'thuật toán tìm kiếm xử lý hàng tỷ truy vấn mỗi ngày.',
                options: ['search', 'find', 'look', 'seek'],
                answer: 'search',
            },
            exampleSentences: [
                { en: 'The algorithm can detect patterns in large datasets.', vi: 'thuật toán có thể phát hiện các mẫu trong bộ dữ liệu lớn.' },
            ],
            sentenceSequence: {
                en: 'The algorithm runs efficiently.',
                vi: 'thuật toán chạy hiệu quả.',
            },
        },
        {
            word: 'database',
            phonetic: '/ˈdeɪ.tə.beɪs/',
            partOfSpeech: 'noun',
            vietnameseMeaning: 'cơ sở dữ liệu',
            explanation: 'Một hệ thống lưu trữ khối lượng lớn thông tin được tổ chức một cách có cấu trúc trên máy tính để dễ dàng truy cập và quản lý.',
            distractors: ['dateline', 'debate', 'debase'],
            pronunciationTip: 'Nhấn âm tiết đầu: DA-ta-base',
            collocations: [
                { phrase: 'relational database', vietnamese: 'cơ sở dữ liệu quan hệ' },
                { phrase: 'query a database', vietnamese: 'truy vấn cơ sở dữ liệu' },
                { phrase: 'database management', vietnamese: 'quản lý cơ sở dữ liệu' },
            ],
            collocationExercise: {
                sentence: 'We need to ___ the database for customer records.',
                sentenceVi: 'Chúng ta cần truy vấn cơ sở dữ liệu để lấy hồ sơ khách hàng.',
                options: ['query', 'ask', 'search', 'find'],
                answer: 'query',
            },
            exampleSentences: [
                { en: 'All customer information is stored in the database.', vi: 'Toàn bộ thông tin khách hàng được lưu trong cơ sở dữ liệu.' },
            ],
            sentenceSequence: {
                en: 'The data is stored in the database.',
                vi: 'dữ liệu được lưu trữ trong cơ sở dữ liệu.',
            },
        },
        {
            word: 'interface',
            phonetic: '/ˈɪn.tər.feɪs/',
            partOfSpeech: 'noun',
            vietnameseMeaning: 'giao diện',
            explanation: 'Điểm tương tác, nơi giao tiếp giữa người sử dụng (người dùng) và máy tính, phần mềm hoặc một thiết bị.',
            distractors: ['interact', 'internal', 'interval'],
            pronunciationTip: 'Nhấn âm tiết đầu: in-ter-face',
            collocations: [
                { phrase: 'user interface', vietnamese: 'giao diện người dùng' },
                { phrase: 'graphical interface', vietnamese: 'giao diện đồ họa' },
                { phrase: 'intuitive interface', vietnamese: 'giao diện trực quan' },
            ],
            collocationExercise: {
                sentence: 'The app has a very ___ user interface.',
                sentenceVi: 'Ứng dụng có giao diện người dùng rất trực quan.',
                options: ['intuitive', 'intelligent', 'intensive', 'intentional'],
                answer: 'intuitive',
            },
            exampleSentences: [
                { en: 'The new interface is much more user-friendly.', vi: 'Giao diện mới thân thiện với người dùng hơn nhiều.' },
            ],
            sentenceSequence: {
                en: 'The user interface is easy to navigate.',
                vi: 'giao diện người dùng rất dễ điều hướng.',
            },
        },
        {
            word: 'deploy',
            phonetic: '/dɪˈplɔɪ/',
            partOfSpeech: 'verb',
            vietnameseMeaning: 'triển khai',
            explanation: 'Hành động cài đặt, cấu hình và đưa một ứng dụng hay hệ thống phần mềm vào trạng thái hoạt động chính thức để người dùng sử dụng.',
            distractors: ['destroy', 'decoy', 'delay'],
            pronunciationTip: 'Nhấn âm tiết thứ 2: de-PLOY',
            collocations: [
                { phrase: 'deploy an application', vietnamese: 'triển khai ứng dụng' },
                { phrase: 'deploy to production', vietnamese: 'đưa lên môi trường production' },
                { phrase: 'deploy resources', vietnamese: 'triển khai tài nguyên' },
            ],
            collocationExercise: {
                sentence: 'We will ___ the new version to production tonight.',
                sentenceVi: 'Chúng tôi sẽ triển khai phiên bản mới lên môi trường thực tế vào tối nay.',
                options: ['deploy', 'deliver', 'develop', 'design'],
                answer: 'deploy',
            },
            exampleSentences: [
                { en: 'The team deployed the update successfully.', vi: 'Nhóm đã triển khai bản cập nhật thành công.' },
            ],
            sentenceSequence: {
                en: 'We deployed the app to production.',
                vi: 'Chúng tôi đã triển khai ứng dụng lên môi trường thực tế.',
            },
        },
        {
            word: 'encrypt',
            phonetic: '/ɪnˈkrɪpt/',
            partOfSpeech: 'verb',
            vietnameseMeaning: 'mã hóa',
            explanation: 'Chuyển đổi dữ liệu thông thường thành một dạng mật mã bí mật để chỉ những ai có khóa giải mã mới có thể đọc được nhằm bảo mật thông tin.',
            distractors: ['enclose', 'encode', 'endorse'],
            pronunciationTip: 'Nhấn âm tiết thứ 2: en-CRYPT',
            collocations: [
                { phrase: 'encrypt data', vietnamese: 'mã hóa dữ liệu' },
                { phrase: 'encrypted connection', vietnamese: 'kết nối mã hóa' },
                { phrase: 'end-to-end encryption', vietnamese: 'mã hóa đầu cuối' },
            ],
            collocationExercise: {
                sentence: 'All sensitive data must be ___ before transmission.',
                sentenceVi: 'Tất cả dữ liệu nhạy cảm phải được mã hóa trước khi truyền đi.',
                options: ['encrypted', 'encoded', 'enclosed', 'endorsed'],
                answer: 'encrypted',
            },
            exampleSentences: [
                { en: 'The files are encrypted for security.', vi: 'Các tập tin được mã hóa để bảo mật.' },
            ],
            sentenceSequence: {
                en: 'The data is encrypted.',
                vi: 'dữ liệu được mã hóa.',
            },
        },
    ],

    ielts: [
        {
            word: 'phenomenon',
            phonetic: '/fɪˈnɒm.ɪ.nən/',
            partOfSpeech: 'noun',
            vietnameseMeaning: 'hiện tượng',
            explanation: 'Một sự thật, sự kiện hoặc tình huống kiện đáng chú ý được quan sát thấy xảy ra trong tự nhiên hoặc xã hội, thường cần được giải thích về mặt khoa học.',
            distractors: ['philosophy', 'philanthropy', 'pharmacy'],
            pronunciationTip: 'Nhấn âm tiết thứ 2: fe-NOM-e-non. Số nhiều: phenomena',
            collocations: [
                { phrase: 'natural phenomenon', vietnamese: 'hiện tượng tự nhiên' },
                { phrase: 'cultural phenomenon', vietnamese: 'hiện tượng văn hóa' },
                { phrase: 'global phenomenon', vietnamese: 'hiện tượng toàn cầu' },
            ],
            collocationExercise: {
                sentence: 'Climate change is a ___ phenomenon affecting the entire world.',
                sentenceVi: 'Biến đổi khí hậu là một hiện tượng toàn cầu đang ảnh hưởng đến toàn thế giới.',
                options: ['global', 'world', 'total', 'full'],
                answer: 'global',
            },
            exampleSentences: [
                { en: 'This phenomenon has been studied by scientists for decades.', vi: 'Hiện tượng này đã được các nhà khoa học nghiên cứu hàng thập kỷ.' },
            ],
            sentenceSequence: {
                en: 'These phenomena are fascinating.',
                vi: 'Những hiện tượng này thật hấp dẫn.',
            },
        },
        {
            word: 'significant',
            phonetic: '/sɪɡˈnɪf.ɪ.kənt/',
            partOfSpeech: 'adjective',
            vietnameseMeaning: 'đáng kể, quan trọng',
            explanation: 'Đủ lớn, đủ rõ ràng rệt để có ảnh hưởng thực tế và đáng được chú ý hay cân nhắc tới.',
            distractors: ['sufficient', 'magnificent', 'efficient'],
            pronunciationTip: 'Nhấn âm tiết thứ 2: sig-NIF-i-cant',
            collocations: [
                { phrase: 'significant increase', vietnamese: 'tăng đáng kể' },
                { phrase: 'significant impact', vietnamese: 'tác động đáng kể' },
                { phrase: 'statistically significant', vietnamese: 'có ý nghĩa thống kê' },
            ],
            collocationExercise: {
                sentence: 'There was a ___ increase in temperature last year.',
                sentenceVi: 'Đã có sự gia tăng đáng kể về nhiệt độ vào năm ngoái.',
                options: ['significant', 'signified', 'signature', 'signal'],
                answer: 'significant',
            },
            exampleSentences: [
                { en: 'The results showed a significant improvement.', vi: 'Kết quả cho thấy sự cải thiện đáng kể.' },
            ],
            sentenceSequence: {
                en: 'This is significantly different.',
                vi: 'điều này khác biệt đáng kể.',
            },
        },
        {
            word: 'contribute',
            phonetic: '/kənˈtrɪb.juːt/',
            partOfSpeech: 'verb',
            vietnameseMeaning: 'đóng góp',
            explanation: 'Cung cấp tiền bạc, công sức, ý tưởng hay tài nguyên cùng với những người khác để giúp đạt được một mục tiêu chung.',
            distractors: ['distribute', 'attribute', 'constitute'],
            pronunciationTip: 'Nhấn âm tiết thứ 2: con-TRIB-ute',
            collocations: [
                { phrase: 'contribute to', vietnamese: 'đóng góp vào' },
                { phrase: 'significantly contribute', vietnamese: 'đóng góp đáng kể' },
                { phrase: 'contribute ideas', vietnamese: 'đóng góp ý kiến' },
            ],
            collocationExercise: {
                sentence: 'Many factors ___ to global warming.',
                sentenceVi: 'Nhiều yếu tố đóng góp vào sự nóng lên toàn cầu.',
                options: ['contribute', 'distribute', 'attribute', 'constitute'],
                answer: 'contribute',
            },
            exampleSentences: [
                { en: 'Technology has contributed to economic growth.', vi: 'Công nghệ đã đóng góp vào tăng trưởng kinh tế.' },
            ],
            sentenceSequence: {
                en: 'This contributes to the problem.',
                vi: 'điều này góp phần vào vấn đề.',
            },
        },
    ],
};

export default wordData;
