import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TopicSelectPage from './pages/TopicSelectPage';
import LearnPage from './pages/LearnPage';
import PendingApprovalPage from './pages/PendingApprovalPage';
import SocialLoginLandingPage from './pages/SocialLoginLandingPage';
import CustomInputPage from './pages/CustomInputPage';
import SavedListsPage from './pages/SavedListsPage';
import GenerateListPage from './pages/GenerateListPage';
import ReviewPage from './pages/ReviewPage';
import LearnGrammarPage from './pages/LearnGrammarPage';
import GrammarReviewPage from './pages/GrammarReviewPage';
import GrammarSelectPage from './pages/student/GrammarSelectPage';
import AdminRoute from './components/AdminRoute';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminTopicsPage from './pages/admin/AdminTopicsPage';
import AdminTopicWordsPage from './pages/admin/AdminTopicWordsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminGroupsPage from './pages/admin/AdminGroupsPage';
import AdminTeacherTopicsPage from './pages/admin/AdminTeacherTopicsPage';
import AdminGrammarPage from './pages/admin/AdminGrammarPage';
import AdminTeacherGrammarPage from './pages/admin/AdminTeacherGrammarPage';
import AdminExamsPage from './pages/admin/AdminExamsPage';
import AdminTeacherExamsPage from './pages/admin/AdminTeacherExamsPage';
import AdminReportPeriodsPage from './pages/admin/AdminReportPeriodsPage';
import AdminPromptsPage from './pages/admin/AdminPromptsPage';
import AdminRewardPointsPage from './pages/admin/AdminRewardPointsPage';
import AdminFeedbackPage from './pages/admin/AdminFeedbackPage';
import AdminMiniGamesPage from './pages/admin/AdminMiniGamesPage';
import ExamEditorPage from './pages/admin/ExamEditorPage';
import TeacherRoute from './components/auth/TeacherRoute';
import TeacherLayout from './pages/teacher/TeacherLayout';
import TeacherGroupsPage from './pages/teacher/TeacherGroupsPage';
import TeacherGroupDetailPage from './pages/teacher/TeacherGroupDetailPage';
import TeacherTopicsPage from './pages/teacher/TeacherTopicsPage';
import TeacherTopicWordsPage from './pages/teacher/TeacherTopicWordsPage';
import TeacherGrammarPage from './pages/teacher/TeacherGrammarPage';
import TeacherGrammarEditorPage from './pages/teacher/TeacherGrammarEditorPage';
import TeacherExamsPage from './pages/teacher/TeacherExamsPage';
import ExamSubmissionsPage from './pages/teacher/ExamSubmissionsPage';
import StudentProgressPage from './pages/teacher/StudentProgressPage';
import TeacherPromptsPage from './pages/teacher/TeacherPromptsPage';
import TeacherRatingResultsPage from './pages/teacher/TeacherRatingResultsPage';
import TeacherReceivedFeedbackPage from './pages/teacher/TeacherReceivedFeedbackPage';
import TeacherMiniGamesPage from './pages/teacher/TeacherMiniGamesPage';
import TeacherDashboardPage from './pages/teacher/TeacherDashboardPage';
import ITRoute from './components/auth/ITRoute';
import ITLayout from './pages/it/ITLayout';
import ITDashboardPage from './pages/it/ITDashboardPage';
import ITGamesPage from './pages/it/ITGamesPage';
import TakeExamPage from './pages/TakeExamPage';

import TeacherRatingFormPage from './pages/student/TeacherRatingFormPage';
import ExamResultPage from './pages/ExamResultPage';

import { AppSettingsProvider } from './contexts/AppSettingsContext';
import ModalBackHandler from './components/common/ModalBackHandler';

// --- Handling Deep Link / Share URL before React Router mounts --- //
if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    let shareId = url.searchParams.get('shareId');
    let shareType = url.searchParams.get('shareType');

    // Fallback if app is in an iframe (common on some hosting/preview sites)
    if (!shareId && window.parent !== window) {
        try {
            const topUrl = new URL(window.top.location.href);
            shareId = topUrl.searchParams.get('shareId');
            shareType = topUrl.searchParams.get('shareType');
        } catch (e) {
            // Silently fail if top window is inaccessible (CORS)
        }
    }

    if (shareId && shareType) {
        sessionStorage.setItem('pendingDeepLink', JSON.stringify({ shareId, shareType }));

        // Clean parameters from current window to avoid re-processing or leaking
        url.search = '';
        window.history.replaceState({ path: url.toString() }, '', url.toString());
    }
}

function ScrollToTop() {
    const { pathname } = useLocation();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    return null;
}

// Handles ?_preview= param: after React mounts, navigate() to the real route
// Must be inside BrowserRouter to use useNavigate()
function PreviewRedirect() {
    const navigate = useNavigate();

    useEffect(() => {
        if (window.__PENDING_PREVIEW__) {
            const path = window.__PENDING_PREVIEW__;
            delete window.__PENDING_PREVIEW__;
            navigate(path, { replace: true });
        }
    }, [navigate]);

    return null;
}

function App() {
    return (
        <BrowserRouter>
            <ScrollToTop />
            <PreviewRedirect />
            <ModalBackHandler />
            <AuthProvider>
                <AppSettingsProvider>
                    <Routes>
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/sll" element={<SocialLoginLandingPage />} />
                        <Route path="/pending" element={<PendingApprovalPage />} />
                        <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                        <Route path="/topics" element={<ProtectedRoute><TopicSelectPage /></ProtectedRoute>} />
                        <Route path="/custom-input" element={<ProtectedRoute><CustomInputPage /></ProtectedRoute>} />
                        <Route path="/saved-lists" element={<ProtectedRoute><SavedListsPage /></ProtectedRoute>} />
                        <Route path="/generate-list" element={<ProtectedRoute><GenerateListPage /></ProtectedRoute>} />
                        <Route path="/review" element={<ProtectedRoute><ReviewPage /></ProtectedRoute>} />
                        <Route path="/progress" element={<Navigate to="/" replace />} />
                        <Route path="/learn" element={<ProtectedRoute><LearnPage /></ProtectedRoute>} />
                        <Route path="/grammar-learn" element={<ProtectedRoute><LearnGrammarPage /></ProtectedRoute>} />
                        <Route path="/grammar-review" element={<ProtectedRoute><GrammarReviewPage /></ProtectedRoute>} />
                        <Route path="/grammar-topics" element={<ProtectedRoute><GrammarSelectPage /></ProtectedRoute>} />
                        <Route path="/exam" element={<ProtectedRoute><TakeExamPage /></ProtectedRoute>} />
                        <Route path="/exam-result" element={<ProtectedRoute><ExamResultPage /></ProtectedRoute>} />
                        <Route path="/rate-teacher" element={<ProtectedRoute><TeacherRatingFormPage /></ProtectedRoute>} />
                        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
                            <Route index element={<AdminDashboardPage />} />
                            <Route path="topics" element={<AdminTopicsPage />} />
                            <Route path="topics/:topicId" element={<AdminTopicWordsPage />} />
                            <Route path="users" element={<AdminUsersPage />} />
                            <Route path="groups" element={<AdminGroupsPage />} />
                            <Route path="reward-points" element={<AdminRewardPointsPage />} />
                            <Route path="groups/:groupId" element={<TeacherGroupDetailPage />} />
                            <Route path="teacher-topics" element={<AdminTeacherTopicsPage />} />
                            <Route path="teacher-topics/:topicId" element={<TeacherTopicWordsPage />} />
                            <Route path="grammar" element={<AdminGrammarPage />} />
                            <Route path="grammar/:id" element={<TeacherGrammarEditorPage />} />
                            <Route path="teacher-grammar" element={<AdminTeacherGrammarPage />} />
                            <Route path="teacher-grammar/:id" element={<TeacherGrammarEditorPage />} />
                            <Route path="exams" element={<AdminExamsPage />} />
                            <Route path="exams/:examId" element={<ExamEditorPage />} />
                            <Route path="teacher-exams" element={<AdminTeacherExamsPage />} />
                            <Route path="teacher-exams/:examId" element={<ExamEditorPage />} />
                            <Route path="exam-submissions/:assignmentId/:studentId" element={<ExamSubmissionsPage />} />
                            <Route path="groups/:groupId/students/:studentId" element={<StudentProgressPage />} />
                            <Route path="report-periods" element={<AdminReportPeriodsPage />} />
                            <Route path="feedback" element={<AdminFeedbackPage />} />
                            <Route path="mini-games" element={<AdminMiniGamesPage />} />
                            <Route path="prompts" element={<AdminPromptsPage />} />
                        </Route>
                        <Route path="/teacher" element={<TeacherRoute><TeacherLayout /></TeacherRoute>}>
                            <Route index element={<TeacherDashboardPage />} />
                            <Route path="groups" element={<TeacherGroupsPage />} />
                            <Route path="groups/:groupId" element={<TeacherGroupDetailPage />} />
                            <Route path="topics" element={<TeacherTopicsPage />} />
                            <Route path="topics/:topicId" element={<TeacherTopicWordsPage />} />
                            <Route path="system-topics/:topicId" element={<TeacherTopicWordsPage />} />
                            <Route path="grammar" element={<TeacherGrammarPage />} />
                            <Route path="grammar/:id" element={<TeacherGrammarEditorPage />} />
                            <Route path="system-grammar/:id" element={<TeacherGrammarEditorPage />} />
                            <Route path="exams" element={<TeacherExamsPage />} />
                            <Route path="exams/:examId" element={<ExamEditorPage />} />
                            <Route path="system-exams/:examId" element={<ExamEditorPage />} />
                            <Route path="exam-submissions/:assignmentId/:studentId" element={<ExamSubmissionsPage />} />
                            <Route path="groups/:groupId/students/:studentId" element={<StudentProgressPage />} />
                            <Route path="prompts" element={<TeacherPromptsPage />} />
                            <Route path="ratings" element={<TeacherRatingResultsPage />} />
                            <Route path="reward-points" element={<AdminRewardPointsPage />} />
                            <Route path="feedback" element={<TeacherReceivedFeedbackPage />} />
                            <Route path="mini-games" element={<TeacherMiniGamesPage />} />
                        </Route>
                        <Route path="/it" element={<ITRoute><ITLayout /></ITRoute>}>
                            <Route index element={<ITDashboardPage />} />
                            <Route path="games" element={<ITGamesPage />} />
                        </Route>
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </AppSettingsProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}



export default App;
