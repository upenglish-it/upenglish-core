�import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Link } from 'react-router-dom';
import { getAdminTopics, saveAdminTopic, deleteAdminTopic, getFolders, saveFolder, deleteFolder, getGroups, toggleResourcePublic, toggleTeacherVisible, getResourceSharedEntities, shareResourceToEmail, unshareResourceFromUser, shareResourceToGroup, unshareResourceFromGroup, getAdminTopicContentStatus, updateTopicFoldersOrder, getAdminTopicWordCounts, recalcTopicWordCount, transferOfficialToTeacher, shareResourceToTeacher, unshareResourceFromTeacher, getResourceSharedTeachers } from '../../services/adminService';
import { createAssignment, getAssignmentsForTopic } from '../../services/teacherService';
import { getPendingProposals, approveProposal, rejectProposal, findExistingOfficialCopy } from '../../services/contentProposalService';
import { duplicateAdminTopic } from '../../services/duplicateService';
import { useAuth } from '../../contexts/AuthContext';
import { BookOpen, Edit, Trash2, X, Plus, List, FolderOpen, GripVertical, Check, CheckCircle, Share2, Globe, Users, Mail, UserPlus, Lock, Search, AlertTriangle, ChevronDown, ChevronRight, Clock, Send, XCircle, Landmark, FileText, Filter, GraduationCap, Copy } from 'lucide-react';
import CustomSelect from '../../components/common/CustomSelect';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import EmailAutocomplete from '../../components/common/EmailAutocomplete';
import { findFolderIdForItem, reorderIdsByVisibleSubset, toggleIdInList, syncItemFolderAssignment } from '../../utils/folderManagement';
import '../../components/common/ShareModal.css';

function CustomDropdown({ value, options, onChange, placeholder = "Chọn m�"t mục" }) {
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
    const [publicFilter, setPublicFilter] = useState('all'); // 'all' | 'public' | 'private'

    // Topic States
    const [topicFormOpen, setTopicFormOpen] = useState(false);
    const [topicFormData, setTopicFormData] = useState({ id: '', name: '', description: '', icon: '', color: '#3b82f6', status: 'active' });
    const [isEditingTopic, setIsEditingTopic] = useState(false);
    const [topicToDelete, setTopicToDelete] = useState(null);
    const [topicToDuplicate, setTopicToDuplicate] = useState(null);
    const [isDuplicating, setIsDuplicating] = useState(false);
    const [isSavingTopic, setIsSavingTopic] = useState(false);

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

    // Teacher Share States
    const [teacherShareEmail, setTeacherShareEmail] = useState('');
    const [sharedTeachers, setSharedTeachers] = useState([]);
    const [isTeacherSharing, setIsTeacherSharing] = useState(false);

    // Share modal tab (mobile)
    const [adminShareTab, setAdminShareTab] = useState('internal');

    // Quick Assign States
    const [teacherManagedGroups, setTeacherManagedGroups] = useState([]);
    const [quickAssignGroupId, setQuickAssignGroupId] = useState('');
    const [quickAssignDueDate, setQuickAssignDueDate] = useState('');
    const [quickAssignScheduledStart, setQuickAssignScheduledStart] = useState('');
    const [isQuickAssigning, setIsQuickAssigning] = useState(false);
    const [quickAssignSuccess, setQuickAssignSuccess] = useState('');
    const [existingAssignments, setExistingAssignments] = useState([]);

    // Proposal States
    const [pendingProposals, setPendingProposals] = useState([]);
    const [proposalsLoading, setProposalsLoading] = useState(false);
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [proposalToReject, setProposalToReject] = useState(null);
    const [rejectNote, setRejectNote] = useState('');
    const [approveModalOpen, setApproveModalOpen] = useState(false);
    const [proposalToApprove, setProposalToApprove] = useState(null);
    const [existingOfficialCopy, setExistingOfficialCopy] = useState(null);
    const [isApproving, setIsApproving] = useState(false);

    // Transfer ownership state
    const [transferModalOpen, setTransferModalOpen] = useState(false);
    const [transferTarget, setTransferTarget] = useState(null);
    const [transferEmail, setTransferEmail] = useState('');
    const [isTransferring, setIsTransferring] = useState(false);

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
            const missingCountIds = [];
            topicsData.forEach(t => {
                if (t.cachedWordCount != null) {
                    counts[t.id] = t.cachedWordCount;
                } else {
                    counts[t.id] = 0;
                    missingCountIds.push(t.id);
                }
            });
            setTopicWordCounts(counts);

            // Lazy-fetch real counts for topics missing cachedWordCount (non-blocking)
            if (missingCountIds.length > 0) {
                getAdminTopicWordCounts(missingCountIds).then(realCounts => {
                    setTopicWordCounts(prev => ({ ...prev, ...realCounts }));
                    // Cache them back to Firestore so next load is instant
                    missingCountIds.forEach(id => recalcTopicWordCount(id, 'topics'));
                }).catch(err => console.error('Error fetching missing word counts:', err));
            }

            // Determine which topic IDs are inside public folders
            const publicFolderTopicIds = new Set();
            foldersData.forEach(folder => {
                if (folder.isPublic && folder.topicIds && Array.isArray(folder.topicIds)) {
                    folder.topicIds.forEach(id => publicFolderTopicIds.add(id));
                }
            });

            // Make topics implicitly public if they are in a public folder
            const topicsWithInheritedPublic = topicsData.map(t => {
                const normalizedTopic = { ...t, status: 'active' };
                if (publicFolderTopicIds.has(t.id)) {
                    // Only inherit public if not explicitly disabled
                    if (t.isPublic !== false) {
                        return { ...normalizedTopic, isPublic: true, isInPublicFolder: true };
                    }
                    return { ...normalizedTopic, isInPublicFolder: true };
                }
                return normalizedTopic;
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
        setTopicFormData({ ...topic, folderId: findFolderIdForItem(folders, topic.id, 'topicIds') });
        setIsEditingTopic(true);
        setTopicFormOpen(true);
    }

    async function handleTopicFormSubmit(e) {
        e.preventDefault();
        let finalTopicId;
        if (isEditingTopic) {
            // Khi �ang sửa, giữ nguyên ID g�c � không tạo ID m�:i
            finalTopicId = topicFormData.id;
        } else {
            finalTopicId = topicFormData.id.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
            if (!finalTopicId) {
                // Tự ��"ng tạo ID từ tên topic nếu �Ồ tr�ng
                const nameSlug = topicFormData.name.trim()
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/�/g, 'd')
                    .replace(/[^a-z0-9\s-]/g, '')
                    .trim()
                    .replace(/\s+/g, '-');
                if (!nameSlug) {
                    setAlertMessage({ type: 'error', text: "Vui lòng nhập tên chủ �ề hoặc ID tùy ch�0nh." });
                    return;
                }
                finalTopicId = nameSlug;
            }
        }
        try {
            const topicToSave = { ...topicFormData, status: 'active' };
            const targetFolderId = topicToSave.folderId;
            delete topicToSave.folderId; // Remove from topic doc itself if not wanted

            await saveAdminTopic(
                { ...topicToSave, id: finalTopicId },
                { isEditing: isEditingTopic }
            );

            await syncItemFolderAssignment({
                itemId: finalTopicId,
                targetFolderId,
                folders,
                itemIdsKey: 'topicIds',
                saveFolder
            });

            setTopicFormOpen(false);
            setAlertMessage({ type: 'success', text: isEditingTopic ? "Cập nhật chủ �ề thành công!" : "Thêm chủ �ề m�:i thành công!" });
            loadData();
        } catch (error) {
            setAlertMessage({ type: 'error', text: "L�i lưu chủ �ề: " + error.message });
        }
    }

    async function handleConfirmDeleteTopic() {
        if (!topicToDelete) return;
        try {
            await deleteAdminTopic(topicToDelete.id);
            setTopics(prev => prev.filter(t => t.id !== topicToDelete.id));
            setAlertMessage({ type: 'success', text: "Đã chuyỒn chủ �ề vào trạng thái �ã xóa." });
        } catch (error) {
            setAlertMessage({ type: 'error', text: "L�i xóa chủ �ề: " + error.message });
        }
        setTopicToDelete(null);
    }

    async function handleConfirmDuplicateTopic() {
        if (!topicToDuplicate || isDuplicating) return;
        setIsDuplicating(true);
        try {
            await duplicateAdminTopic(topicToDuplicate.id, user?.uid);
            setAlertMessage({ type: 'success', text: `Đã nhân �ôi chủ �ề "${topicToDuplicate.name}" thành công!` });
            loadData();
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'L�i nhân �ôi chủ �ề: ' + error.message });
        } finally {
            setIsDuplicating(false);
            setTopicToDuplicate(null);
        }
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
            setAlertMessage({ type: 'error', text: "Tên hoặc ID Folder không hợp l�!." });
            return;
        }

        try {
            await saveFolder({ ...folderFormData, id: finalFolderId });
            setFolderFormOpen(false);
            setAlertMessage({ type: 'success', text: isEditingFolder ? "Cập nhật folder thành công!" : "Thêm folder m�:i thành công!" });
            loadData();
        } catch (error) {
            setAlertMessage({ type: 'error', text: "L�i lưu folder: " + error.message });
        }
    }

    async function handleConfirmDeleteFolder() {
        if (!folderToDelete) return;
        try {
            await deleteFolder(folderToDelete.id);
            setFolders(prev => prev.filter(f => f.id !== folderToDelete.id));
            setAlertMessage({ type: 'success', text: "Đã xóa folder thành công!" });
        } catch (error) {
            setAlertMessage({ type: 'error', text: "L�i xóa folder: " + error.message });
        }
        setFolderToDelete(null);
    }

    function toggleTopicInFolder(topicId) {
        setFolderFormData(prev => ({ ...prev, topicIds: toggleIdInList(prev.topicIds, topicId) }));
    }

    async function handleFolderDragEnd(result) {
        const { source, destination, type } = result;
        if (!destination) return;
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        if (type === 'topic') {
            const folderId = source.droppableId.replace('folder-topics-', '');
            const folder = folders.find(f => f.id === folderId);
            if (!folder) return;
            const ids = reorderIdsByVisibleSubset({
                allIds: folder.topicIds || [],
                sourceIndex: source.index,
                destinationIndex: destination.index,
                searchTerm,
                getItem: id => topics.find(topic => topic.id === id),
                matchesSearch: (topic, term) =>
                    (topic.name || '').toLowerCase().includes(term) ||
                    (topic.description || '').toLowerCase().includes(term)
            });
            setFolders(prev => prev.map(f => f.id === folderId ? { ...f, topicIds: ids } : f));
            try { await saveFolder({ ...folder, topicIds: ids }); } catch (error) {
                setAlertMessage({ type: 'error', text: 'L�i sắp xếp topic: ' + error.message });
                loadData();
            }
            return;
        }

        // Default: folder reorder
        const reordered = Array.from(folders);
        const [moved] = reordered.splice(source.index, 1);
        reordered.splice(destination.index, 0, moved);
        setFolders(reordered);
        try {
            await updateTopicFoldersOrder(reordered);
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'L�i sắp xếp folder: ' + error.message });
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
        setTeacherShareEmail('');
        setSharedTeachers([]);
        try {
            const [entities, groupsData, assignments, teachers] = await Promise.all([
                getResourceSharedEntities(type, resource.id),
                getGroups(),
                type !== 'folder' ? getAssignmentsForTopic(resource.id) : Promise.resolve([]),
                getResourceSharedTeachers(type, resource.id)
            ]);
            setShareUsers(entities.users);
            setShareGroups(entities.groups.map(g => g.id));
            setAllGroups(groupsData);
            setTeacherManagedGroups(groupsData);
            setExistingAssignments(assignments);
            setSharedTeachers(teachers);
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'L�i tải thông tin chia sẻ: ' + err.message });
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
            setQuickAssignSuccess(`Đã giao thành công cho l�:p ${selectedGroup?.name}!`);
            setQuickAssignGroupId('');
            setQuickAssignDueDate('');
            setQuickAssignScheduledStart('');
            const updated = await getAssignmentsForTopic(resourceToShare.id);
            setExistingAssignments(updated);
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'L�i giao bài: ' + err.message });
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
            setAlertMessage({ type: 'error', text: 'L�i cập nhật public: ' + err.message });
        }
        setIsSharing(false);
    }

    async function handleToggleTeacherVisible(resource, type) {
        const newStatus = !resource.teacherVisible;
        setIsTeacherSharing(true);
        try {
            await toggleTeacherVisible(type, resource.id, newStatus);
            setResourceToShare(prev => prev ? { ...prev, teacherVisible: newStatus } : prev);
            setAlertMessage({ type: 'success', text: newStatus ? 'Đã bật cho GV sử dụng!' : 'Đã tắt quyền GV sử dụng.' });
            loadData();
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'L�i cập nhật: ' + err.message });
        }
        setIsTeacherSharing(false);
    }

    async function handleAddTeacherShare(emailOrEvent) {
        const email = typeof emailOrEvent === 'string' ? emailOrEvent : teacherShareEmail;
        if (!email || !email.trim() || !resourceToShare) return;
        setIsTeacherSharing(true);
        try {
            const teacher = await shareResourceToTeacher(resourceToShare.type, resourceToShare.id, email);
            if (!sharedTeachers.some(t => t.uid === teacher.uid)) {
                setSharedTeachers(prev => [...prev, teacher]);
            }
            setTeacherShareEmail('');
            setAlertMessage({ type: 'success', text: `Đã chia sẻ cho GV ${teacher.displayName || email}` });
        } catch (err) {
            setAlertMessage({ type: 'error', text: err.message });
        }
        setIsTeacherSharing(false);
    }

    async function handleRemoveTeacherShare(teacherUid) {
        if (!resourceToShare) return;
        setIsTeacherSharing(true);
        try {
            await unshareResourceFromTeacher(resourceToShare.type, resourceToShare.id, teacherUid);
            setSharedTeachers(prev => prev.filter(t => t.uid !== teacherUid));
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'L�i gỡ quyền: ' + err.message });
        }
        setIsTeacherSharing(false);
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
            setAlertMessage({ type: 'error', text: 'L�i xóa quyền: ' + err.message });
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
            setAlertMessage({ type: 'error', text: 'L�i chia sẻ nhóm: ' + err.message });
        }
        setIsSharing(false);
    }

    // --- PROPOSAL HANDLERS ---
    async function loadProposals() {
        setProposalsLoading(true);
        try {
            const proposals = await getPendingProposals('vocab');
            // Check each proposal if it's new or update
            const enriched = await Promise.all(proposals.map(async (p) => {
                try {
                    const sourceId = p.level === 'folder' ? p.sourceFolderId : p.sourceId;
                    const existing = await findExistingOfficialCopy(sourceId, p.type, p.level || 'item');
                    return { ...p, isUpdate: !!existing };
                } catch { return { ...p, isUpdate: false }; }
            }));
            setPendingProposals(enriched);
        } catch (err) {
            console.error('Error loading proposals:', err);
        }
        setProposalsLoading(false);
    }

    async function handleApproveProposal(proposal) {
        try {
            const sourceId = proposal.level === 'folder' ? proposal.sourceFolderId : proposal.sourceId;
            const existing = await findExistingOfficialCopy(sourceId, proposal.type, proposal.level || 'item');
            if (existing) {
                setProposalToApprove(proposal);
                setExistingOfficialCopy(existing);
                setApproveModalOpen(true);
            } else {
                setIsApproving(true);
                await approveProposal(proposal.id, 'admin', 'create_new');
                setAlertMessage({ type: 'success', text: 'Đã duy�!t và tạo bài học chính thức thành công!' });
                loadProposals();
                loadData();
                setIsApproving(false);
            }
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'L�i duy�!t: ' + err.message });
            setIsApproving(false);
        }
    }

    async function handleConfirmApprove(mode) {
        if (!proposalToApprove) return;
        setIsApproving(true);
        try {
            await approveProposal(proposalToApprove.id, 'admin', mode);
            setAlertMessage({ type: 'success', text: mode === 'overwrite' ? 'Đã duy�!t và cập nhật bản chính thức cũ!' : 'Đã duy�!t và tạo bản chính thức m�:i!' });
            setApproveModalOpen(false);
            setProposalToApprove(null);
            setExistingOfficialCopy(null);
            loadProposals();
            loadData();
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'L�i duy�!t: ' + err.message });
        }
        setIsApproving(false);
    }

    // --- TRANSFER OWNERSHIP HANDLER ---
    function openTransferModal(item, collectionName) {
        setTransferTarget({ ...item, collectionName });
        setTransferEmail('');
        setTransferModalOpen(true);
    }

    async function handleConfirmTransfer(overrideEmail, overrideCollectionName, overrideId, overrideName) {
        const email = overrideEmail || transferEmail;
        const collName = overrideCollectionName || (transferTarget && transferTarget.collectionName);
        const itemId = overrideId || (transferTarget && transferTarget.id);
        const itemName = overrideName || (transferTarget && (transferTarget.name || transferTarget.title));
        if (!collName || !itemId || !email.trim()) return;
        setIsTransferring(true);
        try {
            const result = await transferOfficialToTeacher(collName, itemId, email.trim());
            setAlertMessage({ type: 'success', text: `Đã chuyỒn quyền "${itemName}" cho ${result.teacherName}!` });
            setTransferModalOpen(false);
            setTransferTarget(null);
            setShareModalOpen(false);
            loadData();
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'L�i chuyỒn quyền: ' + err.message });
        }
        setIsTransferring(false);
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
            setAlertMessage({ type: 'success', text: 'Đã từ ch�i �ề xuất.' });
            setRejectModalOpen(false);
            setProposalToReject(null);
            loadProposals();
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'L�i từ ch�i: ' + err.message });
        }
    }

    const filteredTopics = topics.filter(t => {
        const matchesSearch = (t.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.id || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesPublic = publicFilter === 'all' ? true
            : publicFilter === 'public' ? !!t.isPublic
            : !t.isPublic;
        return matchesSearch && matchesPublic;
    });

    const filteredFolders = folders.filter(f => {
        const matchesSearch = (f.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (f.id || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesPublic = publicFilter === 'all' ? true
            : publicFilter === 'public' ? !!f.isPublic
            : !f.isPublic;
        const hasMatchingTopic = (f.topicIds || []).some(tid =>
            filteredTopics.some(t => t.id === tid)
        );
        return (matchesSearch && matchesPublic) || hasMatchingTopic;
    });

    const unassignedTopicsCount = topics.length; // Can be detailed later if needed

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <h1 className="admin-page-title">Bài học vocab chính thức</h1>
                <p className="admin-page-subtitle">Quản lý các b�" từ vựng chính thức trên h�! th�ng.</p>
                <div className="admin-header-actions" style={{ display: 'flex', gap: '12px' }}>
                    <button className="admin-btn admin-btn-outline" onClick={openAddFolderForm}><FolderOpen size={16} /> Thêm Folder</button>
                    <button className="admin-btn admin-btn-primary" onClick={openAddTopicForm}><Plus size={16} /> Thêm Topic m�:i</button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="admin-search-box" style={{ flex: 1, minWidth: '200px' }}>
                    <Search size={16} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Tìm tên hoặc ID chủ �ề, folder..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="admin-public-filter">
                    <button className={`admin-filter-btn${publicFilter === 'all' ? ' active' : ''}`} onClick={() => setPublicFilter('all')}>
                        <Filter size={14} /> Tất cả
                    </button>
                    <button className={`admin-filter-btn public${publicFilter === 'public' ? ' active' : ''}`} onClick={() => setPublicFilter('public')}>
                        <Globe size={14} /> Public
                    </button>
                    <button className={`admin-filter-btn private${publicFilter === 'private' ? ' active' : ''}`} onClick={() => setPublicFilter('private')}>
                        <Lock size={14} /> Chưa public
                    </button>
                </div>
            </div>

            <div className="admin-card">
                {loading ? (
                    <div className="admin-empty-state">Đang tải dữ li�!u...</div>
                ) : (
                    <div className="admin-table-container">
                        <DragDropContext onDragEnd={handleFolderDragEnd}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px' }}></th>
                                        <th>Tên mục</th>
                                        <th>Thông tin</th>
                                        <th style={{ textAlign: 'center' }}>Trạng thái</th>
                                        <th className="text-right">Hành ��"ng</th>
                                    </tr>
                                </thead>
                                <Droppable droppableId="topic-folders">
                                    {(provided) => (
                                        <tbody ref={provided.innerRef} {...provided.droppableProps}>
                                            {filteredFolders.map((folder, fIndex) => {
                                                const isExpanded = expandedFolders.has(folder.id) || searchTerm.length > 0;
                                                // Preserve topicIds array order for drag-and-drop
                                                const folderTopicIds = folder.topicIds || [];
                                                const folderTopics = folderTopicIds
                                                    .map(tid => filteredTopics.find(t => t.id === tid))
                                                    .filter(Boolean);

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
                                                                            <div className="admin-topic-icon" style={{ background: '#fef9c3', width: '32px', height: '32px', fontSize: '0.9rem' }}>�x�</div>
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
                                                                                    {folder.teacherVisible && !folder.isPublic && (
                                                                                        <span style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '4px', background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                                                            <GraduationCap size={10} /> GV
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
                                                                        Folder này chưa có chủ �ề nào.
                                                                    </td>
                                                                </tr>
                                                            ) : (
                                                                <Droppable droppableId={`folder-topics-${folder.id}`} type="topic">
                                                                    {(topicDropProvided) => (
                                                                        <>
                                                                        {folderTopics.map((topic, tIdx) => (
                                                                            <Draggable key={topic.id} draggableId={`topic-${topic.id}`} index={tIdx}>
                                                                                {(topicDragProv, topicSnapshot) => (
                                                                    <tr
                                                                        ref={(node) => { topicDragProv.innerRef(node); if (tIdx === 0) topicDropProvided.innerRef(node); }}
                                                                        {...topicDragProv.draggableProps}
                                                                        {...(tIdx === 0 ? topicDropProvided.droppableProps : {})}
                                                                        className="table-row-nested"
                                                                        style={{
                                                                            ...topicDragProv.draggableProps.style,
                                                                            backgroundColor: topicSnapshot.isDragging ? '#f0f9ff' : undefined,
                                                                            boxShadow: topicSnapshot.isDragging ? '0 4px 12px rgba(0,0,0,0.08)' : undefined
                                                                        }}
                                                                    >
                                                                        <td>
                                                                            <div {...topicDragProv.dragHandleProps} style={{ cursor: 'grab', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                                <GripVertical size={14} />
                                                                            </div>
                                                                        </td>
                                                                        <td data-label="Tên mục">
                                                                            <div className="admin-topic-cell">
                                                                                <div className="admin-topic-icon" style={{ background: `${topic.color}20`, width: '32px', height: '32px', fontSize: '0.9rem' }}>{topic.icon}</div>
                                                                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '10px' }}>
                                                                                        <div className="admin-topic-name" style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                            {topicContentStatus[topic.id]?.isComplete
                                                                                                ? <CheckCircle size={14} style={{ color: '#16a34a', flexShrink: 0 }} title="Đã có n�"i dung học �ầy �ủ" />
                                                                                                : topicContentStatus[topic.id]?.total > 0
                                                                                                    ? <AlertTriangle size={14} style={{ color: '#d97706', flexShrink: 0 }} title={`${topicContentStatus[topic.id]?.complete}/${topicContentStatus[topic.id]?.total} từ có n�"i dung`} />
                                                                                                    : null
                                                                                            }
                                                                                            {topic.name}
                                                                                        </div>
                                                                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                                                            {topic.isPublic && (
                                                                                                <span style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '4px', background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0', whiteSpace: 'nowrap' }}>Public</span>
                                                                                            )}
                                                                                            {topic.teacherVisible && !topic.isPublic && (
                                                                                                <span style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '4px', background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><GraduationCap size={9} /> GV</span>
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
                                                                            <div style={{ display: 'flex', gap: '6px', flexDirection: 'column', alignItems: 'center' }}>
                                                                                <span className={`admin-status-badge ${topic.status === 'coming_soon' ? 'coming-soon' : 'active'}`} style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                                                                                    {topic.status === 'coming_soon' ? 'Sắp ra mắt' : 'Đang hoạt ��"ng'}
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
                                                                                <button className="admin-action-btn" onClick={() => setTopicToDuplicate(topic)} title="Nhân �ôi"><Copy size={14} /></button>
                                                                                 <button className="admin-action-btn danger" onClick={() => setTopicToDelete(topic)}><Trash2 size={14} /></button>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                                )}
                                                                            </Draggable>
                                                                        ))}
                                                                        {topicDropProvided.placeholder}
                                                                        </>
                                                                    )}
                                                                </Droppable>
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
                                                            Chủ �ề chưa phân loại ({unassignedTopics.length})
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
                                                                            ? <CheckCircle size={14} style={{ color: '#16a34a', flexShrink: 0 }} title="Đã có n�"i dung học �ầy �ủ" />
                                                                            : topicContentStatus[topic.id]?.total > 0
                                                                                ? <AlertTriangle size={14} style={{ color: '#d97706', flexShrink: 0 }} title={`${topicContentStatus[topic.id]?.complete}/${topicContentStatus[topic.id]?.total} từ có n�"i dung`} />
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
                                                            <div style={{ display: 'flex', gap: '6px', flexDirection: 'column', alignItems: 'center' }}>
                                                                <span className={`admin-status-badge ${topic.status === 'coming_soon' ? 'coming-soon' : 'active'}`}>
                                                                    {topic.status === 'coming_soon' ? 'Sắp ra mắt' : 'Đang hoạt ��"ng'}
                                                                </span>
                                                                {topic.isPublic && (
                                                                    <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0' }}>Public</span>
                                                                )}
                                                                {topic.teacherVisible && !topic.isPublic && (
                                                                    <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><GraduationCap size={10} /> GV</span>
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
                                                                <button className="admin-action-btn" onClick={() => setTopicToDuplicate(topic)} title="Nhân �ôi"><Copy size={16} /></button>
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
                            Đề xuất chờ duy�!t
                            <span style={{ background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                                {pendingProposals.length}
                            </span>
                        </h2>
                    </div>
                    <div className="admin-table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>N�"i dung �ề xuất</th>
                                    <th>Giáo viên</th>
                                    <th>Loại</th>
                                    <th className="text-right">Hành ��"ng</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingProposals.map(proposal => (
                                    <tr key={proposal.id}>
                                        <td data-label="N�"i dung">
                                            <div className="admin-topic-cell">
                                                <div className="admin-topic-icon" style={{ background: `${proposal.color || '#6366f1'}20` }}>
                                                    {proposal.icon || '�xa'}
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
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                                <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: '#e0e7ff', color: '#4f46e5', fontWeight: 600 }}>
                                                    {proposal.level === 'folder' ? 'Folder' : 'Bài lẻ'}
                                                </span>
                                                <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: proposal.isUpdate ? '#fff7ed' : '#ecfdf5', color: proposal.isUpdate ? '#c2410c' : '#059669', fontWeight: 600, border: `1px solid ${proposal.isUpdate ? '#fed7aa' : '#a7f3d0'}` }}>
                                                    {proposal.isUpdate ? '�x Cập nhật' : '�x " Tài li�!u m�:i'}
                                                </span>
                                            </div>
                                        </td>
                                        <td data-label="Hành ��"ng" className="text-right">
                                            <div className="admin-table-actions">
                                                <button
                                                    className="admin-action-btn"
                                                    style={{ color: '#10b981' }}
                                                    onClick={() => handleApproveProposal(proposal)}
                                                    disabled={isApproving}
                                                    title="Duy�!t"
                                                >
                                                    <CheckCircle size={16} />
                                                </button>
                                                <button
                                                    className="admin-action-btn danger"
                                                    onClick={() => openRejectModal(proposal)}
                                                    title="Từ ch�i"
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
                                <XCircle size={24} /> Từ ch�i �ề xuất
                            </div>
                        </h2>
                        <p className="admin-modal-desc">
                            Từ ch�i �ề xuất <strong>{proposalToReject.proposalName}</strong> của giáo viên <strong>{proposalToReject.teacherName}</strong>?
                        </p>
                        <div className="admin-form-group">
                            <label>Lý do từ ch�i (tuỳ chọn)</label>
                            <textarea
                                className="admin-form-input admin-form-textarea"
                                value={rejectNote}
                                onChange={e => setRejectNote(e.target.value)}
                                placeholder="Nhập lý do �Ồ giáo viên biết..."
                                rows={3}
                            />
                        </div>
                        <div className="admin-modal-actions" style={{ flexDirection: 'row' }}>
                            <button className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setRejectModalOpen(false)}>Hủy</button>
                            <button className="admin-btn admin-btn-primary" style={{ backgroundColor: '#ef4444', flex: 1 }} onClick={handleConfirmReject}>Xác nhận từ ch�i</button>
                        </div>
                    </div>
                </div>
            )}

            {/* APPROVE MODE MODAL */}
            {approveModalOpen && proposalToApprove && existingOfficialCopy && (
                <div className="admin-modal-overlay">
                    <div className="admin-modal" style={{ maxWidth: '480px' }}>
                        <h2 className="admin-modal-title" style={{ color: '#f59e0b' }}>�a�️ Đã có bản chính thức</h2>
                        <p className="admin-modal-desc" style={{ marginBottom: '8px' }}>
                            N�"i dung <strong>"{proposalToApprove.proposalName}"</strong> �ã có bản chính thức trư�:c �ó:
                        </p>
                        <div style={{
                            background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px',
                            padding: '12px', marginBottom: '16px', fontSize: '0.85rem', color: '#9a3412'
                        }}>
                            �x <strong>{existingOfficialCopy.name}</strong>
                            <div style={{ fontSize: '0.75rem', color: '#c2410c', marginTop: '4px' }}>
                                ID: {existingOfficialCopy.id}
                            </div>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '20px' }}>
                            Bạn mu�n <strong>cập nhật bản cũ</strong> hay <strong>tạo bản m�:i</strong>?
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button
                                className="admin-btn admin-btn-primary"
                                style={{ backgroundColor: '#f59e0b', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                onClick={() => handleConfirmApprove('overwrite')}
                                disabled={isApproving}
                            >
                                �x Cập nhật bản cũ (�è lên)
                            </button>
                            <button
                                className="admin-btn admin-btn-primary"
                                style={{ backgroundColor: '#10b981', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                onClick={() => handleConfirmApprove('create_new')}
                                disabled={isApproving}
                            >
                                �~" Tạo bản chính thức m�:i
                            </button>
                            <button
                                className="admin-btn admin-btn-secondary"
                                style={{ width: '100%' }}
                                onClick={() => { setApproveModalOpen(false); setProposalToApprove(null); setExistingOfficialCopy(null); }}
                                disabled={isApproving}
                            >
                                Hủy
                            </button>
                        </div>
                    </div>
                </div>
            )}



            {topicFormOpen && (
                    <div className="teacher-modal-overlay">
                        <div className="teacher-modal wide" style={{ maxWidth: '500px', overflow: 'auto' }}>
                            <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                                <button type="button" className="teacher-modal-close" onClick={() => setTopicFormOpen(false)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <h2 className="admin-modal-title" style={{ justifyContent: 'flex-start', marginBottom: '24px', paddingRight: '40px' }}>
                                {isEditingTopic ? 'Sửa Chủ �ề' : 'Thêm Chủ �ề m�:i'}
                            </h2>
                            <form onSubmit={handleTopicFormSubmit}>
                                <div className="admin-form-group">
                                    <label>Tên chủ �ề</label>
                                    <input type="text" className="admin-form-input" required value={topicFormData.name} onChange={e => setTopicFormData({ ...topicFormData, name: e.target.value })} placeholder="Ví dụ: Công ngh�! thông tin" />
                                </div>
                                <div className="admin-form-group">
                                    <label>Mô tả ngắn</label>
                                    <textarea className="admin-form-input admin-form-textarea" required value={topicFormData.description} onChange={e => setTopicFormData({ ...topicFormData, description: e.target.value })} placeholder="Mô tả cho chủ �ề này..." />
                                </div>
                                <div className="admin-form-row">
                                    <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                        <label>BiỒu tượng (Emoji)</label>
                                        <input type="text" className="admin-form-input" required value={topicFormData.icon} onChange={e => setTopicFormData({ ...topicFormData, icon: e.target.value })} placeholder="Ví dụ: �x�" />
                                    </div>
                                    <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                        <label>Màu nền (Hex)</label>
                                        <input type="color" className="admin-form-input" style={{ padding: '4px', height: '42px' }} value={topicFormData.color} onChange={e => setTopicFormData({ ...topicFormData, color: e.target.value })} />
                                    </div>
                                </div>
                                <div className="admin-form-group">
                                    <label>Folder (Phân loại)</label>
                                    <CustomDropdown
                                        value={topicFormData.folderId || ''}
                                        options={[
                                            { value: '', label: '-- Chưa phân loại --' },
                                            ...folders.map(f => ({ value: f.id, label: `�x� ${f.name}` }))
                                        ]}
                                        onChange={(val) => setTopicFormData({ ...topicFormData, folderId: val })}
                                    />
                                </div>
                                {!isEditingTopic && (
                                    <div className="admin-form-group">
                                        <label>ID Tùy ch�0nh (Tùy chọn)</label>
                                        <input type="text" className="admin-form-input" value={topicFormData.id} onChange={e => setTopicFormData({ ...topicFormData, id: e.target.value })} placeholder="technology (tự ��"ng tạo nếu �Ồ tr�ng)" />
                                        <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Sử dụng chữ thường, không dấu, ngĒn cách bằng dấu gạch ngang.</p>
                                    </div>
                                )}

                                <div className="admin-modal-actions" style={{ marginTop: '32px', flexDirection: 'row' }}>
                                    <button type="button" className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setTopicFormOpen(false)}>Hủy</button>
                                    <button type="submit" className="admin-btn admin-btn-primary" style={{ flex: 1 }}>{isEditingTopic ? 'Cập nhật' : 'Thêm m�:i'}</button>
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
                                Bạn có chắc chắn mu�n xóa chủ �ề <strong>{topicToDelete.name}</strong>?<br /><br />
                                <strong>Lưu ý:</strong> Chủ �ề sẽ �ược soft delete gi�ng grammar/exams. Dữ li�!u từ vựng bên trong chưa b�9 xóa vĩnh vi�&n.
                            </p>
                            <div className="admin-modal-actions" style={{ flexDirection: 'row', marginTop: '24px' }}>
                                <button className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setTopicToDelete(null)}>Hủy</button>
                                <button className="admin-btn admin-btn-primary" style={{ backgroundColor: '#ef4444', flex: 1 }} onClick={handleConfirmDeleteTopic}>ChuyỒn vào �ã xóa</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* DUPLICATE TOPIC MODAL */}
            {
                topicToDuplicate && (
                    <div className="teacher-modal-overlay" style={{ zIndex: 2000 }}>
                        <div className="teacher-modal">
                            <h2 className="admin-modal-title" style={{ color: '#6366f1', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Copy size={24} /> Nhân �ôi chủ �ề
                                </div>
                            </h2>
                            <p className="admin-modal-desc">
                                Bạn có chắc chắn mu�n nhân �ôi chủ �ề <strong>{topicToDuplicate.name}</strong>?<br /><br />
                                M�"t bản sao m�:i sẽ �ược tạo v�:i toàn b�" từ vựng bên trong.
                            </p>
                            <div className="admin-modal-actions" style={{ flexDirection: 'row', marginTop: '24px' }}>
                                <button className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setTopicToDuplicate(null)} disabled={isDuplicating}>Hủy</button>
                                <button className="admin-btn admin-btn-primary" style={{ background: '#6366f1', flex: 1 }} onClick={handleConfirmDuplicateTopic} disabled={isDuplicating}>
                                    {isDuplicating ? 'Đang nhân �ôi...' : 'Nhân �ôi'}
                                </button>
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
                                {isEditingFolder ? 'Sửa Folder' : 'Thêm Folder m�:i'}
                            </h2>
                            <form onSubmit={handleFolderFormSubmit}>
                                <div className="admin-form-group">
                                    <label>Tên Folder</label>
                                    <input type="text" className="admin-form-input" required value={folderFormData.name} onChange={e => setFolderFormData({ ...folderFormData, name: e.target.value })} placeholder="Ví dụ: Giao tiếp vĒn phòng" />
                                </div>
                                <div className="admin-form-group">
                                    <label>Mô tả ngắn</label>
                                    <input type="text" className="admin-form-input" value={folderFormData.description} onChange={e => setFolderFormData({ ...folderFormData, description: e.target.value })} placeholder="Mô tả..." />
                                </div>

                                <div className="admin-form-group" style={{ marginTop: '16px' }}>
                                    <label style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>Chọn chủ �ề thu�"c Folder này</span>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--color-primary)', background: 'var(--color-primary-light)20', padding: '2px 8px', borderRadius: '12px' }}>
                                            Đã chọn {folderFormData.topicIds?.length || 0}
                                        </span>
                                    </label>
                                    <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', background: '#f8fafc' }}>
                                        {topics.length === 0 ? (
                                            <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
                                                Chưa có chủ �ề nào �Ồ chọn.
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
                                Bạn có chắc chắn mu�n xóa Folder <strong>{folderToDelete.name}</strong>?<br /><br />
                                <strong>Lưu ý:</strong> Các chủ �ề bên trong sẽ không b�9 xóa, ch�0 Folder b�9 xóa �i.
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
                    <div className="teacher-modal-overlay" style={{ zIndex: 3000 }}>
                        <div className="teacher-modal">
                            <h2 className="admin-modal-title">
                                {alertMessage.type === 'success' ? <span style={{ color: '#10b981' }}>Thành công</span> : <span style={{ color: '#ef4444' }}>Đã có l�i</span>}
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
                        <div className="teacher-modal wide" style={{ maxWidth: '960px', overflow: 'auto' }}>
                            <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                                <button type="button" className="teacher-modal-close" onClick={() => setShareModalOpen(false)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <h2 className="admin-modal-title" style={{ justifyContent: 'flex-start', marginBottom: '24px', paddingRight: '40px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Share2 size={24} color="var(--color-primary)" />
                                    Chia sẻ {resourceToShare.type === 'folder' ? 'Folder' : 'Chủ �ề'}
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

                            {/* Mobile tabs */}
                            <div className="share-modal-tabs">
                                <button className={`share-modal-tab tab-internal ${adminShareTab === 'internal' ? 'active' : ''}`} onClick={() => setAdminShareTab('internal')}>
                                    <Lock size={16} /> N�"i b�" (GV)
                                </button>
                                <button className={`share-modal-tab tab-student ${adminShareTab === 'student' ? 'active' : ''}`} onClick={() => setAdminShareTab('student')}>
                                    <GraduationCap size={16} /> Học viên
                                </button>
                            </div>

                            {/* Two columns */}
                            <div className="share-modal-columns">
                                {/* ������ LEFT COLUMN: N�"i b�" ������ */}
                                <div className={`share-modal-col ${adminShareTab === 'internal' ? 'active' : ''}`}>
                                    <div className="share-modal-col-header teacher">
                                        <Lock size={18} /> N�"i b�" (Giáo viên)
                                    </div>

                                    {/* Public Toggle */}
                                    <div className="share-modal-section">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                            <Globe size={18} color="#3b82f6" />
                                            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155', margin: 0 }}>Quyền truy cập chung</h4>
                                        </div>
                                        <div className="admin-share-public-toggle" style={{ background: resourceToShare.isPublic ? '#ecfdf5' : '#fff', border: `1px solid ${resourceToShare.isPublic ? '#10b981' : '#e2e8f0'}` }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: resourceToShare.isPublic ? '#10b981' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: resourceToShare.isPublic ? '#fff' : '#64748b' }}>
                                                    {resourceToShare.isPublic ? <Globe size={20} /> : <Lock size={20} />}
                                                </div>
                                                <div>
                                                    <h4 style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1e293b', margin: '0 0 4px 0' }}>{resourceToShare.isPublic ? 'Đang Công khai' : 'Hạn chế'}</h4>
                                                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>{resourceToShare.isPublic ? 'Bất kỳ ai cũng có thỒ tìm và học bài này mà không cần �Ēng nhập.' : 'Cần cấp quyền bên dư�:i hoặc gửi Link trực tiếp.'}</p>
                                                </div>
                                            </div>
                                            <button onClick={handleTogglePublic} disabled={isSharing} style={{ padding: '8px 16px', background: resourceToShare.isPublic ? 'transparent' : 'var(--color-primary)', color: resourceToShare.isPublic ? '#ef4444' : '#fff', border: resourceToShare.isPublic ? '1px solid #ef4444' : 'none', borderRadius: '6px', cursor: isSharing ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                                                {resourceToShare.isPublic ? 'Tắt Public' : 'Bật Public'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Teacher Sharing */}
                                    <div className="share-modal-section">
                                        <h4><GraduationCap size={16} color="#8b5cf6" /> Dành cho Giáo viên</h4>
                                        <div style={{ padding: '16px', background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a', marginBottom: '2px' }}>Cho tất cả GV sử dụng</div>
                                                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{resourceToShare.teacherVisible ? 'Tất cả GV �ều thấy và giao bài �ược.' : 'Ch�0 GV �ược ch�0 ��9nh bên dư�:i m�:i thấy.'}</div>
                                                </div>
                                                <button onClick={() => handleToggleTeacherVisible(resourceToShare, resourceToShare.type)} disabled={isTeacherSharing} style={{ position: 'relative', flexShrink: 0, width: '40px', height: '24px', borderRadius: '12px', background: resourceToShare.teacherVisible ? '#3b82f6' : '#cbd5e1', border: 'none', cursor: 'pointer', transition: 'background 0.3s' }}>
                                                    <div style={{ position: 'absolute', top: '2px', left: resourceToShare.teacherVisible ? '18px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}></div>
                                                </button>
                                            </div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><UserPlus size={14} /> Chia sẻ cho GV cụ thỒ</div>
                                            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                                <EmailAutocomplete value={teacherShareEmail} onChange={setTeacherShareEmail} onSelect={(email) => handleAddTeacherShare(email)} placeholder="Email giáo viên..." roleFilter="teacher" />
                                                <button onClick={() => handleAddTeacherShare(teacherShareEmail)} disabled={isTeacherSharing || !teacherShareEmail} style={{ flexShrink: 0, padding: '8px 12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: isTeacherSharing ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Thêm</button>
                                            </div>
                                            {sharedTeachers.length > 0 && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    {sharedTeachers.map(t => (
                                                        <div key={t.uid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>{(t.displayName || t.email || 'G').charAt(0).toUpperCase()}</div>
                                                                <div>
                                                                    <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#0f172a' }}>{t.displayName || 'Giáo viên'}</div>
                                                                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{t.email}</div>
                                                                </div>
                                                            </div>
                                                            <button onClick={() => handleRemoveTeacherShare(t.uid)} disabled={isTeacherSharing} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }} title="Gỡ quyền"><X size={14} /></button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {/* Transfer Ownership */}
                                            <div style={{ marginTop: '16px', padding: '14px', background: '#faf5ff', borderRadius: '10px', border: '1px dashed #c4b5fd' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                                    <span style={{ fontSize: '1rem' }}>�x</span>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#6d28d9' }}>ChuyỒn quyền s�x hữu</span>
                                                </div>
                                                <p style={{ fontSize: '0.75rem', color: '#7c3aed', margin: '0 0 8px 0' }}>N�"i dung sẽ mất tag "Chính thức" và thu�"c về giáo viên.</p>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <EmailAutocomplete value={transferEmail} onChange={setTransferEmail} onSelect={(email) => { const collName = resourceToShare.type === 'folder' ? 'topic_folders' : 'topics'; handleConfirmTransfer(email, collName, resourceToShare.id, resourceToShare.name || resourceToShare.title); }} placeholder="Email giáo viên nhận..." roleFilter="teacher" />
                                                    <button onClick={() => { const collName = resourceToShare.type === 'folder' ? 'topic_folders' : 'topics'; handleConfirmTransfer(transferEmail, collName, resourceToShare.id, resourceToShare.name || resourceToShare.title); }} disabled={isTransferring || !transferEmail.trim()} style={{ flexShrink: 0, padding: '8px 14px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '6px', cursor: (isTransferring || !transferEmail.trim()) ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.82rem', opacity: (isTransferring || !transferEmail.trim()) ? 0.5 : 1 }}>
                                                        {isTransferring ? 'Đang chuyỒn...' : 'ChuyỒn'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* ������ RIGHT COLUMN: Học viên ������ */}
                                <div className={`share-modal-col ${adminShareTab === 'student' ? 'active' : ''}`}>
                                    <div className="share-modal-col-header student">
                                        <GraduationCap size={18} /> Học viên
                                    </div>

                                    {/* Student Group + Email sharing */}
                                    {!resourceToShare.isPublic && (
                                        <div className="share-modal-section">
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
                                                        <EmailAutocomplete value={shareEmail} onChange={setShareEmail} onSubmit={(email) => handleAddShareEmail(email)} disabled={isSharing} roleFilter="student" />
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
                                        </div>
                                    )}

                                    {/* Quick Assign */}
                                    {resourceToShare.type !== 'folder' && (
                                        <div className="share-modal-section" style={{ padding: '16px', background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', borderRadius: '12px', border: '1px solid #fde68a' }}>
                                            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', fontWeight: 700, color: '#92400e', margin: '0 0 6px 0' }}><FileText size={16} /> Giao bài cho l�:p</h4>
                                            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '12px' }}>Giao nhanh bài học này cho 1 l�:p mà bạn �ang chủ nhi�!m.</p>
                                            {existingAssignments.length > 0 && (
                                                <div style={{ marginBottom: '12px' }}>
                                                    <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>Đã giao cho:</p>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                        {existingAssignments.map(a => (
                                                            <span key={a.id} style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px', background: 'linear-gradient(135deg, #fef3c7, #fde68a)', color: '#92400e', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #fcd34d' }}>�S& {a.groupName || a.targetName || allGroups.find(g => g.id === a.groupId)?.name || 'L�:p'}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {teacherManagedGroups.length > 0 ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                        <div style={{ flex: '1 1 140px', minWidth: 0, position: 'relative', zIndex: 20 }}>
                                                            <CustomSelect value={quickAssignGroupId} onChange={v => setQuickAssignGroupId(v)} placeholder="-- Chọn l�:p --" options={teacherManagedGroups.map(g => ({ value: g.id, label: g.name, icon: '�x��' }))} style={{ margin: 0 }} />
                                                        </div>
                                                        <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                                                            <input type="datetime-local" value={quickAssignDueDate} onChange={e => setQuickAssignDueDate(e.target.value)} style={{ width: '100%', padding: '6px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.88rem', color: '#1e293b', minHeight: '38px', boxSizing: 'border-box' }} />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>⏰ Thời �iỒm bắt �ầu</div>
                                                        <div style={{ display: 'flex', gap: '6px' }}>
                                                            <button type="button" onClick={() => setQuickAssignScheduledStart('')} style={{ flex: 1, padding: '7px 10px', borderRadius: '8px', border: !quickAssignScheduledStart ? '2px solid #059669' : '1.5px solid #e2e8f0', background: !quickAssignScheduledStart ? 'linear-gradient(135deg, #10b981, #059669)' : '#fff', color: !quickAssignScheduledStart ? '#fff' : '#64748b', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s' }}>Bắt �ầu ngay</button>
                                                            <button type="button" onClick={() => setQuickAssignScheduledStart('pending')} style={{ flex: 1, padding: '7px 10px', borderRadius: '8px', border: quickAssignScheduledStart ? '2px solid #d97706' : '1.5px solid #e2e8f0', background: quickAssignScheduledStart ? 'linear-gradient(135deg, #f59e0b, #d97706)' : '#fff', color: quickAssignScheduledStart ? '#fff' : '#64748b', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s' }}>Hẹn ngày...</button>
                                                        </div>
                                                        {quickAssignScheduledStart && (
                                                            <div style={{ marginTop: '6px' }}>
                                                                <input type="datetime-local" value={quickAssignScheduledStart === 'pending' ? '' : quickAssignScheduledStart} onChange={e => setQuickAssignScheduledStart(e.target.value)} style={{ width: '100%', padding: '6px 12px', borderRadius: '8px', border: '1.5px solid #f59e0b', fontSize: '0.85rem', color: '#1e293b', background: '#fffbeb', boxSizing: 'border-box' }} />
                                                                {quickAssignScheduledStart && quickAssignScheduledStart !== 'pending' && quickAssignDueDate && new Date(quickAssignScheduledStart) >= new Date(quickAssignDueDate) && (
                                                                    <p style={{ color: '#ef4444', fontSize: '0.75rem', margin: '4px 0 0', fontWeight: 600 }}>�a� Ngày bắt �ầu phải trư�:c hạn n�"p!</p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button type="button" onClick={handleQuickAssign} disabled={isQuickAssigning || !quickAssignGroupId || !quickAssignDueDate || quickAssignScheduledStart === 'pending' || (quickAssignScheduledStart && quickAssignScheduledStart !== 'pending' && quickAssignDueDate && new Date(quickAssignScheduledStart) >= new Date(quickAssignDueDate))} className="admin-btn admin-btn-primary" style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', opacity: (isQuickAssigning || !quickAssignGroupId || !quickAssignDueDate || quickAssignScheduledStart === 'pending') ? 0.6 : 1 }}>
                                                        <Send size={14} /> {isQuickAssigning ? 'Đang giao...' : 'Giao bài'}
                                                    </button>
                                                    {quickAssignSuccess && (
                                                        <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#ecfdf5', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#059669', fontWeight: 500 }}><CheckCircle size={16} /> {quickAssignSuccess}</div>
                                                    )}
                                                </div>
                                            ) : (
                                                <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>Bạn chưa quản lý l�:p nào.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

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
