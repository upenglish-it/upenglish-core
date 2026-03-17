import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getExams, deleteExam, getAllTeacherExamFolders, saveTeacherExamFolder, deleteTeacherExamFolder, saveExam, createExamAssignment, getExamAssignmentsForExam, recalcExamQuestionCache } from '../../services/examService';
import { getGroups, toggleResourcePublic, getResourceSharedEntities, shareResourceToEmail, unshareResourceFromUser, shareResourceToGroup, unshareResourceFromGroup } from '../../services/adminService';
import { useAuth } from '../../contexts/AuthContext';
import { Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { BookOpen, Search, Trash2, Edit, AlertCircle, Globe, List, FolderOpen, X, ChevronDown, ChevronRight, AlertTriangle, User, Share2, Users, UsersRound, Mail, UserPlus, Lock, Send, FileText, CheckCircle, Clock } from 'lucide-react';
import CustomSelect from '../../components/common/CustomSelect';
import EmailAutocomplete from '../../components/common/EmailAutocomplete';

export default function AdminTeacherExamsPage() {
    const { user } = useAuth();
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [teacherMap, setTeacherMap] = useState({});

    // Share States
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const [resourceToShare, setResourceToShare] = useState(null);
    const [shareGroups, setShareGroups] = useState([]);
    const [allGroups, setAllGroups] = useState([]);
    const [shareUsers, setShareUsers] = useState([]);
    const [shareEmail, setShareEmail] = useState('');
    const [isSharing, setIsSharing] = useState(false);

    // Quick Assign States
    const [teacherManagedGroups, setTeacherManagedGroups] = useState([]);
    const [quickAssignGroupId, setQuickAssignGroupId] = useState('');
    const [quickAssignDueDate, setQuickAssignDueDate] = useState('');
    const [isQuickAssigning, setIsQuickAssigning] = useState(false);
    const [quickAssignSuccess, setQuickAssignSuccess] = useState('');
    const [existingAssignments, setExistingAssignments] = useState([]);

    // UI state
    const [expandedTeachers, setExpandedTeachers] = useState(new Set());
    const [expandedFolders, setExpandedFolders] = useState(new Set());

    // Folders state
    const [folders, setFolders] = useState([]);
    const [folderFormOpen, setFolderFormOpen] = useState(false);
    const [folderFormData, setFolderFormData] = useState({ name: '', description: '', icon: '📁', color: '#6366f1', isPublic: false });
    const [isFolderEditing, setIsFolderEditing] = useState(false);
    const [folderToDelete, setFolderToDelete] = useState(null);
    const [isSavingFolder, setIsSavingFolder] = useState(false);

    const [examToDelete, setExamToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [alertMessage, setAlertMessage] = useState(null);

    // Exam Edit State
    const [examFormOpen, setExamFormOpen] = useState(false);
    const [examFormData, setExamFormData] = useState({ id: '', name: '', title: '', description: '', durationMinutes: 60, isPublic: false, timingMode: 'exam' });
    const [isSavingExam, setIsSavingExam] = useState(false);
    const [originalTimingMode, setOriginalTimingMode] = useState('exam');

    useEffect(() => {
        loadData();
    }, []);

    const fetchTeacherInfo = async (teacherId, currentMap) => {
        if (!teacherId || currentMap[teacherId]) return;
        try {
            const userRef = doc(db, 'users', teacherId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                setTeacherMap(prev => ({ ...prev, [teacherId]: userSnap.data() }));
            } else {
                setTeacherMap(prev => ({ ...prev, [teacherId]: { email: 'Unknown user', displayName: 'Unknown' } }));
            }
        } catch (err) {
            console.error("Error fetching teacher:", err);
        }
    };

    async function loadData() {
        setLoading(true);
        try {
            const [examsData, foldersData] = await Promise.all([
                getExams('teacher'),
                getAllTeacherExamFolders()
            ]);
            setExams(examsData);
            setFolders(foldersData);

            const tempTeacherMap = { ...teacherMap };
            const allTeacherIds = new Set([
                ...examsData.map(ex => ex.createdBy),
                ...foldersData.map(f => f.teacherId),
                ...examsData.flatMap(ex => ex.collaboratorIds || [])
            ]);
            await Promise.all([...allTeacherIds].map(id => fetchTeacherInfo(id, tempTeacherMap)));

            // Background: refresh stale question-time caches for question-mode exams
            const questionModeExams = examsData.filter(ex => ex.timingMode === 'question');
            if (questionModeExams.length > 0) {
                Promise.all(questionModeExams.map(ex => recalcExamQuestionCache(ex.id))).then(() => {
                    // Reload exams to reflect updated cache
                    getExams('teacher').then(refreshed => setExams(refreshed)).catch(() => {});
                }).catch(() => {});
            }
        } catch (error) {
            console.error(error);
            setAlertMessage({ type: 'error', text: 'Lỗi tải dữ liệu: ' + error.message });
        }
        setLoading(false);
    }

    const filteredExams = exams.filter(ex => {
        const searchLower = searchTerm.toLowerCase();
        const teacher = teacherMap[ex.createdBy] || {};
        return (
            ex.name?.toLowerCase().includes(searchLower) ||
            ex.title?.toLowerCase().includes(searchLower) ||
            teacher.email?.toLowerCase().includes(searchLower) ||
            teacher.displayName?.toLowerCase().includes(searchLower)
        );
    });

    const filteredFolders = folders.filter(f => {
        const searchLower = searchTerm.toLowerCase();
        const teacher = teacherMap[f.teacherId] || {};
        const matchesFolder = (
            f.name?.toLowerCase().includes(searchLower) ||
            teacher.email?.toLowerCase().includes(searchLower) ||
            teacher.displayName?.toLowerCase().includes(searchLower)
        );
        const hasMatchingExam = (f.examIds || []).some(eid =>
            filteredExams.some(ex => ex.id === eid)
        );
        return matchesFolder || hasMatchingExam;
    });

    // Helper: get the teacherId from an exam (supports both `createdBy` and legacy `teacherId`)
    const getExamTeacherId = (ex) => ex.createdBy || ex.teacherId;

    async function handleConfirmDelete() {
        if (!examToDelete) return;
        setIsDeleting(true);
        try {
            await deleteExam(examToDelete.id);
            setExams(exams.filter(ex => ex.id !== examToDelete.id));
            setAlertMessage({ type: 'success', text: 'Đã xóa đề thi thành công!' });
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'Lỗi khi xóa đề thi: ' + error.message });
        }
        setIsDeleting(false);
        setExamToDelete(null);
    }

    // Folder CRUD
    function openFolderEditForm(folder) {
        setFolderFormData({ ...folder });
        setIsFolderEditing(true);
        setFolderFormOpen(true);
    }

    async function handleFolderSubmit(e) {
        e.preventDefault();
        setIsSavingFolder(true);
        try {
            await saveTeacherExamFolder(folderFormData.teacherId, folderFormData);
            setFolderFormOpen(false);
            setAlertMessage({ type: 'success', text: 'Cập nhật folder thành công!' });
            loadData();
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'Lỗi: ' + error.message });
        }
        setIsSavingFolder(false);
    }

    // Exam CRUD
    function openEditExamForm(exam) {
        setExamFormData({ ...exam, timingMode: exam.timingMode || 'exam' });
        setOriginalTimingMode(exam.timingMode || 'exam');
        setExamFormOpen(true);
    }

    async function handleExamSubmit(e) {
        e.preventDefault();
        setIsSavingExam(true);
        try {
            // Need to retain original fields, just updating name/title/description etc.
            await saveExam(examFormData);
            setExamFormOpen(false);
            setAlertMessage({ type: 'success', text: 'Cập nhật đề thi thành công!' });
            loadData();
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'Lỗi: ' + error.message });
        }
        setIsSavingExam(false);
    }

    async function handleConfirmDeleteFolder() {
        if (!folderToDelete) return;
        try {
            await deleteTeacherExamFolder(folderToDelete.id);
            setFolders(folders.filter(f => f.id !== folderToDelete.id));
            setAlertMessage({ type: 'success', text: 'Đã xóa folder thành công!' });
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'Lỗi xóa folder: ' + error.message });
        }
        setFolderToDelete(null);
    }

    // --- SHARE HANDLERS ---
    async function openShareModal(resource, type) {
        setResourceToShare({ ...resource, type });
        setShareModalOpen(true);
        setLinkCopied(false);
        setIsSharing(true);
        setShareEmail('');
        setQuickAssignGroupId('');
        setQuickAssignDueDate('');
        setQuickAssignSuccess('');
        try {
            const [entities, groupsData, assignments] = await Promise.all([
                getResourceSharedEntities(type, resource.id),
                getGroups(),
                type !== 'teacher_exam_folder' ? getExamAssignmentsForExam(resource.id) : Promise.resolve([])
            ]);
            setShareUsers(entities.users);
            setShareGroups(entities.groups.map(g => g.id));
            setAllGroups(groupsData);
            setTeacherManagedGroups(groupsData);
            setExistingAssignments(assignments.map(a => ({
                ...a,
                groupName: a.groupName || groupsData.find(g => g.id === (a.targetId || a.groupId))?.name || a.targetName || ''
            })));
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi tải thông tin chia sẻ: ' + err.message });
        }
        setIsSharing(false);
    }

    async function handleTogglePublic() {
        if (!resourceToShare) return;
        const newPublicStatus = !resourceToShare.isPublic;
        setIsSharing(true);
        try {
            await toggleResourcePublic(resourceToShare.type, resourceToShare.id, newPublicStatus);
            setResourceToShare({ ...resourceToShare, isPublic: newPublicStatus });
            loadData();
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi cập nhật public: ' + err.message });
        }
        setIsSharing(false);
    }

    async function handleAddShareEmail(e) {
        if (e && e.preventDefault) e.preventDefault();
        const emailToShare = typeof e === 'string' ? e : shareEmail;
        if (!emailToShare || !emailToShare.trim()) return;
        setIsSharing(true);
        try {
            const userAdded = await shareResourceToEmail(resourceToShare.type, resourceToShare.id, emailToShare);
            if (!shareUsers.some(u => u.id === userAdded.id)) {
                setShareUsers([...shareUsers, userAdded]);
            }
            setShareEmail('');
            setAlertMessage({ type: 'success', text: `Đã chia sẻ cho ${emailToShare}` });
        } catch (err) {
            setAlertMessage({ type: 'error', text: err.message });
        }
        setIsSharing(false);
    }

    async function handleRemoveShareUser(uid) {
        setIsSharing(true);
        try {
            await unshareResourceFromUser(resourceToShare.type, resourceToShare.id, uid);
            setShareUsers(shareUsers.filter(u => u.id !== uid));
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi xóa quyền: ' + err.message });
        }
        setIsSharing(false);
    }

    async function handleToggleGroupShare(groupId) {
        setIsSharing(true);
        try {
            if (shareGroups.includes(groupId)) {
                await unshareResourceFromGroup(resourceToShare.type, resourceToShare.id, groupId);
                setShareGroups(shareGroups.filter(id => id !== groupId));
            } else {
                await shareResourceToGroup(resourceToShare.type, resourceToShare.id, groupId);
                setShareGroups([...shareGroups, groupId]);
            }
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi chia sẻ nhóm: ' + err.message });
        }
        setIsSharing(false);
    }

    async function handleQuickAssign() {
        if (!quickAssignGroupId || !quickAssignDueDate || !resourceToShare) return;

        // Block if time setup is incomplete
        const examName = resourceToShare.name || resourceToShare.title;
        if (resourceToShare.timingMode === 'section' && (resourceToShare.sections || []).some(s => !s.timeLimitMinutes || s.timeLimitMinutes <= 0)) {
            setAlertMessage({ type: 'error', text: `Bài "${examName}" có section chưa đặt thời gian. Vui lòng hoàn thành thiết lập thời gian trước khi giao bài.` });
            return;
        }
        if (resourceToShare.timingMode === 'question') {
            setAlertMessage({ type: 'error', text: `Bài "${examName}" chưa hoàn thành thiết lập thời gian theo từng câu hỏi. Vui lòng kiểm tra thời gian từng câu trước khi giao bài.` });
            return;
        }

        setIsQuickAssigning(true);
        setQuickAssignSuccess('');
        try {
            const selectedGroup = teacherManagedGroups.find(g => g.id === quickAssignGroupId);
            await createExamAssignment({
                examId: resourceToShare.id,
                examName: resourceToShare.name || resourceToShare.title,
                examTitle: resourceToShare.name || resourceToShare.title,
                examType: resourceToShare.examType || 'homework',
                targetType: 'group',
                targetId: quickAssignGroupId,
                targetName: selectedGroup?.name || '',
                dueDate: Timestamp.fromDate(new Date(quickAssignDueDate)),
                createdBy: user.uid,
            });
            setQuickAssignSuccess(`Đã giao thành công cho lớp ${selectedGroup?.name}!`);
            setQuickAssignGroupId('');
            setQuickAssignDueDate('');
            const updated = await getExamAssignmentsForExam(resourceToShare.id);
            setExistingAssignments(updated.map(a => ({
                ...a,
                groupName: a.groupName || teacherManagedGroups.find(g => g.id === (a.targetId || a.groupId))?.name || a.targetName || ''
            })));
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi giao bài: ' + err.message });
        }
        setIsQuickAssigning(false);
    }

    if (loading) return <div className="admin-page"><div className="admin-empty-state">Đang tải dữ liệu...</div></div>;

    const formatDuration = (minutes) => {
        if (!minutes) return 'Không giới hạn';
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        if (h > 0) return `${h}h${m > 0 ? ` ${m}p` : ''}`;
        return `${m} phút`;
    };

    // Grouping logic by Teacher
    const teacherGroupedData = {};
    const relevantTeacherIds = new Set([
        ...filteredExams.map(ex => ex.createdBy || ex.teacherId),
        ...filteredFolders.map(f => f.teacherId)
    ]);

    [...relevantTeacherIds].forEach(teacherId => {
        if (!teacherId) return; // ignore items missing teacherId just in case

        const teacherFols = filteredFolders.filter(f => f.teacherId === teacherId);
        const tfIds = new Set(teacherFols.flatMap(f => f.examIds || []));
        const teacherUnassignedExams = filteredExams.filter(ex => (ex.createdBy || ex.teacherId) === teacherId && !tfIds.has(ex.id));

        teacherGroupedData[teacherId] = {
            teacher: teacherMap[teacherId] || { id: teacherId, displayName: 'Unknown', email: teacherId },
            folders: teacherFols,
            unassignedExams: teacherUnassignedExams
        };
    });

    const teacherGroupEntries = Object.entries(teacherGroupedData).sort((a, b) => {
        const nameA = (a[1].teacher.displayName || a[1].teacher.email || '').toLowerCase();
        const nameB = (b[1].teacher.displayName || b[1].teacher.email || '').toLowerCase();
        return nameA.localeCompare(nameB);
    });

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <div>
                    <h1 className="admin-page-title">Bài thi GV tạo</h1>
                    <p className="admin-page-desc">Quản lý các đề thi do giáo viên tải lên</p>
                </div>
            </div>

            <div>
                <div className="admin-search-box">
                    <Search size={16} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Tìm tên đề thi, folder, tên GV hoặc email..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="admin-card">
                {teacherGroupEntries.length === 0 ? (
                    <div className="admin-empty-state">
                        <BookOpen size={48} color="#cbd5e1" style={{ marginBottom: '16px' }} />
                        <p>Không có đề thi hoặc folder nào được tìm thấy.</p>
                    </div>
                ) : (
                    <div className="admin-table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}></th>
                                    <th>Cấu trúc thư mục (Giáo viên / Folder / Đề thi)</th>
                                    <th>Thông tin thêm / Thời gian</th>
                                    <th className="text-right">Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {teacherGroupEntries.map(([teacherId, groupData]) => {
                                    const { teacher, folders: tFolders, unassignedExams: tExams } = groupData;
                                    const isTeacherExpanded = expandedTeachers.has(teacherId) || searchTerm.length > 0;

                                    return (
                                        <React.Fragment key={teacherId}>
                                            {/* Level 1: Teacher Row */}
                                            <tr className="table-row-folder" style={{ backgroundColor: '#f8fafc' }}>
                                                <td>
                                                    <button
                                                        className="admin-expand-btn"
                                                        onClick={() => {
                                                            const newSet = new Set(expandedTeachers);
                                                            if (isTeacherExpanded) newSet.delete(teacherId);
                                                            else newSet.add(teacherId);
                                                            setExpandedTeachers(newSet);
                                                        }}
                                                    >
                                                        {isTeacherExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                    </button>
                                                </td>
                                                <td>
                                                    <div className="admin-topic-cell">
                                                        <div className="admin-topic-icon" style={{ background: '#e2e8f0', color: '#475569', borderRadius: '50%' }}>
                                                            <User size={18} />
                                                        </div>
                                                        <div>
                                                            <div className="admin-topic-name" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                                                                {teacher.displayName || 'Không có tên'}
                                                            </div>
                                                            <div className="admin-topic-id" style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                                {teacher.email || teacherId}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                        <span style={{ fontSize: '0.8rem', background: '#e0e7ff', color: '#4f46e5', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, border: '1px solid #c7d2fe' }}>Folders: {tFolders.length}</span>
                                                        <span style={{ fontSize: '0.8rem', background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, border: '1px solid #fde68a' }}>Bài rời: {tExams.length}</span>
                                                        <span style={{ fontSize: '0.8rem', background: '#f0fdf4', color: '#16a34a', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, border: '1px solid #bbf7d0' }}>Tổng bài: {exams.filter(ex => (ex.createdBy || ex.teacherId) === teacherId).length}</span>
                                                    </div>
                                                </td>
                                                <td className="text-right"></td>
                                            </tr>

                                            {/* Level 2 & 3 */}
                                            {isTeacherExpanded && (
                                                <>
                                                    {/* Render Teacher Folders */}
                                                    {tFolders.map(folder => {
                                                        const isFolderExpanded = expandedFolders.has(folder.id) || searchTerm.length > 0;
                                                        const folderExams = filteredExams.filter(ex => (folder.examIds || []).includes(ex.id));

                                                        return (
                                                            <React.Fragment key={folder.id}>
                                                                {/* Level 2: Folder Row */}
                                                                <tr className="table-row-nested table-row-nested-folder" style={{ backgroundColor: '#fff' }}>
                                                                    <td style={{ paddingLeft: '24px' }}>
                                                                        <button
                                                                            className="admin-expand-btn"
                                                                            onClick={() => {
                                                                                const newExpanded = new Set(expandedFolders);
                                                                                if (isFolderExpanded) newExpanded.delete(folder.id);
                                                                                else newExpanded.add(folder.id);
                                                                                setExpandedFolders(newExpanded);
                                                                            }}
                                                                        >
                                                                            {isFolderExpanded ? <ChevronDown size={14} color="#64748b" /> : <ChevronRight size={14} color="#64748b" />}
                                                                        </button>
                                                                    </td>
                                                                    <td>
                                                                        <div className="admin-topic-cell" style={{ paddingLeft: '12px' }}>
                                                                            <div className="admin-topic-icon" style={{ background: '#fef9c3', width: '32px', height: '32px', fontSize: '0.9rem' }}>📁</div>
                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                                <div className="admin-topic-name" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 600 }}>
                                                                                    {folder.name}
                                                                                    {folder.isPublic && (
                                                                                        <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 'normal' }}>
                                                                                            <Globe size={10} /> Public
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <div className="admin-text-muted" style={{ fontSize: '0.8rem', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                                    {folder.description || <span style={{ fontStyle: 'italic', color: '#cbd5e1' }}>Không có mô tả</span>}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td></td>
                                                                    <td className="text-right">
                                                                        <div className="admin-table-actions">
                                                                            <button className="admin-action-btn" onClick={() => openFolderEditForm(folder)} title="Sửa folder">
                                                                                <Edit size={14} />
                                                                            </button>
                                                                            <button className="admin-action-btn danger" onClick={() => setFolderToDelete(folder)} title="Xóa folder">
                                                                                <Trash2 size={14} />
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>

                                                                {/* Level 3: Exams inside Folder */}
                                                                {isFolderExpanded && (
                                                                    folderExams.length === 0 ? (
                                                                        <tr>
                                                                            <td></td>
                                                                            <td colSpan="3" style={{ paddingLeft: '76px', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>
                                                                                Folder này chưa có đề thi nào.
                                                                            </td>
                                                                        </tr>
                                                                    ) : (
                                                                        folderExams.map(exam => (
                                                                            <tr key={exam.id} className="table-row-nested" style={{ backgroundColor: '#fafafa' }}>
                                                                                <td></td>
                                                                                <td data-label="Tên đề thi">
                                                                                    <div className="admin-topic-cell">
                                                                                        <div className="admin-topic-icon" style={{ background: '#fce7f3', color: '#db2777', fontSize: '0.8rem' }}>📋</div>
                                                                                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '6px' }}>
                                                                                            <div className="admin-topic-name" style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                                                                {exam.name || exam.title}
                                                                                                <span style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '4px', background: exam.examType === 'test' ? '#fef2f2' : '#f5f3ff', color: exam.examType === 'test' ? '#dc2626' : '#7c3aed', border: `1px solid ${exam.examType === 'test' ? '#fecaca' : '#ddd6fe'}`, whiteSpace: 'nowrap', fontWeight: 700 }}>{exam.examType === 'test' ? 'Kiểm tra' : 'Bài tập'}</span>
                                                                                                {exam.isPublic && (
                                                                                                    <span style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '4px', background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0', whiteSpace: 'nowrap' }}>Public</span>
                                                                                                )}
                                                                                                {exam.collaboratorIds?.length > 0 && exam.collaboratorIds.map(uid => {
                                                                                                    const name = teacherMap[uid]?.displayName || (exam.collaboratorNames && exam.collaboratorNames[uid]) || 'Giáo viên';
                                                                                                    return (
                                                                                                        <span key={uid} title={`Cộng tác viên: ${name}`} style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#faf5ff', color: '#7c3aed', border: '1px solid #ddd6fe', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                                                            <UsersRound size={10} />
                                                                                                            {name}
                                                                                                        </span>
                                                                                                    );
                                                                                                })}
                                                                                            </div>
                                                                                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                                                                <span style={{ fontSize: '0.78rem', background: '#f5f3ff', color: '#7c3aed', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>{exam.timingMode === 'section' ? `Theo section (${(exam.sections || []).reduce((s, sec) => s + (sec.timeLimitMinutes || 0), 0)}p)` : exam.timingMode === 'question' ? `Theo câu (${Math.round((exam.cachedQuestionTimeTotalSeconds || 0) / 60)}p)` : `Theo bài (${formatDuration(exam.timeLimitMinutes || exam.durationMinutes)})`}</span>
                                                                                                {exam.timingMode === 'section' && (exam.sections || []).some(s => !s.timeLimitMinutes || s.timeLimitMinutes <= 0) && (
                                                                                                    <span style={{ fontSize: '0.72rem', background: '#fef2f2', color: '#dc2626', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, border: '1px solid #fecaca', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>⚠ {(exam.sections || []).filter(s => !s.timeLimitMinutes || s.timeLimitMinutes <= 0).length} section chưa hẹn giờ</span>
                                                                                                )}
                                                                                                {exam.timingMode === 'question' && (exam.cachedQuestionTimeMissingCount > 0) && (
                                                                                                    <span style={{ fontSize: '0.72rem', background: '#fff7ed', color: '#ea580c', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, border: '1px solid #fed7aa', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>⚠ {exam.cachedQuestionTimeMissingCount} câu hỏi chưa hẹn giờ</span>
                                                                                                )}
                                                                                                <span style={{ fontSize: '0.78rem', background: '#e0f2fe', color: '#0284c7', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>{exam.sections?.length || 0} {(exam.sections?.length || 0) === 1 ? 'section' : 'sections'}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </td>
                                                                                <td></td>
                                                                                <td className="text-right">
                                                                                    <div className="admin-table-actions">
                                                                                        <Link to={`/admin/teacher-exams/${exam.id}`} className="admin-action-btn" title="Chỉnh sửa đề thi">
                                                                                            <List size={14} />
                                                                                        </Link>
                                                                                        <button className="admin-action-btn" onClick={() => openShareModal(exam, 'exam')} title="Chia sẻ">
                                                                                            <Share2 size={14} />
                                                                                        </button>
                                                                                        <button className="admin-action-btn" onClick={() => openEditExamForm(exam)} title="Sửa tên/thông tin">
                                                                                            <Edit size={14} />
                                                                                        </button>
                                                                                        <button className="admin-action-btn danger" onClick={() => setExamToDelete(exam)} title="Xóa đề thi">
                                                                                            <Trash2 size={14} />
                                                                                        </button>
                                                                                    </div>
                                                                                </td>
                                                                            </tr>
                                                                        ))
                                                                    )
                                                                )}
                                                            </React.Fragment>
                                                        );
                                                    })}

                                                    {/* Render Teacher Unassigned Exams */}
                                                    {tExams.length > 0 && (
                                                        <>
                                                            <tr className="admin-unassigned-header">
                                                                <td></td>
                                                                <td colSpan="3" style={{ paddingLeft: '48px' }}>
                                                                    <div className="admin-unassigned-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#fef3c7', color: '#b45309', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, marginTop: '8px', marginBottom: '8px' }}>
                                                                        <AlertTriangle size={14} />
                                                                        Đề thi chưa được phân vào Folder ({tExams.length})
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                            {tExams.map(exam => (
                                                                <tr key={exam.id} className="table-row-nested" style={{ backgroundColor: '#fafafa' }}>
                                                                    <td></td>
                                                                    <td>
                                                                        <div className="admin-topic-cell">
                                                                            <div className="admin-topic-icon" style={{ background: '#fce7f3', color: '#db2777', fontSize: '0.8rem' }}>📋</div>
                                                                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '6px' }}>
                                                                                <div className="admin-topic-name" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', flexWrap: 'wrap' }}>
                                                                                    {exam.name || exam.title}
                                                                                    <span style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '4px', background: exam.examType === 'test' ? '#fef2f2' : '#f5f3ff', color: exam.examType === 'test' ? '#dc2626' : '#7c3aed', border: `1px solid ${exam.examType === 'test' ? '#fecaca' : '#ddd6fe'}`, whiteSpace: 'nowrap', fontWeight: 700 }}>{exam.examType === 'test' ? 'Kiểm tra' : 'Bài tập'}</span>
                                                                                    {exam.isPublic && (
                                                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', background: '#eff6ff', color: '#3b82f6', padding: '2px 6px', borderRadius: '4px' }}>
                                                                                            <Globe size={10} /> Công khai
                                                                                        </span>
                                                                                    )}
                                                                                    {exam.collaboratorIds?.length > 0 && exam.collaboratorIds.map(uid => {
                                                                                        const name = teacherMap[uid]?.displayName || (exam.collaboratorNames && exam.collaboratorNames[uid]) || 'Giáo viên';
                                                                                        return (
                                                                                            <span key={uid} title={`Cộng tác viên: ${name}`} style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#faf5ff', color: '#7c3aed', border: '1px solid #ddd6fe', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                                                <UsersRound size={10} />
                                                                                                {name}
                                                                                            </span>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                                                    <span style={{ fontSize: '0.78rem', background: '#f5f3ff', color: '#7c3aed', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>{exam.timingMode === 'section' ? `Theo section (${(exam.sections || []).reduce((s, sec) => s + (sec.timeLimitMinutes || 0), 0)}p)` : exam.timingMode === 'question' ? `Theo câu (${Math.round((exam.cachedQuestionTimeTotalSeconds || 0) / 60)}p)` : `Theo bài (${formatDuration(exam.timeLimitMinutes || exam.durationMinutes)})`}</span>
                                                                                    {exam.timingMode === 'section' && (exam.sections || []).some(s => !s.timeLimitMinutes || s.timeLimitMinutes <= 0) && (
                                                                                        <span style={{ fontSize: '0.72rem', background: '#fef2f2', color: '#dc2626', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, border: '1px solid #fecaca', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>⚠ {(exam.sections || []).filter(s => !s.timeLimitMinutes || s.timeLimitMinutes <= 0).length} section chưa hẹn giờ</span>
                                                                                    )}
                                                                                    {exam.timingMode === 'question' && (exam.cachedQuestionTimeMissingCount > 0) && (
                                                                                        <span style={{ fontSize: '0.72rem', background: '#fff7ed', color: '#ea580c', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, border: '1px solid #fed7aa', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>⚠ {exam.cachedQuestionTimeMissingCount} câu hỏi chưa hẹn giờ</span>
                                                                                    )}
                                                                                    <span style={{ fontSize: '0.78rem', background: '#e0f2fe', color: '#0284c7', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>{exam.sections?.length || 0} {(exam.sections?.length || 0) === 1 ? 'section' : 'sections'}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td></td>
                                                                    <td className="text-right">
                                                                        <div className="admin-table-actions">
                                                                            <Link to={`/admin/teacher-exams/${exam.id}`} className="admin-action-btn" title="Chỉnh sửa đề thi">
                                                                                <List size={14} />
                                                                            </Link>
                                                                            <button className="admin-action-btn" onClick={() => openShareModal(exam, 'exam')} title="Chia sẻ">
                                                                                <Share2 size={14} />
                                                                            </button>
                                                                            <button className="admin-action-btn" onClick={() => openEditExamForm(exam)} title="Sửa tên/thông tin">
                                                                                <Edit size={14} />
                                                                            </button>
                                                                            <button className="admin-action-btn danger" onClick={() => setExamToDelete(exam)} title="Xóa đề thi">
                                                                                <Trash2 size={14} />
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* FOLDER EDIT MODAL */}
            {folderFormOpen && (
                <div className="teacher-modal-overlay">
                    <div className="teacher-modal wide" style={{ maxWidth: '600px', overflow: 'auto' }}>
                        <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                            <button type="button" className="teacher-modal-close" onClick={() => setFolderFormOpen(false)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <h2 className="admin-modal-title" style={{ justifyContent: 'space-between', marginBottom: '24px', paddingRight: '40px' }}>
                            Sửa Folder
                        </h2>
                        <form onSubmit={handleFolderSubmit}>
                            <div className="admin-form-group">
                                <label>Tên Folder</label>
                                <input type="text" className="admin-form-input" required value={folderFormData.name} onChange={e => setFolderFormData({ ...folderFormData, name: e.target.value })} />
                            </div>
                            <div className="admin-form-group">
                                <label>Mô tả</label>
                                <textarea className="admin-form-input admin-form-textarea" value={folderFormData.description || ''} onChange={e => setFolderFormData({ ...folderFormData, description: e.target.value })} />
                            </div>

                            <div className="admin-form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input type="checkbox" checked={folderFormData.isPublic || false} onChange={e => setFolderFormData({ ...folderFormData, isPublic: e.target.checked })} />
                                    Công khai (Public)
                                </label>
                            </div>
                            <div className="admin-modal-actions" style={{ marginTop: '24px', flexDirection: 'row' }}>
                                <button type="button" className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setFolderFormOpen(false)} disabled={isSavingFolder}>Hủy</button>
                                <button type="submit" className="admin-btn admin-btn-primary" style={{ flex: 1 }} disabled={isSavingFolder}>{isSavingFolder ? 'Đang lưu...' : 'Cập nhật'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* EXAM EDIT MODAL */}
            {examFormOpen && (
                <div className="teacher-modal-overlay">
                    <div className="teacher-modal wide" style={{ maxWidth: '600px', overflow: 'auto' }}>
                        <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                            <button type="button" className="teacher-modal-close" onClick={() => setExamFormOpen(false)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <h2 className="admin-modal-title" style={{ justifyContent: 'space-between', marginBottom: '24px', paddingRight: '40px' }}>
                            Sửa thông tin đề thi
                        </h2>
                        <form onSubmit={handleExamSubmit}>
                            <div className="admin-form-group">
                                <label>Loại</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button type="button" onClick={() => setExamFormData({ ...examFormData, examType: 'homework' })} style={{ flex: 1, padding: '10px 16px', borderRadius: '12px', border: (examFormData.examType || 'homework') === 'homework' ? '2px solid #7c3aed' : '2px solid #e2e8f0', background: (examFormData.examType || 'homework') === 'homework' ? '#f5f3ff' : '#fff', color: (examFormData.examType || 'homework') === 'homework' ? '#7c3aed' : '#64748b', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                        📝 Bài tập
                                    </button>
                                    <button type="button" onClick={() => setExamFormData({ ...examFormData, examType: 'test' })} style={{ flex: 1, padding: '10px 16px', borderRadius: '12px', border: examFormData.examType === 'test' ? '2px solid #ef4444' : '2px solid #e2e8f0', background: examFormData.examType === 'test' ? '#fef2f2' : '#fff', color: examFormData.examType === 'test' ? '#dc2626' : '#64748b', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                        📋 Bài kiểm tra
                                    </button>
                                </div>
                            </div>
                            <div className="admin-form-group">
                                <label>Tên / Tiêu đề (Name)</label>
                                <input type="text" className="admin-form-input" required value={examFormData.name || examFormData.title || ''} onChange={e => setExamFormData({ ...examFormData, name: e.target.value, title: e.target.value })} />
                            </div>
                            <div className="admin-form-group">
                                <label>Mô tả</label>
                                <textarea className="admin-form-input admin-form-textarea" value={examFormData.description || ''} onChange={e => setExamFormData({ ...examFormData, description: e.target.value })} />
                            </div>
                            <CustomSelect
                                label="Cấp độ nội dung (CEFR)"
                                value={examFormData.cefrLevel || ''}
                                onChange={v => setExamFormData({ ...examFormData, cefrLevel: v })}
                                placeholder="-- Chọn cấp độ CEFR --"
                                options={[
                                    { value: 'A0', label: 'A0 · Pre-Beginner' },
                                    { value: 'A1', label: 'A1 · Beginner' },
                                    { value: 'A2', label: 'A2 · Elementary' },
                                    { value: 'B1', label: 'B1 · Intermediate' },
                                    { value: 'B2', label: 'B2 · Upper Intermediate' },
                                    { value: 'C1', label: 'C1 · Advanced' },
                                    { value: 'C2', label: 'C2 · Proficient' },
                                ]}
                            />
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <div className="admin-form-group" style={{ flex: 1 }}>
                                    <label>Icon (Emoji)</label>
                                    <input type="text" className="admin-form-input" value={examFormData.icon || '📋'} onChange={e => setExamFormData({ ...examFormData, icon: e.target.value })} />
                                </div>
                                <div className="admin-form-group" style={{ flex: 1 }}>
                                    <label>Màu sắc</label>
                                    <input type="color" className="admin-form-input" style={{ padding: '4px', height: '42px' }} value={examFormData.color || '#6366f1'} onChange={e => setExamFormData({ ...examFormData, color: e.target.value })} />
                                </div>
                            </div>
                            <div className="admin-form-group">
                                <label>Chế độ thời gian</label>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    {[{ value: 'exam', label: '📋 Cả bài' }, { value: 'section', label: '📄 Theo section' }, { value: 'question', label: '❓ Theo câu hỏi' }].map(mode => (
                                        <button key={mode.value} type="button" onClick={() => setExamFormData({ ...examFormData, timingMode: mode.value })}
                                            style={{ flex: 1, padding: '10px 8px', borderRadius: '12px', border: examFormData.timingMode === mode.value ? '2px solid #6366f1' : '2px solid #e2e8f0', background: examFormData.timingMode === mode.value ? '#eef2ff' : '#fff', color: examFormData.timingMode === mode.value ? '#4f46e5' : '#64748b', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}>
                                            {mode.label}
                                        </button>
                                    ))}
                                </div>
                                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '6px', marginBottom: 0 }}>
                                    {examFormData.timingMode === 'exam' ? '⏱ Đặt 1 khoảng thời gian cố định cho toàn bộ bài.' : examFormData.timingMode === 'section' ? '⏱ Thời gian sẽ được cấu hình riêng cho từng section trong trang chỉnh sửa.' : '⏱ Thời gian sẽ được cấu hình riêng cho từng câu hỏi trong trang chỉnh sửa.'}
                                </p>
                            </div>
                            {examFormData.timingMode !== originalTimingMode && (
                                <div style={{ padding: '12px 16px', borderRadius: '12px', background: '#fef2f2', border: '1px solid #fecaca', marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                        <AlertTriangle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                                        <div>
                                            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#dc2626' }}>Cảnh báo thay đổi chế độ thời gian</p>
                                            <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#7f1d1d', lineHeight: '1.4' }}>
                                                {examFormData.timingMode === 'section'
                                                    ? 'Bạn cần vào trang chỉnh sửa để đặt thời gian cho từng section. Mặc định thời gian sẽ bằng 0 và học viên sẽ không thể làm bài được.'
                                                    : examFormData.timingMode === 'question'
                                                    ? 'Bạn cần vào trang chỉnh sửa để đặt thời gian cho từng câu hỏi. Mặc định thời gian sẽ bằng 0 và học viên sẽ không thể làm bài được.'
                                                    : 'Thời gian section/câu hỏi trước đó sẽ không còn hiệu lực. Bạn cần đặt thời gian tổng cho cả bài.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {examFormData.timingMode === 'exam' && (
                            <div className="admin-form-group">
                                <label>Thời gian làm bài (phút)</label>
                                <input type="text" inputMode="decimal" className="admin-form-input" min="0" value={examFormData.durationMinutes || examFormData.timeLimitMinutes || 60} onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setExamFormData({ ...examFormData, durationMinutes: v, timeLimitMinutes: v }); }} onBlur={e => { const n = parseFloat(e.target.value); setExamFormData(prev => ({ ...prev, durationMinutes: (n && n > 0) ? n : '', timeLimitMinutes: (n && n > 0) ? n : '' })); }} placeholder="Ví dụ: 60 hoặc 2.5" />
                            </div>
                            )}
                            <div className="admin-form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input type="checkbox" checked={examFormData.isPublic || false} onChange={e => setExamFormData({ ...examFormData, isPublic: e.target.checked })} />
                                    Công khai (Public)
                                </label>
                            </div>
                            <div className="admin-modal-actions" style={{ marginTop: '24px', flexDirection: 'row' }}>
                                <button type="button" className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setExamFormOpen(false)} disabled={isSavingExam}>Hủy</button>
                                <button type="submit" className="admin-btn admin-btn-primary" style={{ flex: 1 }} disabled={isSavingExam}>{isSavingExam ? 'Đang lưu...' : 'Cập nhật'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DELETE EXAM MODAL */}
            {examToDelete && (
                <div className="teacher-modal-overlay">
                    <div className="teacher-modal">
                        <h2 className="admin-modal-title" style={{ color: '#ef4444', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertCircle size={24} /> Xác nhận xóa
                            </div>
                        </h2>
                        <p className="admin-modal-desc">
                            Bạn có chắc chắn muốn xóa đề thi <strong>{examToDelete.title}</strong>?<br/><br/>
                            <strong>Lưu ý:</strong> Không thể khôi phục.
                        </p>
                        <div className="admin-modal-actions" style={{ flexDirection: 'row' }}>
                            <button className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setExamToDelete(null)} disabled={isDeleting}>Hủy</button>
                            <button className="admin-btn admin-btn-primary" style={{ flex: 1, backgroundColor: '#ef4444' }} onClick={handleConfirmDelete} disabled={isDeleting}>
                                {isDeleting ? 'Đang xóa...' : 'Xóa đề thi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE FOLDER MODAL */}
            {folderToDelete && (
                <div className="teacher-modal-overlay">
                    <div className="teacher-modal">
                        <h2 className="admin-modal-title" style={{ color: '#ef4444', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertCircle size={24} /> Xác nhận xóa Folder
                            </div>
                        </h2>
                        <p className="admin-modal-desc">
                            Bạn có chắc chắn muốn xóa folder <strong>{folderToDelete.name}</strong>?<br/><br/>
                            <strong>Lưu ý:</strong> Các đề thi bên trong sẽ không bị xóa.
                        </p>
                        <div className="admin-modal-actions" style={{ flexDirection: 'row' }}>
                            <button className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setFolderToDelete(null)}>Hủy</button>
                            <button className="admin-btn admin-btn-primary" style={{ flex: 1, backgroundColor: '#ef4444' }} onClick={handleConfirmDeleteFolder}>
                                Xóa Folder
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SHARE MODAL */}
            {shareModalOpen && resourceToShare && (
                <div className="teacher-modal-overlay">
                    <div className="teacher-modal wide" style={{ maxWidth: '600px', overflow: 'auto' }}>
                        <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                            <button className="teacher-modal-close" onClick={() => setShareModalOpen(false)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <h2 className="admin-modal-title" style={{ justifyContent: 'flex-start', marginBottom: '24px', paddingRight: '40px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Share2 size={24} color="var(--color-primary)" />
                                Chia sẻ Đề thi
                            </div>
                        </h2>
                        <div style={{ marginBottom: '20px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', margin: '0 0 4px 0' }}>{resourceToShare.name || resourceToShare.title}</h3>
                            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>ID: {resourceToShare.id}</p>
                            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <input type="text" readOnly value={`${window.location.origin}/preview/superstudy?shareId=${resourceToShare.id}&shareType=${resourceToShare.type}`} style={{ flex: '1 1 200px', minWidth: '0', padding: '8px 12px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none', backgroundColor: '#f1f5f9', color: '#475569' }} />
                                <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/preview/superstudy?shareId=${resourceToShare.id}&shareType=${resourceToShare.type}`); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }} style={{ flex: window.innerWidth < 480 ? '1' : '0 0 auto', padding: '8px 16px', background: linkCopied ? '#10b981' : 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', transition: 'all 0.3s' }}>
                                    {linkCopied ? 'Đã Copy!' : 'Copy Link'}
                                </button>
                            </div>
                        </div>
                        <div className="admin-share-public-toggle" style={{ background: resourceToShare.isPublic ? '#ecfdf5' : '#fff', border: `1px solid ${resourceToShare.isPublic ? '#10b981' : '#e2e8f0'}`, marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: resourceToShare.isPublic ? '#10b981' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: resourceToShare.isPublic ? '#fff' : '#64748b' }}>
                                    {resourceToShare.isPublic ? <Globe size={20} /> : <Lock size={20} />}
                                </div>
                                <div>
                                    <h4 style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1e293b', margin: '0 0 4px 0' }}>{resourceToShare.isPublic ? 'Đang Công khai' : 'Hạn chế'}</h4>
                                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>{resourceToShare.isPublic ? 'Bất kỳ ai cũng có thể tìm và làm đề này.' : 'Cần cấp quyền hoặc gửi Link.'}</p>
                                </div>
                            </div>
                            <button onClick={handleTogglePublic} disabled={isSharing} style={{ padding: '8px 16px', background: resourceToShare.isPublic ? 'transparent' : 'var(--color-primary)', color: resourceToShare.isPublic ? '#ef4444' : '#fff', border: resourceToShare.isPublic ? '1px solid #ef4444' : 'none', borderRadius: '6px', cursor: isSharing ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                                {resourceToShare.isPublic ? 'Tắt Public' : 'Bật Public'}
                            </button>
                        </div>
                        {!resourceToShare.isPublic && (
                            <div className="admin-share-grid">
                                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 600, color: '#334155', margin: '0 0 12px 0' }}><Users size={16} /> Chia sẻ cho Nhóm</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                                        {allGroups.length === 0 ? <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>Chưa có nhóm nào.</p> : null}
                                        {allGroups.map(g => (
                                            <label key={g.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.85rem', color: '#475569', cursor: 'pointer', background: '#f8fafc', padding: '8px', borderRadius: '6px' }}>
                                                <input type="checkbox" checked={shareGroups.includes(g.id)} disabled={isSharing} onChange={() => handleToggleGroupShare(g.id)} style={{ accentColor: 'var(--color-primary)', marginTop: '2px' }} />
                                                <span style={{ flex: 1 }}>{g.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 600, color: '#334155', margin: '0 0 12px 0' }}><Mail size={16} /> Chia sẻ cá nhân</h4>
                                    <form onSubmit={handleAddShareEmail} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                        <EmailAutocomplete value={shareEmail} onChange={setShareEmail} onSubmit={(email) => handleAddShareEmail(email)} disabled={isSharing} />
                                        <button type="submit" disabled={isSharing} style={{ flexShrink: 0, padding: '8px 12px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '6px', cursor: isSharing ? 'not-allowed' : 'pointer' }}><UserPlus size={16} /></button>
                                    </form>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                                        {shareUsers.length === 0 ? <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>Chưa thêm ai.</p> : null}
                                        {shareUsers.map(u => (
                                            <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '0.85rem', color: '#475569', background: '#f8fafc', padding: '8px', borderRadius: '6px' }}>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</span>
                                                <button onClick={() => handleRemoveShareUser(u.id)} disabled={isSharing} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: isSharing ? 'not-allowed' : 'pointer', padding: '4px' }} title="Gỡ quyền"><X size={14} /></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        <div style={{ marginTop: '20px', padding: '16px', background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', borderRadius: '12px', border: '1px solid #fde68a' }}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', fontWeight: 700, color: '#92400e', margin: '0 0 6px 0' }}><FileText size={16} /> Giao bài cho lớp</h4>
                            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '12px' }}>Giao nhanh đề thi này cho 1 lớp.</p>
                            {existingAssignments.length > 0 && (
                                <div style={{ marginBottom: '12px' }}>
                                    <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>Đã giao cho:</p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {existingAssignments.map(a => (
                                            <span key={a.id} style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px', background: 'linear-gradient(135deg, #fef3c7, #fde68a)', color: '#92400e', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #fcd34d' }}>✅ {a.groupName || a.targetName || 'Lớp'}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {teacherManagedGroups.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 20 }}>
                                            <CustomSelect value={quickAssignGroupId} onChange={v => setQuickAssignGroupId(v)} placeholder="-- Chọn lớp --" options={teacherManagedGroups.map(g => ({ value: g.id, label: g.name, icon: '🏫' }))} style={{ margin: 0 }} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <input type="datetime-local" value={quickAssignDueDate} onChange={e => setQuickAssignDueDate(e.target.value)} style={{ width: '100%', padding: '6px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.88rem', color: '#1e293b', minHeight: '38px', boxSizing: 'border-box' }} />
                                        </div>
                                    </div>
                                    <button type="button" onClick={handleQuickAssign} disabled={isQuickAssigning || !quickAssignGroupId || !quickAssignDueDate} className="admin-btn admin-btn-primary" style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', opacity: (isQuickAssigning || !quickAssignGroupId || !quickAssignDueDate) ? 0.6 : 1 }}>
                                        <Send size={14} />
                                        {isQuickAssigning ? 'Đang giao...' : 'Giao bài'}
                                    </button>
                                    {quickAssignSuccess && (
                                        <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#ecfdf5', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#059669', fontWeight: 500 }}>
                                            <CheckCircle size={16} /> {quickAssignSuccess}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>Chưa có lớp nào.</p>
                            )}
                        </div>
                        <div className="admin-modal-actions" style={{ marginTop: '24px', flexDirection: 'row' }}>
                            <button className="admin-btn admin-btn-primary" style={{ flex: 1 }} onClick={() => setShareModalOpen(false)}>Đóng</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ALERTS */}
            {alertMessage && (
                <div className="teacher-modal-overlay">
                    <div className="teacher-modal">
                        <h2 className="admin-modal-title">
                            {alertMessage.type === 'success' ? <span style={{ color: '#10b981' }}>Thành công</span> : <span style={{ color: '#ef4444' }}>Đã có lỗi</span>}
                        </h2>
                        <p className="admin-modal-desc">{alertMessage.text}</p>
                        <div className="admin-modal-actions" style={{ flexDirection: 'row' }}>
                            <button className="admin-btn admin-btn-primary" style={{ flex: 1 }} onClick={() => setAlertMessage(null)}>Đóng</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
