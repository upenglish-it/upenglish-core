import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAdminAllGrammarExercises, deleteAdminGrammarExercise, getGroups, toggleResourcePublic, getResourceSharedEntities, shareResourceToEmail, unshareResourceFromUser, shareResourceToGroup, unshareResourceFromGroup, cleanupExpiredDeletedContent, restoreGrammarExerciseToAdmin } from '../../services/adminService';
import { getAllTeacherGrammarFolders, saveTeacherGrammarFolder, deleteTeacherGrammarFolder, saveGrammarExercise, getDeletedGrammarExercises, getDeletedTeacherGrammarFolders, restoreGrammarExercise, restoreTeacherGrammarFolder, permanentlyDeleteGrammarExercise, permanentlyDeleteTeacherGrammarFolder } from '../../services/grammarService';
import { createAssignment, getAssignmentsForTopic } from '../../services/teacherService';
import { useAuth } from '../../contexts/AuthContext';
import { BookOpen, Search, Trash2, Edit, AlertCircle, Globe, List, FolderOpen, X, ChevronDown, ChevronRight, AlertTriangle, User, Share2, Users, UsersRound, Mail, UserPlus, Lock, Send, FileText, CheckCircle, RotateCcw, ArrowRightLeft } from 'lucide-react';
import { convertGrammarToExam } from '../../services/conversionService';
import CustomSelect from '../../components/common/CustomSelect';
import EmailAutocomplete from '../../components/common/EmailAutocomplete';
import { usersService } from '../../models';

export default function AdminTeacherGrammarPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [exercises, setExercises] = useState([]);
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
    const [quickAssignScheduledStart, setQuickAssignScheduledStart] = useState('');
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

    const [exerciseToDelete, setExerciseToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [alertMessage, setAlertMessage] = useState(null);

    // Conversion state
    const [exerciseToConvert, setExerciseToConvert] = useState(null);
    const [isConverting, setIsConverting] = useState(false);
    const [convertExamType, setConvertExamType] = useState('homework');
    const [convertTimingMode, setConvertTimingMode] = useState('exam');

    // Exercise Edit State
    const [exerciseFormOpen, setExerciseFormOpen] = useState(false);
    const [exerciseFormData, setExerciseFormData] = useState({ id: '', name: '', description: '', icon: '📝', color: '#3b82f6', targetLevel: 'B1', targetAge: 12, isPublic: false });
    const [isSavingExercise, setIsSavingExercise] = useState(false);

    // Trash state
    const [deletedExercises, setDeletedExercises] = useState([]);
    const [deletedFolders2, setDeletedFolders2] = useState([]);
    const [trashExpanded, setTrashExpanded] = useState(false);
    const [trashActionLoading, setTrashActionLoading] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const fetchTeacherInfo = async (teacherId, currentMap) => {
        if (!teacherId || currentMap[teacherId]) return;
        try {
            const userSnap = await usersService.findOne(teacherId);
            if (userSnap) {
                setTeacherMap(prev => ({ ...prev, [teacherId]: userSnap }));
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
            const [exercisesData, foldersData, delExercises, delFolders] = await Promise.all([
                getAdminAllGrammarExercises(),
                getAllTeacherGrammarFolders(),
                getDeletedGrammarExercises(),
                getDeletedTeacherGrammarFolders()
            ]);
            const teacherExercises = exercisesData.filter(ex => ex.teacherId);
            setExercises(teacherExercises);
            setFolders(foldersData);
            setDeletedExercises(delExercises.filter(ex => ex.teacherId));
            setDeletedFolders2(delFolders);

            // Fire-and-forget auto-purge
            cleanupExpiredDeletedContent().catch(() => {});

            const tempTeacherMap = { ...teacherMap };
            const allTeacherIds = new Set([
                ...teacherExercises.map(ex => ex.teacherId),
                ...foldersData.map(f => f.teacherId),
                ...teacherExercises.flatMap(ex => ex.collaboratorIds || []),
                ...delExercises.map(ex => ex.teacherId),
                ...delFolders.map(f => f.teacherId)
            ]);
            await Promise.all([...allTeacherIds].map(id => fetchTeacherInfo(id, tempTeacherMap)));
        } catch (error) {
            console.error(error);
            setAlertMessage({ type: 'error', text: 'Lỗi tải dữ liệu: ' + error.message });
        }
        setLoading(false);
    }

    const filteredExercises = exercises.filter(ex => {
        const searchLower = searchTerm.toLowerCase();
        const teacher = teacherMap[ex.teacherId] || {};
        return (
            ex.name?.toLowerCase().includes(searchLower) ||
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
        const hasMatchingExercise = (f.exerciseIds || []).some(eid =>
            filteredExercises.some(ex => ex.id === eid)
        );
        return matchesFolder || hasMatchingExercise;
    });

    async function handleConfirmDelete() {
        if (!exerciseToDelete) return;
        setIsDeleting(true);
        try {
            await deleteAdminGrammarExercise(exerciseToDelete.id);
            setExercises(exercises.filter(ex => ex.id !== exerciseToDelete.id));
            setAlertMessage({ type: 'success', text: 'Đã xóa bài luyện thành công!' });
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'Lỗi khi xóa bài luyện: ' + error.message });
        }
        setIsDeleting(false);
        setExerciseToDelete(null);
    }

    // Folder CRUD
    function openFolderEditForm(folder) {
        setFolderFormData({ ...folder });
        setIsFolderEditing(true);
        setFolderFormOpen(true);
    }

    // Exercise CRUD
    function openEditExerciseForm(exercise) {
        setExerciseFormData({ ...exercise });
        setExerciseFormOpen(true);
    }

    async function handleExerciseSubmit(e) {
        e.preventDefault();
        setIsSavingExercise(true);
        try {
            await saveGrammarExercise(exerciseFormData);
            setExerciseFormOpen(false);
            setAlertMessage({ type: 'success', text: 'Cập nhật bài luyện thành công!' });
            loadData();
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'Lỗi: ' + error.message });
        }
        setIsSavingExercise(false);
    }

    async function handleFolderSubmit(e) {
        e.preventDefault();
        setIsSavingFolder(true);
        try {
            await saveTeacherGrammarFolder(folderFormData.teacherId, folderFormData);
            setFolderFormOpen(false);
            setAlertMessage({ type: 'success', text: 'Cập nhật folder thành công!' });
            loadData();
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'Lỗi: ' + error.message });
        }
        setIsSavingFolder(false);
    }

    async function handleConfirmDeleteFolder() {
        if (!folderToDelete) return;
        try {
            await deleteTeacherGrammarFolder(folderToDelete.id);
            setFolders(folders.filter(f => f.id !== folderToDelete.id));
            setAlertMessage({ type: 'success', text: 'Đã xóa folder thành công!' });
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'Lỗi xóa folder: ' + error.message });
        }
        setFolderToDelete(null);
    }

    // --- SHARE HANDLERS ---

    async function handleConfirmConvert() {
        if (!exerciseToConvert) return;
        setIsConverting(true);
        try {
            const newExamId = await convertGrammarToExam(exerciseToConvert.id, user.uid, {
                examType: convertExamType,
                timingMode: convertTimingMode,
                createdByRole: 'admin'
            });
            setExerciseToConvert(null);
            setAlertMessage({ type: 'success', text: `Đã chuyển đổi "${exerciseToConvert.name}" thành ${convertExamType === 'test' ? 'Bài kiểm tra' : 'Bài tập'} (Admin)!` });
            navigate(`/admin/exams/${newExamId}`);
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'Lỗi chuyển đổi: ' + error.message });
        }
        setIsConverting(false);
    }

    async function openShareModal(resource, type) {
        setResourceToShare({ ...resource, type });
        setShareModalOpen(true);
        setLinkCopied(false);
        setIsSharing(true);
        setShareEmail('');
        setQuickAssignGroupId('');
        setQuickAssignDueDate('');
        setQuickAssignScheduledStart('');
        setQuickAssignSuccess('');
        try {
            const [entities, groupsData, assignments] = await Promise.all([
                getResourceSharedEntities(type, resource.id),
                getGroups(),
                type !== 'teacher_grammar_folder' ? getAssignmentsForTopic(resource.id) : Promise.resolve([])
            ]);
            setShareUsers(entities.users);
            setShareGroups(entities.groups.map(g => g.id));
            setAllGroups(groupsData);
            setTeacherManagedGroups(groupsData);
            setExistingAssignments(assignments);
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
        setIsQuickAssigning(true);
        setQuickAssignSuccess('');
        try {
            const selectedGroup = teacherManagedGroups.find(g => g.id === quickAssignGroupId);
            const assignPayload = {
                topicId: resourceToShare.id,
                topicName: resourceToShare.name,
                groupId: quickAssignGroupId,
                groupName: selectedGroup?.name || '',
                dueDate: new Date(quickAssignDueDate).toISOString(),
                teacherId: user.uid,
                teacherName: user.displayName || user.email,
            };
            if (quickAssignScheduledStart && quickAssignScheduledStart !== 'pending') {
                assignPayload.scheduledStart = new Date(quickAssignScheduledStart).toISOString();
            }
            await createAssignment(assignPayload);
            setQuickAssignSuccess(`Đã giao thành công cho lớp ${selectedGroup?.name}!`);
            setQuickAssignGroupId('');
            setQuickAssignDueDate('');
            setQuickAssignScheduledStart('');
            const updated = await getAssignmentsForTopic(resourceToShare.id);
            setExistingAssignments(updated);
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi giao bài: ' + err.message });
        }
        setIsQuickAssigning(false);
    }

    if (loading) return <div className="admin-page"><div className="admin-empty-state">Đang tải dữ liệu...</div></div>;



    // Grouping logic by Teacher
    const teacherGroupedData = {};
    const relevantTeacherIds = new Set([
        ...filteredExercises.map(ex => ex.teacherId),
        ...filteredFolders.map(f => f.teacherId)
    ]);

    [...relevantTeacherIds].forEach(teacherId => {
        if (!teacherId) return; // ignore items missing teacherId just in case

        const teacherFols = filteredFolders.filter(f => f.teacherId === teacherId);
        const tfIds = new Set(teacherFols.flatMap(f => f.exerciseIds || []));
        const teacherUnassignedExercises = filteredExercises.filter(ex => ex.teacherId === teacherId && !tfIds.has(ex.id));

        teacherGroupedData[teacherId] = {
            teacher: teacherMap[teacherId] || { id: teacherId, displayName: 'Unknown', email: teacherId },
            folders: teacherFols,
            unassignedExercises: teacherUnassignedExercises
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
                    <h1 className="admin-page-title">Bài học Kỹ năng GV tạo</h1>
                    <p className="admin-page-subtitle">Quản lý các bài Kỹ năng do giáo viên tạo ra</p>
                </div>
            </div>

            <div>
                <div className="admin-search-box">
                    <Search size={16} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Tìm tên bài luyện, folder, tên GV hoặc email..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="admin-card">
                {teacherGroupEntries.length === 0 ? (
                    <div className="admin-empty-state">
                        <BookOpen size={48} color="#cbd5e1" style={{ marginBottom: '16px' }} />
                        <p>Không có bài luyện hoặc folder nào được tìm thấy.</p>
                    </div>
                ) : (
                    <div className="admin-table-container">

                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}></th>
                                    <th>Cấu trúc thư mục (Giáo viên / Folder / Bài luyện)</th>
                                    <th>Thông tin thêm / Trình độ</th>
                                    <th className="text-right">Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {teacherGroupEntries.map(([teacherId, groupData]) => {
                                    const { teacher, folders: tFolders, unassignedExercises: tExercises } = groupData;
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
                                                        <span style={{ fontSize: '0.8rem', background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, border: '1px solid #fde68a' }}>Bài rời: {tExercises.length}</span>
                                                        <span style={{ fontSize: '0.8rem', background: '#f0fdf4', color: '#16a34a', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, border: '1px solid #bbf7d0' }}>Tổng bài: {exercises.filter(ex => ex.teacherId === teacherId).length}</span>
                                                    </div>
                                                </td>
                                                <td className="text-right"></td>
                                            </tr>

                                            {/* Level 2 & 3 */}
                                            {isTeacherExpanded && (
                                                <>
                                                    {/* Render Teacher Folders */}
                                                    {tFolders.map((folder) => {
                                                        const isFolderExpanded = expandedFolders.has(folder.id) || searchTerm.length > 0;
                                                        const folderExercises = filteredExercises.filter(ex => (folder.exerciseIds || []).includes(ex.id));

                                                        return (
                                                            <React.Fragment key={folder.id}>
                                                                {/* Level 2: Folder Row */}
                                                                <tr className="table-row-nested table-row-nested-folder">
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

                                                                {/* Level 3: Exercises inside Folder */}
                                                                {isFolderExpanded && (
                                                                    folderExercises.length === 0 ? (
                                                                        <tr className="admin-empty-nested-row">
                                                                            <td></td>
                                                                            <td colSpan="3">
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', color: '#64748b' }}>
                                                                                    <AlertTriangle size={14} style={{ opacity: 0.7 }} />
                                                                                    <span style={{ fontSize: '0.85rem' }}>Folder này chưa có bài luyện nào.</span>
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    ) : (
                                                                        folderExercises.map(exercise => (
                                                                            <tr key={exercise.id} className="table-row-nested" style={{ backgroundColor: '#fafafa' }}>
                                                                                <td></td>
                                                                                <td data-label="Tên bài luyện">
                                                                                    <div className="admin-topic-cell">
                                                                                        <div className="admin-topic-icon" style={{ background: `${exercise.color || '#3b82f6'}20`, fontSize: '0.8rem' }}>
                                                                                            {exercise.icon || '📝'}
                                                                                        </div>
                                                                                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '6px' }}>
                                                                                            <div className="admin-topic-name" style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                                                                {exercise.name}
                                                                                                {exercise.isPublic && (
                                                                                                    <span style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '4px', background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0', whiteSpace: 'nowrap' }}>Public</span>
                                                                                                )}
                                                                                                {exercise.collaboratorIds?.length > 0 && exercise.collaboratorIds.map(uid => {
                                                                                                    const name = teacherMap[uid]?.displayName || (exercise.collaboratorNames && exercise.collaboratorNames[uid]) || 'Giáo viên';
                                                                                                    return (
                                                                                                        <span key={uid} title={`Cộng tác viên: ${name}`} style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#faf5ff', color: '#7c3aed', border: '1px solid #ddd6fe', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                                                            <UsersRound size={10} />
                                                                                                            {name}
                                                                                                        </span>
                                                                                                    );
                                                                                                })}
                                                                                            </div>
                                                                                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                                                                <span style={{ fontSize: '0.78rem', background: '#e0e7ff', color: '#4f46e5', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>{exercise.targetLevel || 'N/A'}</span>
                                                                                                <span style={{ fontSize: '0.78rem', background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>{exercise.targetAge || 'N/A'} tuổi</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </td>
                                                                                <td></td>
                                                                                <td className="text-right">
                                                                                    <div className="admin-table-actions">
                                                                                        <Link to={`/admin/teacher-grammar/${exercise.id}`} className="admin-action-btn" title="Xem/Sửa câu hỏi">
                                                                                            <List size={14} />
                                                                                        </Link>
                                                                                        <button className="admin-action-btn" onClick={() => { setExerciseToConvert(exercise); setConvertExamType('homework'); setConvertTimingMode('exam'); }} title="Chuyển thành Bài tập/KT"><ArrowRightLeft size={14} /></button>
                                                                                        <button className="admin-action-btn" onClick={() => openShareModal(exercise, 'teacher_grammar')} title="Chia sẻ">
                                                                                            <Share2 size={14} />
                                                                                        </button>
                                                                                        <button className="admin-action-btn" onClick={() => openEditExerciseForm(exercise)} title="Sửa bài luyện">
                                                                                            <Edit size={14} />
                                                                                        </button>
                                                                                        <button className="admin-action-btn danger" onClick={() => setExerciseToDelete(exercise)} title="Xóa bài luyện">
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

                                                    {/* Render Teacher Unassigned Exercises */}
                                                    {tExercises.length > 0 && (
                                                        <>
                                                            <tr className="admin-unassigned-header">
                                                                <td></td>
                                                                <td colSpan="3" style={{ paddingLeft: '48px' }}>
                                                                    <div className="admin-unassigned-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#fef3c7', color: '#b45309', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, marginTop: '8px', marginBottom: '8px' }}>
                                                                        <AlertTriangle size={14} />
                                                                        Bài luyện chưa được phân vào Folder ({tExercises.length})
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                            {tExercises.map(exercise => (
                                                                <tr key={exercise.id} className="table-row-nested" style={{ backgroundColor: '#fafafa' }}>
                                                                    <td></td>
                                                                    <td>
                                                                        <div className="admin-topic-cell">
                                                                            <div className="admin-topic-icon" style={{ background: `${exercise.color || '#3b82f6'}20`, fontSize: '0.8rem' }}>{exercise.icon || '📝'}</div>
                                                                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '6px' }}>
                                                                                <div className="admin-topic-name" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', flexWrap: 'wrap' }}>
                                                                                    {exercise.name}
                                                                                    {exercise.isPublic && (
                                                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', background: '#eff6ff', color: '#3b82f6', padding: '2px 6px', borderRadius: '4px' }}>
                                                                                            <Globe size={10} /> Công khai
                                                                                        </span>
                                                                                    )}
                                                                                    {exercise.collaboratorIds?.length > 0 && exercise.collaboratorIds.map(uid => {
                                                                                        const name = teacherMap[uid]?.displayName || (exercise.collaboratorNames && exercise.collaboratorNames[uid]) || 'Giáo viên';
                                                                                        return (
                                                                                            <span key={uid} title={`Cộng tác viên: ${name}`} style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#faf5ff', color: '#7c3aed', border: '1px solid #ddd6fe', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                                                <UsersRound size={10} />
                                                                                                {name}
                                                                                            </span>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                                                    <span style={{ fontSize: '0.78rem', background: '#e0e7ff', color: '#4f46e5', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>{exercise.targetLevel || 'N/A'}</span>
                                                                                    <span style={{ fontSize: '0.78rem', background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>{exercise.targetAge || 'N/A'} tuổi</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td></td>
                                                                    <td className="text-right">
                                                                        <div className="admin-table-actions">
                                                                            <Link to={`/admin/teacher-grammar/${exercise.id}`} className="admin-action-btn" title="Xem/Sửa câu hỏi">
                                                                                <List size={14} />
                                                                            </Link>
                                                                            <button className="admin-action-btn" onClick={() => { setExerciseToConvert(exercise); setConvertExamType('homework'); setConvertTimingMode('exam'); }} title="Chuyển thành Bài tập/KT"><ArrowRightLeft size={14} /></button>
                                                                            <button className="admin-action-btn" onClick={() => openShareModal(exercise, 'teacher_grammar')} title="Chia sẻ">
                                                                                <Share2 size={14} />
                                                                            </button>
                                                                            <button className="admin-action-btn" onClick={() => openEditExerciseForm(exercise)} title="Sửa bài luyện">
                                                                                <Edit size={14} />
                                                                            </button>
                                                                            <button className="admin-action-btn danger" onClick={() => setExerciseToDelete(exercise)} title="Xóa bài luyện">
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

            {/* TRASH SECTION */}
            {(deletedExercises.length > 0 || deletedFolders2.length > 0) && (
                <div className="admin-card" style={{ marginTop: '24px', border: '1px solid #fecaca' }}>
                    <div
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '16px 20px', userSelect: 'none' }}
                        onClick={() => setTrashExpanded(!trashExpanded)}
                    >
                        {trashExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        <Trash2 size={18} style={{ color: '#ef4444' }} />
                        <span style={{ fontWeight: 600, fontSize: '1rem', color: '#dc2626' }}>Thùng rác</span>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 'normal' }}>({deletedExercises.length + deletedFolders2.length} mục · Tự xóa sau 30 ngày)</span>
                    </div>
                    {trashExpanded && (
                        <div style={{ padding: '0 20px 20px' }}>
                            <div className="admin-table-container">
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Loại</th>
                                            <th>Tên</th>
                                            <th>Giáo viên</th>
                                            <th>Còn lại</th>
                                            <th className="text-right">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {deletedFolders2.map(folder => {
                                            const daysLeft = folder.deletedAt ? Math.max(0, 30 - Math.floor((Date.now() - (folder.deletedAt.toMillis ? folder.deletedAt.toMillis() : new Date(folder.deletedAt).getTime())) / 86400000)) : '?';
                                            const teacher = teacherMap[folder.teacherId] || {};
                                            return (
                                                <tr key={`df-${folder.id}`}>
                                                    <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#6366f1' }}><FolderOpen size={14} /> Folder</span></td>
                                                    <td style={{ fontWeight: 500 }}>{folder.name}</td>
                                                    <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{teacher.displayName || teacher.email || folder.teacherId}</td>
                                                    <td><span style={{ fontSize: '0.8rem', color: daysLeft <= 7 ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>{daysLeft} ngày</span></td>
                                                    <td className="text-right">
                                                        <div className="admin-table-actions">
                                                            <button className="admin-action-btn" disabled={trashActionLoading === folder.id} title="Khôi phục cho GV" onClick={async () => {
                                                                setTrashActionLoading(folder.id);
                                                                try { await restoreTeacherGrammarFolder(folder.id); loadData(); setAlertMessage({ type: 'success', text: 'Đã khôi phục folder cho giáo viên!' }); } catch (e) { setAlertMessage({ type: 'error', text: e.message }); }
                                                                setTrashActionLoading(null);
                                                            }}><RotateCcw size={14} /></button>
                                                            <button className="admin-action-btn danger" disabled={trashActionLoading === folder.id} title="Xóa vĩnh viễn" onClick={async () => {
                                                                if (!window.confirm('Xóa vĩnh viễn folder này?')) return;
                                                                setTrashActionLoading(folder.id);
                                                                try { await permanentlyDeleteTeacherGrammarFolder(folder.id); loadData(); setAlertMessage({ type: 'success', text: 'Đã xóa vĩnh viễn!' }); } catch (e) { setAlertMessage({ type: 'error', text: e.message }); }
                                                                setTrashActionLoading(null);
                                                            }}><Trash2 size={14} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {deletedExercises.map(exercise => {
                                            const daysLeft = exercise.deletedAt ? Math.max(0, 30 - Math.floor((Date.now() - (exercise.deletedAt.toMillis ? exercise.deletedAt.toMillis() : new Date(exercise.deletedAt).getTime())) / 86400000)) : '?';
                                            const teacher = teacherMap[exercise.teacherId] || {};
                                            return (
                                                <tr key={`de-${exercise.id}`}>
                                                    <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#10b981' }}><BookOpen size={14} /> Bài luyện</span></td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span style={{ fontSize: '1rem' }}>{exercise.icon || '📝'}</span>
                                                            <span style={{ fontWeight: 500 }}>{exercise.name}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{teacher.displayName || teacher.email || exercise.teacherId}</td>
                                                    <td><span style={{ fontSize: '0.8rem', color: daysLeft <= 7 ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>{daysLeft} ngày</span></td>
                                                    <td className="text-right">
                                                        <div className="admin-table-actions">
                                                            <button className="admin-action-btn" disabled={trashActionLoading === exercise.id} title="Khôi phục cho Giáo viên" onClick={async () => {
                                                                setTrashActionLoading(exercise.id);
                                                                try { await restoreGrammarExercise(exercise.id); loadData(); setAlertMessage({ type: 'success', text: 'Đã khôi phục cho giáo viên!' }); } catch (e) { setAlertMessage({ type: 'error', text: e.message }); }
                                                                setTrashActionLoading(null);
                                                            }}><RotateCcw size={14} /><User size={12} style={{ marginLeft: '-4px' }} /></button>
                                                            <button className="admin-action-btn" disabled={trashActionLoading === exercise.id} title="Khôi phục cho Admin" style={{ color: '#7c3aed' }} onClick={async () => {
                                                                setTrashActionLoading(exercise.id);
                                                                try { await restoreGrammarExerciseToAdmin(exercise.id); loadData(); setAlertMessage({ type: 'success', text: 'Đã khôi phục cho Admin!' }); } catch (e) { setAlertMessage({ type: 'error', text: e.message }); }
                                                                setTrashActionLoading(null);
                                                            }}><RotateCcw size={14} /><UsersRound size={12} style={{ marginLeft: '-4px' }} /></button>
                                                            <button className="admin-action-btn danger" disabled={trashActionLoading === exercise.id} title="Xóa vĩnh viễn" onClick={async () => {
                                                                if (!window.confirm('Xóa vĩnh viễn bài luyện này? Tất cả câu hỏi bên trong sẽ bị xóa.')) return;
                                                                setTrashActionLoading(exercise.id);
                                                                try { await permanentlyDeleteGrammarExercise(exercise.id); loadData(); setAlertMessage({ type: 'success', text: 'Đã xóa vĩnh viễn!' }); } catch (e) { setAlertMessage({ type: 'error', text: e.message }); }
                                                                setTrashActionLoading(null);
                                                            }}><Trash2 size={14} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

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

            {/* EXERCISE EDIT MODAL */}
            {exerciseFormOpen && (
                <div className="teacher-modal-overlay">
                    <div className="teacher-modal wide" style={{ maxWidth: '600px', overflow: 'auto' }}>
                        <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                            <button type="button" className="teacher-modal-close" onClick={() => setExerciseFormOpen(false)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <h2 className="admin-modal-title" style={{ justifyContent: 'space-between', marginBottom: '24px', paddingRight: '40px' }}>
                            Sửa thông tin bài học
                        </h2>
                        <form onSubmit={handleExerciseSubmit}>
                            <div className="admin-form-group">
                                <label>Tên Bài học</label>
                                <input type="text" className="admin-form-input" required value={exerciseFormData.name || ''} onChange={e => setExerciseFormData({ ...exerciseFormData, name: e.target.value })} />
                            </div>
                            <div className="admin-form-group">
                                <label>Mô tả</label>
                                <textarea className="admin-form-input admin-form-textarea" value={exerciseFormData.description || ''} onChange={e => setExerciseFormData({ ...exerciseFormData, description: e.target.value })} />
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="admin-form-group">
                                    <label>Độ khó (Level)</label>
                                    <select className="admin-form-input" value={exerciseFormData.targetLevel || 'A1'} onChange={e => setExerciseFormData({ ...exerciseFormData, targetLevel: e.target.value })}>
                                        <option value="A1">A1 - Beginner</option>
                                        <option value="A2">A2 - Elementary</option>
                                        <option value="B1">B1 - Intermediate</option>
                                        <option value="B2">B2 - Upper Intermediate</option>
                                        <option value="C1">C1 - Advanced</option>
                                        <option value="C2">C2 - Proficient</option>
                                    </select>
                                </div>
                                <div className="admin-form-group">
                                    <label>Độ tuổi</label>
                                    <select className="admin-form-input" value={exerciseFormData.targetAge || '10-15'} onChange={e => setExerciseFormData({ ...exerciseFormData, targetAge: e.target.value })}>
                                        <option value="5-9">5 - 9 tuổi</option>
                                        <option value="10-15">10 - 15 tuổi</option>
                                        <option value="16-18">16 - 18 tuổi</option>
                                        <option value="18+">18+ (Người lớn)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="admin-form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input type="checkbox" checked={exerciseFormData.isPublic || false} onChange={e => setExerciseFormData({ ...exerciseFormData, isPublic: e.target.checked })} />
                                    Công khai (Public)
                                </label>
                            </div>
                            <div className="admin-modal-actions" style={{ marginTop: '24px', flexDirection: 'row' }}>
                                <button type="button" className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setExerciseFormOpen(false)} disabled={isSavingExercise}>Hủy</button>
                                <button type="submit" className="admin-btn admin-btn-primary" style={{ flex: 1 }} disabled={isSavingExercise}>{isSavingExercise ? 'Đang lưu...' : 'Cập nhật'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DELETE EXERCISE MODAL */}
            {exerciseToDelete && (
                <div className="teacher-modal-overlay">
                    <div className="teacher-modal">
                        <h2 className="admin-modal-title" style={{ color: '#ef4444', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertCircle size={24} /> Xác nhận xóa
                            </div>
                        </h2>
                        <p className="admin-modal-desc">
                            Bạn có chắc chắn muốn xóa bài luyện <strong>{exerciseToDelete.name}</strong>?<br/><br/>
                            <strong>Lưu ý:</strong> Toàn bộ câu hỏi bên trong sẽ bị xóa vĩnh viễn và không thể khôi phục.
                        </p>
                        <div className="admin-modal-actions" style={{ flexDirection: 'row' }}>
                            <button className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setExerciseToDelete(null)} disabled={isDeleting}>Hủy</button>
                            <button className="admin-btn admin-btn-primary" style={{ flex: 1, backgroundColor: '#ef4444' }} onClick={handleConfirmDelete} disabled={isDeleting}>
                                {isDeleting ? 'Đang xóa...' : 'Xóa bài luyện'}
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
                            <strong>Lưu ý:</strong> Các bài luyện bên trong sẽ không bị xóa, chỉ folder bị xóa.
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
                                Chia sẻ Bài luyện
                            </div>
                        </h2>

                        <div style={{ marginBottom: '20px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', margin: '0 0 4px 0' }}>{resourceToShare.name}</h3>
                            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>ID: {resourceToShare.id}</p>
                            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <input type="text" readOnly value={`${window.location.origin}/preview/superstudy?shareId=${resourceToShare.id}&shareType=${resourceToShare.type}`} style={{ flex: '1 1 200px', minWidth: '0', padding: '8px 12px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none', backgroundColor: '#f1f5f9', color: '#475569' }} />
                                <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/preview/superstudy?shareId=${resourceToShare.id}&shareType=${resourceToShare.type}`); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }} style={{ flex: window.innerWidth < 480 ? '1' : '0 0 auto', padding: '8px 16px', background: linkCopied ? '#10b981' : 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', transition: 'all 0.3s' }}>
                                    {linkCopied ? 'Đã Copy!' : 'Copy Link'}
                                </button>
                            </div>
                        </div>

                        {/* Public Toggle */}
                        <div className="admin-share-public-toggle" style={{ background: resourceToShare.isPublic ? '#ecfdf5' : '#fff', border: `1px solid ${resourceToShare.isPublic ? '#10b981' : '#e2e8f0'}`, marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: resourceToShare.isPublic ? '#10b981' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: resourceToShare.isPublic ? '#fff' : '#64748b' }}>
                                    {resourceToShare.isPublic ? <Globe size={20} /> : <Lock size={20} />}
                                </div>
                                <div>
                                    <h4 style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1e293b', margin: '0 0 4px 0' }}>{resourceToShare.isPublic ? 'Đang Công khai' : 'Hạn chế'}</h4>
                                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>{resourceToShare.isPublic ? 'Bất kỳ ai cũng có thể tìm và học bài này.' : 'Cần cấp quyền hoặc gửi Link.'}</p>
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

                        {/* Quick Assign */}
                        <div style={{ marginTop: '20px', padding: '16px', background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', borderRadius: '12px', border: '1px solid #fde68a' }}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', fontWeight: 700, color: '#92400e', margin: '0 0 6px 0' }}><FileText size={16} /> Giao bài cho lớp</h4>
                            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '12px' }}>Giao nhanh bài này cho 1 lớp.</p>
                            {existingAssignments.length > 0 && (
                                <div style={{ marginBottom: '12px' }}>
                                    <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>Đã giao cho:</p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {existingAssignments.map(a => (
                                            <span key={a.id} style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px', background: 'linear-gradient(135deg, #fef3c7, #fde68a)', color: '#92400e', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #fcd34d' }}>✅ {a.groupName || a.targetName || allGroups.find(g => g.id === a.groupId)?.name || 'Lớp'}</span>
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
                                    {/* Scheduled Start Toggle */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 500 }}>⏰ Thời điểm bắt đầu:</span>
                                        <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1.5px solid #e2e8f0' }}>
                                            <button type="button" onClick={() => setQuickAssignScheduledStart('')} style={{ padding: '4px 12px', fontSize: '0.78rem', fontWeight: 600, border: 'none', cursor: 'pointer', background: !quickAssignScheduledStart ? 'linear-gradient(135deg, #10b981, #059669)' : '#f8fafc', color: !quickAssignScheduledStart ? '#fff' : '#64748b', transition: 'all 0.2s' }}>Bắt đầu ngay</button>
                                            <button type="button" onClick={() => setQuickAssignScheduledStart('pending')} style={{ padding: '4px 12px', fontSize: '0.78rem', fontWeight: 600, border: 'none', borderLeft: '1px solid #e2e8f0', cursor: 'pointer', background: quickAssignScheduledStart ? 'linear-gradient(135deg, #f59e0b, #d97706)' : '#f8fafc', color: quickAssignScheduledStart ? '#fff' : '#64748b', transition: 'all 0.2s' }}>Hẹn ngày...</button>
                                        </div>
                                    </div>
                                    {quickAssignScheduledStart && (
                                        <div>
                                            <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500, marginBottom: '4px', display: 'block' }}>📅 Ngày giờ bắt đầu</label>
                                            <input type="datetime-local" value={quickAssignScheduledStart === 'pending' ? '' : quickAssignScheduledStart} onChange={e => setQuickAssignScheduledStart(e.target.value)} style={{ width: '100%', padding: '6px 12px', borderRadius: '10px', border: '1.5px solid #f59e0b', fontSize: '0.88rem', color: '#1e293b', minHeight: '38px', boxSizing: 'border-box', background: '#fffbeb' }} />
                                            {quickAssignScheduledStart && quickAssignScheduledStart !== 'pending' && quickAssignDueDate && new Date(quickAssignScheduledStart) >= new Date(quickAssignDueDate) && (
                                                <p style={{ color: '#ef4444', fontSize: '0.75rem', margin: '4px 0 0' }}>⚠ Ngày bắt đầu phải trước hạn nộp!</p>
                                            )}
                                        </div>
                                    )}
                                    <button type="button" onClick={handleQuickAssign} disabled={isQuickAssigning || !quickAssignGroupId || !quickAssignDueDate || (quickAssignScheduledStart === 'pending') || (quickAssignScheduledStart && quickAssignScheduledStart !== 'pending' && quickAssignDueDate && new Date(quickAssignScheduledStart) >= new Date(quickAssignDueDate))} className="admin-btn admin-btn-primary" style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', opacity: (isQuickAssigning || !quickAssignGroupId || !quickAssignDueDate || quickAssignScheduledStart === 'pending') ? 0.6 : 1 }}>
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

            {/* CONVERT TO EXAM MODAL */}
            {exerciseToConvert && (
                <div className="admin-modal-overlay">
                    <div className="admin-modal" style={{ maxWidth: '520px' }}>
                        <h2 className="admin-modal-title" style={{ color: '#7c3aed' }}><ArrowRightLeft size={24} /> Chuyển thành Bài tập/KT</h2>
                        <p className="admin-modal-desc">
                            Chuyển bài kỹ năng <strong>{exerciseToConvert.name}</strong> thành Bài tập hoặc Kiểm tra. Bài gốc sẽ được giữ nguyên.
                        </p>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'block' }}>Loại bài</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {[{ value: 'homework', label: '📋 Bài tập', desc: 'Bài luyện tập' }, { value: 'test', label: '📝 Kiểm tra', desc: 'Bài kiểm tra chính thức' }].map(opt => (
                                    <button key={opt.value} type="button" onClick={() => setConvertExamType(opt.value)}
                                        style={{ flex: 1, padding: '12px', borderRadius: '12px', border: convertExamType === opt.value ? '2px solid #7c3aed' : '2px solid #e2e8f0', background: convertExamType === opt.value ? '#f5f3ff' : '#fff', color: convertExamType === opt.value ? '#6d28d9' : '#64748b', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                        <div>{opt.label}</div>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 400 }}>{opt.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'block' }}>Quản lý thời gian</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {[{ value: 'exam', label: '⏱ Cả bài' }, { value: 'section', label: '📑 Theo section' }, { value: 'question', label: '❓ Theo câu' }].map(mode => (
                                    <button key={mode.value} type="button" onClick={() => setConvertTimingMode(mode.value)}
                                        style={{ flex: 1, padding: '10px 8px', borderRadius: '12px', border: convertTimingMode === mode.value ? '2px solid #7c3aed' : '2px solid #e2e8f0', background: convertTimingMode === mode.value ? '#f5f3ff' : '#fff', color: convertTimingMode === mode.value ? '#6d28d9' : '#64748b', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}>
                                        {mode.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '10px 14px', fontSize: '0.8rem', color: '#92400e', marginBottom: '16px' }}>
                            💡 Sau khi chuyển đổi, bạn có thể thiết lập lại section và thời gian trong trang chỉnh sửa.
                        </div>
                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 14px', fontSize: '0.8rem', color: '#166534', marginBottom: '16px' }}>
                            🔒 Bài mới sẽ được lưu vào mục <strong>Bài tập/KT Admin</strong>.
                        </div>
                        <div className="admin-modal-actions">
                            <button className="admin-btn admin-btn-secondary" onClick={() => setExerciseToConvert(null)} disabled={isConverting}>Hủy</button>
                            <button className="admin-btn admin-btn-primary" onClick={handleConfirmConvert} disabled={isConverting} style={{ background: '#7c3aed' }}>
                                {isConverting ? 'Đang chuyển đổi...' : '🔄 Chuyển đổi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
