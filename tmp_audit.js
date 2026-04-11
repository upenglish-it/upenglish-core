const fs = require('fs');
const path = require('path');

function getFiles(dir, ext) {
    try { return fs.readdirSync(dir).filter(f => f.endsWith(ext)).sort(); }
    catch(e) { return []; }
}

function getRecursive(dir, ext) {
    try {
        let all = [];
        function walk(d) {
            fs.readdirSync(d).forEach(f => {
                const full = path.join(d, f);
                if(fs.statSync(full).isDirectory()) walk(full);
                else if(f.endsWith(ext)) all.push(f);
            });
        }
        walk(dir);
        return all.sort();
    } catch(e) { return []; }
}

function getFnExports(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const matches = content.match(/export\s+(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g) || [];
        return matches.map(m => m.replace(/export\s+(?:async\s+)?function\s+/, '')).sort();
    } catch(e) { return []; }
}

// ============ FILE-LEVEL AUDITS ============
console.log('\n===== 1. SERVICE FILE AUDIT =====');
const srcSvc = getFiles('sUPerStudy---Merging/src/services', '.js');
const feSvc  = getFiles('superstudy-fe/src/services', '.js');
const missingSvc = srcSvc.filter(f => !feSvc.includes(f));
const extraSvc   = feSvc.filter(f => !srcSvc.includes(f));
console.log('Missing from FE:', missingSvc.join(', ') || 'NONE');
console.log('Extra in FE:', extraSvc.join(', ') || 'none');

console.log('\n===== 2. PAGE FILE AUDIT =====');
const srcPages = getRecursive('sUPerStudy---Merging/src/pages', '.jsx');
const fePages  = getRecursive('superstudy-fe/src/pages', '.jsx');
const missingPages = srcPages.filter(f => !fePages.includes(f));
const extraPages   = fePages.filter(f => !srcPages.includes(f));
console.log('Missing from FE:', missingPages.join(', ') || 'NONE');
console.log('Extra in FE:', extraPages.join(', ') || 'none');

console.log('\n===== 3. COMPONENT FILE AUDIT =====');
const srcComp = getRecursive('sUPerStudy---Merging/src/components', '.jsx');
const feComp  = getRecursive('superstudy-fe/src/components', '.jsx');
const missingComp = srcComp.filter(f => !feComp.includes(f));
console.log('Missing from FE:', missingComp.join(', ') || 'NONE');

console.log('\n===== 4. CONTEXT/HOOKS/UTILS AUDIT =====');
const srcContexts = getFiles('sUPerStudy---Merging/src/contexts', '.jsx').concat(getFiles('sUPerStudy---Merging/src/contexts', '.js'));
const feContexts  = getFiles('superstudy-fe/src/contexts', '.jsx').concat(getFiles('superstudy-fe/src/contexts', '.js'));
console.log('Missing contexts:', srcContexts.filter(f => !feContexts.includes(f)).join(', ') || 'NONE');

const srcHooks = getFiles('sUPerStudy---Merging/src/hooks', '.js').concat(getFiles('sUPerStudy---Merging/src/hooks', '.jsx'));
const feHooks  = getFiles('superstudy-fe/src/hooks', '.js').concat(getFiles('superstudy-fe/src/hooks', '.jsx'));
console.log('Missing hooks:', srcHooks.filter(f => !feHooks.includes(f)).join(', ') || 'NONE');

const srcUtils = getFiles('sUPerStudy---Merging/src/utils', '.js');
const feUtils  = getFiles('superstudy-fe/src/utils', '.js');
console.log('Missing utils:', srcUtils.filter(f => !feUtils.includes(f)).join(', ') || 'NONE');

const srcData = getFiles('sUPerStudy---Merging/src/data', '.json').concat(getFiles('sUPerStudy---Merging/src/data', '.js'));
const feData  = getFiles('superstudy-fe/src/data', '.json').concat(getFiles('superstudy-fe/src/data', '.js'));
console.log('Missing data files:', srcData.filter(f => !feData.includes(f)).join(', ') || 'NONE');

// ============ FUNCTION-LEVEL AUDITS for KEY SERVICES ============
console.log('\n===== 5. FUNCTION-LEVEL AUDIT (KEY SERVICES) =====');
const serviceFiles = [
    'adminService.js', 'examService.js', 'teacherService.js',
    'grammarService.js', 'duplicateService.js', 'miniGameService.js',
    'notificationService.js', 'aiService.js', 'conversionService.js',
    'spacedRepetition.js', 'teacherRatingService.js', 'skillReportService.js',
    'rewardPointsService.js', 'redFlagService.js', 'feedbackService.js',
    'promptService.js', 'vocabImageService.js', 'contentProposalService.js',
];

serviceFiles.forEach(svc => {
    const srcFns = getFnExports(`sUPerStudy---Merging/src/services/${svc}`);
    const feFns  = getFnExports(`superstudy-fe/src/services/${svc}`);
    if(srcFns.length === 0 && feFns.length === 0) return;
    const missing = srcFns.filter(f => !feFns.includes(f));
    if(missing.length > 0) {
        console.log(`${svc}: MISSING [${missing.join(', ')}]`);
    }
});

// ============ SIZE DISCREPANCY AUDIT for KEY PAGES ============
console.log('\n===== 6. SIZE DISCREPANCY AUDIT (pages > 5KB diff) =====');
const pageMap = [
    ['src/pages/admin/AdminTopicsPage.jsx', 'src/pages/admin/AdminTopicsPage.jsx'],
    ['src/pages/admin/AdminTopicWordsPage.jsx', 'src/pages/admin/AdminTopicWordsPage.jsx'],
    ['src/pages/admin/AdminExamsPage.jsx', 'src/pages/admin/AdminExamsPage.jsx'],
    ['src/pages/admin/AdminGrammarPage.jsx', 'src/pages/admin/AdminGrammarPage.jsx'],
    ['src/pages/admin/AdminMiniGamesPage.jsx', 'src/pages/admin/AdminMiniGamesPage.jsx'],
    ['src/pages/admin/AdminUsersPage.jsx', 'src/pages/admin/AdminUsersPage.jsx'],
    ['src/pages/admin/AdminDashboardPage.jsx', 'src/pages/admin/AdminDashboardPage.jsx'],
    ['src/pages/teacher/ExamEditorPage.jsx', 'src/pages/teacher/ExamEditorPage.jsx'],
    ['src/pages/teacher/TeacherMiniGamesPage.jsx', 'src/pages/teacher/TeacherMiniGamesPage.jsx'],
    ['src/pages/teacher/TeacherGroupsPage.jsx', 'src/pages/teacher/TeacherGroupsPage.jsx'],
    ['src/pages/teacher/ExamSubmissionsPage.jsx', 'src/pages/teacher/ExamSubmissionsPage.jsx'],
    ['src/pages/student/TakeExamPage.jsx', 'src/pages/student/TakeExamPage.jsx'],
    ['src/pages/student/LearnPage.jsx', 'src/pages/student/LearnPage.jsx'],
    ['src/pages/DashboardPage.jsx', 'src/pages/DashboardPage.jsx'],
    ['src/pages/it/ITGamesPage.jsx', 'src/pages/it/ITGamesPage.jsx'],
    ['src/pages/it/ITDashboardPage.jsx', 'src/pages/it/ITDashboardPage.jsx'],
    ['src/pages/teacher/TeacherGrammarEditorPage.jsx', 'src/pages/teacher/TeacherGrammarEditorPage.jsx'],
];

pageMap.forEach(([srcRel, feRel]) => {
    try {
        const srcSize = fs.statSync(`sUPerStudy---Merging/${srcRel}`).size;
        const feSize  = fs.statSync(`superstudy-fe/${feRel}`).size;
        const diff = srcSize - feSize;
        if(Math.abs(diff) > 5000) {
            console.log(`${srcRel.split('/').pop()}: src=${srcSize}B fe=${feSize}B DIFF=${diff}B`);
        }
    } catch(e) {}
});

// ============ BACKEND MODULES AUDIT ============
console.log('\n===== 7. BACKEND MODULES AUDIT =====');
const backendModulesDir = 'backend/apps/superstudy/src/modules';
const backendModules = fs.readdirSync(backendModulesDir).filter(f => 
    fs.statSync(`${backendModulesDir}/${f}`).isDirectory()
).sort();
console.log('Backend modules:', backendModules.join(', '));

// Check for Agenda job definitions
const hasAgendaJobs = fs.existsSync('backend/apps/superstudy/src/jobs');
console.log('Agenda jobs folder exists:', hasAgendaJobs);
console.log('Done.');
