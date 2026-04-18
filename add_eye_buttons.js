const fs = require('fs');
const file = 'C:/Users/Jinshin/Desktop/projects/viet/upenglish-core/superstudy-fe/src/pages/teacher/TeacherExamsPage.jsx';
let content = fs.readFileSync(file, 'utf8');

const eyeBtn = `<button className="admin-action-btn" title={\`Xem tr\u01b0\u1edbc \${exam.examType === 'test' ? 'b\u00e0i ki\u1ec3m tra' : 'b\u00e0i t\u1eadp'}\`} onClick={() => { if (!exam.sections || exam.sections.length === 0) { alert('B\u00e0i t\u1eadp ch\u01b0a c\u00f3 n\u1ed9i dung \u0111\u1ec3 xem tr\u01b0\u1edbc.'); return; } window.open(\`\${window.__APP_BASE__ || './'}?_preview=\${encodeURIComponent(\`/exam?examId=\${exam.id}&preview=true\`)}\`, '_blank'); }}><Eye size={16} /></button>`;

// Inspect actual bytes after first /Link>
const idx = content.indexOf('/Link>');
const snippet = content.substring(idx, idx + 120);
console.log('Actual bytes after first /Link>:', JSON.stringify(snippet));

// Count occurrences before
console.log('Eye before:', (content.match(/Xem tr\u01b0\u1edbc/g) || []).length);

let cnt = 0;

// Pattern 1: deep indent (72 spaces), {isOwn && (
const indent1 = ' '.repeat(72);
const p1old = `/Link>\r\n${indent1}{isOwn && (`;
const p1new = `/Link>\r\n${indent1}${eyeBtn}\r\n${indent1}{isOwn && (`;
const c1 = content.split(p1old).length - 1;
console.log('Pattern 1 count:', c1);
if (c1 > 0) { content = content.split(p1old).join(p1new); cnt += c1; }

// Pattern 2: deep indent (72 spaces), <span (system row)
const p2old = `/Link>\r\n${indent1}<span style={{ fontSize: '0.8rem', color: '#3b82f6'`;
const p2new = `/Link>\r\n${indent1}${eyeBtn}\r\n${indent1}<span style={{ fontSize: '0.8rem', color: '#3b82f6'`;
const c2 = content.split(p2old).length - 1;
console.log('Pattern 2 count:', c2);
if (c2 > 0) { content = content.split(p2old).join(p2new); cnt += c2; }

// Pattern 3: shallower indent (60 spaces), {isOwn && ( (unassigned exams)
const indent3 = ' '.repeat(60);
const p3old = `/Link>\r\n${indent3}{isOwn && (`;
const p3new = `/Link>\r\n${indent3}${eyeBtn}\r\n${indent3}{isOwn && (`;
const c3 = content.split(p3old).length - 1;
console.log('Pattern 3 count:', c3);
if (c3 > 0) { content = content.split(p3old).join(p3new); cnt += c3; }

console.log('Total:', cnt);
console.log('Eye after:', (content.match(/Xem tr\u01b0\u1edbc/g) || []).length);

if (cnt > 0) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Written!');
} else {
    console.log('No patterns matched - checking what comes after /Link>...');
    // Show all /Link> occurrences
    let i = 0;
    let pos = 0;
    while ((pos = content.indexOf('/Link>', pos)) !== -1 && i < 6) {
        console.log(`  [${i}] pos=${pos}: ${JSON.stringify(content.substring(pos, pos + 100))}`);
        pos++;
        i++;
    }
}
