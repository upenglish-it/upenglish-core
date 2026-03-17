import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Link } from 'react-router-dom';
import { getAdminTopics, saveAdminTopic, deleteAdminTopic, getFolders, saveFolder, deleteFolder, getGroups, toggleResourcePublic, getResourceSharedEntities, shareResourceToEmail, unshareResourceFromUser, shareResourceToGroup, unshareResourceFromGroup, getAdminTopicContentStatus, updateTopicFoldersOrder } from '../../services/adminService';
import { createAssignment, getAssignmentsForTopic } from '../../services/teacherService';
import { getPendingProposals, approveProposal, rejectProposal } from '../../services/contentProposalService';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { BookOpen, Edit, Trash2, X, Plus, List, FolderOpen, GripVertical, Check, CheckCircle, Share2, Globe, Users, Mail, UserPlus, Lock, Search, AlertTriangle, ChevronDown, ChevronRight, Clock, Send, XCircle, Landmark, FileText } from 'lucide-react';
import CustomSelect from '../../components/common/CustomSelect';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import EmailAutocomplete from '../../components/common/EmailAutocomplete';

function CustomDropdown({ value, options, onChange, placeholder = "Chọn một mục" }) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [coords, setCoords] = React.useState({ top: 0, left: 0, width: 0 });
    const selectedOption = options.find(opt => opt.value === value);
    const dropdownRef = React.useRef(null);
    const portalRef = React.useRef(null);

    React.useEffect(() => {
        function handleClickOutside(event) {
            if (
                dropdownRef.current && !dropdownRef.current.contains(event.target) &&
                (!portalRef.current || !portalRef.current.contains(event.target))
            ) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleDropdown = () => {
        if (!isOpen && dropdownRef.current) {
            const rect = dropdownRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom,
                left: rect.left,
                width: rect.width
            });
        }
        setIsOpen(!isOpen);
    };

    return (
        <div ref={dropdownRef} className="admin-custom-dropdown" style={{ position: 'relative', width: '100%' }}>
            <div
                className={`admin-form-input ${isOpen ? 'active' : ''}`}
                onClick={toggleDropdown}
                style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    cursor: 'pointer', padding: '10px 14px',
                    color: '#0f172a',
                    fontSize: window.innerWidth < 768 ? '0.85rem' : '0.95rem'
                }}
            >
                <span style={{
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    maxWidth: '85%'
                }}>{selectedOption ? selectedOption.label : placeholder}</span>
                <ChevronDown size={14} style={{ flexShrink: 0, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: '#64748b' }} />
            </div>
            {isOpen && ReactDOM.createPortal(
                <div ref={portalRef} style={{
                    position: 'fixed', top: coords.top, left: coords.left, width: coords.width, zIndex: 9999,
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
                    marginTop: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto'
                }}>
                    {options.map((opt, idx) => (
                        <div
                            key={idx}
                            onClick={() => { onChange(opt.value); setIsOpen(false); }}
                            style={{
                                padding: '10px 14px', cursor: 'pointer',
                                background: value === opt.value ? '#eff6ff' : 'transparent',
                                color: value === opt.value ? '#2563eb' : '#334155',
                                fontWeight: value === opt.value ? '600' : '500',
                                borderBottom: idx === options.length - 1 ? 'none' : '1px solid #f1f5f9',
                                fontSize: window.innerWidth < 768 ? '0.8rem' : '0.9rem'
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.background = '#f8fafc';
                                e.target.style.color = '#0f172a';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.background = value === opt.value ? '#eff6ff' : 'transparent';
                                e.target.style.color = value === opt.value ? '#2563eb' : '#334155';
                            }}
                        >
                            {opt.label}
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
}

export default function AdminTopicsPage() {
    const { user } = useAuth();
    const [topics, setTopics] = useState([]);
    const [folders, setFolders] = useState([]);
    const [topicWordCounts, setTopicWordCounts] = useState({});
    const [topicContentStatus, setTopicContentStatus] = useState({});
    const [loading, setLoading] = useState(true);
    const [expandedFolders, setExpandedFolders] = useState(new Set());
    const [alertMessage, setAlertMessage] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Topic States
    const [topicFormOpen, setTopicFormOpen] = useState(false);
    const [topicFormData, setTopicFormData] = useState({ id: '', name: '', description: '', icon: '', color: '#3b82f6', status: 'active' });
    const [isEditingTopic, setIsEditingTopic] = useState(false);
    const [topicToDelete, setTopicToDelete] = useState(null);

    // Folder States
    const [folderFormOpen, setFolderFormOpen] = useState(false);
    const [folderFormData, setFolderFormData] = useState({ id: '', name: '', description: '', icon: '', color: '#3b82f6', topicIds: [], order: 0 });
    const [isEditingFolder, setIsEditingFolder] = useState(false);
    const [folderToDelete, setFolderToDelete] = useState(null);

    // Share States
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const [resourceToShare, setResourceToShare] = useState(null); // { id, name, type, isPublic }
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
    const [proposalsLoading, setProposalsLoading] = useState(false);
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [proposalToReject, setProposalToReject] = useState(null);
    const [rejectNote, setRejectNote] = useState('');

    const [loadVersion, setLoadVersion] = useState(0);

    useEffect(() => {
        loadData();
        loadProposals();
    }, []);

    // Lazy load content status after topics are loaded (non-blocking)
    useEffect(() => {
        if (topics.length === 0) return;
        const topicIds = topics.map(t => t.id);
        getAdminTopicContentStatus(topicIds)
            .then(status => setTopicContentStatus(status))
            .catch(err => console.error('Error loading content status:', err));
    }, [loadVersion]);

    async function loadData() {
        setLoading(true);
        try {
            const [topicsData, foldersData] = await Promise.all([
                getAdminTopics(),
                getFolders()
            ]);

            // Read cached word counts from topic documents
            const counts = {};
            topicsData.forEach(t => { counts[t.id] = t.cachedWordCount ?? 0; });
            setTopicWordCounts(counts);

            // Determine which topic IDs are inside public folders
            const publicFolderTopicIds = new Set();
            foldersData.forEach(folder => {
                if (folder.isPublic && folder.topicIds && Array.isArray(folder.topicIds)) {
                    folder.topicIds.forEach(id => publicFolderTopicIds.add(id));
                }
            });

            // Make topics implicitly public if they are in a public folder
            const topicsWithInheritedPublic = topicsData.map(t => {
                if (publicFolderTopicIds.has(t.id)) {
                    // Only inherit public if not explicitly disabled
                    if (t.isPublic !== false) {
                        return { ...t, isPublic: true, isInPublicFolder: true };
                    }
                    return { ...t, isInPublicFolder: true };
                }
                return t;
            });

            setTopics(topicsWithInheritedPublic);
            setFolders(foldersData);
        } catch (error) {
            console.error(error);
        }
        setLoading(false);
        setLoadVersion(v => v + 1);
    }

    // --- TOPIC HANDLERS ---
    function openAddTopicForm() {
        setTopicFormData({ id: '', name: '', description: '', icon: '', color: '#3b82f6', status: 'active', folderId: '' });
        setIsEditingTopic(false);
        setTopicFormOpen(true);
    }

    function openEditTopicForm(topic) {
        // Find if this topic is in any folder
        const currentFolder = folders.find(f => (f.topicIds || []).includes(topic.id));
        setTopicFormData({ ...topic, folderId: currentFolder ? currentFolder.id : '' });
        setIsEditingTopic(true);
        setTopicFormOpen(true);
    }

    async function handleTopicFormSubmit(e) {
        e.preventDefault();
        let finalTopicId;
        if (isEditingTopic) {
            // Khi đang sửa, giữ nguyên ID gốc — không tạo ID mới
            finalTopicId = topicFormData.id;
        } else {
            finalTopicId = topicFormData.id.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
            if (!finalTopicId) {
                // Tự động tạo ID từ tên topic nếu để trống
                const nameSlug = topicFormData.name.trim()
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/đ/g, 'd')
                    .replace(/[^a-z0-9\s-]/g, '')
                    .trim()
                    .replace(/\s+/g, '-');
                if (!nameSlug) {
                    setAlertMessage({ type: 'error', text: "Vui lòng nhập tên chủ đề hoặc ID tùy chỉnh." });
                    return;
                }
                finalTopicId = nameSlug;
            }
        }
        try {
            const topicToSave = { ...topicFormData };
            const targetFolderId = topicToSave.folderId;
            delete topicToSave.folderId; // Remove from topic doc itself if not wanted

            await saveAdminTopic({ ...topicToSave, id: finalTopicId });

            // Handle Folder Reassignment
            const currentFolder = folders.find(f => (f.topicIds || []).includes(finalTopicId));

            if (currentFolder && currentFolder.id !== targetFolderId) {
                // Remove from old folder
                const updatedOldFolder = {
                    ...currentFolder,
                    topicIds: (currentFolder.topicIds || []).filter(tid => tid !== finalTopicId)
                };
                await saveFolder(updatedOldFolder);
            }

            if (targetFolderId && (!currentFolder || currentFolder.id !== targetFolderId)) {
                // Add to new folder
                const targetFolder = folders.find(f => f.id === targetFolderId);
                if (targetFolder) {
                    const updatedNewFolder = {
                        ...targetFolder,
                        topicIds: Array.from(new Set([...(targetFolder.topicIds || []), finalTopicId]))
                    };
                    await saveFolder(updatedNewFolder);
                }
            }

            setTopicFormOpen(false);
            setAlertMessage({ type: 'success', text: isEditingTopic ? "Cập nhật chủ đề thành công!" : "Thêm chủ đề mới thành công!" });
            loadData();
        } catch (error) {
            setAlertMessage({ type: 'error', text: "Lỗi lưu chủ đề: " + error.message });
        }
    }

    async function handleConfirmDeleteTopic() {
        if (!topicToDelete) return;
        try {
            await deleteAdminTopic(topicToDelete.id);
            setTopics(prev => prev.filter(t => t.id !== topicToDelete.id));
            setAlertMessage({ type: 'success', text: "Đã xóa chủ đề thành công!" });
        } catch (error) {
            setAlertMessage({ type: 'error', text: "Lỗi xóa chủ đề: " + error.message });
        }
        setTopicToDelete(null);
    }

    // --- FOLDER HANDLERS ---
    function openAddFolderForm() {
        setFolderFormData({ id: '', name: '', description: '', icon: '', color: '#3b82f6', topicIds: [], order: folders.length });
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
            await saveFolder({ ...folderFormData, id: finalFolderId });
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
            await deleteFolder(folderToDelete.id);
            setFolders(prev => prev.filter(f => f.id !== folderToDelete.id));
            setAlertMessage({ type: 'success', text: "Đã xóa folder thành công!" });
        } catch (error) {
            setAlertMessage({ type: 'error', text: "Lỗi xóa folder: " + error.message });
        }
        setFolderToDelete(null);
    }

    function toggleTopicInFolder(topicId) {
        setFolderFormData(prev => {
            const current = new Set(prev.topicIds || []);
            if (current.has(topicId)) {
                current.delete(topicId);
            } else {
                current.add(topicId);
            }
            return { ...prev, topicIds: Array.from(current) };
        });
    }

    async function handleFolderDragEnd(result) {
        if (!result.destination) return;
        const reordered = Array.from(folders);
        const [moved] = reordered.splice(result.source.index, 1);
        reordered.splice(result.destination.index, 0, moved);
        setFolders(reordered); // optimistic update
        try {
            await updateTopicFoldersOrder(reordered);
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
                type !== 'folder' ? getAssignmentsForTopic(resource.id) : Promise.resolve([])
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
            loadData(); // Refresh list to update badge
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
            // check if user already in list
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
        setProposalsLoading(true);
        try {
            const proposals = await getPendingProposals('vocab');
            setPendingProposals(proposals);
        } catch (err) {
            console.error('Error loading proposals:', err);
        }
        setProposalsLoading(false);
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

    const filteredTopics = topics.filter(t =>
        (t.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.id || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredFolders = folders.filter(f => {
        const matchesFolder = (f.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (f.id || '').toLowerCase().includes(searchTerm.toLowerCase());
        const hasMatchingTopic = (f.topicIds || []).some(tid =>
            filteredTopics.some(t => t.id === tid)
        );
        return matchesFolder || hasMatchingTopic;
    });

    const unassignedTopicsCount = topics.length; // Can be detailed later if needed

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <h1 className="admin-page-title">Bài học vocab chính thức</h1>
                <div className="admin-header-actions" style={{ display: 'flex', gap: '12px' }}>
                    <button className="admin-btn admin-btn-outline" onClick={openAddFolderForm}><FolderOpen size={16} /> Thêm Folder</button>
                    <button className="admin-btn admin-btn-primary" onClick={openAddTopicForm}><Plus size={16} /> Thêm Topic mới</button>
                </div>
            </div>

            <div>
                <div className="admin-search-box">
                    <Search size={16} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Tìm tên hoặc ID chủ đề, folder..."
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
                                <Droppable droppableId="topic-folders">
                                    {(provided) => (
                                        <tbody ref={provided.innerRef} {...provided.droppableProps}>
                                            {filteredFolders.map((folder, fIndex) => {
                                                const isExpanded = expandedFolders.has(folder.id) || searchTerm.length > 0;
                                                const folderTopics = filteredTopics
                                                    .filter(t => (folder.topicIds || []).includes(t.id))
                                                    .sort((a, b) => {
                                                        // Ưu tiên bài đã hoàn thành nội dung lên trên
                                                        const aComplete = topicContentStatus[a.id]?.isComplete ? 1 : 0;
                                                        const bComplete = topicContentStatus[b.id]?.isComplete ? 1 : 0;
                                                        if (bComplete !== aComplete) return bComplete - aComplete;
                                                        // Sắp xếp tự nhiên theo tên (Lesson 2 trước Lesson 10)
                                                        return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' });
                                                    });

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
                                                                                            <span>{folderTopics.length}</span>
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
                                                                            <button className="admin-action-btn" onClick={() => openShareModal(folder, 'folder')} title="Chia sẻ Folder"><Share2 size={16} /></button>
                                                                            <button className="admin-action-btn" onClick={() => openEditFolderForm(folder)} title="Sửa Folder"><Edit size={16} /></button>
                                                                            <button className="admin-action-btn danger" onClick={() => setFolderToDelete(folder)} title="Xóa Folder"><Trash2 size={16} /></button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </Draggable>
                                                        {isExpanded && (
                                                            folderTopics.length === 0 ? (
                                                                <tr>
                                                                    <td></td>
                                                                    <td colSpan="4" style={{ paddingLeft: '40px', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>
                                                                        Folder này chưa có chủ đề nào.
                                                                    </td>
                                                                </tr>
                                                            ) : (
                                                                folderTopics.map(topic => (
                                                                    <tr key={topic.id} className="table-row-nested">
                                                                        <td></td>
                                                                        <td data-label="Tên mục">
                                                                            <div className="admin-topic-cell">
                                                                                <div className="admin-topic-icon" style={{ background: `${topic.color}20`, width: '32px', height: '32px', fontSize: '0.9rem' }}>{topic.icon}</div>
                                                                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '10px' }}>
                                                                                        <div className="admin-topic-name" style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                            {topicContentStatus[topic.id]?.isComplete
                                                                                                ? <CheckCircle size={14} style={{ color: '#16a34a', flexShrink: 0 }} title="Đã có nội dung học đầy đủ" />
                                                                                                : topicContentStatus[topic.id]?.total > 0
                                                                                                    ? <AlertTriangle size={14} style={{ color: '#d97706', flexShrink: 0 }} title={`${topicContentStatus[topic.id]?.complete}/${topicContentStatus[topic.id]?.total} từ có nội dung`} />
                                                                                                    : null
                                                                                            }
                                                                                            {topic.name}
                                                                                        </div>
                                                                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                                                            {topic.isPublic && (
                                                                                                <span style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '4px', background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0', whiteSpace: 'nowrap' }}>Public</span>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                    {/* Compact Info for Mobile */}
                                                                                    <div className="mobile-show" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                                                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><BookOpen size={10} /> {topicWordCounts[topic.id] || 0} từ</span>
                                                                                        <span>&middot;</span>
                                                                                        <span className={`${topic.status === 'coming_soon' ? 'text-warning' : 'text-success'}`} style={{ fontWeight: 600 }}>
                                                                                            {topic.status === 'coming_soon' ? 'Sắp ra mắt' : 'Active'}
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td data-label="Thông tin" className="mobile-hide">
                                                                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                                                                                {topicWordCounts[topic.id] || 0} từ
                                                                            </span>
                                                                        </td>
                                                                        <td data-label="Trạng thái" className="mobile-hide">
                                                                            <div style={{ display: 'flex', gap: '6px', flexDirection: 'column', alignItems: 'flex-start' }}>
                                                                                <span className={`admin-status-badge ${topic.status === 'coming_soon' ? 'coming-soon' : 'active'}`} style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                                                                                    {topic.status === 'coming_soon' ? 'Sắp ra mắt' : 'Đang hoạt động'}
                                                                                </span>
                                                                            </div>
                                                                        </td>
                                                                        <td data-label="Thao tác" className="text-right">
                                                                            <div className="admin-table-actions">
                                                                                <Link to={`/admin/topics/${topic.id}`} className="admin-action-btn" title="Quản lý từ vựng">
                                                                                    <List size={14} />
                                                                                </Link>
                                                                                <button className="admin-action-btn" onClick={() => openShareModal(topic, 'topic')}><Share2 size={14} /></button>
                                                                                <button className="admin-action-btn" onClick={() => openEditTopicForm(topic)}><Edit size={14} /></button>
                                                                                <button className="admin-action-btn danger" onClick={() => setTopicToDelete(topic)}><Trash2 size={14} /></button>
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
                                    {/* RENDER UNASSIGNED TOPICS */}
                                    {(() => {
                                        const assignedTopicIds = new Set(folders.flatMap(f => f.topicIds || []));
                                        const unassignedTopics = filteredTopics.filter(t => !assignedTopicIds.has(t.id));

                                        if (unassignedTopics.length === 0) return null;

                                        return (
                                            <>
                                                <tr className="admin-unassigned-header">
                                                    <td></td>
                                                    <td colSpan="4">
                                                        <div className="admin-unassigned-label">
                                                            <AlertTriangle size={16} />
                                                            Chủ đề chưa phân loại ({unassignedTopics.length})
                                                        </div>
                                                    </td>
                                                </tr>
                                                {unassignedTopics.map(topic => (
                                                    <tr key={topic.id}>
                                                        <td></td>
                                                        <td>
                                                            <div className="admin-topic-cell">
                                                                <div className="admin-topic-icon" style={{ background: `${topic.color}20` }}>{topic.icon}</div>
                                                                <div>
                                                                    <div className="admin-topic-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                        {topicContentStatus[topic.id]?.isComplete
                                                                            ? <CheckCircle size={14} style={{ color: '#16a34a', flexShrink: 0 }} title="Đã có nội dung học đầy đủ" />
                                                                            : topicContentStatus[topic.id]?.total > 0
                                                                                ? <AlertTriangle size={14} style={{ color: '#d97706', flexShrink: 0 }} title={`${topicContentStatus[topic.id]?.complete}/${topicContentStatus[topic.id]?.total} từ có nội dung`} />
                                                                                : null
                                                                        }
                                                                        {topic.name}
                                                                    </div>
                                                                    <div className="admin-topic-id">Topic ID: {topic.id}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <span style={{ fontWeight: 600, color: '#475569' }}>
                                                                {topicWordCounts[topic.id] || 0} từ
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div style={{ display: 'flex', gap: '6px', flexDirection: 'column', alignItems: 'flex-start' }}>
                                                                <span className={`admin-status-badge ${topic.status === 'coming_soon' ? 'coming-soon' : 'active'}`}>
                                                                    {topic.status === 'coming_soon' ? 'Sắp ra mắt' : 'Đang hoạt động'}
                                                                </span>
                                                                {topic.isPublic && (
                                                                    <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0' }}>Public</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="text-right">
                                                            <div className="admin-table-actions">
                                                                <Link to={`/admin/topics/${topic.id}`} className="admin-action-btn" title="Quản lý từ vựng">
                                                                    <List size={16} />
                                                                </Link>
                                                                <button className="admin-action-btn" onClick={() => openShareModal(topic, 'topic')}><Share2 size={16} /></button>
                                                                <button className="admin-action-btn" onClick={() => openEditTopicForm(topic)}><Edit size={16} /></button>
                                                                <button className="admin-action-btn danger" onClick={() => setTopicToDelete(topic)}><Trash2 size={16} /></button>
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
                            <span style={{ background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                                {pendingProposals.length}
                            </span>
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
                                        <td data-label="Nội dung">
                                            <div className="admin-topic-cell">
                                                <div className="admin-topic-icon" style={{ background: `${proposal.color || '#6366f1'}20` }}>
                                                    {proposal.icon || '📚'}
                                                </div>
                                                <div>
                                                    <div className="admin-topic-name">{proposal.proposalName}</div>
                                                    <div className="admin-topic-id" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                                        {proposal.proposalDescription || 'Không có mô tả'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td data-label="Giáo viên">
                                            <div style={{ fontSize: '0.85rem', color: '#334155' }}>{proposal.teacherName}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{proposal.teacherEmail}</div>
                                        </td>
                                        <td data-label="Loại">
                                            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: '#e0e7ff', color: '#4f46e5', fontWeight: 600 }}>
                                                {proposal.level === 'folder' ? 'Folder' : 'Bài lẻ'}
                                            </span>
                                        </td>
                                        <td data-label="Hành động" className="text-right">
                                            <div className="admin-table-actions">
                                                <button
                                                    className="admin-action-btn"
                                                    style={{ color: '#10b981' }}
                                                    onClick={() => handleApproveProposal(proposal.id)}
                                                    title="Duyệt"
                                                >
                                                    <CheckCircle size={16} />
                                                </button>
                                                <button
                                                    className="admin-action-btn danger"
                                                    onClick={() => openRejectModal(proposal)}
                                                    title="Từ chối"
                                                >
                                                    <XCircle size={16} />
                                                </button>
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
                    <div className="teacher-modal" style={{ maxWidth: '450px' }}>
                        <h2 className="admin-modal-title" style={{ color: '#ef4444', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <XCircle size={24} /> Từ chối đề xuất
                            </div>
                        </h2>
                        <p className="admin-modal-desc">
                            Từ chối đề xuất <strong>{proposalToReject.proposalName}</strong> của giáo viên <strong>{proposalToReject.teacherName}</strong>?
                        </p>
                        <div className="admin-form-group">
                            <label>Lý do từ chối (tuỳ chọn)</label>
                            <textarea
                                className="admin-form-input admin-form-textarea"
                                value={rejectNote}
                                onChange={e => setRejectNote(e.target.value)}
                                placeholder="Nhập lý do để giáo viên biết..."
                                rows={3}
                            />
                        </div>
                        <div className="admin-modal-actions" style={{ flexDirection: 'row' }}>
                            <button className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setRejectModalOpen(false)}>Hủy</button>
                            <button className="admin-btn admin-btn-primary" style={{ backgroundColor: '#ef4444', flex: 1 }} onClick={handleConfirmReject}>Xác nhận từ chối</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- TOPIC MODALS --- */}
            {
                topicFormOpen && (
                    <div className="teacher-modal-overlay">
                        <div className="teacher-modal wide" style={{ maxWidth: '500px', overflow: 'auto' }}>
                            <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                                <button type="button" className="teacher-modal-close" onClick={() => setTopicFormOpen(false)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <h2 className="admin-modal-title" style={{ justifyContent: 'flex-start', marginBottom: '24px', paddingRight: '40px' }}>
                                {isEditingTopic ? 'Sửa Chủ đề' : 'Thêm Chủ đề mới'}
                            </h2>
                            <form onSubmit={handleTopicFormSubmit}>
                                <div className="admin-form-group">
                                    <label>Tên chủ đề</label>
                                    <input type="text" className="admin-form-input" required value={topicFormData.name} onChange={e => setTopicFormData({ ...topicFormData, name: e.target.value })} placeholder="Ví dụ: Công nghệ thông tin" />
                                </div>
                                <div className="admin-form-group">
                                    <label>Mô tả ngắn</label>
                                    <textarea className="admin-form-input admin-form-textarea" required value={topicFormData.description} onChange={e => setTopicFormData({ ...topicFormData, description: e.target.value })} placeholder="Mô tả cho chủ đề này..." />
                                </div>
                                <div className="admin-form-row">
                                    <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                        <label>Biểu tượng (Emoji)</label>
                                        <input type="text" className="admin-form-input" required value={topicFormData.icon} onChange={e => setTopicFormData({ ...topicFormData, icon: e.target.value })} placeholder="Ví dụ: 💻" />
                                    </div>
                                    <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                        <label>Màu nền (Hex)</label>
                                        <input type="color" className="admin-form-input" style={{ padding: '4px', height: '42px' }} value={topicFormData.color} onChange={e => setTopicFormData({ ...topicFormData, color: e.target.value })} />
                                    </div>
                                </div>
                                <div className="admin-form-group">
                                    <label>Trạng thái hiển thị</label>
                                    <CustomDropdown
                                        value={topicFormData.status || 'active'}
                                        options={[
                                            { value: 'active', label: 'Đang hoạt động (Hiển thị đầy đủ)' },
                                            { value: 'coming_soon', label: 'Sắp ra mắt (Khóa học)' }
                                        ]}
                                        onChange={(val) => setTopicFormData({ ...topicFormData, status: val })}
                                    />
                                </div>
                                <div className="admin-form-group">
                                    <label>Folder (Phân loại)</label>
                                    <CustomDropdown
                                        value={topicFormData.folderId || ''}
                                        options={[
                                            { value: '', label: '-- Chưa phân loại --' },
                                            ...folders.map(f => ({ value: f.id, label: `📁 ${f.name}` }))
                                        ]}
                                        onChange={(val) => setTopicFormData({ ...topicFormData, folderId: val })}
                                    />
                                </div>
                                {!isEditingTopic && (
                                    <div className="admin-form-group">
                                        <label>ID Tùy chỉnh (Tùy chọn)</label>
                                        <input type="text" className="admin-form-input" value={topicFormData.id} onChange={e => setTopicFormData({ ...topicFormData, id: e.target.value })} placeholder="technology (tự động tạo nếu để trống)" />
                                        <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Sử dụng chữ thường, không dấu, ngăn cách bằng dấu gạch ngang.</p>
                                    </div>
                                )}

                                <div className="admin-modal-actions" style={{ marginTop: '32px', flexDirection: 'row' }}>
                                    <button type="button" className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setTopicFormOpen(false)}>Hủy</button>
                                    <button type="submit" className="admin-btn admin-btn-primary" style={{ flex: 1 }}>{isEditingTopic ? 'Cập nhật' : 'Thêm mới'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {
                topicToDelete && (
                    <div className="teacher-modal-overlay">
                        <div className="teacher-modal">
                            <h2 className="admin-modal-title" style={{ color: '#ef4444', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Trash2 size={24} /> Xác nhận xóa
                                </div>
                            </h2>
                            <p className="admin-modal-desc">
                                Bạn có chắc chắn muốn xóa chủ đề <strong>{topicToDelete.name}</strong>?<br /><br />
                                <strong>Lưu ý:</strong> Toàn bộ từ vựng bên trong cũng sẽ bị xóa vĩnh viễn và không thể khôi phục.
                            </p>
                            <div className="admin-modal-actions" style={{ flexDirection: 'row', marginTop: '24px' }}>
                                <button className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setTopicToDelete(null)}>Hủy</button>
                                <button className="admin-btn admin-btn-primary" style={{ backgroundColor: '#ef4444', flex: 1 }} onClick={handleConfirmDeleteTopic}>Xóa vĩnh viễn</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* --- FOLDER MODALS --- */}
            {
                folderFormOpen && (
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
                                    <input type="text" className="admin-form-input" required value={folderFormData.name} onChange={e => setFolderFormData({ ...folderFormData, name: e.target.value })} placeholder="Ví dụ: Giao tiếp văn phòng" />
                                </div>
                                <div className="admin-form-group">
                                    <label>Mô tả ngắn</label>
                                    <input type="text" className="admin-form-input" value={folderFormData.description} onChange={e => setFolderFormData({ ...folderFormData, description: e.target.value })} placeholder="Mô tả..." />
                                </div>

                                <div className="admin-form-group" style={{ marginTop: '16px' }}>
                                    <label style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>Chọn chủ đề thuộc Folder này</span>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--color-primary)', background: 'var(--color-primary-light)20', padding: '2px 8px', borderRadius: '12px' }}>
                                            Đã chọn {folderFormData.topicIds?.length || 0}
                                        </span>
                                    </label>
                                    <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', background: '#f8fafc' }}>
                                        {topics.length === 0 ? (
                                            <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
                                                Chưa có chủ đề nào để chọn.
                                            </div>
                                        ) : (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                                                {topics.map(topic => {
                                                    const isSelected = (folderFormData.topicIds || []).includes(topic.id);
                                                    return (
                                                        <div
                                                            key={topic.id}
                                                            onClick={() => toggleTopicInFolder(topic.id)}
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
                                                                <span style={{ fontSize: '1.2rem' }}>{topic.icon}</span>
                                                                <span style={{ fontSize: '0.9rem', fontWeight: isSelected ? 600 : 400, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{topic.name}</span>
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
                                    <button type="submit" className="admin-btn admin-btn-primary" style={{ flex: 1 }}>{isEditingFolder ? 'Cập nhật' : 'Thêm Folder'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {
                folderToDelete && (
                    <div className="teacher-modal-overlay">
                        <div className="teacher-modal">
                            <h2 className="admin-modal-title" style={{ color: '#ef4444', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Trash2 size={24} /> Xác nhận xóa
                                </div>
                            </h2>
                            <p className="admin-modal-desc">
                                Bạn có chắc chắn muốn xóa Folder <strong>{folderToDelete.name}</strong>?<br /><br />
                                <strong>Lưu ý:</strong> Các chủ đề bên trong sẽ không bị xóa, chỉ Folder bị xóa đi.
                            </p>
                            <div className="admin-modal-actions" style={{ flexDirection: 'row', marginTop: '24px' }}>
                                <button className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setFolderToDelete(null)}>Hủy</button>
                                <button className="admin-btn admin-btn-primary" style={{ backgroundColor: '#ef4444', flex: 1 }} onClick={handleConfirmDeleteFolder}>Xóa Folder</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                alertMessage && (
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
                )
            }

            {/* --- SHARE MODAL --- */}
            {
                shareModalOpen && resourceToShare && (
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
                                    Chia sẻ {resourceToShare.type === 'folder' ? 'Folder' : 'Chủ đề'}
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
                                        value={`${window.location.origin}/preview/superstudy?shareId=${resourceToShare.id}&shareType=${resourceToShare.type === 'folder' ? 'admin_folder' : 'admin_topic'}`}
                                        style={{ flex: '1 1 200px', minWidth: '0', padding: '8px 12px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none', backgroundColor: '#f1f5f9', color: '#475569' }}
                                    />
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(`${window.location.origin}/preview/superstudy?shareId=${resourceToShare.id}&shareType=${resourceToShare.type === 'folder' ? 'admin_folder' : 'admin_topic'}`);
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
                                        <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>{resourceToShare.isPublic ? 'Bất kỳ ai cũng có thể tìm và học bài này mà không cần đăng nhập.' : 'Cần cấp quyền bên dưới hoặc gửi Link trực tiếp.'}</p>
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
                            {resourceToShare.type !== 'folder' && (
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
                )
            }
        </div >
    );
}
