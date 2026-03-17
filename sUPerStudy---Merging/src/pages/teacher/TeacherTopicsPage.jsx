import { useState, useEffect, Fragment, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getTeacherTopics, saveTeacherTopic, deleteTeacherTopic, getSharedAndPublicTeacherTopics, getTeacherTopicFolders, saveTeacherTopicFolder, deleteTeacherTopicFolder, addCollaborator, removeCollaborator, transferOwnership, getCollaboratedResources, findTeacherByEmail, getTeacherGroups, createAssignment, getAssignmentsForTopic } from '../../services/teacherService';
import { submitProposal, getProposalForSource } from '../../services/contentProposalService';
import { getUsersPublicInfo } from '../../services/userService';
import { getFolders, getGroups, toggleResourcePublic, getResourceSharedEntities, shareResourceToEmail, unshareResourceFromUser, shareResourceToGroup, unshareResourceFromGroup, getAdminTopics } from '../../services/adminService';
import { useAuth } from '../../contexts/AuthContext';
import { Timestamp } from 'firebase/firestore';
import { BookOpen, Edit, Trash2, X, Plus, List, FolderOpen, Share2, Globe, Users, Mail, UserPlus, Lock, Search, AlertTriangle, ChevronDown, ChevronRight, AlertCircle, Landmark, Send, CheckCircle, XCircle, Clock, ArrowRightLeft, UsersRound, FileText, Calendar, Copy } from 'lucide-react';
import { duplicateTeacherTopic } from '../../services/duplicateService';
import EmailAutocomplete from '../../components/common/EmailAutocomplete';
import CustomSelect from '../../components/common/CustomSelect';

export default function TeacherTopicsPage() {
    const { user } = useAuth();
    const [topics, setTopics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [alertMessage, setAlertMessage] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // UI state
    const [expandedFolders, setExpandedFolders] = useState(new Set());

    // Folders
    const [folders, setFolders] = useState([]); // Shared/Admin
    const [teacherFolders, setTeacherFolders] = useState([]); // Own

    // Topic Form
    const [formOpen, setFormOpen] = useState(false);
    const [formData, setFormData] = useState({ id: '', name: '', description: '', icon: '📘', color: '#10b981' });
    const [isEditing, setIsEditing] = useState(false);
    const [topicToDelete, setTopicToDelete] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [topicToDuplicate, setTopicToDuplicate] = useState(null);
    const [isDuplicating, setIsDuplicating] = useState(false);

    // Folder Form
    const [folderFormOpen, setFolderFormOpen] = useState(false);
    const [folderFormData, setFolderFormData] = useState({ name: '', description: '', icon: '📁', color: '#3b82f6', topicIds: [] });
    const [isFolderEditing, setIsFolderEditing] = useState(false);
    const [folderToDelete, setFolderToDelete] = useState(null);
    const [isFolderSaving, setIsFolderSaving] = useState(false);

    // Share Modal
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const [resourceToShare, setResourceToShare] = useState(null);
    const [shareGroups, setShareGroups] = useState([]);
    const [allGroups, setAllGroups] = useState([]);
    const [shareUsers, setShareUsers] = useState([]);
    const [shareEmail, setShareEmail] = useState('');
    const [isSharing, setIsSharing] = useState(false);
    const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);

    // Collaborator state
    const [collaborators, setCollaborators] = useState([]);
    const [collabEmail, setCollabEmail] = useState('');
    const [isAddingCollab, setIsAddingCollab] = useState(false);
    const [transferTarget, setTransferTarget] = useState(null);

    // Proposal state
    const [currentProposal, setCurrentProposal] = useState(null);
    const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);

    // Quick Assign state
    const [teacherManagedGroups, setTeacherManagedGroups] = useState([]);
    const [quickAssignGroupId, setQuickAssignGroupId] = useState('');
    const [quickAssignDueDate, setQuickAssignDueDate] = useState('');
    const [isQuickAssigning, setIsQuickAssigning] = useState(false);
    const [quickAssignSuccess, setQuickAssignSuccess] = useState('');
    const [existingAssignments, setExistingAssignments] = useState([]);

    const groupDropdownRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (groupDropdownRef.current && !groupDropdownRef.current.contains(event.target)) {
                setGroupDropdownOpen(false);
            }
        }

        if (groupDropdownOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [groupDropdownOpen]);

    useEffect(() => {
        if (user?.uid) {
            loadTopics();
        }
    }, [user?.uid, user?.mergedTopicAccess]);

    async function loadTopics() {
        setLoading(true);
        try {
            const ownTopics = await getTeacherTopics(user.uid);
            const collabTopics = await getCollaboratedResources('teacher_topics', user.uid);
            const sharedAccessIds = user.mergedTopicAccess || user.topicAccess || [];
            const sharedTopics = await getSharedAndPublicTeacherTopics(sharedAccessIds);
            const adminTopics = await getAdminTopics();

            const map = new Map();
            ownTopics.forEach(t => map.set(t.id, { ...t, isOwner: true, isAdmin: false }));
            collabTopics.forEach(t => {
                if (!map.has(t.id)) {
                    map.set(t.id, { ...t, isOwner: false, isCollaborator: true, isAdmin: false });
                }
            });

            const allFolders = await getFolders();
            const folderAccess = user.mergedFolderAccess || user.folderAccess || [];

            const visibleFolders = allFolders.filter(f => {
                if (f.isPublic) return true;
                if (folderAccess.includes(f.id)) return true;
                const folderTopics = [...sharedTopics, ...adminTopics].filter(t => (f.topicIds || []).includes(t.id));
                return folderTopics.some(t => t.isPublic || sharedAccessIds.includes(t.id));
            });

            const topicsInheritedFromFolders = new Set();
            const topicsInheritedFromPublicFolders = new Set();
            visibleFolders.forEach(folder => {
                if (folder.topicIds && Array.isArray(folder.topicIds)) {
                    folder.topicIds.forEach(id => {
                        topicsInheritedFromFolders.add(id);
                        if (folder.isPublic) {
                            topicsInheritedFromPublicFolders.add(id);
                        }
                    });
                }
            });

            sharedTopics.forEach(t => {
                const isInheritedPublic = topicsInheritedFromPublicFolders.has(t.id);
                if (!map.has(t.id)) {
                    map.set(t.id, { ...t, isPublic: t.isPublic !== false ? (t.isPublic || isInheritedPublic) : false, isInPublicFolder: isInheritedPublic, isOwner: false, isAdmin: false });
                } else if (isInheritedPublic && map.get(t.id).isPublic !== false) {
                    map.get(t.id).isPublic = true;
                    map.get(t.id).isInPublicFolder = true;
                }
            });
            adminTopics.forEach(t => {
                const isInheritedPublic = topicsInheritedFromPublicFolders.has(t.id);
                if (t.isPublic === true || sharedAccessIds.includes(t.id) || topicsInheritedFromFolders.has(t.id) || isInheritedPublic) {
                    if (!map.has(t.id)) {
                        map.set(t.id, { ...t, isPublic: t.isPublic !== false ? (t.isPublic || isInheritedPublic) : false, isInPublicFolder: isInheritedPublic, isOwner: false, isAdmin: true });
                    } else if (isInheritedPublic && map.get(t.id).isPublic !== false) {
                        map.get(t.id).isPublic = true;
                        map.get(t.id).isInPublicFolder = true;
                    }
                }
            });

            const merged = Array.from(map.values()).sort((a, b) => {
                const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                return timeB - timeA;
            });
            setTopics(merged);
            setFolders(visibleFolders);

            const ownFolders = await getTeacherTopicFolders(user.uid);
            setTeacherFolders(ownFolders);

            // Fetch teacher names for shared topics
            const sharedTeacherIds = [...new Set(sharedTopics.filter(t => t.teacherId && t.teacherId !== user.uid).map(t => t.teacherId))];
            if (sharedTeacherIds.length > 0) {
                const teacherNamesMap = await getUsersPublicInfo(sharedTeacherIds);
                setTopics(prev => prev.map(t => {
                    if (t.teacherId && teacherNamesMap[t.teacherId]) {
                        return { ...t, creatorName: teacherNamesMap[t.teacherId].displayName };
                    }
                    return t;
                }));
            }
        } catch (error) {
            console.error(error);
            setAlertMessage({ type: 'error', text: 'Lỗi tải danh sách bài học: ' + error.message });
        }
        setLoading(false);
    }

    function openAddForm() {
        setFormData({ id: '', name: '', description: '', icon: '📘', color: '#10b981', folderId: '' });
        setIsEditing(false);
        setFormOpen(true);
    }

    function openEditForm(topic) {
        const containingFolder = teacherFolders.find(f => (f.topicIds || []).includes(topic.id));
        setFormData({ ...topic, folderId: containingFolder?.id || '' });
        setIsEditing(true);
        setFormOpen(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setIsSaving(true);
        let finalTopicId = formData.id;
        if (isEditing) {
            // When editing, keep the original ID as-is
            finalTopicId = formData.id;
        } else if (!finalTopicId) {
            finalTopicId = `t-${user.uid.substring(0, 5)}-${Date.now()}`;
        } else {
            finalTopicId = finalTopicId.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
        }

        if (!finalTopicId) {
            setAlertMessage({ type: 'error', text: "ID Chủ đề không hợp lệ." });
            setIsSaving(false);
            return;
        }

        try {
            const { folderId, ...topicData } = formData;
            await saveTeacherTopic(user.uid, { ...topicData, id: finalTopicId });

            if (folderId) {
                const folder = teacherFolders.find(f => f.id === folderId);
                if (folder && !(folder.topicIds || []).includes(finalTopicId)) {
                    await saveTeacherTopicFolder(user.uid, { ...folder, topicIds: [...(folder.topicIds || []), finalTopicId] });
                }
            }
            for (const f of teacherFolders) {
                if (f.id !== folderId && (f.topicIds || []).includes(finalTopicId)) {
                    await saveTeacherTopicFolder(user.uid, { ...f, topicIds: (f.topicIds || []).filter(id => id !== finalTopicId) });
                }
            }

            setFormOpen(false);
            setAlertMessage({ type: 'success', text: isEditing ? "Cập nhật bài học thành công!" : "Tạo bài học mới thành công!" });
            loadTopics();
        } catch (error) {
            setAlertMessage({ type: 'error', text: "Lỗi lưu bài học: " + error.message });
        }
        setIsSaving(false);
    }

    async function handleConfirmDelete() {
        if (!topicToDelete) return;
        try {
            await deleteTeacherTopic(user.uid, topicToDelete.id);
            setTopics(prev => prev.filter(t => t.id !== topicToDelete.id));
            setAlertMessage({ type: 'success', text: "Đã xóa bài học thành công!" });
        } catch (error) {
            setAlertMessage({ type: 'error', text: "Lỗi xóa bài học: " + error.message });
        }
        setTopicToDelete(null);
    }

    async function handleConfirmDuplicate() {
        if (!topicToDuplicate) return;
        setIsDuplicating(true);
        try {
            await duplicateTeacherTopic(topicToDuplicate.id, user.uid);
            setAlertMessage({ type: 'success', text: `Đã nhân đôi bài học "${topicToDuplicate.name}" thành công!` });
            loadTopics();
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'Lỗi nhân đôi bài học: ' + error.message });
        }
        setIsDuplicating(false);
        setTopicToDuplicate(null);
    }

    // --- SHARE HANDLERS ---
    async function openShareModal(resource, customType) {
        const type = customType || (resource.isAdmin ? 'admin_topic' : 'teacher_topic');
        setResourceToShare({ ...resource, type });
        setShareModalOpen(true);
        setLinkCopied(false);
        setIsSharing(true);
        setShareEmail('');
        setCollabEmail('');
        setCollaborators([]);
        setTransferTarget(null);
        setCurrentProposal(null);
        setQuickAssignGroupId('');
        setQuickAssignDueDate('');
        setQuickAssignSuccess('');

        const isOwner = resource.isOwner || resource.teacherId === user.uid;
        const isCollaborator = resource.isCollaborator;

        try {
            // Always fetch teacher's managed groups (for quick-assign)
            const managedGroups = await getTeacherGroups(user.groupIds || []);
            setTeacherManagedGroups(managedGroups);

            // Fetch existing assignments for this resource
            if (!resource.type?.includes('folder')) {
                const assignments = await getAssignmentsForTopic(resource.id);
                const enriched = assignments.map(a => ({
                    ...a,
                    groupName: managedGroups.find(g => g.id === (a.groupId || a.targetId))?.name || a.groupName || a.targetName || a.groupId || a.targetId || ''
                }));
                setExistingAssignments(enriched);
            }

            // Fetch share-related data only for owners/collaborators
            if (isOwner || isCollaborator || resource.type === 'admin_folder') {
                const [entities, groupsData] = await Promise.all([
                    getResourceSharedEntities(type, resource.id),
                    getGroups()
                ]);
                setShareUsers(entities.users);
                setShareGroups(entities.groups.map(g => g.id));
                setAllGroups(groupsData);

                // Load collaborators from resource data - fetch live user profiles
                const collabIds = resource.collaboratorIds || [];
                const collabNames = resource.collaboratorNames || {};
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

                // Check proposal status
                if (isOwner && !resource.isAdmin) {
                    const proposal = await getProposalForSource(resource.id, 'vocab');
                    setCurrentProposal(proposal);
                }
            }
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi tải thông tin chia sẻ: ' + err.message });
        }
        setIsSharing(false);
    }

    // --- COLLABORATOR HANDLERS ---
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
            const collectionName = resourceToShare.type?.includes('folder') ? 'teacher_topic_folders' : 'teacher_topics';
            await addCollaborator(collectionName, resourceToShare.id, teacher.uid, teacher.displayName, resourceToShare.name);
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
            const collectionName = resourceToShare.type?.includes('folder') ? 'teacher_topic_folders' : 'teacher_topics';
            await removeCollaborator(collectionName, resourceToShare.id, uid, resourceToShare.name);
            setCollaborators(prev => prev.filter(c => c.uid !== uid));
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi gỡ cộng tác viên: ' + err.message });
        }
        setIsAddingCollab(false);
    }

    async function handlePreTransferOwnership(emailToTransfer) {
        if (!emailToTransfer || !emailToTransfer.trim() || !resourceToShare) return;
        if (emailToTransfer.trim().toLowerCase() === user.email?.toLowerCase()) {
            setAlertMessage({ type: 'error', text: 'Bạn đang sở hữu bài học này.' });
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
            const collectionName = resourceToShare.type?.includes('folder') ? 'teacher_topic_folders' : 'teacher_topics';
            await transferOwnership(
                collectionName, resourceToShare.id,
                user.uid, user.displayName || user.email,
                transferTarget.uid, transferTarget.displayName,
                resourceToShare.name
            );
            setAlertMessage({ type: 'success', text: `Đã chuyển quyền sở hữu cho ${transferTarget.displayName}!` });
            setShareModalOpen(false);
            setTransferTarget(null);
            loadTopics();
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi chuyển nhượng: ' + err.message });
        }
        setIsAddingCollab(false);
    }

    async function handleSubmitProposal(level = 'item') {
        if (!resourceToShare) return;
        setIsSubmittingProposal(true);
        try {
            await submitProposal({
                type: 'vocab',
                level,
                sourceId: resourceToShare.id,
                sourceFolderId: level === 'folder' ? resourceToShare.id : null,
                sourceCollection: 'teacher_topics',
                teacherId: user.uid,
                teacherName: user.displayName || user.email,
                teacherEmail: user.email,
                proposalName: resourceToShare.name || resourceToShare.title,
                proposalDescription: resourceToShare.description || '',
                icon: resourceToShare.icon,
                color: resourceToShare.color
            });
            const proposal = await getProposalForSource(resourceToShare.id, 'vocab');
            setCurrentProposal(proposal);
            setAlertMessage({ type: 'success', text: 'Đã gửi đề xuất thành công! Admin sẽ xem xét và phê duyệt.' });
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi gửi đề xuất: ' + err.message });
        }
        setIsSubmittingProposal(false);
    }

    async function handleTogglePublic() {
        if (!resourceToShare) return;
        const newPublicStatus = !resourceToShare.isPublic;
        setIsSharing(true);
        try {
            await toggleResourcePublic(resourceToShare.type || 'teacher_topic', resourceToShare.id, newPublicStatus);
            setResourceToShare({ ...resourceToShare, isPublic: newPublicStatus });
            loadTopics();
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
            const userAdded = await shareResourceToEmail(resourceToShare.type || 'teacher_topic', resourceToShare.id, emailToShare);
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
            await unshareResourceFromUser(resourceToShare.type || 'teacher_topic', resourceToShare.id, uid);
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
                await unshareResourceFromGroup(resourceToShare.type || 'teacher_topic', resourceToShare.id, groupId);
                setShareGroups(shareGroups.filter(id => id !== groupId));
            } else {
                await shareResourceToGroup(resourceToShare.type || 'teacher_topic', resourceToShare.id, groupId);
                setShareGroups([...shareGroups, groupId]);
            }
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi chia sẻ nhóm: ' + err.message });
        }
        setIsSharing(false);
    }

    // --- QUICK ASSIGN HANDLER ---
    async function handleQuickAssign() {
        if (!quickAssignGroupId || !quickAssignDueDate || !resourceToShare) return;
        setIsQuickAssigning(true);
        setQuickAssignSuccess('');
        try {
            const dueDateTimestamp = Timestamp.fromDate(new Date(quickAssignDueDate));
            await createAssignment({
                groupId: quickAssignGroupId,
                topicId: resourceToShare.id,
                topicName: resourceToShare.name,
                dueDate: dueDateTimestamp,
                isTeacherTopic: !resourceToShare.isAdmin,
                isGrammar: false,
                createdBy: user?.uid
            });
            const groupName = teacherManagedGroups.find(g => g.id === quickAssignGroupId)?.name || '';
            setQuickAssignSuccess(`Đã giao bài "${resourceToShare.name}" cho lớp ${groupName}!`);
            setQuickAssignGroupId('');
            setQuickAssignDueDate('');
            // Refresh existing assignments
            const updatedAssignments = await getAssignmentsForTopic(resourceToShare.id);
            setExistingAssignments(updatedAssignments.map(a => ({
                ...a,
                groupName: teacherManagedGroups.find(g => g.id === (a.groupId || a.targetId))?.name || a.groupName || a.targetName || a.groupId || a.targetId || ''
            })));
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi giao bài: ' + err.message });
        }
        setIsQuickAssigning(false);
    }

    // --- FOLDER HANDLERS ---
    function openFolderAddForm() {
        setFolderFormData({ name: '', description: '', icon: '📁', color: '#3b82f6', topicIds: [] });
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
            await saveTeacherTopicFolder(user.uid, folderFormData);
            setFolderFormOpen(false);
            setAlertMessage({ type: 'success', text: isFolderEditing ? 'Cập nhật Folder thành công!' : 'Tạo Folder mới thành công!' });
            loadTopics();
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'Lỗi lưu Folder: ' + error.message });
        }
        setIsFolderSaving(false);
    }

    async function handleConfirmDeleteFolder() {
        if (!folderToDelete) return;
        try {
            await deleteTeacherTopicFolder(folderToDelete.id);
            setFolders(prev => prev.filter(f => f.id !== folderToDelete.id));
            setAlertMessage({ type: 'success', text: 'Đã xóa Folder thành công!' });
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'Lỗi xóa Folder: ' + error.message });
        }
        setFolderToDelete(null);
    }

    function handleFolderTopicToggle(topicId) {
        setFolderFormData(prev => {
            const ids = prev.topicIds || [];
            if (ids.includes(topicId)) {
                return { ...prev, topicIds: ids.filter(id => id !== topicId) };
            } else {
                return { ...prev, topicIds: [...ids, topicId] };
            }
        });
    }

    // Prepare data for UI
    const allRenderableFolders = [
        ...teacherFolders.map(f => ({ ...f, isAppSystemFolder: false, isOwnFolder: true })),
        ...folders.map(f => ({ ...f, isAppSystemFolder: true, isOwnFolder: false }))
    ];

    const searchLower = searchTerm.toLowerCase();

    const filteredTopics = topics.filter(t =>
        t.name?.toLowerCase().includes(searchLower) ||
        t.description?.toLowerCase().includes(searchLower)
    );

    const filteredFolders = allRenderableFolders.filter(f => {
        const matchesName = f.name?.toLowerCase().includes(searchLower);
        const hasMatchingTopic = (f.topicIds || []).some(id => filteredTopics.some(t => t.id === id));
        return matchesName || hasMatchingTopic;
    });

    // Determine unassigned topics
    const allFolderTopicIds = new Set(allRenderableFolders.flatMap(f => f.topicIds || []));
    const unassignedTopics = filteredTopics.filter(t => !allFolderTopicIds.has(t.id));

    const ownTopics = topics.filter(t => t.isOwner || t.teacherId === user?.uid);

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <div>
                    <h1 className="admin-page-title" style={{ margin: 0 }}>Bài học từ vựng</h1>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '4px' }}>Tạo và quản lý các bộ từ vựng của riêng bạn để giao cho học viên.</p>
                </div>
                <div className="admin-header-actions">
                    <button className="admin-btn admin-btn-secondary" onClick={openFolderAddForm}>
                        <FolderOpen size={16} /> Tạo Folder
                    </button>
                    <button className="admin-btn admin-btn-primary" onClick={openAddForm}>
                        <Plus size={16} /> Tạo bài mới
                    </button>
                </div>
            </div>

            <div>
                <div className="admin-search-box">
                    <Search size={16} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm bài học, folder..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="admin-card">
                {loading ? (
                    <div className="admin-empty-state">Đang tải dữ liệu...</div>
                ) : (filteredFolders.length === 0 && unassignedTopics.length === 0) ? (
                    <div className="admin-empty-state">
                        <div className="admin-empty-icon"><BookOpen size={28} /></div>
                        <h3>Chưa có dữ liệu</h3>
                        <p>Bấm nút "Tạo bài mới" hoặc "Tạo Folder" để bắt đầu.</p>
                    </div>
                ) : (
                    <div className="admin-table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}></th>
                                    <th>Cấu trúc thư mục (Folder / Bài học)</th>
                                    <th>Thông tin thêm</th>
                                    <th className="text-right">Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* FOLDERS */}
                                {filteredFolders.map(folder => {
                                    const isExpanded = expandedFolders.has(folder.id) || searchTerm.length > 0;
                                    const folderTopics = filteredTopics.filter(t => (folder.topicIds || []).includes(t.id));

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
                                                        <button
                                                            className="admin-action-btn"
                                                            onClick={() => openShareModal(folder, folder.isAppSystemFolder ? 'admin_folder' : 'teacher_topic_folder')}
                                                            title="Chia sẻ"
                                                        >
                                                            <Share2 size={16} />
                                                        </button>
                                                        {folder.isOwnFolder && (
                                                            <>
                                                                <button className="admin-action-btn" onClick={() => openFolderEditForm(folder)} title="Sửa"><Edit size={16} /></button>
                                                                <button className="admin-action-btn danger" onClick={() => setFolderToDelete(folder)} title="Xóa"><Trash2 size={16} /></button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* TOPICS IN FOLDER */}
                                            {isExpanded && (
                                                folderTopics.length === 0 ? (
                                                    <tr>
                                                        <td></td>
                                                        <td colSpan="3" style={{ paddingLeft: '40px', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>
                                                            Folder này chưa có bài học nào.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    folderTopics.map(topic => (
                                                        <tr key={topic.id} className="table-row-nested" style={{ backgroundColor: '#fafafa' }}>
                                                            <td></td>
                                                            <td data-label="Tên bài học">
                                                                <div className="admin-topic-cell">
                                                                    <div className="admin-topic-icon" style={{ background: `${topic.color}20` }}>{topic.icon}</div>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                            <div className="admin-topic-name" style={{ fontWeight: 600, color: '#1e293b' }}>{topic.name}</div>
                                                                            {topic.isAdmin ? (
                                                                                <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                                    <Globe size={10} /> Chính thức
                                                                                </span>
                                                                            ) : topic.isPublic ? (
                                                                                <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                                    <Globe size={10} /> Public
                                                                                </span>
                                                                            ) : (topic.isInPublicFolder && topic.isPublic === false) ? (
                                                                                <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', display: 'inline-flex', alignItems: 'center', gap: '4px' }} title="Bài học thuộc nhóm Public nhưng bị tắt thủ công.">
                                                                                    <AlertTriangle size={10} /> Đã tắt Public
                                                                                </span>
                                                                            ) : topic.isCollaborator ? (
                                                                                <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#faf5ff', color: '#7c3aed', border: '1px solid #ddd6fe', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                                    <UsersRound size={10} /> Cộng tác viên {topic.collaboratorNames && topic.collaboratorNames[user.uid] ? '' : (topic.creatorName ? `· Chủ: ${topic.creatorName}` : '')}
                                                                                </span>
                                                                            ) : (!topic.isOwner && topic.teacherId !== user.uid) ? (
                                                                                <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#475569', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                                    <Lock size={10} /> Được chia sẻ {topic.creatorName ? `bởi ${topic.creatorName}` : ''}
                                                                                </span>
                                                                            ) : null}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td data-label="Mô tả">
                                                                <div className="admin-text-muted" style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    {topic.description || <span style={{ fontStyle: 'italic', color: '#cbd5e1' }}>Không có mô tả</span>}
                                                                </div>
                                                            </td>
                                                            <td data-label="Thao tác" className="text-right">
                                                                <div className="admin-table-actions">
                                                                    <button className="admin-action-btn" onClick={() => openShareModal(topic)} title="Chia sẻ">
                                                                        <Share2 size={16} />
                                                                    </button>

                                                                    <Link to={topic.isAdmin ? `/teacher/system-topics/${topic.id}` : `/teacher/topics/${topic.id}`} className="admin-action-btn" title="Quản lý từ vựng">
                                                                        <List size={16} />
                                                                    </Link>
                                                                    {(topic.isOwner || topic.teacherId === user.uid) && (
                                                                        <button className="admin-action-btn" onClick={() => setTopicToDuplicate(topic)} title="Nhân đôi bài học"><Copy size={16} /></button>
                                                                    )}
                                                                    {topic.isOwner || topic.teacherId === user.uid || topic.isCollaborator ? (
                                                                        <>
                                                                            <button className="admin-action-btn" onClick={() => openEditForm(topic)} title="Sửa thông tin"><Edit size={16} /></button>
                                                                            <button className="admin-action-btn danger" onClick={() => setTopicToDelete(topic)} title="Xóa bài học"><Trash2 size={16} /></button>
                                                                        </>
                                                                    ) : null}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )
                                            )}
                                        </Fragment>
                                    );
                                })}

                                {/* UNASSIGNED TOPICS */}
                                {unassignedTopics.length > 0 && (
                                    <>
                                        <tr className="admin-unassigned-header">
                                            <td></td>
                                            <td colSpan="3">
                                                <div className="admin-unassigned-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#fef3c7', color: '#b45309', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, marginTop: '16px', marginBottom: '8px' }}>
                                                    <AlertTriangle size={14} />
                                                    Bài học chưa được phân vào Folder ({unassignedTopics.length})
                                                </div>
                                            </td>
                                        </tr>
                                        {unassignedTopics.map(topic => (
                                            <tr key={topic.id} className="table-row-nested" style={{ backgroundColor: '#fafafa' }}>
                                                <td></td>
                                                <td data-label="Tên bài học">
                                                    <div className="admin-topic-cell">
                                                        <div className="admin-topic-icon" style={{ background: `${topic.color}20` }}>{topic.icon}</div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <div className="admin-topic-name" style={{ fontWeight: 600, color: '#1e293b' }}>{topic.name}</div>
                                                                {topic.isAdmin ? (
                                                                    <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                        <Globe size={10} /> Chính thức
                                                                    </span>
                                                                ) : topic.isPublic ? (
                                                                    <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                        <Globe size={10} /> Public
                                                                    </span>
                                                                ) : topic.isCollaborator ? (
                                                                    <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#faf5ff', color: '#7c3aed', border: '1px solid #ddd6fe', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                        <UsersRound size={10} /> Cộng tác viên
                                                                    </span>
                                                                ) : (!topic.isOwner && topic.teacherId !== user.uid) ? (
                                                                    <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#475569', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                        <Lock size={10} /> Được chia sẻ {topic.creatorName ? `bởi ${topic.creatorName}` : ''}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                            <div className="admin-text-muted" style={{ fontSize: '0.8rem', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {topic.description || <span style={{ fontStyle: 'italic', color: '#cbd5e1' }}>Không có mô tả</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td data-label="Mô tả">
                                                    <div className="admin-text-muted" style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {topic.description || <span style={{ fontStyle: 'italic', color: '#cbd5e1' }}>Không có mô tả</span>}
                                                    </div>
                                                </td>
                                                <td data-label="Thao tác" className="text-right">
                                                    <div className="admin-table-actions">
                                                        <button className="admin-action-btn" onClick={() => openShareModal(topic)} title="Chia sẻ">
                                                            <Share2 size={16} />
                                                        </button>

                                                        <Link to={topic.isAdmin ? `/teacher/system-topics/${topic.id}` : `/teacher/topics/${topic.id}`} className="admin-action-btn" title="Quản lý từ vựng">
                                                            <List size={16} />
                                                        </Link>
                                                        {(topic.isOwner || topic.teacherId === user.uid) && (
                                                            <button className="admin-action-btn" onClick={() => setTopicToDuplicate(topic)} title="Nhân đôi bài học"><Copy size={16} /></button>
                                                        )}
                                                        {topic.isOwner || topic.teacherId === user.uid || topic.isCollaborator ? (
                                                            <>
                                                                <button className="admin-action-btn" onClick={() => openEditForm(topic)} title="Sửa thông tin"><Edit size={16} /></button>
                                                                <button className="admin-action-btn danger" onClick={() => setTopicToDelete(topic)} title="Xóa bài học"><Trash2 size={16} /></button>
                                                            </>
                                                        ) : null}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
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
                    <div className="teacher-modal wide" style={{ maxWidth: '500px', overflow: 'auto' }}>
                        <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                            <button className="teacher-modal-close" onClick={() => setFormOpen(false)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <h2 className="admin-modal-title" style={{ justifyContent: 'flex-start', marginBottom: '24px', paddingRight: '40px' }}>
                            {isEditing ? 'Sửa Bài học' : 'Tạo Bài học mới'}
                        </h2>
                        <form onSubmit={handleSubmit}>
                            <div className="admin-form-group">
                                <label>Tên bài học</label>
                                <input type="text" className="admin-form-input" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ví dụ: Unit 1 - Family" />
                            </div>
                            <div className="admin-form-group">
                                <label>Mô tả ngắn</label>
                                <textarea className="admin-form-input admin-form-textarea" required value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Mô tả cho bộ từ này..." />
                            </div>
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <div className="admin-form-group" style={{ flex: 1 }}>
                                    <label>Biểu tượng (Emoji)</label>
                                    <input type="text" className="admin-form-input" required value={formData.icon} onChange={e => setFormData({ ...formData, icon: e.target.value })} placeholder="📘" />
                                </div>
                                <div className="admin-form-group" style={{ flex: 1 }}>
                                    <label>Màu nền (Hex)</label>
                                    <input type="color" className="admin-form-input" style={{ padding: '4px', height: '42px' }} value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} />
                                </div>
                            </div>
                            {!isEditing && (
                                <div className="admin-form-group">
                                    <label>ID Tùy chỉnh (Tùy chọn)</label>
                                    <input type="text" className="admin-form-input" value={formData.id} onChange={e => setFormData({ ...formData, id: e.target.value })} placeholder="family-vocab (để trống sẽ tự tạo)" />
                                    <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Sử dụng chữ thường, không dấu, ngăn cách bằng dấu gạch ngang.</p>
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

                            <div className="admin-modal-actions" style={{ marginTop: '32px', flexDirection: 'row' }}>
                                <button type="button" className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setFormOpen(false)} disabled={isSaving}>Hủy</button>
                                <button type="submit" className="admin-btn admin-btn-primary" style={{ flex: 1 }} disabled={isSaving}>{isSaving ? 'Đang lưu...' : (isEditing ? 'Cập nhật' : 'Tạo mới')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DELETE TOPIC MODAL */}
            {topicToDelete && (
                <div className="admin-modal-overlay">
                    <div className="admin-modal">
                        <h2 className="admin-modal-title" style={{ color: '#ef4444' }}><Trash2 size={24} /> Xác nhận xóa</h2>
                        <p className="admin-modal-desc">
                            Bạn có chắc chắn muốn xóa bài học <strong>{topicToDelete.name}</strong>? Toàn bộ từ vựng bên trong cũng sẽ bị xóa vĩnh viễn và không thể khôi phục.
                        </p>
                        <div className="admin-modal-actions">
                            <button className="admin-btn admin-btn-secondary" onClick={() => setTopicToDelete(null)}>Hủy</button>
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
                                <input type="text" className="admin-form-input" required value={folderFormData.name} onChange={e => setFolderFormData({ ...folderFormData, name: e.target.value })} placeholder="Ví dụ: Unit 1-5 Vocabulary" />
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
                                    Nếu bật, tất cả bài học bên trong Folder này sẽ được mọi người nhìn thấy trên App.
                                </p>
                            </div>
                            <div className="admin-form-group">
                                <label>Chọn các bài học đưa vào Folder này</label>
                                <div className="admin-folder-topics-select">
                                    {ownTopics.length === 0 ? (
                                        <p className="admin-text-muted" style={{ padding: '12px' }}>Bạn chưa tạo bài học nào để thêm vào Folder.</p>
                                    ) : (
                                        ownTopics.map(topic => (
                                            <div key={topic.id} className="admin-folder-topic-item" onClick={() => handleFolderTopicToggle(topic.id)}>
                                                <input
                                                    type="checkbox"
                                                    checked={(folderFormData.topicIds || []).includes(topic.id)}
                                                    onChange={() => { }} // Handle on parent div
                                                />
                                                <span className="admin-topic-icon" style={{ background: `${topic.color}20`, display: 'inline-flex', width: '24px', height: '24px', fontSize: '0.8rem' }}>{topic.icon}</span>
                                                <span style={{ fontSize: '0.9rem' }}>{topic.name}</span>
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
                            Các bài học bên trong sẽ <strong>KHÔNG</strong> bị xóa, chúng chỉ bị đưa ra ngoài thư mục.
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
                            Chia sẻ {resourceToShare.type?.includes('folder') ? 'Folder' : 'Bài học'}
                        </h2>

                        <div style={{ marginBottom: '20px', padding: '12px', background: '#f8fafc', borderRadius: '8px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div className="admin-topic-icon" style={{ background: `${resourceToShare.color || '#3b82f6'}20`, width: '40px', height: '40px', fontSize: '1.2rem' }}>
                                {resourceToShare.icon || (resourceToShare.type?.includes('folder') ? '📁' : '📘')}
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a' }}>{resourceToShare.name || resourceToShare.title}</h3>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                                    {resourceToShare.isAppSystemFolder || resourceToShare.isAdmin ? 'Nội dung chính thức (chỉ xem)' : 'Do bạn quản lý'}
                                </p>
                            </div>
                        </div>

                        {/* Public Toggle (Only for owners) */}
                        {(resourceToShare.isOwner || resourceToShare.teacherId === user?.uid) ? (
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontWeight: '600' }}>
                                        <Globe size={18} color={resourceToShare.isPublic ? '#10b981' : '#64748b'} />
                                        Mở công khai
                                    </div>
                                    <button
                                        onClick={handleTogglePublic}
                                        disabled={isSharing}
                                        style={{
                                            position: 'relative',
                                            width: '40px', height: '24px',
                                            borderRadius: '12px',
                                            background: resourceToShare.isPublic ? '#10b981' : '#cbd5e1',
                                            border: 'none', cursor: 'pointer',
                                            transition: 'background 0.3s'
                                        }}
                                    >
                                        <div style={{
                                            position: 'absolute', top: '2px', left: resourceToShare.isPublic ? '18px' : '2px',
                                            width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
                                            transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                        }}></div>
                                    </button>
                                </div>
                                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                                    {resourceToShare.isPublic
                                        ? 'Bất kỳ ai sử dụng ứng dụng đều có thể tìm thấy và học bài này.'
                                        : 'Chỉ những người được cấp quyền bên dưới mới có thể truy cập.'}
                                </p>
                            </div>
                        ) : (
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '20px', background: '#f8fafc' }}>
                                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <AlertCircle size={14} /> Bạn đang xem chia sẻ của tài nguyên này, không thể thay đổi người được chia sẻ.
                                </p>
                            </div>
                        )}

                        {/* Groups (Only for owners) */}
                        {(resourceToShare.isOwner || resourceToShare.teacherId === user?.uid) && (
                            <div style={{ marginBottom: '20px' }}>
                                <h4 style={{ fontSize: '0.9rem', color: '#0f172a', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={16} /> Chia sẻ theo lớp/nhóm</h4>
                                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '12px' }}>Chia sẻ để thiết lập thành các bài học tự do, học viên có thể tìm đến học theo sở thích.</p>
                                {allGroups.length > 0 ? (
                                    <div style={{ position: 'relative' }} ref={groupDropdownRef}>
                                        <button
                                            onClick={() => setGroupDropdownOpen(!groupDropdownOpen)}
                                            style={{
                                                width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontSize: '0.85rem'
                                            }}
                                        >
                                            <span style={{ color: shareGroups.length > 0 ? '#0f172a' : '#64748b' }}>
                                                {shareGroups.length > 0 ? `Đã chọn ${shareGroups.length} lớp/nhóm` : 'Chọn lớp/nhóm...'}
                                            </span>
                                            <ChevronDown size={16} color="#64748b" style={{ transform: groupDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                        </button>

                                        {groupDropdownOpen && (
                                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', zIndex: 10, maxHeight: '200px', overflowY: 'auto' }}>
                                                <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    {allGroups.map(group => {
                                                        const isSelected = shareGroups.includes(group.id);
                                                        return (
                                                            <label key={group.id} style={{ display: 'flex', alignItems: 'center', padding: '8px', cursor: 'pointer', borderRadius: '6px', background: isSelected ? '#eff6ff' : 'transparent', transition: 'background 0.2s' }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    onChange={() => handleToggleGroupShare(group.id)}
                                                                    disabled={isSharing}
                                                                    style={{ marginRight: '10px', cursor: 'pointer', width: '16px', height: '16px' }}
                                                                />
                                                                <span style={{ fontSize: '0.85rem', color: isSelected ? '#2563eb' : '#334155', fontWeight: isSelected ? '500' : 'normal' }}>{group.name}</span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>Không có lớp/nhóm nào trên hệ thống.</p>
                                )}
                            </div>
                        )}

                        {/* Explicit Users (Only for owners) */}
                        {(resourceToShare.isOwner || resourceToShare.teacherId === user?.uid) && (
                            <div>
                                <h4 style={{ fontSize: '0.9rem', color: '#0f172a', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}><UserPlus size={16} /> Chia sẻ cá nhân</h4>
                                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '12px' }}>Chia sẻ cho từng cá nhân để thêm vào lộ trình học tự do của riêng họ.</p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                                    <div style={{ width: '100%' }}>
                                        <EmailAutocomplete
                                            value={shareEmail}
                                            onChange={setShareEmail}
                                            onSelect={(email) => handleAddShareEmail(email)}
                                        />
                                    </div>
                                    <button
                                        className="admin-btn admin-btn-primary"
                                        onClick={handleAddShareEmail}
                                        disabled={isSharing || !shareEmail}
                                        style={{ width: '100%', padding: '8px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        Thêm
                                    </button>
                                </div>

                                {shareUsers.length > 0 && (
                                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                                        {shareUsers.map((u, i) => (
                                            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: i < shareUsers.length - 1 ? '1px solid #e2e8f0' : 'none', background: '#fafafa' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                                        {u.email.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#0f172a' }}>{u.displayName || 'Học viên'}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{u.email}</div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveShareUser(u.id)}
                                                    disabled={isSharing}
                                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                                    title="Xóa quyền truy cập"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Quick Assign to Class (for all resources, not folders) */}
                        {!resourceToShare.type?.includes('folder') && (
                            <div style={{ marginBottom: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                                <h4 style={{ fontSize: '0.9rem', color: '#0f172a', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}><FileText size={16} color="#f59e0b" /> Giao bài cho lớp</h4>
                                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '12px' }}>Giao nhanh bài học này cho 1 lớp mà bạn đang chủ nhiệm.</p>

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
                                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>Bạn chưa quản lý lớp nào. Liên hệ Admin để được thêm vào lớp.</p>
                                )}
                            </div>
                        )}

                        {/* Collaborators Section (Only for owners) */}
                        {(resourceToShare.isOwner || resourceToShare.teacherId === user?.uid) && !resourceToShare.isAdmin && !resourceToShare.type?.includes('admin') && (
                            <div style={{ marginBottom: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
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

                        {/* Proposal Section (Only for owners of teacher content) */}
                        {(resourceToShare.isOwner || resourceToShare.teacherId === user?.uid) && !resourceToShare.isAdmin && !resourceToShare.type?.includes('admin') && (
                            <div style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                                <h4 style={{ fontSize: '0.9rem', color: '#0f172a', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Landmark size={16} /> Đề xuất thành nội dung chính thức
                                </h4>
                                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '12px' }}>
                                    Gửi {resourceToShare.type?.includes('folder') ? 'folder' : 'bài học'} này cho Admin duyệt để đưa lên kho bài học chính thức.
                                </p>

                                {currentProposal ? (
                                    <div style={{
                                        padding: '12px 16px', borderRadius: '8px',
                                        background: currentProposal.status === 'approved' ? '#ecfdf5' : currentProposal.status === 'rejected' ? '#fef2f2' : '#fffbeb',
                                        border: `1px solid ${currentProposal.status === 'approved' ? '#a7f3d0' : currentProposal.status === 'rejected' ? '#fecaca' : '#fde68a'}`
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            {currentProposal.status === 'pending' && <Clock size={16} color="#d97706" />}
                                            {currentProposal.status === 'approved' && <CheckCircle size={16} color="#10b981" />}
                                            {currentProposal.status === 'rejected' && <XCircle size={16} color="#ef4444" />}
                                            <span style={{
                                                fontWeight: 600, fontSize: '0.85rem',
                                                color: currentProposal.status === 'approved' ? '#059669' : currentProposal.status === 'rejected' ? '#dc2626' : '#d97706'
                                            }}>
                                                {currentProposal.status === 'pending' && 'Đang chờ Admin duyệt'}
                                                {currentProposal.status === 'approved' && 'Đã được duyệt ✓'}
                                                {currentProposal.status === 'rejected' && 'Đã bị từ chối'}
                                            </span>
                                        </div>
                                        {currentProposal.status === 'rejected' && currentProposal.adminNote && (
                                            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '8px 0 0', fontStyle: 'italic' }}>
                                                Lý do: {currentProposal.adminNote}
                                            </p>
                                        )}
                                        {currentProposal.status === 'rejected' && (
                                            <button
                                                onClick={() => handleSubmitProposal(resourceToShare.type?.includes('folder') ? 'folder' : 'item')}
                                                disabled={isSubmittingProposal}
                                                className="admin-btn admin-btn-primary"
                                                style={{ marginTop: '10px', fontSize: '0.8rem' }}
                                            >
                                                <Send size={14} /> Gửi lại đề xuất
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => handleSubmitProposal(resourceToShare.type?.includes('folder') ? 'folder' : 'item')}
                                        disabled={isSubmittingProposal}
                                        className="admin-btn"
                                        style={{
                                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                            color: '#fff', border: 'none',
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            padding: '10px 20px', borderRadius: '8px', fontSize: '0.85rem',
                                            cursor: isSubmittingProposal ? 'not-allowed' : 'pointer',
                                            opacity: isSubmittingProposal ? 0.6 : 1
                                        }}
                                    >
                                        <Send size={14} />
                                        {isSubmittingProposal ? 'Đang gửi...' : 'Gửi đề xuất chính thức'}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TRANSFER OWNERSHIP CONFIRM */}
            {transferTarget && (
                <div className="admin-modal-overlay">
                    <div className="admin-modal" style={{ maxWidth: '450px' }}>
                        <h2 className="admin-modal-title" style={{ color: '#8b5cf6' }}><ArrowRightLeft size={24} /> Chuyển quyền sở hữu</h2>
                        <p className="admin-modal-desc">
                            Bạn có chắc chắn muốn chuyển quyền sở hữu bài học <strong>{resourceToShare?.name}</strong> cho <strong>{transferTarget.displayName}</strong>?
                            <br /><br />
                            Sau khi chuyển, bạn sẽ trở thành cộng tác viên và không thể xóa hoặc quản lý chia sẻ bài này nữa.
                        </p>
                        <div className="admin-modal-actions">
                            <button className="admin-btn admin-btn-secondary" onClick={() => setTransferTarget(null)} disabled={isAddingCollab}>Hủy</button>
                            <button className="admin-btn admin-btn-primary" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }} onClick={handleTransferOwnership} disabled={isAddingCollab}>
                                {isAddingCollab ? 'Đang xử lý...' : 'Xác nhận chuyển'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DUPLICATE CONFIRM */}
            {topicToDuplicate && (
                <div className="admin-modal-overlay">
                    <div className="admin-modal" style={{ maxWidth: '450px' }}>
                        <h2 className="admin-modal-title" style={{ color: '#6366f1' }}><Copy size={24} /> Nhân đôi bài học</h2>
                        <p className="admin-modal-desc">
                            Bạn có muốn nhân đôi bài học <strong>{topicToDuplicate.name}</strong>?
                        </p>
                        <div className="admin-modal-actions">
                            <button className="admin-btn admin-btn-secondary" onClick={() => setTopicToDuplicate(null)} disabled={isDuplicating}>Hủy</button>
                            <button className="admin-btn admin-btn-primary" onClick={handleConfirmDuplicate} disabled={isDuplicating}>
                                {isDuplicating ? 'Đang nhân đôi...' : 'Xác nhận nhân đôi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ALERTS */}
            {alertMessage && (
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
            )}
        </div>
    );
}
