import { useState, useEffect, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { getExams, getSharedExams, saveExam, deleteExam, getExamFolders, getTeacherExamFolders, saveTeacherExamFolder, deleteTeacherExamFolder, createExamAssignment, getExamAssignmentsForExam } from '../../services/examService';
import { submitProposal, getProposalForSource } from '../../services/contentProposalService';
import { getUsersPublicInfo } from '../../services/userService';
import { addCollaborator, removeCollaborator, transferOwnership, getCollaboratedResources, findTeacherByEmail, getTeacherGroups } from '../../services/teacherService';
import { useAuth } from '../../contexts/AuthContext';
import { Timestamp } from 'firebase/firestore';
import { Edit, Trash2, X, Plus, List, Search, Clock, ClipboardCheck, ClipboardList, FolderOpen, Globe, Lock, AlertTriangle, Share2, ChevronDown, ChevronRight, AlertCircle, Users, UserPlus, Landmark, Send, CheckCircle, XCircle, ArrowRightLeft, UsersRound, FileText, Calendar, Copy } from 'lucide-react';
import { duplicateExam } from '../../services/duplicateService';
import CustomSelect from '../../components/common/CustomSelect';
import EmailAutocomplete from '../../components/common/EmailAutocomplete';

export default function TeacherExamsPage() {
    const { user } = useAuth();
    const [mergedExams, setMergedExams] = useState([]);
    const [questionCounts, setQuestionCounts] = useState({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // UI state
    const [expandedFolders, setExpandedFolders] = useState(new Set());

    // Folders
    const [folders, setFolders] = useState([]);
    const [teacherFolders, setTeacherFolders] = useState([]);

    // Form
    const [formOpen, setFormOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '', description: '', icon: '📋', color: '#6366f1',
        timeLimitMinutes: 60, timingMode: 'exam', sections: [], isPublic: false, folderId: '', cefrLevel: '', examType: 'homework'
    });
    const [isEditing, setIsEditing] = useState(false);
    const [examToDelete, setExamToDelete] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [alertMessage, setAlertMessage] = useState(null);
    const [examToDuplicate, setExamToDuplicate] = useState(null);
    const [isDuplicating, setIsDuplicating] = useState(false);

    // Folder CRUD states
    const [folderFormOpen, setFolderFormOpen] = useState(false);
    const [folderFormData, setFolderFormData] = useState({ name: '', description: '', icon: '📁', color: '#6366f1', examIds: [] });
    const [isFolderEditing, setIsFolderEditing] = useState(false);
    const [folderToDelete, setFolderToDelete] = useState(null);
    const [isFolderSaving, setIsFolderSaving] = useState(false);

    // Proposal state
    const [proposalModalOpen, setProposalModalOpen] = useState(false);
    const [proposalTarget, setProposalTarget] = useState(null);
    const [currentProposal, setCurrentProposal] = useState(null);
    const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);
    const [proposalLoading, setProposalLoading] = useState(false);

    // Collaboration state
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [resourceToShare, setResourceToShare] = useState(null);
    const [collaborators, setCollaborators] = useState([]);
    const [collabEmail, setCollabEmail] = useState('');
    const [isAddingCollab, setIsAddingCollab] = useState(false);
    const [transferTarget, setTransferTarget] = useState(null);

    // Quick Assign state
    const [teacherManagedGroups, setTeacherManagedGroups] = useState([]);
    const [quickAssignGroupId, setQuickAssignGroupId] = useState('');
    const [quickAssignDueDate, setQuickAssignDueDate] = useState('');
    const [isQuickAssigning, setIsQuickAssigning] = useState(false);
    const [quickAssignSuccess, setQuickAssignSuccess] = useState('');
    const [existingAssignments, setExistingAssignments] = useState([]);

    useEffect(() => {
        if (user?.uid) loadData();
    }, [user?.uid]);

    async function loadData() {
        setLoading(true);
        try {
            // 1. Fetch own teacher exams
            const teacherExams = await getExams('teacher');
            const ownExams = teacherExams.filter(e => e.createdBy === user?.uid);

            // 2. Fetch shared/public exams using user's examAccess
            const examAccessIds = user.mergedExamAccess || user.examAccess || [];
            const sharedExams = await getSharedExams(examAccessIds);

            // 2.5 Fetch collaborated exams
            const collabExams = await getCollaboratedResources('exams', user?.uid);

            // 3. Fetch folders and filter visible ones
            const allFolders = await getExamFolders();
            const folderAccess = user.mergedExamFolderAccess || user.examFolderAccess || [];

            const publicFolderExamIds = new Set();
            const folderExamIds = new Set();

            const visibleFolders = allFolders.filter(f => {
                const folderExams = (f.examIds || []).map(eid => sharedExams.find(e => e.id === eid)).filter(Boolean);
                const hasVisibleExam = folderExams.length > 0;

                if (f.isPublic || folderAccess.includes(f.id) || hasVisibleExam) {
                    (f.examIds || []).forEach(eid => {
                        folderExamIds.add(eid);
                        if (f.isPublic) publicFolderExamIds.add(eid);
                    });
                    return true;
                }
                return false;
            });

            // 4. Build merged map: own > shared > system (inherited from folder)
            const map = new Map();
            ownExams.forEach(e => map.set(e.id, { ...e, isOwner: true, isAdmin: false }));

            sharedExams.forEach(e => {
                const isInheritedPublic = publicFolderExamIds.has(e.id);
                if (!map.has(e.id)) {
                    const isAdmin = e.createdByRole === 'admin' || !e.createdByRole;
                    map.set(e.id, {
                        ...e,
                        isPublic: e.isPublic !== false ? (e.isPublic || isInheritedPublic) : false,
                        isInPublicFolder: isInheritedPublic,
                        isOwner: false,
                        isAdmin
                    });
                }
            });

            collabExams.forEach(e => {
                if (!map.has(e.id)) {
                    map.set(e.id, {
                        ...e,
                        isPublic: e.isPublic || false,
                        isOwner: false,
                        isCollaborator: true,
                        isAdmin: false
                    });
                }
            });

            const merged = Array.from(map.values()).sort((a, b) => {
                const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                return timeB - timeA;
            });

            setMergedExams(merged);
            setFolders(visibleFolders);

            // Read cached question counts from exam documents
            const counts = {};
            merged.forEach(e => { counts[e.id] = e.cachedQuestionCount ?? 0; });
            setQuestionCounts(counts);

            // Fetch teacher's own exam folders
            const ownFolders = await getTeacherExamFolders(user.uid);
            setTeacherFolders(ownFolders);

            // Fetch teacher names for shared exams
            const sharedTeacherIds = [...new Set(merged.filter(e => !e.isOwner && !e.isAdmin && e.createdBy).map(e => e.createdBy))];
            if (sharedTeacherIds.length > 0) {
                const teacherNamesMap = await getUsersPublicInfo(sharedTeacherIds);
                setMergedExams(prev => prev.map(e => {
                    if (e.createdBy && teacherNamesMap[e.createdBy]) {
                        return { ...e, creatorName: teacherNamesMap[e.createdBy].displayName };
                    }
                    return e;
                }));
            }
        } catch (error) {
            console.error(error);
            setAlertMessage({ type: 'error', text: 'Lỗi tải dữ liệu: ' + error.message });
        }
        setLoading(false);
    }

    function openAddForm() {
        setFormData({
            name: '', description: '', icon: '📋', color: '#6366f1',
            timeLimitMinutes: 60, timingMode: 'exam', sections: [{ id: crypto.randomUUID(), title: 'Section 1', context: '', order: 0 }],
            isPublic: false, folderId: '', cefrLevel: '', examType: 'homework'
        });
        setIsEditing(false);
        setFormOpen(true);
    }

    function openEditForm(exam) {
        const containingFolder = teacherFolders.find(f => (f.examIds || []).includes(exam.id));
        setFormData({ ...exam, folderId: containingFolder?.id || '', cefrLevel: exam.cefrLevel || '', examType: exam.examType || 'homework', timingMode: exam.timingMode || 'exam' });
        setIsEditing(true);
        setFormOpen(true);
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        if (!formData.cefrLevel) {
            setAlertMessage({ type: 'error', text: 'Vui lòng chọn Cấp độ nội dung (CEFR) trước khi lưu.' });
            return;
        }
        setIsSaving(true);
        try {
            const { folderId, ...examData } = formData;
            if (examData.timingMode === 'exam') {
                examData.timeLimitMinutes = parseFloat(examData.timeLimitMinutes) || 60;
            } else {
                examData.timeLimitMinutes = 0; // Time is per-section or per-question
            }
            const examId = await saveExam({
                ...examData,
                createdBy: examData.createdBy || user?.uid,
                createdByRole: 'teacher',
                teacherTitle: user?.teacherTitle || '',
                studentTitle: user?.studentTitle || ''
            });

            // Auto-add/remove from selected folder
            if (folderId && examId) {
                const folder = teacherFolders.find(f => f.id === folderId);
                if (folder && !(folder.examIds || []).includes(examId)) {
                    await saveTeacherExamFolder(user.uid, { ...folder, examIds: [...(folder.examIds || []), examId] });
                }
            }
            if (examId) {
                for (const f of teacherFolders) {
                    if (f.id !== folderId && (f.examIds || []).includes(examId)) {
                        await saveTeacherExamFolder(user.uid, { ...f, examIds: (f.examIds || []).filter(id => id !== examId) });
                    }
                }
            }

            setFormOpen(false);
            setAlertMessage({ type: 'success', text: isEditing ? 'Cập nhật thành công!' : 'Tạo bài tập và kiểm tra thành công!' });
            loadData();
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'Lỗi: ' + error.message });
        }
        setIsSaving(false);
    }

    async function handleConfirmDelete() {
        if (!examToDelete) return;
        try {
            await deleteExam(examToDelete.id);
            setMergedExams(prev => prev.filter(e => e.id !== examToDelete.id));
            setAlertMessage({ type: 'success', text: 'Đã xóa thành công!' });
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'Lỗi xóa: ' + error.message });
        }
        setExamToDelete(null);
    }

    async function handleConfirmDuplicate() {
        if (!examToDuplicate) return;
        setIsDuplicating(true);
        try {
            await duplicateExam(examToDuplicate.id, user.uid);
            setAlertMessage({ type: 'success', text: `Đã nhân đôi đề thi "${examToDuplicate.name}" thành công!` });
            loadData();
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'Lỗi nhân đôi: ' + error.message });
        }
        setIsDuplicating(false);
        setExamToDuplicate(null);
    }

    // --- PROPOSAL HANDLERS ---
    async function handleSubmitProposal() {
        if (!resourceToShare) return;
        setIsSubmittingProposal(true);
        try {
            await submitProposal({
                type: 'exam',
                level: resourceToShare.level || (resourceToShare.type?.includes('folder') ? 'folder' : 'item'),
                sourceId: resourceToShare.id,
                sourceFolderId: resourceToShare.type?.includes('folder') ? resourceToShare.id : null,
                sourceCollection: 'exams',
                teacherId: user.uid,
                teacherName: user.displayName || user.email,
                teacherEmail: user.email,
                proposalName: resourceToShare.name || resourceToShare.title,
                proposalDescription: resourceToShare.description || '',
                icon: resourceToShare.icon,
                color: resourceToShare.color
            });
            const proposal = await getProposalForSource(resourceToShare.id, 'exam');
            setCurrentProposal(proposal);
            setAlertMessage({ type: 'success', text: 'Đã gửi đề xuất thành công! Admin sẽ xem xét và phê duyệt.' });
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi gửi đề xuất: ' + err.message });
        }
        setIsSubmittingProposal(false);
    }

    // --- COLLABORATION HANDLERS ---
    async function openShareModal(exam) {
        setResourceToShare(exam);
        setShareModalOpen(true);
        setCollabEmail('');
        setTransferTarget(null);
        setQuickAssignGroupId('');
        setQuickAssignDueDate('');
        setQuickAssignSuccess('');

        const collabIds = exam.collaboratorIds || [];
        const collabNames = exam.collaboratorNames || {};
        if (collabIds.length > 0) {
            const profilesMap = await getUsersPublicInfo(collabIds);
            setCollaborators(collabIds.map(uid => ({
                uid,
                displayName: profilesMap[uid]?.displayName || collabNames[uid] || 'Giáo viên',
                email: profilesMap[uid]?.email || ''
            })));
        } else {
            setCollaborators([]);
        }

        setProposalLoading(true);
        try {
            const [proposal, managedGroups, examAssignments] = await Promise.all([
                getProposalForSource(exam.id, 'exam'),
                getTeacherGroups(user.groupIds || []),
                getExamAssignmentsForExam(exam.id)
            ]);
            setCurrentProposal(proposal);
            setTeacherManagedGroups(managedGroups);
            // Enrich assignment tags with group names
            setExistingAssignments(examAssignments.map(a => ({
                ...a,
                groupName: managedGroups.find(g => g.id === a.targetId)?.name || a.targetName || a.groupName || a.targetId || ''
            })));
        } catch (err) {
            console.error('Error loading proposal:', err);
            setCurrentProposal(null);
        }
        setProposalLoading(false);
    }

    async function handleAddCollaborator(e) {
        if (e && e.preventDefault) e.preventDefault();
        const emailToAdd = typeof e === 'string' ? e : collabEmail;
        if (!emailToAdd || !emailToAdd.trim() || !resourceToShare) return;
        if (emailToAdd.trim().toLowerCase() === user.email?.toLowerCase()) {
            setAlertMessage({ type: 'error', text: 'Bạn không thể thêm chính mình.' });
            return;
        }
        setIsAddingCollab(true);
        try {
            const teacher = await findTeacherByEmail(emailToAdd.trim());
            if (!teacher) {
                setAlertMessage({ type: 'error', text: 'Không tìm thấy giáo viên với email này.' });
                setIsAddingCollab(false);
                return;
            }
            if (collaborators.some(c => c.uid === teacher.uid)) {
                setAlertMessage({ type: 'error', text: 'Giáo viên này đã là cộng tác viên.' });
                setIsAddingCollab(false);
                return;
            }
            await addCollaborator('exams', resourceToShare.id, teacher.uid, teacher.displayName, resourceToShare.name);
            setCollaborators(prev => [...prev, { uid: teacher.uid, displayName: teacher.displayName, email: teacher.email }]);
            setCollabEmail('');
            setAlertMessage({ type: 'success', text: `Đã thêm ${teacher.displayName} làm cộng tác viên!` });
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi thêm cộng tác viên: ' + err.message });
        }
        setIsAddingCollab(false);
    }

    async function handleRemoveCollaborator(uid) {
        if (!resourceToShare) return;
        setIsAddingCollab(true);
        try {
            await removeCollaborator('exams', resourceToShare.id, uid, resourceToShare.name);
            setCollaborators(prev => prev.filter(c => c.uid !== uid));
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi gỡ cộng tác viên: ' + err.message });
        }
        setIsAddingCollab(false);
    }

    async function handlePreTransferOwnership(emailToTransfer) {
        if (!emailToTransfer || !emailToTransfer.trim() || !resourceToShare) return;
        if (emailToTransfer.trim().toLowerCase() === user.email?.toLowerCase()) {
            setAlertMessage({ type: 'error', text: 'Bạn đang sở hữu đề thi này.' });
            return;
        }
        setIsAddingCollab(true);
        try {
            const teacher = await findTeacherByEmail(emailToTransfer.trim());
            if (!teacher) {
                setAlertMessage({ type: 'error', text: 'Không tìm thấy giáo viên với email này.' });
                setIsAddingCollab(false);
                return;
            }
            setTransferTarget(teacher);
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi tìm giáo viên: ' + err.message });
        }
        setIsAddingCollab(false);
    }

    async function handleTransferOwnership() {
        if (!transferTarget || !resourceToShare) return;
        setIsAddingCollab(true);
        try {
            await transferOwnership(
                'exams', resourceToShare.id,
                user.uid, user.displayName || user.email,
                transferTarget.uid, transferTarget.displayName,
                resourceToShare.name
            );
            setAlertMessage({ type: 'success', text: `Đã chuyển quyền sở hữu cho ${transferTarget.displayName}!` });
            setShareModalOpen(false);
            setTransferTarget(null);
            loadData();
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi chuyển nhượng: ' + err.message });
        }
        setIsAddingCollab(false);
    }

    // --- FOLDER HANDLERS ---
    function openFolderAddForm() {
        setFolderFormData({ name: '', description: '', icon: '📁', color: '#6366f1', examIds: [] });
        setIsFolderEditing(false);
        setFolderFormOpen(true);
    }

    function openFolderEditForm(folder) {
        setFolderFormData({ ...folder });
        setIsFolderEditing(true);
        setFolderFormOpen(true);
    }

    async function handleFolderSubmit(e) {
        e.preventDefault();
        setIsFolderSaving(true);
        try {
            await saveTeacherExamFolder(user.uid, folderFormData);
            setFolderFormOpen(false);
            setAlertMessage({ type: 'success', text: isFolderEditing ? 'Cập nhật Folder thành công!' : 'Tạo Folder mới thành công!' });
            loadData();
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'Lỗi lưu Folder: ' + error.message });
        }
        setIsFolderSaving(false);
    }

    async function handleConfirmDeleteFolder() {
        if (!folderToDelete) return;
        try {
            await deleteTeacherExamFolder(folderToDelete.id);
            setFolders(prev => prev.filter(f => f.id !== folderToDelete.id));
            setAlertMessage({ type: 'success', text: 'Đã xóa Folder thành công!' });
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'Lỗi xóa Folder: ' + error.message });
        }
        setFolderToDelete(null);
    }

    function handleFolderExamToggle(examId) {
        setFolderFormData(prev => {
            const ids = prev.examIds || [];
            if (ids.includes(examId)) {
                return { ...prev, examIds: ids.filter(id => id !== examId) };
            } else {
                return { ...prev, examIds: [...ids, examId] };
            }
        });
    }

    // Prepare data for UI
    const allRenderableFolders = [
        ...teacherFolders.map(f => ({ ...f, isAppSystemFolder: false, isOwnFolder: true })),
        ...folders.map(f => ({ ...f, isAppSystemFolder: true, isOwnFolder: false }))
    ];

    const searchLower = searchTerm.toLowerCase();

    const filteredExams = mergedExams.filter(e =>
        (e.name || '').toLowerCase().includes(searchLower) ||
        (e.description || '').toLowerCase().includes(searchLower)
    );

    const filteredFolders = allRenderableFolders.filter(f => {
        const matchesName = (f.name || '').toLowerCase().includes(searchLower);
        const hasMatchingExam = (f.examIds || []).some(id => filteredExams.some(e => e.id === id));
        return matchesName || hasMatchingExam;
    });

    const allFolderExamIds = new Set(allRenderableFolders.flatMap(f => f.examIds || []));
    const unassignedExams = filteredExams.filter(e => !allFolderExamIds.has(e.id));

    const ownExams = mergedExams.filter(e => e.isOwner);

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <div>
                    <h1 className="admin-page-title" style={{ margin: 0 }}>Bài tập và Kiểm tra</h1>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '4px' }}>Tạo và quản lý đề thi (cấu trúc theo section).</p>
                </div>
                <div className="admin-header-actions">
                    <button className="admin-btn admin-btn-secondary" onClick={openFolderAddForm}>
                        <FolderOpen size={16} /> Tạo Folder
                    </button>
                    <button className="admin-btn admin-btn-primary" onClick={openAddForm}>
                        <Plus size={16} /> Tạo bài tập và kiểm tra
                    </button>
                </div>
            </div>

            <div>
                <div className="admin-search-box">
                    <Search size={16} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Tìm bài tập và kiểm tra, folder..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="admin-card">
                {loading ? (
                    <div className="admin-empty-state">Đang tải dữ liệu...</div>
                ) : (filteredFolders.length === 0 && unassignedExams.length === 0) ? (
                    <div className="admin-empty-state">
                        <div className="admin-empty-icon"><ClipboardList size={28} /></div>
                        <h3>Chưa có dữ liệu</h3>
                        <p>Bấm nút "Tạo bài tập và kiểm tra" hoặc "Tạo Folder" để bắt đầu.</p>
                    </div>
                ) : (
                    <div className="admin-table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}></th>
                                    <th>Cấu trúc thư mục (Folder / Đề thi)</th>
                                    <th>Thông tin</th>
                                    <th className="text-right">Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* FOLDERS */}
                                {filteredFolders.map(folder => {
                                    const isExpanded = expandedFolders.has(folder.id) || searchTerm.length > 0;
                                    const folderExams = filteredExams.filter(e => (folder.examIds || []).includes(e.id));

                                    return (
                                        <Fragment key={folder.id}>
                                            <tr className="table-row-folder">
                                                <td>
                                                    <button
                                                        className="admin-expand-btn"
                                                        onClick={() => {
                                                            const newSet = new Set(expandedFolders);
                                                            if (isExpanded) newSet.delete(folder.id);
                                                            else newSet.add(folder.id);
                                                            setExpandedFolders(newSet);
                                                        }}
                                                    >
                                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                    </button>
                                                </td>
                                                <td>
                                                    <div className="admin-topic-cell">
                                                        <div className="admin-topic-icon" style={{ background: '#fef9c3' }}>📁</div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                            <div className="admin-topic-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <span style={{ fontWeight: 600, color: '#1e293b' }}>{folder.name}</span>
                                                                {folder.isAppSystemFolder ? (
                                                                    <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 'normal' }}>
                                                                        <Globe size={10} /> Chính thức
                                                                    </span>
                                                                ) : folder.isPublic ? (
                                                                    <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 'normal' }}>
                                                                        <Globe size={10} /> Public
                                                                    </span>
                                                                ) : null}
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
                                                        {folder.isOwnFolder && (
                                                            <>
                                                                <button className="admin-action-btn" onClick={() => openFolderEditForm(folder)} title="Sửa"><Edit size={16} /></button>
                                                                <button className="admin-action-btn danger" onClick={() => setFolderToDelete(folder)} title="Xóa"><Trash2 size={16} /></button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* EXAMS IN FOLDER */}
                                            {isExpanded && (
                                                folderExams.length === 0 ? (
                                                    <tr>
                                                        <td></td>
                                                        <td colSpan="3" style={{ paddingLeft: '40px', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>
                                                            Folder này chưa có bài tập và kiểm tra nào.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    folderExams.map(exam => {
                                                        const isOwn = exam.isOwner;
                                                        const isSystem = exam.isAdmin;
                                                        const isShared = !isOwn && !isSystem;

                                                        return (
                                                            <tr key={exam.id} className="table-row-nested" style={{ backgroundColor: '#fafafa' }}>
                                                                <td></td>
                                                                <td data-label="Đề thi">
                                                                    <div className="admin-topic-cell">
                                                                        <div className="admin-topic-icon" style={{ background: `${exam.color || '#6366f1'}20` }}>{exam.icon || '📋'}</div>
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                                                                <div className="admin-topic-name" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>{exam.name} <span style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, background: exam.examType === 'test' ? '#fef2f2' : '#f5f3ff', color: exam.examType === 'test' ? '#dc2626' : '#7c3aed', border: `1px solid ${exam.examType === 'test' ? '#fecaca' : '#ddd6fe'}` }}>{exam.examType === 'test' ? 'Kiểm tra' : 'Bài tập'}</span></div>
                                                                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                                                    {isSystem ? (
                                                                                        <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 'normal' }}>
                                                                                            <Globe size={10} /> Chính thức
                                                                                        </span>
                                                                                    ) : exam.isPublic ? (
                                                                                        <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 'normal' }}>
                                                                                            <Globe size={10} /> Public
                                                                                        </span>
                                                                                    ) : exam.isCollaborator ? (
                                                                                        <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#faf5ff', color: '#7c3aed', border: '1px solid #ddd6fe', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 'normal' }}>
                                                                                            <UsersRound size={10} /> Cộng tác viên {exam.collaboratorNames && exam.collaboratorNames[user.uid] ? '' : (exam.creatorName ? `· Chủ: ${exam.creatorName}` : '')}
                                                                                        </span>
                                                                                    ) : isShared ? (
                                                                                        <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 'normal' }}>
                                                                                            <Lock size={10} /> Được chia sẻ {exam.creatorName ? `bởi ${exam.creatorName}` : ''}
                                                                                        </span>
                                                                                    ) : null}
                                                                                </div>
                                                                            </div>
                                                                            <div className="admin-text-muted" style={{ fontSize: '0.75rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '2px' }}>{exam.description || 'Không có mô tả'}</div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td data-label="Thông tin">
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.8rem', color: '#64748b' }}>
                                                                        <span><List size={12} /> {questionCounts[exam.id] || 0} câu</span>
                                                                        <span><Clock size={12} /> {exam.timingMode === 'section' ? `Theo section (${(exam.sections || []).reduce((s, sec) => s + (sec.timeLimitMinutes || 0), 0)} phút)` : exam.timingMode === 'question' ? `Theo câu (${Math.round((exam.cachedQuestionTimeTotalSeconds || 0) / 60)} phút)` : `Theo bài (${exam.timeLimitMinutes || 60} phút)`}</span>
                                                                        {exam.timingMode === 'section' && (exam.sections || []).some(s => !s.timeLimitMinutes || s.timeLimitMinutes <= 0) && (
                                                                            <span style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 700 }}>⚠ {(exam.sections || []).filter(s => !s.timeLimitMinutes || s.timeLimitMinutes <= 0).length} section chưa hẹn giờ</span>
                                                                        )}
                                                                        {exam.timingMode === 'question' && (exam.cachedQuestionTimeMissingCount > 0) && (
                                                                            <span style={{ fontSize: '0.7rem', color: '#ea580c', fontWeight: 700 }}>⚠ {exam.cachedQuestionTimeMissingCount} câu hỏi chưa hẹn giờ</span>
                                                                        )}
                                                                        <span><ClipboardCheck size={12} /> {exam.sections?.length || 0} sections</span>
                                                                        {exam.cefrLevel && <span style={{ color: '#6366f1', fontWeight: 600 }}>{exam.cefrLevel}</span>}
                                                                    </div>
                                                                </td>
                                                                <td data-label="Hành động" className="text-right">
                                                                    <div className="admin-table-actions">
                                                                        <Link to={isSystem ? `/teacher/system-exams/${exam.id}` : `/teacher/exams/${exam.id}`} className="admin-action-btn" title="Xem/Quản lý câu hỏi">
                                                                            <List size={16} />
                                                                        </Link>
                                                                        {isOwn && (
                                                                            <>
                                                                                <button className="admin-action-btn" onClick={() => setExamToDuplicate(exam)} title="Nhân đôi"><Copy size={16} /></button>
                                                                                <button className="admin-action-btn" onClick={() => openShareModal(exam)} title="Quản lý cộng tác viên / Đề xuất">
                                                                                    <Share2 size={16} />
                                                                                </button>
                                                                                <button className="admin-action-btn" onClick={() => openEditForm(exam)} title="Sửa thông tin"><Edit size={16} /></button>
                                                                                <button className="admin-action-btn danger" onClick={() => setExamToDelete(exam)} title="Xóa đề thi"><Trash2 size={16} /></button>
                                                                            </>
                                                                        )}
                                                                        {exam.isCollaborator && (
                                                                            <>
                                                                                <button className="admin-action-btn" onClick={() => openEditForm(exam)} title="Sửa thông tin"><Edit size={16} /></button>
                                                                            </>
                                                                        )}
                                                                        {isSystem ? (
                                                                            <span style={{ fontSize: '0.8rem', color: '#3b82f6', fontStyle: 'italic', display: 'flex', alignItems: 'center' }}>
                                                                                <Lock size={12} style={{ marginRight: '4px' }} /> Chính thức
                                                                            </span>
                                                                        ) : isShared && (
                                                                            <span style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic', display: 'flex', alignItems: 'center' }}>
                                                                                <Lock size={12} style={{ marginRight: '4px' }} /> Phân quyền
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )
                                            )}
                                        </Fragment>
                                    );
                                })}

                                {/* UNASSIGNED EXAMS */}
                                {unassignedExams.length > 0 && (
                                    <>
                                        <tr className="admin-unassigned-header">
                                            <td></td>
                                            <td colSpan="3">
                                                <div className="admin-unassigned-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#fef3c7', color: '#b45309', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, marginTop: '16px', marginBottom: '8px' }}>
                                                    <AlertTriangle size={14} />
                                                    Đề thi chưa được phân vào Folder ({unassignedExams.length})
                                                </div>
                                            </td>
                                        </tr>
                                        {unassignedExams.map(exam => {
                                            const isOwn = exam.isOwner;
                                            const isSystem = exam.isAdmin;
                                            const isShared = !isOwn && !isSystem;

                                            return (
                                                <tr key={exam.id} className="table-row-nested" style={{ backgroundColor: '#fafafa' }}>
                                                    <td></td>
                                                    <td data-label="Đề thi">
                                                        <div className="admin-topic-cell">
                                                            <div className="admin-topic-icon" style={{ background: `${exam.color || '#6366f1'}20` }}>{exam.icon || '📋'}</div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                                                    <div className="admin-topic-name" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>{exam.name} <span style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, background: exam.examType === 'test' ? '#fef2f2' : '#f5f3ff', color: exam.examType === 'test' ? '#dc2626' : '#7c3aed', border: `1px solid ${exam.examType === 'test' ? '#fecaca' : '#ddd6fe'}` }}>{exam.examType === 'test' ? 'Kiểm tra' : 'Bài tập'}</span></div>
                                                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                                        {isSystem ? (
                                                                            <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 'normal' }}>
                                                                                <Globe size={10} /> Chính thức
                                                                            </span>
                                                                        ) : exam.isPublic ? (
                                                                            <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 'normal' }}>
                                                                                <Globe size={10} /> Public
                                                                            </span>
                                                                        ) : exam.isCollaborator ? (
                                                                            <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#faf5ff', color: '#7c3aed', border: '1px solid #ddd6fe', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 'normal' }}>
                                                                                <UsersRound size={10} /> Cộng tác viên {exam.collaboratorNames && exam.collaboratorNames[user.uid] ? '' : (exam.creatorName ? `· Chủ: ${exam.creatorName}` : '')}
                                                                            </span>
                                                                        ) : isShared ? (
                                                                            <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 'normal' }}>
                                                                                <Lock size={10} /> Được chia sẻ
                                                                            </span>
                                                                        ) : null}
                                                                    </div>
                                                                </div>
                                                                <div className="admin-text-muted" style={{ fontSize: '0.75rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '2px' }}>{exam.description || 'Không có mô tả'}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td data-label="Thông tin">
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.8rem', color: '#64748b' }}>
                                                            <span><List size={12} /> {questionCounts[exam.id] || 0} câu</span>
                                                            <span><Clock size={12} /> {exam.timingMode === 'section' ? `Theo section (${(exam.sections || []).reduce((s, sec) => s + (sec.timeLimitMinutes || 0), 0)} phút)` : exam.timingMode === 'question' ? `Theo câu (${Math.round((exam.cachedQuestionTimeTotalSeconds || 0) / 60)} phút)` : `Theo bài (${exam.timeLimitMinutes || 60} phút)`}</span>
                                                            {exam.timingMode === 'section' && (exam.sections || []).some(s => !s.timeLimitMinutes || s.timeLimitMinutes <= 0) && (
                                                                <span style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 700 }}>⚠ {(exam.sections || []).filter(s => !s.timeLimitMinutes || s.timeLimitMinutes <= 0).length} section chưa hẹn giờ</span>
                                                            )}
                                                            {exam.timingMode === 'question' && (exam.cachedQuestionTimeMissingCount > 0) && (
                                                                <span style={{ fontSize: '0.7rem', color: '#ea580c', fontWeight: 700 }}>⚠ {exam.cachedQuestionTimeMissingCount} câu hỏi chưa hẹn giờ</span>
                                                            )}
                                                            <span><ClipboardCheck size={12} /> {exam.sections?.length || 0} sections</span>
                                                            {exam.cefrLevel && <span style={{ color: '#6366f1', fontWeight: 600 }}>{exam.cefrLevel}</span>}
                                                        </div>
                                                    </td>
                                                    <td data-label="Hành động" className="text-right">
                                                        <div className="admin-table-actions">
                                                            <Link to={isSystem ? `/teacher/system-exams/${exam.id}` : `/teacher/exams/${exam.id}`} className="admin-action-btn" title="Xem/Quản lý câu hỏi">
                                                                <List size={16} />
                                                            </Link>
                                                            {isOwn && (
                                                                <>
                                                                    <button className="admin-action-btn" onClick={() => setExamToDuplicate(exam)} title="Nhân đôi"><Copy size={16} /></button>
                                                                    <button className="admin-action-btn" onClick={() => openShareModal(exam)} title="Quản lý cộng tác viên / Đề xuất">
                                                                        <Share2 size={16} />
                                                                    </button>
                                                                    <button className="admin-action-btn" onClick={() => openEditForm(exam)} title="Sửa thông tin"><Edit size={16} /></button>
                                                                    <button className="admin-action-btn danger" onClick={() => setExamToDelete(exam)} title="Xóa đề thi"><Trash2 size={16} /></button>
                                                                </>
                                                            )}
                                                            {exam.isCollaborator && (
                                                                <>
                                                                    <button className="admin-action-btn" onClick={() => openEditForm(exam)} title="Sửa thông tin"><Edit size={16} /></button>
                                                                </>
                                                            )}
                                                            {isSystem ? (
                                                                <span style={{ fontSize: '0.8rem', color: '#3b82f6', fontStyle: 'italic', display: 'flex', alignItems: 'center' }}>
                                                                    <Lock size={12} style={{ marginRight: '4px' }} /> Chính thức
                                                                </span>
                                                            ) : isShared && (
                                                                <span style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic', display: 'flex', alignItems: 'center' }}>
                                                                    <Lock size={12} style={{ marginRight: '4px' }} /> Phân quyền
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* FORM MODAL */}
            {formOpen && (
                <div className="teacher-modal-overlay">
                    <div className="teacher-modal wide" style={{ maxWidth: '600px', overflow: 'auto' }}>
                        <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                            <button className="teacher-modal-close" onClick={() => setFormOpen(false)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <h2 className="admin-modal-title" style={{ justifyContent: 'flex-start', marginBottom: '24px', paddingRight: '40px' }}>
                            {isEditing ? 'Sửa bài tập và kiểm tra' : 'Tạo bài tập và kiểm tra mới'}
                        </h2>
                        <form onSubmit={handleFormSubmit}>
                            <div className="admin-form-group">
                                <label>Loại</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button type="button" onClick={() => setFormData({ ...formData, examType: 'homework' })} style={{ flex: 1, padding: '10px 16px', borderRadius: '12px', border: formData.examType === 'homework' ? '2px solid #6366f1' : '2px solid #e2e8f0', background: formData.examType === 'homework' ? '#eff6ff' : '#fff', color: formData.examType === 'homework' ? '#4f46e5' : '#64748b', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                        📝 Bài tập
                                    </button>
                                    <button type="button" onClick={() => setFormData({ ...formData, examType: 'test' })} style={{ flex: 1, padding: '10px 16px', borderRadius: '12px', border: formData.examType === 'test' ? '2px solid #ef4444' : '2px solid #e2e8f0', background: formData.examType === 'test' ? '#fef2f2' : '#fff', color: formData.examType === 'test' ? '#dc2626' : '#64748b', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                        📋 Bài kiểm tra
                                    </button>
                                </div>
                            </div>
                            <div className="admin-form-group">
                                <label>Tên bài tập và kiểm tra</label>
                                <input type="text" className="admin-form-input" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ví dụ: Đề thi thử đại học môn Anh 2024" />
                            </div>
                            <CustomSelect
                                label="Cấp độ nội dung (CEFR)"
                                value={formData.cefrLevel || ''}
                                onChange={v => setFormData({ ...formData, cefrLevel: v })}
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
                            <div className="admin-form-group">
                                <label>Mô tả ngắn</label>
                                <textarea className="admin-form-input admin-form-textarea" required value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Dành cho đối tượng nào, mục đích..." />
                            </div>
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <div className="admin-form-group" style={{ flex: 1 }}>
                                    <label>Icon (Emoji)</label>
                                    <input type="text" className="admin-form-input" value={formData.icon} onChange={e => setFormData({ ...formData, icon: e.target.value })} />
                                </div>
                                <div className="admin-form-group" style={{ flex: 1 }}>
                                    <label>Màu sắc</label>
                                    <input type="color" className="admin-form-input" style={{ padding: '4px', height: '42px' }} value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} />
                                </div>
                            </div>

                            <div className="admin-form-group">
                                <label>Chế độ thời gian</label>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    {[{ value: 'exam', label: '📋 Cả bài', desc: 'Thời gian chung cho toàn bộ bài' }, { value: 'section', label: '📄 Theo section', desc: 'Mỗi section có thời gian riêng' }, { value: 'question', label: '❓ Theo câu hỏi', desc: 'Mỗi câu hỏi có thời gian riêng' }].map(mode => (
                                        <button key={mode.value} type="button" onClick={() => setFormData({ ...formData, timingMode: mode.value })}
                                            style={{ flex: 1, padding: '10px 8px', borderRadius: '12px', border: formData.timingMode === mode.value ? '2px solid #6366f1' : '2px solid #e2e8f0', background: formData.timingMode === mode.value ? '#eef2ff' : '#fff', color: formData.timingMode === mode.value ? '#4f46e5' : '#64748b', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}>
                                            {mode.label}
                                        </button>
                                    ))}
                                </div>
                                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '6px', marginBottom: 0 }}>
                                    {formData.timingMode === 'exam' ? '⏱ Đặt 1 khoảng thời gian cố định cho toàn bộ bài.' : formData.timingMode === 'section' ? '⏱ Thời gian sẽ được cấu hình riêng cho từng section trong trang chỉnh sửa.' : '⏱ Thời gian sẽ được cấu hình riêng cho từng câu hỏi trong trang chỉnh sửa.'}
                                </p>
                            </div>

                            {formData.timingMode === 'exam' && (
                                <div className="admin-form-group">
                                    <label>Thời gian làm bài (phút)</label>
                                    <input type="text" inputMode="decimal" className="admin-form-input" required value={formData.timeLimitMinutes} onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setFormData({ ...formData, timeLimitMinutes: v }); }} onBlur={e => { const n = parseFloat(e.target.value); setFormData(prev => ({ ...prev, timeLimitMinutes: (n && n > 0) ? n : '' })); }} placeholder="Ví dụ: 60 hoặc 2.5" />
                                </div>
                            )}

                            <div className="admin-form-group" style={{ zIndex: 10 }}>
                                <CustomSelect
                                    label="Đưa vào Folder (tùy chọn)"
                                    labelIcon={<FolderOpen size={14} />}
                                    value={formData.folderId || ''}
                                    onChange={v => setFormData({ ...formData, folderId: v })}
                                    placeholder="-- Không chọn Folder --"
                                    options={[
                                        { value: '', label: '-- Không chọn Folder --' },
                                        ...teacherFolders.map(f => ({ value: f.id, label: f.name, icon: f.icon || '📁' }))
                                    ]}
                                />
                            </div>

                            <div className="admin-form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 }}>
                                    <input type="checkbox" checked={formData.isPublic} onChange={e => setFormData({ ...formData, isPublic: e.target.checked })} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                                    Mở công khai (Public)
                                </label>
                                <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '6px', marginLeft: '26px' }}>
                                    Nếu bật, tất cả tài khoản học viên đều có thể thấy và làm bài tập và kiểm tra này. Ngược lại, chỉ những người được chia sẻ mới thấy.
                                </p>
                            </div>

                            <div className="admin-modal-actions" style={{ marginTop: '32px', flexDirection: 'row' }}>
                                <button type="button" className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setFormOpen(false)} disabled={isSaving}>Hủy</button>
                                <button type="submit" className="admin-btn admin-btn-primary" style={{ flex: 1 }} disabled={isSaving}>{isSaving ? 'Đang lưu...' : (isEditing ? 'Cập nhật' : 'Tạo mới')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DELETE MODAL */}
            {examToDelete && (
                <div className="admin-modal-overlay">
                    <div className="admin-modal">
                        <h2 className="admin-modal-title" style={{ color: '#ef4444' }}><Trash2 size={24} /> Xác nhận xóa</h2>
                        <p className="admin-modal-desc">
                            Bạn có chắc chắn muốn xóa bài tập và kiểm tra <strong>{examToDelete.name}</strong>? Toàn bộ câu hỏi bên trong cũng sẽ bị xóa vĩnh viễn và không thể khôi phục.
                        </p>
                        <div className="admin-modal-actions">
                            <button className="admin-btn admin-btn-secondary" onClick={() => setExamToDelete(null)}>Hủy</button>
                            <button className="admin-btn admin-btn-primary" style={{ backgroundColor: '#ef4444' }} onClick={handleConfirmDelete}>Xóa vĩnh viễn</button>
                        </div>
                    </div>
                </div>
            )}

            {/* FOLDER FORM MODAL */}
            {folderFormOpen && (
                <div className="teacher-modal-overlay">
                    <div className="teacher-modal wide" style={{ maxWidth: '550px', overflow: 'auto' }}>
                        <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                            <button className="teacher-modal-close" onClick={() => setFolderFormOpen(false)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <h2 className="admin-modal-title" style={{ justifyContent: 'flex-start', marginBottom: '24px', paddingRight: '40px' }}>
                            {isFolderEditing ? 'Sửa Folder' : 'Tạo Folder mới'}
                        </h2>
                        <form onSubmit={handleFolderSubmit}>
                            <div className="admin-form-group">
                                <label>Tên Folder</label>
                                <input type="text" className="admin-form-input" required value={folderFormData.name} onChange={e => setFolderFormData({ ...folderFormData, name: e.target.value })} placeholder="Ví dụ: Đề thi năng lực 2024" />
                            </div>
                            <div className="admin-form-group">
                                <label>Mô tả</label>
                                <textarea className="admin-form-input admin-form-textarea" value={folderFormData.description || ''} onChange={e => setFolderFormData({ ...folderFormData, description: e.target.value })} placeholder="Mô tả Folder..." />
                            </div>

                            <div className="admin-form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 }}>
                                    <input type="checkbox" checked={folderFormData.isPublic || false} onChange={e => setFolderFormData({ ...folderFormData, isPublic: e.target.checked })} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                                    Mở công khai (Public)
                                </label>
                                <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '6px', marginLeft: '26px' }}>
                                    Nếu bật, tất cả đề thi bên trong Folder này sẽ được mọi người nhìn thấy trên App.
                                </p>
                            </div>
                            <div className="admin-form-group">
                                <label>Chọn các đề thi đưa vào Folder này</label>
                                <div className="admin-folder-topics-select">
                                    {ownExams.length === 0 ? (
                                        <p className="admin-text-muted" style={{ padding: '12px' }}>Bạn chưa tạo đề thi nào để thêm vào Folder.</p>
                                    ) : (
                                        ownExams.map(ex => (
                                            <div key={ex.id} className="admin-folder-topic-item" onClick={() => handleFolderExamToggle(ex.id)}>
                                                <input
                                                    type="checkbox"
                                                    checked={(folderFormData.examIds || []).includes(ex.id)}
                                                    onChange={() => { }} // Handle on parent div
                                                />
                                                <span className="admin-topic-icon" style={{ background: `${ex.color || '#6366f1'}20`, display: 'inline-flex', width: '24px', height: '24px', fontSize: '0.8rem' }}>{ex.icon || '📋'}</span>
                                                <span style={{ fontSize: '0.9rem' }}>{ex.name}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                            <div className="admin-modal-actions" style={{ marginTop: '24px', flexDirection: 'row' }}>
                                <button type="button" className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setFolderFormOpen(false)} disabled={isFolderSaving}>Hủy</button>
                                <button type="submit" className="admin-btn admin-btn-primary" style={{ flex: 1 }} disabled={isFolderSaving}>{isFolderSaving ? 'Đang lưu...' : (isFolderEditing ? 'Cập nhật' : 'Tạo mới')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DELETE FOLDER MODAL */}
            {folderToDelete && (
                <div className="admin-modal-overlay">
                    <div className="admin-modal">
                        <h2 className="admin-modal-title" style={{ color: '#ef4444' }}><AlertTriangle size={24} /> Xác nhận xóa Folder</h2>
                        <p className="admin-modal-desc">
                            Bạn có chắc chắn muốn xóa thư mục <strong>{folderToDelete.name}</strong>?
                            Các đề thi bên trong sẽ <strong>KHÔNG</strong> bị xóa, chúng chỉ bị đưa ra ngoài thư mục.
                        </p>
                        <div className="admin-modal-actions">
                            <button className="admin-btn admin-btn-secondary" onClick={() => setFolderToDelete(null)}>Hủy</button>
                            <button className="admin-btn admin-btn-primary" style={{ backgroundColor: '#ef4444' }} onClick={handleConfirmDeleteFolder}>Xóa Folder</button>
                        </div>
                    </div>
                </div>
            )}



            {/* SHARE MODAL */}
            {shareModalOpen && resourceToShare && (
                <div className="teacher-modal-overlay">
                    <div className="teacher-modal wide" style={{ maxWidth: '550px', overflow: 'auto' }}>
                        <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                            <button className="teacher-modal-close" onClick={() => setShareModalOpen(false)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <h2 className="admin-modal-title" style={{ justifyContent: 'flex-start', marginBottom: '24px', paddingRight: '40px' }}>
                            Cộng tác viên - {resourceToShare.type?.includes('folder') ? 'Folder' : 'Đề thi'}
                        </h2>

                        <div style={{ marginBottom: '20px', padding: '12px', background: '#f8fafc', borderRadius: '8px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div className="admin-topic-icon" style={{ background: `${resourceToShare.color || '#3b82f6'}20`, width: '40px', height: '40px', fontSize: '1.2rem' }}>
                                {resourceToShare.icon || (resourceToShare.type?.includes('folder') ? '📁' : '📋')}
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a' }}>{resourceToShare.name || resourceToShare.title}</h3>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                                    {resourceToShare.isAdmin ? 'Nội dung chính thức (chỉ xem)' : 'Do bạn quản lý'}
                                </p>
                            </div>
                        </div>

                        {/* Quick Assign to Class (for all exam resources) */}
                        {(
                            <div style={{ marginBottom: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                                <h4 style={{ fontSize: '0.9rem', color: '#0f172a', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}><FileText size={16} color="#f59e0b" /> Giao bài cho lớp</h4>
                                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '12px' }}>Giao nhanh Bài tập/Kiểm tra này cho 1 lớp mà bạn đang chủ nhiệm.</p>

                                {/* Existing assignment tags */}
                                {existingAssignments.length > 0 && (
                                    <div style={{ marginBottom: '12px' }}>
                                        <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>Đã giao cho:</p>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                            {existingAssignments.map(a => (
                                                <span key={a.id} style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px', background: 'linear-gradient(135deg, #fef3c7, #fde68a)', color: '#92400e', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #fcd34d' }}>
                                                    ✅ {a.groupName || a.targetName || 'Lớp'}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {teacherManagedGroups.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 20 }}>
                                                <CustomSelect
                                                    value={quickAssignGroupId}
                                                    onChange={v => setQuickAssignGroupId(v)}
                                                    placeholder="-- Chọn lớp --"
                                                    options={teacherManagedGroups.map(g => ({ value: g.id, label: g.name, icon: '🏫' }))}
                                                    style={{ margin: 0 }}
                                                />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <input
                                                    type="datetime-local"
                                                    value={quickAssignDueDate}
                                                    onChange={e => setQuickAssignDueDate(e.target.value)}
                                                    style={{ width: '100%', padding: '6px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.88rem', color: '#1e293b', minHeight: '38px', boxSizing: 'border-box' }}
                                                />
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (!quickAssignGroupId || !quickAssignDueDate || !resourceToShare) return;

                                                // Block if time setup is incomplete
                                                if (resourceToShare.timingMode === 'section' && (resourceToShare.sections || []).some(s => !s.timeLimitMinutes || s.timeLimitMinutes <= 0)) {
                                                    setToast({ message: `Bài "${resourceToShare.name}" có section chưa đặt thời gian. Vui lòng hoàn thành thiết lập thời gian trước khi giao bài.`, type: 'error' });
                                                    return;
                                                }
                                                if (resourceToShare.timingMode === 'question') {
                                                    setToast({ message: `Bài "${resourceToShare.name}" chưa hoàn thành thiết lập thời gian theo từng câu hỏi. Vui lòng kiểm tra thời gian từng câu trước khi giao bài.`, type: 'error' });
                                                    return;
                                                }

                                                setIsQuickAssigning(true);
                                                setQuickAssignSuccess('');
                                                try {
                                                    const dueDateTimestamp = Timestamp.fromDate(new Date(quickAssignDueDate));
                                                    await createExamAssignment({
                                                        examId: resourceToShare.id,
                                                        examName: resourceToShare.name,
                                                        examTitle: resourceToShare.name,
                                                        examType: resourceToShare.examType || 'homework',
                                                        targetType: 'group',
                                                        targetId: quickAssignGroupId,
                                                        dueDate: dueDateTimestamp,
                                                        createdBy: user?.uid,
                                                        teacherTitle: user?.teacherTitle || '',
                                                        studentTitle: user?.studentTitle || ''
                                                    });
                                                    const groupName = teacherManagedGroups.find(g => g.id === quickAssignGroupId)?.name || '';
                                                    setQuickAssignSuccess(`Đã giao "${resourceToShare.name}" cho lớp ${groupName}!`);
                                                    setQuickAssignGroupId('');
                                                    setQuickAssignDueDate('');
                                                    // Refresh existing assignments
                                                    const updatedAssignments = await getExamAssignmentsForExam(resourceToShare.id);
                                                    setExistingAssignments(updatedAssignments.map(a => ({
                                                        ...a,
                                                        groupName: teacherManagedGroups.find(g => g.id === a.targetId)?.name || a.targetName || a.groupName || a.targetId || ''
                                                    })));
                                                } catch (err) {
                                                    setAlertMessage({ type: 'error', text: 'Lỗi giao bài: ' + err.message });
                                                }
                                                setIsQuickAssigning(false);
                                            }}
                                            disabled={isQuickAssigning || !quickAssignGroupId || !quickAssignDueDate}
                                            className="admin-btn admin-btn-primary"
                                            style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', opacity: (isQuickAssigning || !quickAssignGroupId || !quickAssignDueDate) ? 0.6 : 1 }}
                                        >
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
                                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>Bạn chưa quản lý lớp nào. Liên hệ Admin để được thêm vào lớp.</p>
                                )}
                            </div>
                        )}

                        {/* Collaborators Section (Only for owners) */}
                        {resourceToShare.isOwner === false && resourceToShare.teacherId !== user?.uid ? (
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '20px', background: '#f8fafc' }}>
                                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <AlertCircle size={14} /> Bạn đang xem chia sẻ của tài nguyên này, không thể thay đổi người được chia sẻ.
                                </p>
                            </div>
                        ) : !resourceToShare.isAdmin && !resourceToShare.type?.includes('admin') && (
                            <div style={{ marginBottom: '20px' }}>
                                <h4 style={{ fontSize: '0.9rem', color: '#0f172a', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}><UsersRound size={16} color="#8b5cf6" /> Chia sẻ nội bộ</h4>
                                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '12px' }}>Thêm giáo viên khác cùng hợp tác quản lý hoặc chuyển quyền sở hữu hoàn toàn.</p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                                    <div style={{ width: '100%' }}>
                                        <EmailAutocomplete
                                            value={collabEmail}
                                            onChange={setCollabEmail}
                                            onSelect={(email) => { }}
                                            placeholder="Email hệ thống của giáo viên..."
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            className="admin-btn admin-btn-primary"
                                            onClick={handleAddCollaborator}
                                            disabled={isAddingCollab || !collabEmail}
                                            style={{ flex: 1, background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', border: 'none', padding: '8px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            Thêm
                                        </button>
                                        <button
                                            className="admin-btn admin-btn-secondary"
                                            onClick={() => handlePreTransferOwnership(collabEmail)}
                                            disabled={isAddingCollab || !collabEmail}
                                            style={{ flex: 1, padding: '8px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderColor: '#8b5cf6', color: '#8b5cf6', whiteSpace: 'nowrap' }}
                                        >
                                            <ArrowRightLeft size={14} /> Chuyển quyền
                                        </button>
                                    </div>
                                </div>

                                {collaborators.length > 0 && (
                                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                                        {collaborators.map((c, i) => (
                                            <div key={c.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: i < collaborators.length - 1 ? '1px solid #e2e8f0' : 'none', background: '#faf5ff' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                                        {(c.displayName || 'G').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#0f172a' }}>{c.displayName || 'Giáo viên'}</div>
                                                        {c.email && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.email}</div>}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button
                                                        onClick={() => setTransferTarget(c)}
                                                        disabled={isAddingCollab}
                                                        style={{ background: 'none', border: '1px solid #e2e8f0', color: '#8b5cf6', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                        title="Chuyển quyền sở hữu"
                                                    >
                                                        <ArrowRightLeft size={12} /> Chuyển quyền
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemoveCollaborator(c.uid)}
                                                        disabled={isAddingCollab}
                                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                                        title="Gỡ cộng tác viên"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Proposal Section */}
                        {(resourceToShare.isOwner || resourceToShare.teacherId === user?.uid) && !resourceToShare.isAdmin && !resourceToShare.type?.includes('admin') && (
                            <div style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                                <h4 style={{ fontSize: '0.9rem', color: '#0f172a', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Landmark size={16} /> Đề xuất thành nội dung chính thức
                                </h4>
                                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '12px' }}>
                                    Gửi {resourceToShare.type?.includes('folder') ? 'folder' : 'đề thi'} này cho Admin duyệt để đưa lên kho đề thi chính thức.
                                </p>
                                {currentProposal ? (
                                    <div style={{ padding: '12px 16px', borderRadius: '8px', background: currentProposal.status === 'approved' ? '#ecfdf5' : currentProposal.status === 'rejected' ? '#fef2f2' : '#fffbeb', border: `1px solid ${currentProposal.status === 'approved' ? '#a7f3d0' : currentProposal.status === 'rejected' ? '#fecaca' : '#fde68a'}` }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            {currentProposal.status === 'pending' && <Clock size={16} color="#d97706" />}
                                            {currentProposal.status === 'approved' && <CheckCircle size={16} color="#10b981" />}
                                            {currentProposal.status === 'rejected' && <XCircle size={16} color="#ef4444" />}
                                            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: currentProposal.status === 'approved' ? '#059669' : currentProposal.status === 'rejected' ? '#dc2626' : '#d97706' }}>
                                                {currentProposal.status === 'pending' && 'Đang chờ Admin duyệt'}
                                                {currentProposal.status === 'approved' && 'Đã được duyệt ✓'}
                                                {currentProposal.status === 'rejected' && 'Đã bị từ chối'}
                                            </span>
                                        </div>
                                        {currentProposal.status === 'rejected' && currentProposal.adminNote && (
                                            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '8px 0 0', fontStyle: 'italic' }}>Lý do: {currentProposal.adminNote}</p>
                                        )}
                                        {currentProposal.status === 'rejected' && (
                                            <button onClick={() => handleSubmitProposal()} disabled={isSubmittingProposal} className="admin-btn admin-btn-primary" style={{ marginTop: '10px', fontSize: '0.8rem' }}>
                                                <Send size={14} /> Gửi lại đề xuất
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <button onClick={() => handleSubmitProposal()} disabled={isSubmittingProposal} className="admin-btn" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '8px', fontSize: '0.85rem', cursor: isSubmittingProposal ? 'not-allowed' : 'pointer', opacity: isSubmittingProposal ? 0.6 : 1 }}>
                                        <Send size={14} /> {isSubmittingProposal ? 'Đang gửi...' : 'Gửi đề xuất chính thức'}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )
            }

            {/* TRANSFER OWNERSHIP CONFIRM MODAL */}
            {
                transferTarget && (
                    <div className="admin-modal-overlay">
                        <div className="admin-modal" style={{ maxWidth: '450px' }}>
                            <h2 className="admin-modal-title" style={{ color: '#8b5cf6' }}><ArrowRightLeft size={24} /> Chuyển quyền sở hữu</h2>
                            <p className="admin-modal-desc">
                                Bạn có chắc chắn muốn chuyển quyền sở hữu đề thi <strong>{resourceToShare?.name}</strong> cho <strong>{transferTarget.displayName}</strong>?
                                <br /><br />
                                Sau khi chuyển, bạn sẽ trở thành cộng tác viên và không thể xóa đề thi này nữa.
                            </p>
                            <div className="admin-modal-actions">
                                <button className="admin-btn admin-btn-secondary" onClick={() => setTransferTarget(null)} disabled={isAddingCollab}>Hủy</button>
                                <button className="admin-btn admin-btn-primary" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }} onClick={handleTransferOwnership} disabled={isAddingCollab}>
                                    {isAddingCollab ? 'Đang xử lý...' : 'Xác nhận chuyển'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* DUPLICATE CONFIRM */}
            {
                examToDuplicate && (
                    <div className="admin-modal-overlay">
                        <div className="admin-modal" style={{ maxWidth: '450px' }}>
                            <h2 className="admin-modal-title" style={{ color: '#6366f1' }}><Copy size={24} /> Nhân đôi đề thi</h2>
                            <p className="admin-modal-desc">
                                Bạn có muốn nhân đôi đề thi <strong>{examToDuplicate.name}</strong>?
                            </p>
                            <div className="admin-modal-actions">
                                <button className="admin-btn admin-btn-secondary" onClick={() => setExamToDuplicate(null)} disabled={isDuplicating}>Hủy</button>
                                <button className="admin-btn admin-btn-primary" onClick={handleConfirmDuplicate} disabled={isDuplicating}>
                                    {isDuplicating ? 'Đang nhân đôi...' : 'Xác nhận nhân đôi'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ALERTS */}
            {
                alertMessage && (
                    <div className="admin-modal-overlay">
                        <div className="admin-modal">
                            <h2 className="admin-modal-title">
                                {alertMessage.type === 'success' ? <span style={{ color: '#10b981' }}>Thành công</span> : <span style={{ color: '#ef4444' }}>Đã có lỗi</span>}
                            </h2>
                            <p className="admin-modal-desc">{alertMessage.text}</p>
                            <div className="admin-modal-actions">
                                <button className="admin-btn admin-btn-primary" onClick={() => setAlertMessage(null)}>Đóng</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
