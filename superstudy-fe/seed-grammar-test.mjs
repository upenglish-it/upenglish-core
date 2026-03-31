/**
 * Seed script: Create a grammar exercise with ALL question types for UI testing.
 * Run from project root: node src/seed-grammar-test.mjs
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBuXAjB6jCOfzI7YAPkAQ8cVcWFT2-9qh8",
  authDomain: "vocabmaster-71b4a.firebaseapp.com",
  projectId: "vocabmaster-71b4a",
  storageBucket: "vocabmaster-71b4a.firebasestorage.app",
  messagingSenderId: "310596631914",
  appId: "1:310596631914:web:6a0806d53c820a5c98b913",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function findUserUid(email) {
  const q = query(collection(db, 'users'), where('email', '==', email));
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    return snapshot.docs[0].id;
  }
  return null;
}

async function main() {
  const email = 'huynhquan.nguyen@gmail.com';
  const uid = await findUserUid(email);
  
  if (!uid) {
    console.log('Could not find user with email:', email);
    console.log('Using email as teacherId placeholder...');
  }
  
  const teacherId = uid || email;
  console.log(`Using teacherId: ${teacherId}`);

  const exerciseRef = doc(collection(db, 'grammar_exercises'));
  const exerciseId = exerciseRef.id;
  
  await setDoc(exerciseRef, {
    name: '🧪 Test All Question Types',
    description: 'Bài học kỹ năng test giao diện - chứa tất cả các dạng câu hỏi',
    targetLevel: 'B1',
    targetAge: '15-18',
    teacherId: teacherId,
    isPublic: true,
    cachedQuestionCount: 8,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  console.log(`✅ Created exercise: ${exerciseId}`);

  const questions = [
    {
      type: 'multiple_choice',
      purpose: 'Kiểm tra kiến thức ngữ pháp - Thì hiện tại đơn',
      targetSkill: 'grammar',
      hasContext: false, context: '', contextAudioUrl: '',
      order: 0,
      variations: [
        { text: 'She _____ to school every day.', options: ['go', 'goes', 'going', 'gone'], correctAnswer: 1, explanation: '"She" là ngôi thứ 3 số ít → "goes".' },
        { text: 'My brother always _____ breakfast at 7 AM.', options: ['eat', 'eating', 'eats', 'eaten'], correctAnswer: 2, explanation: '"My brother" là ngôi 3 số ít → "eats".' },
        { text: 'They _____ English very well.', options: ['speaks', 'speak', 'speaking', 'spoke'], correctAnswer: 1, explanation: '"They" → "speak".' },
        { text: 'The cat usually _____ on the sofa.', options: ['sleep', 'sleeping', 'slept', 'sleeps'], correctAnswer: 3, explanation: '"The cat" → "sleeps".' },
        { text: 'We _____ football on Sundays.', options: ['plays', 'played', 'play', 'playing'], correctAnswer: 2, explanation: '"We" → "play".' }
      ]
    },
    {
      type: 'fill_in_blank',
      purpose: 'Điền từ vào chỗ trống - Giới từ',
      targetSkill: 'grammar',
      hasContext: false, context: '', contextAudioUrl: '',
      order: 1,
      variations: [
        { text: 'I am interested {{in}} learning new languages.', distractors: ['on', 'at'], explanation: '"Be interested in" là cụm giới từ cố định.' },
        { text: 'She is good {{at}} playing the piano.', distractors: ['in', 'on'], explanation: '"Be good at" → giỏi về.' },
        { text: 'He depends {{on}} his parents for money.', distractors: ['in', 'at'], explanation: '"Depend on" → phụ thuộc.' },
        { text: 'We arrived {{at}} the airport on time.', distractors: ['in', 'to'], explanation: '"Arrive at" cho địa điểm cụ thể.' },
        { text: 'They are looking {{for}} a new apartment.', distractors: ['at', 'after'], explanation: '"Look for" → tìm kiếm.' }
      ]
    },
    {
      type: 'fill_in_blank_typing',
      purpose: 'Tự nhập từ - Chia động từ',
      targetSkill: 'grammar',
      hasContext: false, context: '', contextAudioUrl: '',
      order: 2,
      variations: [
        { text: 'She {{has been}} studying English for 5 years.', explanation: '"For 5 years" → hiện tại hoàn thành tiếp diễn.' },
        { text: 'If I {{were}} you, I would study harder.', explanation: 'Điều kiện loại 2 → "were".' },
        { text: 'By next year, they {{will have finished}} the project.', explanation: '"By next year" → tương lai hoàn thành.' },
        { text: 'The book {{was written}} by a famous author.', explanation: 'Bị động quá khứ đơn → "was written".' },
        { text: 'I wish I {{could speak}} French fluently.', explanation: '"Wish" + could + V → ước muốn hiện tại.' }
      ]
    },
    {
      type: 'matching',
      purpose: 'Nối từ với nghĩa - Từ vựng môi trường',
      targetSkill: 'vocabulary',
      hasContext: false, context: '', contextAudioUrl: '',
      order: 3,
      variations: [
        { text: 'Nối các từ tiếng Anh với nghĩa tiếng Việt tương ứng.', pairs: [{ left: 'pollution', right: 'ô nhiễm' }, { left: 'renewable', right: 'tái tạo được' }, { left: 'deforestation', right: 'phá rừng' }, { left: 'conservation', right: 'bảo tồn' }], explanation: 'Từ vựng chủ đề môi trường.' },
        { text: 'Nối các cụm từ với định nghĩa đúng.', pairs: [{ left: 'global warming', right: 'sự nóng lên toàn cầu' }, { left: 'carbon footprint', right: 'dấu chân carbon' }, { left: 'endangered species', right: 'loài có nguy cơ tuyệt chủng' }, { left: 'sustainable', right: 'bền vững' }], explanation: 'Cụm từ về biến đổi khí hậu.' },
        { text: 'Nối hành động với tác động môi trường.', pairs: [{ left: 'recycling', right: 'giảm rác thải' }, { left: 'planting trees', right: 'tăng lượng oxy' }, { left: 'using plastic bags', right: 'gây ô nhiễm biển' }, { left: 'carpooling', right: 'giảm khí thải CO2' }], explanation: 'Mỗi hành động có tác động trực tiếp.' },
        { text: 'Nối động từ với giới từ đi kèm.', pairs: [{ left: 'depend', right: 'on' }, { left: 'belong', right: 'to' }, { left: 'result', right: 'in' }, { left: 'contribute', right: 'to' }], explanation: 'Cụm động từ + giới từ.' },
        { text: 'Nối từ đồng nghĩa.', pairs: [{ left: 'huge', right: 'enormous' }, { left: 'brave', right: 'courageous' }, { left: 'smart', right: 'intelligent' }, { left: 'happy', right: 'delighted' }], explanation: 'Từ đồng nghĩa giúp phong phú vốn từ.' }
      ]
    },
    {
      type: 'categorization',
      purpose: 'Phân loại từ vựng theo nhóm',
      targetSkill: 'vocabulary',
      hasContext: false, context: '', contextAudioUrl: '',
      order: 4,
      variations: [
        { text: 'Phân loại: Danh từ (Noun) hoặc Tính từ (Adjective).', groups: ['Noun', 'Adjective'], items: [{ text: 'happiness', group: 'Noun' }, { text: 'beautiful', group: 'Adjective' }, { text: 'freedom', group: 'Noun' }, { text: 'dangerous', group: 'Adjective' }, { text: 'knowledge', group: 'Noun' }, { text: 'creative', group: 'Adjective' }], explanation: 'Danh từ: -ness, -dom. Tính từ: -ful, -ous, -ive.' },
        { text: 'Phân loại: Động từ (Verb) hay Trạng từ (Adverb)?', groups: ['Verb', 'Adverb'], items: [{ text: 'quickly', group: 'Adverb' }, { text: 'discover', group: 'Verb' }, { text: 'carefully', group: 'Adverb' }, { text: 'improve', group: 'Verb' }, { text: 'suddenly', group: 'Adverb' }, { text: 'achieve', group: 'Verb' }], explanation: 'Trạng từ thường có -ly.' },
        { text: 'Phân loại: Countable hay Uncountable Noun?', groups: ['Countable', 'Uncountable'], items: [{ text: 'water', group: 'Uncountable' }, { text: 'book', group: 'Countable' }, { text: 'information', group: 'Uncountable' }, { text: 'apple', group: 'Countable' }, { text: 'advice', group: 'Uncountable' }, { text: 'student', group: 'Countable' }], explanation: 'Đếm được: dùng a/an + số nhiều. Không đếm được: không.' },
        { text: 'Phân loại: Past Simple hay Past Participle?', groups: ['Past Simple', 'Past Participle'], items: [{ text: 'went', group: 'Past Simple' }, { text: 'gone', group: 'Past Participle' }, { text: 'ate', group: 'Past Simple' }, { text: 'eaten', group: 'Past Participle' }, { text: 'wrote', group: 'Past Simple' }, { text: 'written', group: 'Past Participle' }], explanation: 'V2 dùng câu thường. V3 dùng hoàn thành & bị động.' },
        { text: 'Phân loại cảm xúc: Positive hay Negative?', groups: ['Positive', 'Negative'], items: [{ text: 'excited', group: 'Positive' }, { text: 'furious', group: 'Negative' }, { text: 'delighted', group: 'Positive' }, { text: 'anxious', group: 'Negative' }, { text: 'grateful', group: 'Positive' }, { text: 'disappointed', group: 'Negative' }], explanation: 'Nhận biết sắc thái cảm xúc.' }
      ]
    },
    {
      type: 'ordering',
      purpose: 'Sắp xếp câu đúng thứ tự',
      targetSkill: 'grammar',
      hasContext: false, context: '', contextAudioUrl: '',
      order: 5,
      variations: [
        { text: 'Sắp xếp các từ thành câu hoàn chỉnh.', items: ['She', 'has', 'been', 'studying', 'English', 'since', '2020'], explanation: '"She has been studying English since 2020."' },
        { text: 'Sắp xếp để tạo câu hỏi đúng.', items: ['How', 'long', 'have', 'you', 'lived', 'here', '?'], explanation: '"How long have you lived here?"' },
        { text: 'Sắp xếp thành câu bị động.', items: ['The', 'cake', 'was', 'made', 'by', 'my', 'mother'], explanation: '"The cake was made by my mother."' },
        { text: 'Sắp xếp các bước nấu ăn.', items: ['Wash the vegetables', 'Cut them into pieces', 'Heat the oil', 'Stir-fry for 5 minutes', 'Add seasoning'], explanation: 'Rửa → Cắt → Đun nóng dầu → Xào → Nêm gia vị.' },
        { text: 'Sắp xếp câu điều kiện.', items: ['If', 'I', 'had', 'more', 'time', ',', 'I', 'would', 'travel', 'around', 'the', 'world'], explanation: '"If I had more time, I would travel around the world."' }
      ]
    },
    {
      type: 'essay',
      purpose: 'Viết đoạn văn ngắn',
      targetSkill: 'writing',
      hasContext: false, context: '', contextAudioUrl: '',
      order: 6,
      variations: [
        { text: 'Write a short paragraph (50-80 words) about your favorite hobby.', explanation: 'Gồm: sở thích, lý do thích, tần suất. Dùng hiện tại đơn.' },
        { text: 'Describe your daily routine in 50-80 words.', explanation: 'Dùng: first, then, after that, finally.' },
        { text: 'Write about your best friend (50-80 words).', explanation: 'Mô tả ngoại hình, tính cách, lý do kết bạn.' },
        { text: 'What is your favorite season? Write 50-80 words.', explanation: 'Nêu mùa yêu thích, thời tiết, hoạt động.' },
        { text: 'If you could visit any country, where would you go? (50-80 words)', explanation: 'Dùng điều kiện loại 2: "If I could..., I would...".' }
      ]
    },
    {
      type: 'audio_recording',
      purpose: 'Luyện phát âm và nói',
      targetSkill: 'speaking',
      hasContext: false, context: '', contextAudioUrl: '',
      order: 7,
      variations: [
        { text: 'Read aloud: "The weather is beautiful today, and I want to go to the park with my friends."', explanation: 'Chú ý: "beautiful" /ˈbjuːtɪfl/, "weather" /ˈweðər/.' },
        { text: 'Introduce yourself in English. Include name, age, where you live, and hobbies.', explanation: 'Dùng: "My name is...", "I am ... years old".' },
        { text: 'Describe: A family is having dinner at a restaurant. What do you see?', explanation: 'Dùng hiện tại tiếp diễn: "They are eating...".' },
        { text: 'Tell a short story about what you did last weekend.', explanation: 'Dùng quá khứ đơn: "I went...", "I played...".' },
        { text: 'Give your opinion: "Should students wear school uniforms?"', explanation: 'Dùng: "I think/believe...", "In my opinion...".' }
      ]
    }
  ];

  for (const q of questions) {
    const questionRef = doc(collection(db, 'grammar_questions'));
    await setDoc(questionRef, {
      ...q,
      exerciseId: exerciseId,
      teacherId: teacherId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log(`  ✅ Created question (${q.type}): ${questionRef.id}`);
  }

  console.log('\n🎉 Done! Exercise ID:', exerciseId);
  console.log(`📱 Open: http://localhost:5173/teacher/grammar/${exerciseId}`);
  console.log(`📱 Or admin: http://localhost:5173/admin/teacher-grammar/${exerciseId}`);
  
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
