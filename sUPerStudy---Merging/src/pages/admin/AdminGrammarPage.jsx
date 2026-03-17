import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Link } from 'react-router-dom';
import { saveGrammarExercise, deleteGrammarExercise, getGrammarExercises } from '../../services/grammarService';
import { getGrammarFolders, saveGrammarFolder, deleteGrammarFolder, getGroups, toggleResourcePublic, getResourceSharedEntities, shareResourceToEmail, unshareResourceFromUser, shareResourceToGroup, unshareResourceFromGroup, updateGrammarFoldersOrder } from '../../services/adminService';
import { createAssignment, getAssignmentsForTopic } from '../../services/teacherService';
import { getPendingProposals, approveProposal, rejectProposal } from '../../services/contentProposalService';
import { Timestamp } from 'firebase/firestore';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useAuth } from '../../contexts/AuthContext';
import { BookOpen, Edit, Trash2, X, Plus, List, FolderOpen, GripVertical, Check, Share2, Globe, Users, Mail, UserPlus, Lock, Search, AlertTriangle, ChevronDown, ChevronRight, CheckCircle, XCircle, Landmark, Clock, Send, FileText } from 'lucide-react';
import CustomSelect from '../../components/common/CustomSelect';
import EmailAutocomplete from '../../components/common/EmailAutocomplete';

function CustomDropdown({ value, options, onChange, placeholder = "Chọn một mục" }) {
    const [isOpen, setIsOpen] = useState(false);
    const [hoverIdx, setHoverIdx] = useState(null);
    const dropdownRef = React.useRef(null);
    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div ref={dropdownRef} className="admin-custom-dropdown" style={{ position: 'relative', width: '100%' }}>
            <div
                className={`admin-form-input ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    cursor: 'pointer', padding: '10px 14px', background: '#fff'
                }}
            >
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown size={14} style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </div>

            {isOpen && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
                    marginTop: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    maxHeight: '200px', overflowY: 'auto'
                }}>
                    {options.map((opt, idx) => (
                        <div
                            key={idx}
                            onMouseEnter={() => setHoverIdx(idx)}
                            onMouseLeave={() => setHoverIdx(null)}
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange(opt.value);
                                setIsOpen(false);
                            }}
                            style={{
                                padding: '10px 14px', cursor: 'pointer',
                                background: (value === opt.value || hoverIdx === idx) ? '#eff6ff' : 'transparent',
                                color: (value === opt.value || hoverIdx === idx) ? '#2563eb' : '#0f172a',
                                fontWeight: value === opt.value ? '600' : '400',
                                borderBottom: idx === options.length - 1 ? 'none' : '1px solid #f1f5f9'
                            }}
                        >
                            {opt.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function AdminGrammarPage() {
    const { user } = useAuth();
    const [exercises, setExercises] = useState([]);
    const [folders, setFolders] = useState([]);
    const [exerciseQuestionCounts, setExerciseQuestionCounts] = useState({});
    const [loading, setLoading] = useState(true);
    const [expandedFolders, setExpandedFolders] = useState(new Set());
    const [alertMessage, setAlertMessage] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Exercise States
    const [exerciseFormOpen, setExerciseFormOpen] = useState(false);
    const [exerciseFormData, setExerciseFormData] = useState({ name: '', description: '', targetLevel: 'A1', targetAge: '10-15' });
    const [isEditingExercise, setIsEditingExercise] = useState(false);
    const [exerciseToDelete, setExerciseToDelete] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // Folder States
    const [folderFormOpen, setFolderFormOpen] = useState(false);
    const [folderFormData, setFolderFormData] = useState({ id: '', name: '', description: '', icon: '', color: '#3b82f6', exerciseIds: [], order: 0 });
    const [isEditingFolder, setIsEditingFolder] = useState(false);
    const [folderToDelete, setFolderToDelete] = useState(null);

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

    // Proposal States
    const [pendingProposals, setPendingProposals] = useState([]);
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [proposalToReject, setProposalToReject] = useState(null);
    const [rejectNote, setRejectNote] = useState('');

    useEffect(() => {
        loadData();
        loadProposals();
    }, []);

    async function loadData() {
        setLoading(true);
        try {
            const [exercisesData, foldersData] = await Promise.all([
                getGrammarExercises(), // no teacherId = get all
                getGrammarFolders()
            ]);

            // Read cached question counts from exercise documents
            const counts = {};
            exercisesData.forEach(ex => { counts[ex.id] = ex.cachedQuestionCount ?? 0; });
            setExerciseQuestionCounts(counts);

            // Determine which topic IDs are inside public folders
            const publicFolderExerciseIds = new Set();
            foldersData.forEach(folder => {
                if (folder.isPublic && folder.exerciseIds && Array.isArray(folder.exerciseIds)) {
                    folder.exerciseIds.forEach(id => publicFolderExerciseIds.add(id));
                }
            });

            // Admin page only shows system/admin-created exercises (no teacherId)
            // Teacher-created exercises appear on /admin/teacher-grammar or teacher's own page
            const adminExercises = exercisesData
                .filter(ex => !ex.teacherId)
                .map(ex => {
                    if (publicFolderExerciseIds.has(ex.id)) {
                        if (ex.isPublic !== false) {
                            return { ...ex, isPublic: true, isInPublicFolder: true };
                        }
                        return { ...ex, isInPublicFolder: true };
                    }
                    return ex;
                });

            setExercises(adminExercises);
            setFolders(foldersData);
        } catch (error) {
            console.error(error);
            setAlertMessage({ type: 'error', text: 'Lỗi tải dữ liệu: ' + error.message });
        }
        setLoading(false);
    }

    // --- EXERCISE HANDLERS ---
    function openAddExerciseForm() {
        setExerciseFormData({ name: '', description: '', targetLevel: 'A1', targetAge: '10-15', icon: '📝', color: '#3b82f6', folderId: '' });
        setIsEditingExercise(false);
        setExerciseFormOpen(true);
    }

    function openEditExerciseForm(exercise) {
        // Find if this exercise is in any folder
        const currentFolder = folders.find(f => (f.exerciseIds || []).includes(exercise.id));
        setExerciseFormData({
            ...exercise,
            targetLevel: exercise.targetLevel || 'A1',
            targetAge: exercise.targetAge || '10-15',
            icon: exercise.icon || '📝',
            color: exercise.color || '#3b82f6',
            folderId: currentFolder ? currentFolder.id : ''
        });
        setIsEditingExercise(true);
        setExerciseFormOpen(true);
    }

    async function handleExerciseFormSubmit(e) {
        e.preventDefault();
        setIsSaving(true);
        try {
            const exerciseToSave = { ...exerciseFormData };
            const targetFolderId = exerciseToSave.folderId;
            delete exerciseToSave.folderId;

            // Admin-created exercises: no teacherId, they're "preset"
            const savedId = await saveGrammarExercise({ ...exerciseToSave });
            const finalExerciseId = exerciseToSave.id || savedId;

            // Handle Folder Reassignment
            const currentFolder = folders.find(f => (f.exerciseIds || []).includes(finalExerciseId));

            if (currentFolder && currentFolder.id !== targetFolderId) {
                // Remove from old folder
                const updatedOldFolder = {
                    ...currentFolder,
                    exerciseIds: (currentFolder.exerciseIds || []).filter(eid => eid !== finalExerciseId)
                };
                await saveGrammarFolder(updatedOldFolder);
            }

            if (targetFolderId && (!currentFolder || currentFolder.id !== targetFolderId)) {
                // Add to new folder
                const targetFolder = folders.find(f => f.id === targetFolderId);
                if (targetFolder) {
                    const updatedNewFolder = {
                        ...targetFolder,
                        exerciseIds: Array.from(new Set([...(targetFolder.exerciseIds || []), finalExerciseId]))
                    };
                    await saveGrammarFolder(updatedNewFolder);
                }
            }

            setExerciseFormOpen(false);
            setAlertMessage({ type: 'success', text: isEditingExercise ? "Cập nhật bài luyện thành công!" : "Tạo bài luyện mới thành công!" });
            loadData();
        } catch (error) {
            setAlertMessage({ type: 'error', text: "Lỗi lưu bài luyện: " + error.message });
        }
        setIsSaving(false);
    }

    async function handleConfirmDeleteExercise() {
        if (!exerciseToDelete) return;
        try {
            await deleteGrammarExercise(exerciseToDelete.id);
            setExercises(prev => prev.filter(e => e.id !== exerciseToDelete.id));
            setAlertMessage({ type: 'success', text: "Đã xóa bài luyện thành công!" });
        } catch (error) {
            setAlertMessage({ type: 'error', text: "Lỗi xóa bài luyện: " + error.message });
        }
        setExerciseToDelete(null);
    }

    // --- FOLDER HANDLERS ---
    function openAddFolderForm() {
        setFolderFormData({ id: '', name: '', description: '', icon: '', color: '#3b82f6', exerciseIds: [], order: folders.length });
        setIsEditingFolder(false);
        setFolderFormOpen(true);
    }

    function openEditFolderForm(folder) {
        setFolderFormData(folder);
        setIsEditingFolder(true);
        setFolderFormOpen(true);
    }

    async function handleFolderFormSubmit(e) {
        e.preventDefault();
        let finalFolderId = folderFormData.id.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
        if (!finalFolderId && !isEditingFolder) {
            finalFolderId = folderFormData.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
        }
        if (!finalFolderId) {
            setAlertMessage({ type: 'error', text: "Tên hoặc ID Folder không hợp lệ." });
            return;
        }
        try {
            await saveGrammarFolder({ ...folderFormData, id: finalFolderId });
            setFolderFormOpen(false);
            setAlertMessage({ type: 'success', text: isEditingFolder ? "Cập nhật folder thành công!" : "Thêm folder mới thành công!" });
            loadData();
        } catch (error) {
            setAlertMessage({ type: 'error', text: "Lỗi lưu folder: " + error.message });
        }
    }

    async function handleConfirmDeleteFolder() {
        if (!folderToDelete) return;
        try {
            await deleteGrammarFolder(folderToDelete.id);
            setFolders(prev => prev.filter(f => f.id !== folderToDelete.id));
            setAlertMessage({ type: 'success', text: "Đã xóa folder thành công!" });
        } catch (error) {
            setAlertMessage({ type: 'error', text: "Lỗi xóa folder: " + error.message });
        }
        setFolderToDelete(null);
    }

    function toggleExerciseInFolder(exerciseId) {
        setFolderFormData(prev => {
            const current = new Set(prev.exerciseIds || []);
            if (current.has(exerciseId)) {
                current.delete(exerciseId);
            } else {
                current.add(exerciseId);
            }
            return { ...prev, exerciseIds: Array.from(current) };
        });
    }


    async function handleFolderDragEnd(result) {
        if (!result.destination) return;
        const reordered = Array.from(folders);
        const [moved] = reordered.splice(result.source.index, 1);
        reordered.splice(result.destination.index, 0, moved);
        setFolders(reordered);
        try {
            await updateGrammarFoldersOrder(reordered);
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'Lỗi sắp xếp folder: ' + error.message });
            loadData();
        }
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
                type !== 'grammar_folder' ? getAssignmentsForTopic(resource.id) : Promise.resolve([])
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

    async function handleQuickAssign() {
        if (!quickAssignGroupId || !quickAssignDueDate || !resourceToShare) return;
        setIsQuickAssigning(true);
        setQuickAssignSuccess('');
        try {
            const selectedGroup = teacherManagedGroups.find(g => g.id === quickAssignGroupId);
            await createAssignment({
                topicId: resourceToShare.id,
                topicName: resourceToShare.name,
                groupId: quickAssignGroupId,
                groupName: selectedGroup?.name || '',
                dueDate: Timestamp.fromDate(new Date(quickAssignDueDate)),
                teacherId: user.uid,
                teacherName: user.displayName || user.email,
            });
            setQuickAssignSuccess(`Đã giao thành công cho lớp ${selectedGroup?.name}!`);
            setQuickAssignGroupId('');
            setQuickAssignDueDate('');
            const updated = await getAssignmentsForTopic(resourceToShare.id);
            setExistingAssignments(updated);
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi giao bài: ' + err.message });
        }
        setIsQuickAssigning(false);
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

    // --- PROPOSAL HANDLERS ---
    async function loadProposals() {
        try {
            const proposals = await getPendingProposals('grammar');
            setPendingProposals(proposals);
        } catch (err) {
            console.error('Error loading proposals:', err);
        }
    }

    async function handleApproveProposal(proposalId) {
        try {
            await approveProposal(proposalId, 'admin');
            setAlertMessage({ type: 'success', text: 'Đã duyệt và tạo bài học chính thức thành công!' });
            loadProposals();
            loadData();
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi duyệt: ' + err.message });
        }
    }

    function openRejectModal(proposal) {
        setProposalToReject(proposal);
        setRejectNote('');
        setRejectModalOpen(true);
    }

    async function handleConfirmReject() {
        if (!proposalToReject) return;
        try {
            await rejectProposal(proposalToReject.id, 'admin', rejectNote);
            setAlertMessage({ type: 'success', text: 'Đã từ chối đề xuất.' });
            setRejectModalOpen(false);
            setProposalToReject(null);
            loadProposals();
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi từ chối: ' + err.message });
        }
    }

    const filteredExercises = exercises.filter(ex =>
        (ex.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ex.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredFolders = folders.filter(f => {
        const matchesFolder = (f.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (f.id || '').toLowerCase().includes(searchTerm.toLowerCase());
        const hasMatchingExercise = (f.exerciseIds || []).some(eid =>
            filteredExercises.some(ex => ex.id === eid)
        );
        return matchesFolder || hasMatchingExercise;
    });

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <h1 className="admin-page-title">Bài học Kỹ năng chính thức</h1>
                <div className="admin-header-actions">
                    <button className="admin-btn admin-btn-outline" onClick={openAddFolderForm}><FolderOpen size={16} /> Thêm Folder</button>
                    <button className="admin-btn admin-btn-primary" onClick={openAddExerciseForm}><Plus size={16} /> Tạo bài luyện mới</button>
                </div>
            </div>

            <div>
                <div className="admin-search-box">
                    <Search size={16} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Tìm tên bài luyện, tên folder..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="admin-card">
                {loading ? (
                    <div className="admin-empty-state">Đang tải dữ liệu...</div>
                ) : (
                    <div className="admin-table-container">
                        <DragDropContext onDragEnd={handleFolderDragEnd}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px' }}></th>
                                        <th>Tên mục</th>
                                        <th>Thông tin</th>
                                        <th>Trạng thái</th>
                                        <th className="text-right">Hành động</th>
                                    </tr>
                                </thead>
                                <Droppable droppableId="grammar-folders">
                                    {(provided) => (
                                        <tbody ref={provided.innerRef} {...provided.droppableProps}>
                                            {filteredFolders.map((folder, fIndex) => {
                                                const isExpanded = expandedFolders.has(folder.id) || searchTerm.length > 0;
                                                const folderExercises = filteredExercises.filter(ex => (folder.exerciseIds || []).includes(ex.id));

                                                return (
                                                    <React.Fragment key={folder.id}>
                                                        <Draggable draggableId={folder.id} index={fIndex}>
                                                            {(draggableProvided, snapshot) => (
                                                                <tr
                                                                    ref={draggableProvided.innerRef}
                                                                    {...draggableProvided.draggableProps}
                                                                    className="table-row-folder"
                                                                    style={{
                                                                        ...draggableProvided.draggableProps.style,
                                                                        background: snapshot.isDragging ? '#eff6ff' : '#fff',
                                                                        display: snapshot.isDragging ? 'table-row' : undefined,
                                                                        boxShadow: snapshot.isDragging ? '0 5px 15px rgba(0,0,0,0.1)' : undefined
                                                                    }}
                                                                >
                                                                    <td>
                                                                        <div className="mobile-hide" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', height: '100%', minHeight: '44px' }}>
                                                                            <div {...draggableProvided.dragHandleProps} style={{ cursor: 'grab', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                                                                                <GripVertical size={14} style={{ transform: 'translateY(-1px)' }} />
                                                                            </div>
                                                                            <button
                                                                                className="admin-expand-btn"
                                                                                onClick={() => {
                                                                                    const newExpanded = new Set(expandedFolders);
                                                                                    if (isExpanded) newExpanded.delete(folder.id);
                                                                                    else newExpanded.add(folder.id);
                                                                                    setExpandedFolders(newExpanded);
                                                                                }}
                                                                            >
                                                                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                            </button>
                                                                        </div>
                                                                        <div {...draggableProvided.dragHandleProps} className="mobile-show" style={{ cursor: 'grab', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                                                                            <GripVertical size={14} style={{ marginRight: '8px', transform: 'translateY(-1px)' }} />
                                                                        </div>
                                                                    </td>
                                                                    <td>
                                                                        <div className="admin-topic-cell" style={{ width: '100%' }}>
                                                                            <div className="admin-topic-icon" style={{ background: '#fef9c3', width: '32px', height: '32px', fontSize: '0.9rem' }}>📁</div>
                                                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '10px' }}>
                                                                                    <div className="admin-topic-name" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 600 }}>
                                                                                        {folder.name}
                                                                                        <div className="mobile-show" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#64748b' }}>
                                                                                            <BookOpen size={12} />
                                                                                            <span>{folderExercises.length}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                    {folder.isPublic && (
                                                                                        <span style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '4px', background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
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
                                                                    <td className="mobile-hide"></td>
                                                                    <td className="mobile-hide"></td>
                                                                    <td className="text-right">
                                                                        <div className="admin-table-actions">
                                                                            <button
                                                                                className="admin-action-btn mobile-show"
                                                                                style={{
                                                                                    marginRight: 'auto',
                                                                                    background: isExpanded ? '#eff6ff' : '#f1f5f9',
                                                                                    border: isExpanded ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                                                                                    color: isExpanded ? '#2563eb' : '#64748b'
                                                                                }}
                                                                                onClick={() => {
                                                                                    const newExpanded = new Set(expandedFolders);
                                                                                    if (isExpanded) newExpanded.delete(folder.id);
                                                                                    else newExpanded.add(folder.id);
                                                                                    setExpandedFolders(newExpanded);
                                                                                }}
                                                                            >
                                                                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                                            </button>
                                                                            <button className="admin-action-btn" onClick={() => openShareModal(folder, 'grammar_folder')} title="Chia sẻ Folder"><Share2 size={16} /></button>
                                                                            <button className="admin-action-btn" onClick={() => openEditFolderForm(folder)} title="Sửa Folder"><Edit size={16} /></button>
                                                                            <button className="admin-action-btn danger" onClick={() => setFolderToDelete(folder)} title="Xóa Folder"><Trash2 size={16} /></button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </Draggable>
                                                        {isExpanded && (
                                                            folderExercises.length === 0 ? (
                                                                <tr className="admin-empty-nested-row">
                                                                    <td></td>
                                                                    <td colSpan="4">
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', color: '#64748b' }}>
                                                                            <AlertTriangle size={14} style={{ opacity: 0.7 }} />
                                                                            <span style={{ fontSize: '0.85rem' }}>Folder này chưa có bài luyện nào. Bấm "Sửa Folder" để thêm.</span>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ) : (
                                                                folderExercises.map(exercise => (
                                                                    <tr key={exercise.id} className="table-row-nested">
                                                                        <td></td>
                                                                        <td data-label="Tên mục">
                                                                            <div className="admin-topic-cell">
                                                                                <div className="admin-topic-icon" style={{ background: `${exercise.color || '#3b82f6'}20`, width: '32px', height: '32px', fontSize: '0.9rem' }}>{exercise.icon || '📝'}</div>
                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                                                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '10px' }}>
                                                                                        <div className="admin-topic-name" style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>{exercise.name}</div>
                                                                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                                                            {exercise.isPublic && (
                                                                                                <span style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '4px', background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0', whiteSpace: 'nowrap' }}>Public</span>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="admin-text-muted" style={{ maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.75rem', marginBottom: '2px' }}>
                                                                                        {exercise.description}
                                                                                    </div>

                                                                                    {/* Compact Info for Mobile */}
                                                                                    <div className="mobile-show" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: '#64748b', flexWrap: 'wrap' }}>
                                                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><List size={10} /> {exerciseQuestionCounts[exercise.id] || 0} câu</span>
                                                                                        <span>&middot;</span>
                                                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Globe size={10} /> {exercise.targetLevel}</span>
                                                                                        <span>&middot;</span>
                                                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Users size={10} /> {exercise.targetAge}t</span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td data-label="Thông tin" className="mobile-hide">
                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                                                                                    {exerciseQuestionCounts[exercise.id] || 0} câu hỏi
                                                                                </span>
                                                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                                                    <span style={{ fontSize: '0.65rem', background: '#e0e7ff', color: '#4f46e5', padding: '1px 4px', borderRadius: '3px', fontWeight: 600 }}>{exercise.targetLevel}</span>
                                                                                    <span style={{ fontSize: '0.65rem', background: '#fef3c7', color: '#d97706', padding: '1px 4px', borderRadius: '3px', fontWeight: 600 }}>{exercise.targetAge}t</span>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td data-label="Trạng thái" className="mobile-hide">
                                                                            <div style={{ display: 'flex', gap: '4px', flexDirection: 'column', alignItems: 'flex-start' }}>
                                                                                <span className="admin-status-badge active" style={{ fontSize: '0.6rem', padding: '1px 5px' }}>Đang hoạt động</span>
                                                                            </div>
                                                                        </td>
                                                                        <td data-label="Thao tác" className="text-right">
                                                                            <div className="admin-table-actions">
                                                                                <Link to={`/admin/grammar/${exercise.id}`} className="admin-action-btn" title="Quản lý câu hỏi">
                                                                                    <List size={14} />
                                                                                </Link>
                                                                                <button className="admin-action-btn" onClick={() => openShareModal(exercise, 'admin_grammar')}><Share2 size={14} /></button>
                                                                                <button className="admin-action-btn" onClick={() => openEditExerciseForm(exercise)}><Edit size={14} /></button>
                                                                                <button className="admin-action-btn danger" onClick={() => setExerciseToDelete(exercise)}><Trash2 size={14} /></button>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                ))
                                                            )
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                            {provided.placeholder}
                                        </tbody>
                                    )}
                                </Droppable>

                                <tbody>
                                    {/* RENDER UNASSIGNED EXERCISES */}
                                    {(() => {
                                        const assignedExIds = new Set(folders.flatMap(f => f.exerciseIds || []));
                                        const unassignedExercises = filteredExercises.filter(ex => !assignedExIds.has(ex.id));

                                        if (unassignedExercises.length === 0) return null;

                                        return (
                                            <>
                                                <tr className="admin-unassigned-header">
                                                    <td></td>
                                                    <td colSpan="4">
                                                        <div className="admin-unassigned-label">
                                                            <AlertTriangle size={16} />
                                                            Bài luyện chưa phân loại ({unassignedExercises.length})
                                                        </div>
                                                    </td>
                                                </tr>
                                                {unassignedExercises.map(exercise => (
                                                    <tr key={exercise.id} className="table-row-nested" style={{ marginLeft: 0, width: '100%', borderLeft: '1px solid #e2e8f0' }}>
                                                        <td></td>
                                                        <td>
                                                            <div className="admin-topic-cell">
                                                                <div className="admin-topic-icon" style={{ background: `${exercise.color || '#3b82f6'}20` }}>{exercise.icon || '📝'}</div>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                    <div className="admin-topic-name" style={{ fontWeight: 600, color: '#1e293b' }}>{exercise.name}</div>
                                                                    <div className="admin-text-muted" style={{ maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.85rem' }}>
                                                                        {exercise.description}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                                                                    {exerciseQuestionCounts[exercise.id] || 0} câu hỏi
                                                                </span>
                                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                                    <span style={{ fontSize: '0.75rem', background: '#e0e7ff', color: '#4f46e5', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>{exercise.targetLevel}</span>
                                                                    <span style={{ fontSize: '0.75rem', background: '#fef3c7', color: '#d97706', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>{exercise.targetAge} tuổi</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div style={{ display: 'flex', gap: '6px', flexDirection: 'column', alignItems: 'flex-start' }}>
                                                                <span className="admin-status-badge active">Đang hoạt động</span>
                                                                {exercise.isPublic && (
                                                                    <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0' }}>Public</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="text-right">
                                                            <div className="admin-table-actions">
                                                                <Link to={`/admin/grammar/${exercise.id}`} className="admin-action-btn" title="Quản lý câu hỏi">
                                                                    <List size={16} />
                                                                </Link>
                                                                <button className="admin-action-btn" onClick={() => openShareModal(exercise, 'admin_grammar')}><Share2 size={16} /></button>
                                                                <button className="admin-action-btn" onClick={() => openEditExerciseForm(exercise)}><Edit size={16} /></button>
                                                                <button className="admin-action-btn danger" onClick={() => setExerciseToDelete(exercise)}><Trash2 size={16} /></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </>
                                        );
                                    })()}
                                </tbody>
                            </table>
                        </DragDropContext>
                    </div>
                )}
            </div>

            {/* PENDING PROPOSALS SECTION */}
            {pendingProposals.length > 0 && (
                <div className="admin-card" style={{ marginTop: '24px' }}>
                    <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Landmark size={20} style={{ color: '#6366f1' }} />
                            Đề xuất chờ duyệt
                            <span style={{ background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>{pendingProposals.length}</span>
                        </h2>
                    </div>
                    <div className="admin-table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Nội dung đề xuất</th>
                                    <th>Giáo viên</th>
                                    <th>Loại</th>
                                    <th className="text-right">Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingProposals.map(proposal => (
                                    <tr key={proposal.id}>
                                        <td data-label="Nội dung"><div className="admin-topic-cell"><div className="admin-topic-icon" style={{ background: `${proposal.color || '#3b82f6'}20` }}>{proposal.icon || '📝'}</div><div><div className="admin-topic-name">{proposal.proposalName}</div><div className="admin-topic-id" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{proposal.proposalDescription || 'Không có mô tả'}</div></div></div></td>
                                        <td data-label="Giáo viên"><div style={{ fontSize: '0.85rem', color: '#334155' }}>{proposal.teacherName}</div><div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{proposal.teacherEmail}</div></td>
                                        <td data-label="Loại"><span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: '#e0e7ff', color: '#4f46e5', fontWeight: 600 }}>{proposal.level === 'folder' ? 'Folder' : 'Bài lẻ'}</span></td>
                                        <td data-label="Hành động" className="text-right">
                                            <div className="admin-table-actions">
                                                <button className="admin-action-btn" style={{ color: '#10b981' }} onClick={() => handleApproveProposal(proposal.id)} title="Duyệt"><CheckCircle size={16} /></button>
                                                <button className="admin-action-btn danger" onClick={() => openRejectModal(proposal)} title="Từ chối"><XCircle size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* REJECT MODAL */}
            {rejectModalOpen && proposalToReject && (
                <div className="teacher-modal-overlay">
                    <div className="teacher-modal">
                        <h2 className="admin-modal-title" style={{ color: '#ef4444', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <XCircle size={24} /> Từ chối đề xuất
                            </div>
                        </h2>
                        <p className="admin-modal-desc">Từ chối đề xuất <strong>{proposalToReject.proposalName}</strong> của giáo viên <strong>{proposalToReject.teacherName}</strong>?</p>
                        <div className="admin-form-group">
                            <label>Lý do từ chối (tuỳ chọn)</label>
                            <textarea className="admin-form-input admin-form-textarea" value={rejectNote} onChange={e => setRejectNote(e.target.value)} placeholder="Nhập lý do để giáo viên biết..." rows={3} />
                        </div>
                        <div className="admin-modal-actions" style={{ flexDirection: 'row', marginTop: '24px' }}>
                            <button className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setRejectModalOpen(false)}>Hủy</button>
                            <button className="admin-btn admin-btn-primary" style={{ backgroundColor: '#ef4444', flex: 1 }} onClick={handleConfirmReject}>Xác nhận từ chối</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- EXERCISE FORM MODAL --- */}
            {exerciseFormOpen && (
                <div className="teacher-modal-overlay">
                    <div className="teacher-modal wide" style={{ maxWidth: '500px', overflow: 'auto' }}>
                        <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                            <button type="button" className="teacher-modal-close" onClick={() => setExerciseFormOpen(false)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <h2 className="admin-modal-title" style={{ justifyContent: 'flex-start', marginBottom: '24px', paddingRight: '40px' }}>
                            {isEditingExercise ? 'Sửa Bài luyện' : 'Tạo Bài luyện mới'}
                        </h2>
                        <form onSubmit={handleExerciseFormSubmit}>
                            <div className="admin-form-group">
                                <label>Tên bài luyện</label>
                                <input type="text" className="admin-form-input" required value={exerciseFormData.name} onChange={e => setExerciseFormData({ ...exerciseFormData, name: e.target.value })} placeholder="Ví dụ: Bài luyện Thì Hiện tại Hoàn thành" />
                            </div>
                            <div className="admin-form-group">
                                <label>Mô tả ngắn</label>
                                <textarea className="admin-form-input admin-form-textarea" value={exerciseFormData.description} onChange={e => setExerciseFormData({ ...exerciseFormData, description: e.target.value })} placeholder="Mô tả về bài luyện..." />
                            </div>
                            <div className="admin-form-row admin-form-row-2col">
                                <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                    <label>Biểu tượng (Emoji)</label>
                                    <input type="text" className="admin-form-input" required value={exerciseFormData.icon} onChange={e => setExerciseFormData({ ...exerciseFormData, icon: e.target.value })} placeholder="Ví dụ: 📝" />
                                </div>
                                <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                    <label>Màu nền (Hex)</label>
                                    <input type="color" className="admin-form-input" style={{ padding: '4px', height: '42px' }} value={exerciseFormData.color} onChange={e => setExerciseFormData({ ...exerciseFormData, color: e.target.value })} />
                                </div>
                            </div>
                            <div className="admin-form-row">
                                <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                    <label>Trình độ mục tiêu</label>
                                    <CustomDropdown
                                        value={exerciseFormData.targetLevel}
                                        options={[
                                            { value: 'A0', label: 'Starters (A0)' },
                                            { value: 'A1', label: 'Movers / KET (A1)' },
                                            { value: 'A2', label: 'Flyers / PET (A2)' },
                                            { value: 'B1', label: 'FCE (B1)' },
                                            { value: 'B2', label: 'CAE / IELTS 5.5-6.5 (B2)' },
                                            { value: 'C1', label: 'CPE / IELTS 7.0+ (C1/C2)' }
                                        ]}
                                        onChange={(val) => setExerciseFormData({ ...exerciseFormData, targetLevel: val })}
                                    />
                                </div>
                                <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                    <label>Độ tuổi học viên</label>
                                    <CustomDropdown
                                        value={exerciseFormData.targetAge}
                                        options={[
                                            { value: '5-8', label: '5 - 8 tuổi' },
                                            { value: '9-12', label: '9 - 12 tuổi' },
                                            { value: '13-17', label: '13 - 17 tuổi' },
                                            { value: '18+', label: 'Trên 18 tuổi' }
                                        ]}
                                        onChange={(val) => setExerciseFormData({ ...exerciseFormData, targetAge: val })}
                                    />
                                </div>
                            </div>

                            <div className="admin-form-group">
                                <label>Folder (Phân loại)</label>
                                <CustomDropdown
                                    value={exerciseFormData.folderId || ''}
                                    options={[
                                        { value: '', label: '-- Chưa phân loại --' },
                                        ...folders.map(f => ({ value: f.id, label: `📁 ${f.name}` }))
                                    ]}
                                    onChange={(val) => setExerciseFormData({ ...exerciseFormData, folderId: val })}
                                />
                            </div>

                            <div className="admin-modal-actions" style={{ marginTop: '32px', flexDirection: 'row' }}>
                                <button type="button" className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setExerciseFormOpen(false)} disabled={isSaving}>Hủy</button>
                                <button type="submit" className="admin-btn admin-btn-primary" style={{ flex: 1 }} disabled={isSaving}>{isSaving ? 'Đang lưu...' : (isEditingExercise ? 'Cập nhật' : 'Tạo mới')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {exerciseToDelete && (
                <div className="teacher-modal-overlay">
                    <div className="teacher-modal">
                        <h2 className="admin-modal-title" style={{ color: '#ef4444', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Trash2 size={24} /> Xác nhận xóa
                            </div>
                        </h2>
                        <p className="admin-modal-desc">
                            Bạn có chắc chắn muốn xóa bài luyện <strong>{exerciseToDelete.name}</strong>?<br /><br />
                            <strong>Lưu ý:</strong> Toàn bộ câu hỏi bên trong cũng sẽ bị xóa vĩnh viễn và không thể khôi phục.
                        </p>
                        <div className="admin-modal-actions" style={{ flexDirection: 'row', marginTop: '24px' }}>
                            <button className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setExerciseToDelete(null)}>Hủy</button>
                            <button className="admin-btn admin-btn-primary" style={{ backgroundColor: '#ef4444', flex: 1 }} onClick={handleConfirmDeleteExercise}>Xóa vĩnh viễn</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- FOLDER MODALS --- */}
            {folderFormOpen && (
                <div className="teacher-modal-overlay">
                    <div className="teacher-modal wide" style={{ maxWidth: '600px', overflow: 'auto' }}>
                        <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                            <button type="button" className="teacher-modal-close" onClick={() => setFolderFormOpen(false)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <h2 className="admin-modal-title" style={{ justifyContent: 'flex-start', marginBottom: '24px', paddingRight: '40px' }}>
                            {isEditingFolder ? 'Sửa Folder' : 'Thêm Folder mới'}
                        </h2>
                        <form onSubmit={handleFolderFormSubmit}>
                            <div className="admin-form-group">
                                <label>Tên Folder</label>
                                <input type="text" className="admin-form-input" required value={folderFormData.name} onChange={e => setFolderFormData({ ...folderFormData, name: e.target.value })} placeholder="Ví dụ: Các thì cơ bản" />
                            </div>
                            <div className="admin-form-group">
                                <label>Mô tả ngắn</label>
                                <input type="text" className="admin-form-input" value={folderFormData.description} onChange={e => setFolderFormData({ ...folderFormData, description: e.target.value })} placeholder="Mô tả..." />
                            </div>


                            <div className="admin-form-group" style={{ marginTop: '16px' }}>
                                <label style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>Chọn bài luyện thuộc Folder này</span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--color-primary)', background: 'var(--color-primary-light)20', padding: '2px 8px', borderRadius: '12px' }}>
                                        Đã chọn {folderFormData.exerciseIds?.length || 0}
                                    </span>
                                </label>
                                <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', background: '#f8fafc' }}>
                                    {exercises.length === 0 ? (
                                        <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
                                            Chưa có bài luyện nào để chọn.
                                        </div>
                                    ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                                            {exercises.map(exercise => {
                                                const isSelected = (folderFormData.exerciseIds || []).includes(exercise.id);
                                                return (
                                                    <div
                                                        key={exercise.id}
                                                        onClick={() => toggleExerciseInFolder(exercise.id)}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: '10px', padding: '10px',
                                                            background: isSelected ? '#eff6ff' : '#fff',
                                                            border: `1px solid ${isSelected ? 'var(--color-primary)' : '#e2e8f0'}`,
                                                            borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        <div style={{ width: '20px', height: '20px', borderRadius: '4px', border: `2px solid ${isSelected ? 'var(--color-primary)' : '#cbd5e1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSelected ? 'var(--color-primary)' : 'transparent' }}>
                                                            {isSelected && <Check size={14} color="#fff" />}
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                                            <span style={{ fontSize: '1.2rem' }}>📝</span>
                                                            <span style={{ fontSize: '0.9rem', fontWeight: isSelected ? 600 : 400, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{exercise.name}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="admin-modal-actions" style={{ marginTop: '32px', flexDirection: 'row' }}>
                                <button type="button" className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setFolderFormOpen(false)}>Hủy</button>
                                <button type="submit" className="admin-btn admin-btn-primary" style={{ flex: 1 }}>{isEditingFolder ? 'Cập nhật Folder' : 'Thêm Folder'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {folderToDelete && (
                <div className="teacher-modal-overlay">
                    <div className="teacher-modal">
                        <h2 className="admin-modal-title" style={{ color: '#ef4444', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Trash2 size={24} /> Xác nhận xóa
                            </div>
                        </h2>
                        <p className="admin-modal-desc">
                            Bạn có chắc chắn muốn xóa Folder <strong>{folderToDelete.name}</strong>?<br /><br />
                            <strong>Lưu ý:</strong> Các bài luyện bên trong sẽ không bị xóa, chỉ Folder bị xóa đi.
                        </p>
                        <div className="admin-modal-actions" style={{ flexDirection: 'row', marginTop: '24px' }}>
                            <button className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setFolderToDelete(null)}>Hủy</button>
                            <button className="admin-btn admin-btn-primary" style={{ backgroundColor: '#ef4444', flex: 1 }} onClick={handleConfirmDeleteFolder}>Xóa Folder</button>
                        </div>
                    </div>
                </div>
            )}

            {alertMessage && (
                <div className="teacher-modal-overlay">
                    <div className="teacher-modal">
                        <h2 className="admin-modal-title">
                            {alertMessage.type === 'success' ? <span style={{ color: '#10b981' }}>Thành công</span> : <span style={{ color: '#ef4444' }}>Đã có lỗi</span>}
                        </h2>
                        <p className="admin-modal-desc">
                            {alertMessage.text}
                        </p>
                        <div className="admin-modal-actions" style={{ flexDirection: 'row' }}>
                            <button className="admin-btn admin-btn-primary" style={{ flex: 1 }} onClick={() => setAlertMessage(null)}>Đóng</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- SHARE MODAL --- */}
            {shareModalOpen && resourceToShare && (
                <div className="teacher-modal-overlay">
                    <div className="teacher-modal wide" style={{ maxWidth: '600px', overflow: 'auto' }}>
                        <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                            <button type="button" className="teacher-modal-close" onClick={() => setShareModalOpen(false)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <h2 className="admin-modal-title" style={{ justifyContent: 'flex-start', marginBottom: '24px', paddingRight: '40px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Share2 size={24} color="var(--color-primary)" />
                                Chia sẻ {resourceToShare.type === 'grammar_folder' ? 'Folder' : 'Bài luyện'}
                            </div>
                        </h2>

                        <div style={{ marginBottom: '20px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', margin: '0 0 4px 0' }}>{resourceToShare.name}</h3>
                            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>ID: {resourceToShare.id}</p>

                            {/* Copy Link Section */}
                            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <input
                                    type="text"
                                    readOnly
                                    value={`${window.location.origin}/preview/superstudy?shareId=${resourceToShare.id}&shareType=${resourceToShare.type === 'grammar_folder' ? 'admin_grammar_folder' : 'admin_grammar'}`}
                                    style={{ flex: '1 1 200px', minWidth: '0', padding: '8px 12px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none', backgroundColor: '#f1f5f9', color: '#475569' }}
                                />
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(`${window.location.origin}/preview/superstudy?shareId=${resourceToShare.id}&shareType=${resourceToShare.type === 'grammar_folder' ? 'admin_grammar_folder' : 'admin_grammar'}`);
                                        setLinkCopied(true);
                                        setTimeout(() => setLinkCopied(false), 2000);
                                    }}
                                    style={{ flex: window.innerWidth < 480 ? '1' : '0 0 auto', padding: '8px 16px', background: linkCopied ? '#10b981' : 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', transition: 'all 0.3s' }}
                                >
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
                                    <h4 style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1e293b', margin: '0 0 4px 0' }}>{resourceToShare.isPublic ? 'Đang Công khai' : 'Hạn chế (Chỉ ai có quyền hoặc có link)'}</h4>
                                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>{resourceToShare.isPublic ? 'Bất kỳ ai cũng có thể tìm và học bài này.' : 'Cần cấp quyền bên dưới hoặc gửi Link trực tiếp.'}</p>
                                </div>
                            </div>
                            <button
                                onClick={handleTogglePublic}
                                disabled={isSharing}
                                style={{
                                    padding: '8px 16px', background: resourceToShare.isPublic ? 'transparent' : 'var(--color-primary)',
                                    color: resourceToShare.isPublic ? '#ef4444' : '#fff',
                                    border: resourceToShare.isPublic ? '1px solid #ef4444' : 'none',
                                    borderRadius: '6px', cursor: isSharing ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.85rem'
                                }}>
                                {resourceToShare.isPublic ? 'Tắt Public' : 'Bật Public'}
                            </button>
                        </div>

                        {!resourceToShare.isPublic && (
                            <div className="admin-share-grid">
                                {/* Group Share */}
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

                                {/* Email Share */}
                                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 600, color: '#334155', margin: '0 0 12px 0' }}><Mail size={16} /> Chia sẻ cá nhân</h4>
                                    <form onSubmit={handleAddShareEmail} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                        <EmailAutocomplete
                                            value={shareEmail}
                                            onChange={setShareEmail}
                                            onSubmit={(email) => handleAddShareEmail(email)}
                                            disabled={isSharing}
                                        />
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

                        {/* Quick Assign Section */}
                        {resourceToShare.type !== 'grammar_folder' && (
                            <div style={{ marginTop: '20px', padding: '16px', background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', borderRadius: '12px', border: '1px solid #fde68a' }}>
                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', fontWeight: 700, color: '#92400e', margin: '0 0 6px 0' }}>
                                    <FileText size={16} /> Giao bài cho lớp
                                </h4>
                                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '12px' }}>Giao nhanh bài học này cho 1 lớp mà bạn đang chủ nhiệm.</p>

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
                                            onClick={handleQuickAssign}
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
                                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>Bạn chưa quản lý lớp nào.</p>
                                )}
                            </div>
                        )}

                        <div className="admin-modal-actions" style={{ marginTop: '24px', flexDirection: 'row' }}>
                            <button className="admin-btn admin-btn-primary" style={{ flex: 1 }} onClick={() => setShareModalOpen(false)}>Đóng</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
