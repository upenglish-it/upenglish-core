import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { getExams, getExam, saveExam, deleteExam, getExamFolders, saveExamFolder, deleteExamFolder, updateExamFoldersOrder, createExamAssignment, getExamAssignmentsForExam, recalcExamQuestionCache } from '../../services/examService';
import { getGroups, toggleResourcePublic, toggleTeacherVisible, getResourceSharedEntities, shareResourceToEmail, unshareResourceFromUser, shareResourceToGroup, unshareResourceFromGroup, transferOfficialToTeacher, shareResourceToTeacher, unshareResourceFromTeacher, getResourceSharedTeachers } from '../../services/adminService';
import { getStudentsInGroup } from '../../services/teacherService';

import { getPendingProposals, approveProposal, rejectProposal, findExistingOfficialCopy } from '../../services/contentProposalService';
import { useAuth } from '../../contexts/AuthContext';
import { Edit, Trash2, X, Plus, List, Search, Clock, ClipboardCheck, FolderOpen, GripVertical, Check, Share2, Globe, ChevronDown, ChevronRight, AlertTriangle, Users, Mail, UserPlus, Lock, CheckCircle, XCircle, Landmark, Send, FileText, Filter, ArrowRightLeft, GraduationCap } from 'lucide-react';
import { convertExamToGrammar } from '../../services/conversionService';
import CustomSelect from '../../components/common/CustomSelect';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import EmailAutocomplete from '../../components/common/EmailAutocomplete';
import '../../components/common/ShareModal.css';

export default function AdminExamsPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [exams, setExams] = useState([]);
    const [folders, setFolders] = useState([]);
    const [questionCounts, setQuestionCounts] = useState({});
    const [loading, setLoading] = useState(true);
    const [expandedFolders, setExpandedFolders] = useState(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [publicFilter, setPublicFilter] = useState('all'); // 'all' | 'public' | 'private'

    // Exam form
    const [formOpen, setFormOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '', description: '', icon: '📋', color: '#6366f1',
        timeLimitMinutes: 60, timingMode: 'exam', sections: [], isPublic: false, examType: 'homework'
    });
    const [isEditing, setIsEditing] = useState(false);
    const [examToDelete, setExamToDelete] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [alertMessage, setAlertMessage] = useState(null);

    // Conversion state
    const [examToConvert, setExamToConvert] = useState(null);
    const [isConvertingToGrammar, setIsConvertingToGrammar] = useState(false);

    // Folder form
    const [folderFormOpen, setFolderFormOpen] = useState(false);
    const [folderFormData, setFolderFormData] = useState({ id: '', name: '', description: '', icon: '', color: '#6366f1', examIds: [], order: 0 });
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

    // Quick Assign States
    const [teacherManagedGroups, setTeacherManagedGroups] = useState([]);
    const [quickAssignGroupId, setQuickAssignGroupId] = useState('');
    const [quickAssignDueDate, setQuickAssignDueDate] = useState('');
    const [isQuickAssigning, setIsQuickAssigning] = useState(false);
    const [quickAssignSuccess, setQuickAssignSuccess] = useState('');
    const [existingAssignments, setExistingAssignments] = useState([]);
    const [quickAssignStudents, setQuickAssignStudents] = useState([]);
    const [quickAssignSelectedStudentIds, setQuickAssignSelectedStudentIds] = useState([]);
    const [quickAssignStudentsLoading, setQuickAssignStudentsLoading] = useState(false);
    const [studentDropdownOpen, setStudentDropdownOpen] = useState(false);

    // Proposal States
    const [pendingProposals, setPendingProposals] = useState([]);
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

    useEffect(() => { loadData(); loadProposals(); }, []);

    useEffect(() => {
        if (alertMessage) {
            const timer = setTimeout(() => setAlertMessage(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [alertMessage]);

    async function loadData() {
        setLoading(true);
        try {
            const [allExams, foldersData] = await Promise.all([
                getExams(),
                getExamFolders()
            ]);

            const publicFolderExamIds = new Set();
            foldersData.forEach(folder => {
                if (folder.isPublic && folder.examIds && Array.isArray(folder.examIds)) {
                    folder.examIds.forEach(id => publicFolderExamIds.add(id));
                }
            });

            // Admin page only shows system/admin-created exams
            // Teacher-created exams appear on /admin/teacher-exams or teacher's own page
            const adminExams = allExams.filter(e => !e.createdByRole || e.createdByRole === 'admin');

            const examsWithInheritedPublic = adminExams.map(e => {
                if (publicFolderExamIds.has(e.id)) {
                    if (e.isPublic !== false) {
                        return { ...e, isPublic: true, isInPublicFolder: true };
                    }
                    return { ...e, isInPublicFolder: true };
                }
                return e;
            });

            const counts = {};
            const examsNeedingRecalc = [];
            examsWithInheritedPublic.forEach(e => {
                if (e.cachedQuestionCount != null) {
                    counts[e.id] = e.cachedQuestionCount;
                } else {
                    counts[e.id] = 0;
                    examsNeedingRecalc.push(e.id);
                }
            });
            setQuestionCounts(counts);
            setExams(examsWithInheritedPublic);
            setFolders(foldersData);

            // Background recalc for exams missing cached count
            if (examsNeedingRecalc.length > 0) {
                Promise.all(examsNeedingRecalc.map(async (eid) => {
                    try {
                        await recalcExamQuestionCache(eid);
                        const refreshed = await getExam(eid);
                        if (refreshed) return { id: eid, count: refreshed.cachedQuestionCount ?? 0 };
                    } catch (e) { /* ignore */ }
                    return null;
                })).then(results => {
                    const updates = {};
                    results.filter(Boolean).forEach(r => { updates[r.id] = r.count; });
                    if (Object.keys(updates).length > 0) {
                        setQuestionCounts(prev => ({ ...prev, ...updates }));
                    }
                });
            }
        } catch (error) {
            console.error(error);
            setAlertMessage({ type: 'error', text: 'Lỗi tải dữ liệu: ' + error.message });
        }
        setLoading(false);
    }

    // --- EXAM HANDLERS ---
    function openAddForm() {
        setFormData({
            name: '', description: '', icon: '📋', color: '#6366f1',
            timeLimitMinutes: 60, timingMode: 'exam', sections: [{ id: crypto.randomUUID(), title: 'Section 1', context: '', order: 0 }],
            isPublic: false, folderId: '', examType: 'homework'
        });
        setIsEditing(false);
        setFormOpen(true);
    }

    function openEditForm(exam) {
        const currentFolder = folders.find(f => (f.examIds || []).includes(exam.id));
        setFormData({ ...exam, sections: exam.sections || [{ id: crypto.randomUUID(), title: 'Section 1', context: '', order: 0 }], folderId: currentFolder ? currentFolder.id : '', examType: exam.examType || 'homework', timingMode: exam.timingMode || 'exam' });
        setIsEditing(true);
        setFormOpen(true);
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        setIsSaving(true);
        try {
            const { folderId, ...examToSave } = formData;
            if (examToSave.timingMode === 'exam') {
                examToSave.timeLimitMinutes = parseFloat(examToSave.timeLimitMinutes) || 60;
            } else {
                examToSave.timeLimitMinutes = 0;
            }
            const finalExamId = await saveExam({ ...examToSave, createdBy: examToSave.createdBy || user?.uid, createdByRole: examToSave.createdByRole || 'admin' });

            const currentFolder = folders.find(f => (f.examIds || []).includes(finalExamId));
            const targetFolderId = folderId;

            if (currentFolder && currentFolder.id !== targetFolderId) {
                const updatedOldFolder = { ...currentFolder, examIds: (currentFolder.examIds || []).filter(eid => eid !== finalExamId) };
                await saveExamFolder(updatedOldFolder);
            }

            if (targetFolderId && (!currentFolder || currentFolder.id !== targetFolderId)) {
                const targetFolder = folders.find(f => f.id === targetFolderId);
                if (targetFolder) {
                    const updatedNewFolder = { ...targetFolder, examIds: Array.from(new Set([...(targetFolder.examIds || []), finalExamId])) };
                    await saveExamFolder(updatedNewFolder);
                }
            }

            setFormOpen(false);
            setAlertMessage({ type: 'success', text: isEditing ? "Cập nhật thành công!" : "Tạo bài tập và kiểm tra mới thành công!" });
            loadData();
        } catch (error) {
            setAlertMessage({ type: 'error', text: "Lỗi lưu: " + error.message });
        }
        setIsSaving(false);
    }

    async function handleConfirmDelete() {
        if (!examToDelete) return;
        try {
            await deleteExam(examToDelete.id);
            setExams(prev => prev.filter(e => e.id !== examToDelete.id));
            setAlertMessage({ type: 'success', text: "Đã xóa bài tập và kiểm tra thành công!" });
        } catch (error) {
            setAlertMessage({ type: 'error', text: "Lỗi xóa: " + error.message });
        }
        setExamToDelete(null);
    }

    async function handleConfirmConvertToGrammar() {
        if (!examToConvert) return;
        setIsConvertingToGrammar(true);
        try {
            const newExerciseId = await convertExamToGrammar(examToConvert.id, user.uid, { createdByRole: 'admin' });
            setExamToConvert(null);
            setAlertMessage({ type: 'success', text: `Đã chuyển đổi "${examToConvert.name}" thành Bài kỹ năng!` });
            navigate(`/admin/grammar/${newExerciseId}`);
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'Lỗi chuyển đổi: ' + error.message });
        }
        setIsConvertingToGrammar(false);
    }

    // --- FOLDER HANDLERS ---
    function openAddFolderForm() {
        setFolderFormData({ id: '', name: '', description: '', icon: '', color: '#6366f1', examIds: [], order: folders.length });
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
        let finalId = folderFormData.id.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
        if (!finalId && !isEditingFolder) {
            finalId = folderFormData.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
        }
        if (!finalId) {
            setAlertMessage({ type: 'error', text: "Tên hoặc ID Folder không hợp lệ." });
            return;
        }
        try {
            await saveExamFolder({ ...folderFormData, id: finalId });
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
            await deleteExamFolder(folderToDelete.id);
            setFolders(prev => prev.filter(f => f.id !== folderToDelete.id));
            setAlertMessage({ type: 'success', text: "Đã xóa folder thành công!" });
        } catch (error) {
            setAlertMessage({ type: 'error', text: "Lỗi xóa folder: " + error.message });
        }
        setFolderToDelete(null);
    }

    function toggleExamInFolder(examId) {
        setFolderFormData(prev => {
            const current = new Set(prev.examIds || []);
            if (current.has(examId)) current.delete(examId);
            else current.add(examId);
            return { ...prev, examIds: Array.from(current) };
        });
    }

    async function handleFolderDragEnd(result) {
        const { source, destination, type } = result;
        if (!destination) return;
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        if (type === 'folder') {
            const reordered = Array.from(folders);
            const [moved] = reordered.splice(source.index, 1);
            reordered.splice(destination.index, 0, moved);
            setFolders(reordered);
            try {
                await updateExamFoldersOrder(reordered);
            } catch (error) {
                setAlertMessage({ type: 'error', text: 'Lỗi sắp xếp folder: ' + error.message });
                loadData();
            }
            return;
        }

        if (type === 'exam') {
            const folderId = source.droppableId.replace('folder-exams-', '');
            const folder = folders.find(f => f.id === folderId);
            if (!folder) return;
            const ids = Array.from(folder.examIds || []);
            const [movedId] = ids.splice(source.index, 1);
            ids.splice(destination.index, 0, movedId);
            setFolders(prev => prev.map(f => f.id === folderId ? { ...f, examIds: ids } : f));
            try {
                await saveExamFolder({ ...folder, examIds: ids });
            } catch (error) {
                setAlertMessage({ type: 'error', text: 'Lỗi sắp xếp bài: ' + error.message });
                loadData();
            }
            return;
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
                type !== 'exam_folder' ? getExamAssignmentsForExam(resource.id) : Promise.resolve([]),
                getResourceSharedTeachers(type, resource.id)
            ]);
            setShareUsers(entities.users);
            setShareGroups(entities.groups.map(g => g.id));
            setAllGroups(groupsData);
            setTeacherManagedGroups(groupsData);
            setExistingAssignments(assignments.map(a => ({
                ...a,
                groupName: a.groupName || groupsData.find(g => g.id === (a.targetId || a.groupId))?.name || a.targetName || ''
            })));
            setSharedTeachers(teachers);
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi tải thông tin chia sẻ: ' + err.message });
        }
        setIsSharing(false);
    }

    async function handleQuickAssign() {
        if (!quickAssignGroupId || !quickAssignDueDate || !resourceToShare) return;

        // Block if time setup is incomplete
        if (resourceToShare.timingMode === 'section' && (resourceToShare.sections || []).some(s => !s.timeLimitMinutes || s.timeLimitMinutes <= 0)) {
            setAlertMessage({ type: 'error', text: `Bài "${resourceToShare.name}" có section chưa đặt thời gian. Vui lòng hoàn thành thiết lập thời gian trước khi giao bài.` });
            return;
        }
        if (resourceToShare.timingMode === 'question' && resourceToShare.cachedQuestionTimeMissingCount > 0) {
            setAlertMessage({ type: 'error', text: `Bài "${resourceToShare.name}" chưa hoàn thành thiết lập thời gian theo từng câu hỏi. Vui lòng kiểm tra thời gian từng câu trước khi giao bài.` });
            return;
        }

        setIsQuickAssigning(true);
        setQuickAssignSuccess('');
        try {
            const selectedGroup = teacherManagedGroups.find(g => g.id === quickAssignGroupId);
            const assignPayload = {
                examId: resourceToShare.id,
                examName: resourceToShare.name,
                targetType: 'group',
                targetId: quickAssignGroupId,
                targetName: selectedGroup?.name || '',
                dueDate: new Date(quickAssignDueDate).toISOString(),
                assignedBy: user.uid,
                assignedByName: user.displayName || user.email,
            };
            if (quickAssignSelectedStudentIds.length > 0) {
                assignPayload.assignedStudentIds = quickAssignSelectedStudentIds;
            }
            await createExamAssignment(assignPayload);
            setQuickAssignSuccess(`Đã giao thành công cho lớp ${selectedGroup?.name}!`);
            setQuickAssignGroupId('');
            setQuickAssignDueDate('');
            setQuickAssignSelectedStudentIds([]);
            setQuickAssignStudents([]);
            setStudentDropdownOpen(false);
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

    async function handleToggleTeacherVisible(resource, type) {
        const newStatus = !resource.teacherVisible;
        setIsTeacherSharing(true);
        try {
            await toggleTeacherVisible(type, resource.id, newStatus);
            setResourceToShare(prev => prev ? { ...prev, teacherVisible: newStatus } : prev);
            setAlertMessage({ type: 'success', text: newStatus ? 'Đã bật cho GV sử dụng!' : 'Đã tắt quyền GV sử dụng.' });
            loadData();
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi cập nhật: ' + err.message });
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
            setAlertMessage({ type: 'error', text: 'Lỗi gỡ quyền: ' + err.message });
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
            const proposals = await getPendingProposals('exam');
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
                setAlertMessage({ type: 'success', text: 'Đã duyệt và tạo bài tập và kiểm tra chính thức thành công!' });
                loadProposals();
                loadData();
                setIsApproving(false);
            }
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi duyệt: ' + err.message });
            setIsApproving(false);
        }
    }

    async function handleConfirmApprove(mode) {
        if (!proposalToApprove) return;
        setIsApproving(true);
        try {
            await approveProposal(proposalToApprove.id, 'admin', mode);
            setAlertMessage({ type: 'success', text: mode === 'overwrite' ? 'Đã duyệt và cập nhật bản chính thức cũ!' : 'Đã duyệt và tạo bản chính thức mới!' });
            setApproveModalOpen(false);
            setProposalToApprove(null);
            setExistingOfficialCopy(null);
            loadProposals();
            loadData();
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi duyệt: ' + err.message });
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
            setAlertMessage({ type: 'success', text: `Đã chuyển quyền "${itemName}" cho ${result.teacherName}!` });
            setTransferModalOpen(false);
            setTransferTarget(null);
            setShareModalOpen(false);
            loadData();
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi chuyển quyền: ' + err.message });
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
            setAlertMessage({ type: 'success', text: 'Đã từ chối đề xuất.' });
            setRejectModalOpen(false);
            setProposalToReject(null);
            loadProposals();
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi từ chối: ' + err.message });
        }
    }

    // --- FILTERING ---
    const filteredExams = exams.filter(e => {
        const matchesSearch = (e.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (e.description || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesPublic = publicFilter === 'all' ? true
            : publicFilter === 'public' ? !!e.isPublic
            : !e.isPublic;
        return matchesSearch && matchesPublic;
    });

    const filteredFolders = folders.filter(f => {
        const matchesSearch = (f.name || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesPublic = publicFilter === 'all' ? true
            : publicFilter === 'public' ? !!f.isPublic
            : !f.isPublic;
        const hasMatchingExam = (f.examIds || []).some(eid => filteredExams.some(e => e.id === eid));
        return (matchesSearch && matchesPublic) || hasMatchingExam;
    });

    // --- RENDER EXAM ROW ---
    function renderExamRow(exam, nested = false) {
        return (
            <tr key={exam.id} className={nested ? "table-row-nested" : ""} style={!nested ? { marginLeft: 0, width: '100%', borderLeft: '1px solid #e2e8f0' } : {}}>
                <td></td>
                <td data-label="Bài tập và Kiểm tra">
                    <div className="admin-topic-cell">
                        <div className="admin-topic-icon" style={{ background: `${exam.color || '#6366f1'}20`, width: nested ? '32px' : '40px', height: nested ? '32px' : '40px', fontSize: nested ? '0.9rem' : '1rem' }}>
                            {exam.icon || '📋'}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '10px' }}>
                                <div className="admin-topic-name" style={{ fontWeight: 600 }}>{exam.name}</div>
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    {exam.isPublic && (
                                        <span style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '4px', background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0', whiteSpace: 'nowrap' }}>Public</span>
                                    )}
                                    {exam.teacherVisible && !exam.isPublic && (
                                        <span style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '4px', background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><GraduationCap size={9} /> GV</span>
                                    )}
                                </div>
                            </div>
                            <div className="admin-text-muted" style={{ maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.75rem', marginBottom: '2px' }}>
                                {exam.description}
                            </div>

                            {/* Compact Info for Mobile */}
                            <div className="mobile-show" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: '#64748b', flexWrap: 'wrap' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><List size={10} /> {questionCounts[exam.id] || 0} câu</span>
                                <span>&middot;</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Clock size={10} /> {exam.timingMode === 'section' ? `Theo section (${(exam.sections || []).reduce((s, sec) => s + (sec.timeLimitMinutes || 0), 0)}p)` : exam.timingMode === 'question' ? `Theo câu (${Math.round((exam.cachedQuestionTimeTotalSeconds || 0) / 60)}p)` : `Theo bài (${exam.timeLimitMinutes || 0}p)`}</span>
                                <span>&middot;</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><ClipboardCheck size={10} /> {exam.sections?.length || 0} {(exam.sections?.length || 0) === 1 ? 'section' : 'sections'}</span>
                                <span>&middot;</span>
                                <span className="active" style={{ color: '#059669', fontWeight: 600 }}>Active</span>
                            </div>
                        </div>
                    </div>
                </td>
                <td data-label="Thông tin" className="mobile-hide">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                            {questionCounts[exam.id] || 0} câu hỏi
                        </span>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.65rem', background: '#e0e7ff', color: '#4f46e5', padding: '1px 4px', borderRadius: '3px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <Clock size={10} /> {exam.timingMode === 'section' ? `Theo section (${(exam.sections || []).reduce((s, sec) => s + (sec.timeLimitMinutes || 0), 0)}ph)` : exam.timingMode === 'question' ? `Theo câu (${Math.round((exam.cachedQuestionTimeTotalSeconds || 0) / 60)}ph)` : `Theo bài (${exam.timeLimitMinutes || 0}ph)`}
                            </span>
                            {exam.timingMode === 'section' && (exam.sections || []).some(s => !s.timeLimitMinutes || s.timeLimitMinutes <= 0) && (
                                <span style={{ fontSize: '0.6rem', background: '#fef2f2', color: '#dc2626', padding: '1px 4px', borderRadius: '3px', fontWeight: 700, border: '1px solid #fecaca' }}>⚠ {(exam.sections || []).filter(s => !s.timeLimitMinutes || s.timeLimitMinutes <= 0).length} section chưa hẹn giờ</span>
                            )}
                            {exam.timingMode === 'question' && (exam.cachedQuestionTimeMissingCount > 0) && (
                                <span style={{ fontSize: '0.6rem', background: '#fff7ed', color: '#ea580c', padding: '1px 4px', borderRadius: '3px', fontWeight: 700, border: '1px solid #fed7aa' }}>⚠ {exam.cachedQuestionTimeMissingCount} câu hỏi chưa hẹn giờ</span>
                            )}
                            <span style={{ fontSize: '0.65rem', background: '#fef3c7', color: '#d97706', padding: '1px 4px', borderRadius: '3px', fontWeight: 600 }}>
                                {exam.sections?.length || 0} {(exam.sections?.length || 0) === 1 ? 'section' : 'sections'}
                            </span>
                        </div>
                    </div>
                </td>
                <td data-label="Trạng thái" className="mobile-hide" style={{ textAlign: 'center' }}>
                    <span className="admin-status-badge active" style={{ fontSize: '0.6rem', padding: '1px 5px' }}>Đang hoạt động</span>
                </td>
                <td className="text-right">
                    <div className="admin-table-actions">
                        <Link to={`/admin/exams/${exam.id}`} className="admin-action-btn" title="Quản lý câu hỏi"><List size={14} /></Link>
                        <button className="admin-action-btn" onClick={() => setExamToConvert(exam)} title="Chuyển thành Bài kỹ năng"><ArrowRightLeft size={14} /></button>
                        <button className="admin-action-btn" onClick={() => openShareModal(exam, 'exam')} title="Chia sẻ"><Share2 size={14} /></button>
                        <button className="admin-action-btn" onClick={() => openEditForm(exam)} title="Sửa"><Edit size={14} /></button>
                        <button className="admin-action-btn danger" onClick={() => setExamToDelete(exam)} title="Xóa"><Trash2 size={14} /></button>
                    </div>
                </td>
            </tr>
        );
    }

    return (
        <div className="admin-page">
            {/* Alert */}
            {alertMessage && (
                <div style={{
                    position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 10000,
                    padding: '14px 24px', borderRadius: '12px', width: 'calc(100vw - 32px)', maxWidth: '500px', boxSizing: 'border-box', wordWrap: 'break-word',
                    background: alertMessage.type === 'success' ? '#ecfdf5' : '#fef2f2',
                    color: alertMessage.type === 'success' ? '#065f46' : '#991b1b',
                    border: `1px solid ${alertMessage.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontWeight: 600, fontSize: '0.9rem',
                    animation: 'fadeIn 0.3s ease'
                }}>
                    {alertMessage.text}
                </div>
            )}

            <div className="admin-page-header">
                <h1 className="admin-page-title">Bài tập và Kiểm tra chính thức</h1>
                <p className="admin-page-subtitle">Quản lý các bài tập và đề kiểm tra chính thức trên hệ thống.</p>
                <div className="admin-header-actions">
                    <button className="admin-btn admin-btn-outline" onClick={openAddFolderForm}><FolderOpen size={16} /> Thêm Folder</button>
                    <button className="admin-btn admin-btn-primary" onClick={openAddForm}><Plus size={16} /> Tạo bài tập và kiểm tra mới</button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="admin-search-box" style={{ flex: 1, minWidth: '200px' }}>
                    <Search size={16} className="search-icon" />
                    <input type="text" placeholder="Tìm tên bài tập và kiểm tra, tên folder..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
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
                                        <th style={{ textAlign: 'center' }}>Trạng thái</th>
                                        <th className="text-right">Hành động</th>
                                    </tr>
                                </thead>
                                <Droppable droppableId="folders" type="folder">
                                    {(provided) => (
                                        <tbody ref={provided.innerRef} {...provided.droppableProps}>
                                            {/* FOLDERS */}
                                            {filteredFolders.map((folder, fIndex) => {
                                                const isExpanded = expandedFolders.has(folder.id) || searchTerm.length > 0;
                                                const examIds = folder.examIds || [];
                                                const folderExams = filteredExams
                                                    .filter(e => examIds.includes(e.id))
                                                    .sort((a, b) => examIds.indexOf(a.id) - examIds.indexOf(b.id));

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
                                                                            <button className="admin-expand-btn"
                                                                                onClick={() => {
                                                                                    const n = new Set(expandedFolders);
                                                                                    if (isExpanded) n.delete(folder.id); else n.add(folder.id);
                                                                                    setExpandedFolders(n);
                                                                                }}>
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
                                                                                            <ClipboardCheck size={12} />
                                                                                            <span>{folderExams.length}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                                                                                </div>
                                                                                <div className="admin-text-muted" style={{ fontSize: '0.8rem', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                                    {folder.description || <span style={{ fontStyle: 'italic', color: '#cbd5e1' }}>Không có mô tả</span>}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="mobile-hide"></td>
                                                                    <td data-label="Trạng thái" className="mobile-hide"></td>
                                                                    <td className="text-right">
                                                                        <div className="admin-table-actions">
                                                                            <button className="admin-action-btn mobile-show"
                                                                                style={{
                                                                                    marginRight: 'auto',
                                                                                    background: isExpanded ? '#eff6ff' : '#f1f5f9',
                                                                                    border: isExpanded ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                                                                                    color: isExpanded ? '#2563eb' : '#64748b'
                                                                                }}
                                                                                onClick={() => {
                                                                                    const n = new Set(expandedFolders);
                                                                                    if (isExpanded) n.delete(folder.id); else n.add(folder.id);
                                                                                    setExpandedFolders(n);
                                                                                }}>
                                                                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                                            </button>
                                                                            <button className="admin-action-btn" onClick={() => openShareModal(folder, 'exam_folder')} title="Chia sẻ Folder"><Share2 size={16} /></button>
                                                                            <button className="admin-action-btn" onClick={() => openEditFolderForm(folder)} title="Sửa Folder"><Edit size={16} /></button>
                                                                            <button className="admin-action-btn danger" onClick={() => setFolderToDelete(folder)} title="Xóa Folder"><Trash2 size={16} /></button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </Draggable>
                                                        {isExpanded && (
                                                            folderExams.length === 0 ? (
                                                                <tr key={`${folder.id}-empty`} className="admin-empty-nested-row">
                                                                    <td></td>
                                                                    <td colSpan="4">
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', color: '#64748b' }}>
                                                                            <AlertTriangle size={14} style={{ opacity: 0.7 }} />
                                                                            <span style={{ fontSize: '0.85rem' }}>Folder này chưa có bài tập và kiểm tra nào. Bấm "Sửa Folder" để thêm.</span>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ) : (
                                                                <Droppable droppableId={`folder-exams-${folder.id}`} type="exam">
                                                                    {(examDropProvided) => (
                                                                        <>
                                                                        {folderExams.map((exam, exIdx) => (
                                                                            <Draggable key={exam.id} draggableId={`exam-${exam.id}`} index={exIdx}>
                                                                                {(examDragProv, examSnapshot) => (
                                                                                    <tr
                                                                                        ref={(node) => { examDragProv.innerRef(node); if (exIdx === 0) examDropProvided.innerRef(node); }}
                                                                                        {...examDragProv.draggableProps}
                                                                                        {...(exIdx === 0 ? examDropProvided.droppableProps : {})}
                                                                                        className="table-row-nested"
                                                                                        style={{
                                                                                            ...examDragProv.draggableProps.style,
                                                                                            backgroundColor: examSnapshot.isDragging ? '#f0f9ff' : undefined,
                                                                                            boxShadow: examSnapshot.isDragging ? '0 4px 12px rgba(0,0,0,0.08)' : undefined
                                                                                        }}
                                                                                    >
                                                                                        <td>
                                                                                            <div {...examDragProv.dragHandleProps} style={{ cursor: 'grab', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                                                <GripVertical size={14} />
                                                                                            </div>
                                                                                        </td>
                                                                                        <td data-label="Bài tập và Kiểm tra">
                                                                                            <div className="admin-topic-cell">
                                                                                                <div className="admin-topic-icon" style={{ background: `${exam.color || '#6366f1'}20`, width: '32px', height: '32px', fontSize: '0.9rem' }}>
                                                                                                    {exam.icon || '📋'}
                                                                                                </div>
                                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                                                                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '10px' }}>
                                                                                                        <div className="admin-topic-name" style={{ fontWeight: 600 }}>{exam.name}</div>
                                                                                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                                                                            {exam.isPublic && (
                                                                                                                <span style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '4px', background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0', whiteSpace: 'nowrap' }}>Public</span>
                                                                                                            )}
                                                                                                            {exam.teacherVisible && !exam.isPublic && (
                                                                                                                <span style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '4px', background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><GraduationCap size={9} /> GV</span>
                                                                                                            )}
                                                                                                        </div>
                                                                                                    </div>
                                                                                                    <div className="admin-text-muted" style={{ maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.75rem', marginBottom: '2px' }}>
                                                                                                        {exam.description}
                                                                                                    </div>
                                                                                                    <div className="mobile-show" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: '#64748b', flexWrap: 'wrap' }}>
                                                                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><List size={10} /> {questionCounts[exam.id] || 0} câu</span>
                                                                                                        <span>&middot;</span>
                                                                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Clock size={10} /> {exam.timingMode === 'section' ? `Theo section (${(exam.sections || []).reduce((s, sec) => s + (sec.timeLimitMinutes || 0), 0)}p)` : exam.timingMode === 'question' ? `Theo câu (${Math.round((exam.cachedQuestionTimeTotalSeconds || 0) / 60)}p)` : `Theo bài (${exam.timeLimitMinutes || 0}p)`}</span>
                                                                                                        <span>&middot;</span>
                                                                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><ClipboardCheck size={10} /> {exam.sections?.length || 0} {(exam.sections?.length || 0) === 1 ? 'section' : 'sections'}</span>
                                                                                                        <span>&middot;</span>
                                                                                                        <span className="active" style={{ color: '#059669', fontWeight: 600 }}>Active</span>
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                        </td>
                                                                                        <td data-label="Thông tin" className="mobile-hide">
                                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                                                                                                    {questionCounts[exam.id] || 0} câu hỏi
                                                                                                </span>
                                                                                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                                                                    <span style={{ fontSize: '0.65rem', background: '#e0e7ff', color: '#4f46e5', padding: '1px 4px', borderRadius: '3px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                                                                        <Clock size={10} /> {exam.timingMode === 'section' ? `Theo section (${(exam.sections || []).reduce((s, sec) => s + (sec.timeLimitMinutes || 0), 0)}ph)` : exam.timingMode === 'question' ? `Theo câu (${Math.round((exam.cachedQuestionTimeTotalSeconds || 0) / 60)}ph)` : `Theo bài (${exam.timeLimitMinutes || 0}ph)`}
                                                                                                    </span>
                                                                                                    {exam.timingMode === 'section' && (exam.sections || []).some(s => !s.timeLimitMinutes || s.timeLimitMinutes <= 0) && (
                                                                                                        <span style={{ fontSize: '0.6rem', background: '#fef2f2', color: '#dc2626', padding: '1px 4px', borderRadius: '3px', fontWeight: 700, border: '1px solid #fecaca' }}>⚠ {(exam.sections || []).filter(s => !s.timeLimitMinutes || s.timeLimitMinutes <= 0).length} section chưa hẹn giờ</span>
                                                                                                    )}
                                                                                                    {exam.timingMode === 'question' && (exam.cachedQuestionTimeMissingCount > 0) && (
                                                                                                        <span style={{ fontSize: '0.6rem', background: '#fff7ed', color: '#ea580c', padding: '1px 4px', borderRadius: '3px', fontWeight: 700, border: '1px solid #fed7aa' }}>⚠ {exam.cachedQuestionTimeMissingCount} câu hỏi chưa hẹn giờ</span>
                                                                                                    )}
                                                                                                    <span style={{ fontSize: '0.65rem', background: '#fef3c7', color: '#d97706', padding: '1px 4px', borderRadius: '3px', fontWeight: 600 }}>
                                                                                                        {exam.sections?.length || 0} {(exam.sections?.length || 0) === 1 ? 'section' : 'sections'}
                                                                                                    </span>
                                                                                                </div>
                                                                                            </div>
                                                                                        </td>
                                                                                        <td data-label="Trạng thái" className="mobile-hide" style={{ textAlign: 'center' }}>
                                                                                            <span className="admin-status-badge active" style={{ fontSize: '0.6rem', padding: '1px 5px' }}>Đang hoạt động</span>
                                                                                        </td>
                                                                                        <td className="text-right">
                                                                                            <div className="admin-table-actions">
                                                                                                <Link to={`/admin/exams/${exam.id}`} className="admin-action-btn" title="Quản lý câu hỏi"><List size={14} /></Link>
                                                                                                <button className="admin-action-btn" onClick={() => setExamToConvert(exam)} title="Chuyển thành Bài kỹ năng"><ArrowRightLeft size={14} /></button>
                                                                                                <button className="admin-action-btn" onClick={() => openShareModal(exam, 'exam')} title="Chia sẻ"><Share2 size={14} /></button>
                                                                                                <button className="admin-action-btn" onClick={() => openEditForm(exam)} title="Sửa"><Edit size={14} /></button>
                                                                                                <button className="admin-action-btn danger" onClick={() => setExamToDelete(exam)} title="Xóa"><Trash2 size={14} /></button>
                                                                                            </div>
                                                                                        </td>
                                                                                    </tr>
                                                                                )}
                                                                            </Draggable>
                                                                        ))}
                                                                        {examDropProvided.placeholder}
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
                                    {/* UNASSIGNED EXAMS */}
                                    {(() => {
                                        const assignedIds = new Set(folders.flatMap(f => f.examIds || []));
                                        const unassigned = filteredExams.filter(e => !assignedIds.has(e.id));
                                        if (unassigned.length === 0) return null;
                                        return (
                                            <>
                                                <tr className="admin-unassigned-header">
                                                    <td></td>
                                                    <td colSpan="4">
                                                        <div className="admin-unassigned-label">
                                                            <AlertTriangle size={16} />
                                                            Bài tập và Kiểm tra chưa phân loại ({unassigned.length})
                                                        </div>
                                                    </td>
                                                </tr>
                                                {unassigned.map(exam => renderExamRow(exam, false))}
                                            </>
                                        );
                                    })()}

                                    {filteredExams.length === 0 && filteredFolders.length === 0 && (
                                        <tr>
                                            <td colSpan="5">
                                                <div className="admin-empty-state">
                                                    <ClipboardCheck size={48} color="#cbd5e1" style={{ marginBottom: '16px' }} />
                                                    <p>{searchTerm ? 'Không tìm thấy kết quả.' : 'Chưa có bài tập và kiểm tra nào. Bấm "Tạo bài tập và kiểm tra mới" để bắt đầu.'}</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
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
                                        <td data-label="Nội dung"><div className="admin-topic-cell"><div className="admin-topic-icon" style={{ background: `${proposal.color || '#6366f1'}20` }}>{proposal.icon || '📋'}</div><div><div className="admin-topic-name">{proposal.proposalName}</div><div className="admin-topic-id" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{proposal.proposalDescription || 'Không có mô tả'}</div></div></div></td>
                                        <td data-label="Giáo viên"><div style={{ fontSize: '0.85rem', color: '#334155' }}>{proposal.teacherName}</div><div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{proposal.teacherEmail}</div></td>
                                        <td data-label="Loại"><div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}><span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: '#e0e7ff', color: '#4f46e5', fontWeight: 600 }}>{proposal.level === 'folder' ? 'Folder' : 'Bài lẻ'}</span><span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: proposal.isUpdate ? '#fff7ed' : '#ecfdf5', color: proposal.isUpdate ? '#c2410c' : '#059669', fontWeight: 600, border: `1px solid ${proposal.isUpdate ? '#fed7aa' : '#a7f3d0'}` }}>{proposal.isUpdate ? '🔄 Cập nhật' : '🆕 Tài liệu mới'}</span></div></td>
                                        <td data-label="Hành động" className="text-right">
                                            <div className="admin-table-actions">
                                                <button className="admin-action-btn" style={{ color: '#10b981' }} onClick={() => handleApproveProposal(proposal)} disabled={isApproving} title="Duyệt"><CheckCircle size={16} /></button>
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
                <div className="admin-modal-overlay">
                    <div className="admin-modal" style={{ maxWidth: '450px' }}>
                        <h2 className="admin-modal-title" style={{ color: '#ef4444' }}><XCircle size={24} /> Từ chối đề xuất</h2>
                        <p className="admin-modal-desc">Từ chối đề xuất <strong>{proposalToReject.proposalName}</strong> của giáo viên <strong>{proposalToReject.teacherName}</strong>?</p>
                        <div className="admin-form-group">
                            <label>Lý do từ chối (tuỳ chọn)</label>
                            <textarea className="admin-form-input admin-form-textarea" value={rejectNote} onChange={e => setRejectNote(e.target.value)} placeholder="Nhập lý do để giáo viên biết..." rows={3} />
                        </div>
                        <div className="admin-modal-actions">
                            <button className="admin-btn admin-btn-secondary" onClick={() => setRejectModalOpen(false)}>Hủy</button>
                            <button className="admin-btn admin-btn-primary" style={{ backgroundColor: '#ef4444' }} onClick={handleConfirmReject}>Xác nhận từ chối</button>
                        </div>
                    </div>
                </div>
            )}

            {/* APPROVE MODE MODAL */}
            {approveModalOpen && proposalToApprove && existingOfficialCopy && (
                <div className="admin-modal-overlay">
                    <div className="admin-modal" style={{ maxWidth: '480px' }}>
                        <h2 className="admin-modal-title" style={{ color: '#f59e0b' }}>⚠️ Đã có bản chính thức</h2>
                        <p className="admin-modal-desc" style={{ marginBottom: '8px' }}>
                            Nội dung <strong>"{proposalToApprove.proposalName}"</strong> đã có bản chính thức trước đó:
                        </p>
                        <div style={{
                            background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px',
                            padding: '12px', marginBottom: '16px', fontSize: '0.85rem', color: '#9a3412'
                        }}>
                            📄 <strong>{existingOfficialCopy.name}</strong>
                            <div style={{ fontSize: '0.75rem', color: '#c2410c', marginTop: '4px' }}>
                                ID: {existingOfficialCopy.id}
                            </div>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '20px' }}>
                            Bạn muốn <strong>cập nhật bản cũ</strong> hay <strong>tạo bản mới</strong>?
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button
                                className="admin-btn admin-btn-primary"
                                style={{ backgroundColor: '#f59e0b', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                onClick={() => handleConfirmApprove('overwrite')}
                                disabled={isApproving}
                            >
                                🔄 Cập nhật bản cũ (đè lên)
                            </button>
                            <button
                                className="admin-btn admin-btn-primary"
                                style={{ backgroundColor: '#10b981', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                onClick={() => handleConfirmApprove('create_new')}
                                disabled={isApproving}
                            >
                                ➕ Tạo bản chính thức mới
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



            {/* EXAM FORM MODAL */}
            {formOpen && (
                <div className="teacher-modal-overlay">
                    <div className="teacher-modal wide" style={{ maxWidth: '960px', overflow: 'auto' }}>
                        <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                            <button className="teacher-modal-close" onClick={() => setFormOpen(false)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <h2 className="admin-modal-title" style={{ justifyContent: 'flex-start', marginBottom: '24px', paddingRight: '40px' }}>
                            {isEditing ? 'Sửa Bài tập và Kiểm tra' : 'Tạo Bài tập và Kiểm tra mới'}
                        </h2>
                        <form onSubmit={handleFormSubmit}>
                            <div className="admin-form-group">
                                <label>Loại</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button type="button" onClick={() => setFormData({ ...formData, examType: 'homework' })} style={{ flex: 1, padding: '10px 16px', borderRadius: '12px', border: formData.examType === 'homework' ? '2px solid #7c3aed' : '2px solid #e2e8f0', background: formData.examType === 'homework' ? '#f5f3ff' : '#fff', color: formData.examType === 'homework' ? '#7c3aed' : '#64748b', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                        📝 Bài tập
                                    </button>
                                    <button type="button" onClick={() => setFormData({ ...formData, examType: 'test' })} style={{ flex: 1, padding: '10px 16px', borderRadius: '12px', border: formData.examType === 'test' ? '2px solid #ef4444' : '2px solid #e2e8f0', background: formData.examType === 'test' ? '#fef2f2' : '#fff', color: formData.examType === 'test' ? '#dc2626' : '#64748b', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                        📋 Bài kiểm tra
                                    </button>
                                </div>
                            </div>
                            <div className="admin-form-group">
                                <label>Tên bài tập và kiểm tra</label>
                                <input type="text" className="admin-form-input" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ví dụ: Kiểm tra giữa kỳ 1" />
                            </div>
                            <div className="admin-form-group">
                                <label>Mô tả ngắn</label>
                                <textarea className="admin-form-input admin-form-textarea" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Mô tả về bài tập và kiểm tra..." />
                            </div>
                            <div className="admin-form-row admin-form-row-2col">
                                <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                    <label>Biểu tượng</label>
                                    <input type="text" className="admin-form-input" required value={formData.icon} onChange={e => setFormData({ ...formData, icon: e.target.value })} placeholder="📋" />
                                </div>
                                <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                    <label>Màu nền</label>
                                    <input type="color" className="admin-form-input" style={{ padding: '4px', height: '42px' }} value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} />
                                </div>
                            </div>
                            <div className="admin-form-group">
                                <label>Chế độ thời gian</label>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    {[{ value: 'exam', label: '📋 Cả bài' }, { value: 'section', label: '📄 Theo section' }, { value: 'question', label: '❓ Theo câu hỏi' }].map(mode => (
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
                                    label="Folder (Phân loại)"
                                    labelIcon={<FolderOpen size={14} />}
                                    value={formData.folderId || ''}
                                    onChange={v => setFormData({ ...formData, folderId: v })}
                                    placeholder="-- Chưa phân loại --"
                                    options={[
                                        { value: '', label: '-- Chưa phân loại --' },
                                        ...folders.map(f => ({ value: f.id, label: f.name, icon: f.icon || '📁' }))
                                    ]}
                                />
                            </div>
                            <div className="admin-modal-actions" style={{ marginTop: '20px', flexDirection: 'row' }}>
                                <button type="button" className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setFormOpen(false)} disabled={isSaving}>Hủy</button>
                                <button type="submit" className="admin-btn admin-btn-primary" style={{ flex: 1 }} disabled={isSaving}>{isSaving ? 'Đang lưu...' : (isEditing ? 'Cập nhật' : 'Tạo mới')}</button>
                            </div>
                        </form>
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
                            {isEditingFolder ? 'Sửa Folder' : 'Thêm Folder mới'}
                        </h2>
                        <form onSubmit={handleFolderFormSubmit}>
                            <div className="admin-form-group">
                                <label>Tên Folder</label>
                                <input type="text" className="admin-form-input" required value={folderFormData.name} onChange={e => setFolderFormData({ ...folderFormData, name: e.target.value })} placeholder="Ví dụ: Kiểm tra Kỳ 1" />
                            </div>


                            {/* Select exams for folder */}
                            <div className="admin-form-group" style={{ marginTop: '16px' }}>
                                <label>Bài tập và Kiểm tra trong Folder ({folderFormData.examIds?.length || 0})</label>
                                <div style={{ maxHeight: '200px', overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px', marginTop: '8px' }}>
                                    {exams.length === 0 ? (
                                        <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>Chưa có bài tập và kiểm tra nào.</div>
                                    ) : exams.map(exam => (
                                        <div key={exam.id}
                                            onClick={() => toggleExamInFolder(exam.id)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                                                cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                                                background: (folderFormData.examIds || []).includes(exam.id) ? '#eff6ff' : 'transparent'
                                            }}>
                                            <div style={{
                                                width: '20px', height: '20px', borderRadius: '5px',
                                                border: (folderFormData.examIds || []).includes(exam.id) ? '2px solid #6366f1' : '2px solid #cbd5e1',
                                                background: (folderFormData.examIds || []).includes(exam.id) ? '#6366f1' : 'transparent',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                {(folderFormData.examIds || []).includes(exam.id) && <Check size={12} color="#fff" />}
                                            </div>
                                            <span style={{ fontSize: '1rem' }}>{exam.icon || '📋'}</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>{exam.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="admin-modal-actions" style={{ marginTop: '24px', flexDirection: 'row' }}>
                                <button type="button" className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setFolderFormOpen(false)}>Hủy</button>
                                <button type="submit" className="admin-btn admin-btn-primary" style={{ flex: 1 }}>{isEditingFolder ? 'Cập nhật' : 'Thêm Folder'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DELETE EXAM CONFIRM */}
            {examToDelete && (
                <div className="admin-modal-overlay">
                    <div className="admin-modal">
                        <h2 className="admin-modal-title" style={{ color: '#ef4444' }}><Trash2 size={24} /> Xác nhận xóa</h2>
                        <p className="admin-modal-desc">
                            Bạn có chắc chắn muốn xóa bài tập và kiểm tra <strong>{examToDelete.name}</strong>? Toàn bộ câu hỏi, bài giao và bài làm bên trong sẽ bị xóa vĩnh viễn.
                        </p>
                        <div className="admin-modal-actions">
                            <button className="admin-btn admin-btn-secondary" onClick={() => setExamToDelete(null)}>Hủy</button>
                            <button className="admin-btn admin-btn-primary" style={{ backgroundColor: '#ef4444' }} onClick={handleConfirmDelete}>Xóa vĩnh viễn</button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE FOLDER CONFIRM */}
            {folderToDelete && (
                <div className="admin-modal-overlay">
                    <div className="admin-modal">
                        <h2 className="admin-modal-title" style={{ color: '#ef4444' }}><Trash2 size={24} /> Xóa Folder</h2>
                        <p className="admin-modal-desc">
                            Xóa folder <strong>{folderToDelete.name}</strong>? Các bài tập và kiểm tra bên trong sẽ không bị xóa, chỉ folder bị xóa.
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
                    <div className="teacher-modal wide" style={{ maxWidth: '600px', overflow: 'auto' }}>
                        <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                            <button className="teacher-modal-close" onClick={() => setShareModalOpen(false)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <h2 className="admin-modal-title" style={{ justifyContent: 'flex-start', marginBottom: '24px', paddingRight: '40px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Share2 size={24} color="var(--color-primary)" />
                                Chia sẻ {resourceToShare.type === 'exam_folder' ? 'Folder' : 'Bài tập và Kiểm tra'}
                            </div>
                        </h2>

                        <div style={{ marginBottom: '20px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', margin: '0 0 4px 0' }}>{resourceToShare.name}</h3>
                            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>ID: {resourceToShare.id}</p>

                            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <input
                                    type="text"
                                    readOnly
                                    value={`${window.location.origin}/preview/superstudy?shareId=${resourceToShare.id}&shareType=${resourceToShare.type === 'exam_folder' ? 'admin_folder' : 'admin_exam'}`}
                                    style={{ flex: '1 1 200px', minWidth: '0', padding: '8px 12px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none', backgroundColor: '#f1f5f9', color: '#475569' }}
                                />
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(`${window.location.origin}/preview/superstudy?shareId=${resourceToShare.id}&shareType=${resourceToShare.type === 'exam_folder' ? 'admin_folder' : 'admin_exam'}`);
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
                                    <Lock size={16} /> Nội bộ (GV)
                                </button>
                                <button className={`share-modal-tab tab-student ${adminShareTab === 'student' ? 'active' : ''}`} onClick={() => setAdminShareTab('student')}>
                                    <GraduationCap size={16} /> Học viên
                                </button>
                            </div>

                            <div className="share-modal-columns">
                                {/* LEFT COLUMN: Nội bộ */}
                                <div className={`share-modal-col ${adminShareTab === 'internal' ? 'active' : ''}`}>
                                    <div className="share-modal-col-header teacher">
                                        <Lock size={18} /> Nội bộ (Giáo viên)
                                    </div>

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
                                                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>{resourceToShare.isPublic ? 'Bất kỳ ai cũng có thể tìm và làm bài tập và kiểm tra này.' : 'Cần cấp quyền bên dưới hoặc gửi Link trực tiếp.'}</p>
                                                </div>
                                            </div>
                                            <button onClick={handleTogglePublic} disabled={isSharing} style={{ padding: '8px 16px', background: resourceToShare.isPublic ? 'transparent' : 'var(--color-primary)', color: resourceToShare.isPublic ? '#ef4444' : '#fff', border: resourceToShare.isPublic ? '1px solid #ef4444' : 'none', borderRadius: '6px', cursor: isSharing ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                                                {resourceToShare.isPublic ? 'Tắt Public' : 'Bật Public'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="share-modal-section">
                                        <h4><GraduationCap size={16} color="#8b5cf6" /> Dành cho Giáo viên</h4>
                                        <div style={{ padding: '16px', background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a', marginBottom: '2px' }}>Cho tất cả GV sử dụng</div>
                                                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{resourceToShare.teacherVisible ? 'Tất cả GV đều thấy và giao bài được.' : 'Chỉ GV được chỉ định bên dưới mới thấy.'}</div>
                                                </div>
                                                <button onClick={() => handleToggleTeacherVisible(resourceToShare, resourceToShare.type)} disabled={isTeacherSharing} style={{ position: 'relative', flexShrink: 0, width: '40px', height: '24px', borderRadius: '12px', background: resourceToShare.teacherVisible ? '#3b82f6' : '#cbd5e1', border: 'none', cursor: 'pointer', transition: 'background 0.3s' }}>
                                                    <div style={{ position: 'absolute', top: '2px', left: resourceToShare.teacherVisible ? '18px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}></div>
                                                </button>
                                            </div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><UserPlus size={14} /> Chia sẻ cho GV cụ thể</div>
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
                                            <div style={{ marginTop: '16px', padding: '14px', background: '#faf5ff', borderRadius: '10px', border: '1px dashed #c4b5fd' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                                    <span style={{ fontSize: '1rem' }}>🔄</span>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#6d28d9' }}>Chuyển quyền sở hữu</span>
                                                </div>
                                                <p style={{ fontSize: '0.75rem', color: '#7c3aed', margin: '0 0 8px 0' }}>Nội dung sẽ mất tag "Chính thức" và thuộc về giáo viên.</p>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <EmailAutocomplete value={transferEmail} onChange={setTransferEmail} onSelect={(email) => { const collName = resourceToShare.type === 'exam_folder' ? 'exam_folders' : 'exams'; handleConfirmTransfer(email, collName, resourceToShare.id, resourceToShare.name || resourceToShare.title); }} placeholder="Email giáo viên nhận..." roleFilter="teacher" />
                                                    <button onClick={() => { const collName = resourceToShare.type === 'exam_folder' ? 'exam_folders' : 'exams'; handleConfirmTransfer(transferEmail, collName, resourceToShare.id, resourceToShare.name || resourceToShare.title); }} disabled={isTransferring || !transferEmail.trim()} style={{ flexShrink: 0, padding: '8px 14px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '6px', cursor: (isTransferring || !transferEmail.trim()) ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.82rem', opacity: (isTransferring || !transferEmail.trim()) ? 0.5 : 1 }}>
                                                        {isTransferring ? 'Đang chuyển...' : 'Chuyển'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* RIGHT COLUMN: Học viên */}
                                <div className={`share-modal-col ${adminShareTab === 'student' ? 'active' : ''}`}>
                                    <div className="share-modal-col-header student">
                                        <GraduationCap size={18} /> Học viên
                                    </div>

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

                                    {resourceToShare.type !== 'exam_folder' && (
                                        <div className="share-modal-section" style={{ padding: '16px', background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', borderRadius: '12px', border: '1px solid #fde68a' }}>
                                            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', fontWeight: 700, color: '#92400e', margin: '0 0 6px 0' }}><FileText size={16} /> Giao bài cho lớp</h4>
                                            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '12px' }}>Giao nhanh bài này cho 1 lớp mà bạn đang chủ nhiệm.</p>
                                            {existingAssignments.length > 0 && (
                                                <div style={{ marginBottom: '12px' }}>
                                                    <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>Đã giao cho:</p>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                        {existingAssignments.filter((a, i, arr) => arr.findIndex(x => x.targetId === a.targetId) === i).map(a => (
                                                            <span key={a.id} style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px', background: 'linear-gradient(135deg, #fef3c7, #fde68a)', color: '#92400e', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #fcd34d' }}>✅ {a.groupName || a.targetName || allGroups.find(g => g.id === a.groupId)?.name || 'Lớp'}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {teacherManagedGroups.length > 0 ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                        <div style={{ flex: '1 1 140px', minWidth: 0, position: 'relative', zIndex: 20 }}>
                                                            <CustomSelect value={quickAssignGroupId} onChange={v => { setQuickAssignGroupId(v); setQuickAssignSelectedStudentIds([]); setStudentDropdownOpen(false); if (v) { setQuickAssignStudentsLoading(true); getStudentsInGroup(v).then(students => { setQuickAssignStudents(students); setQuickAssignStudentsLoading(false); }).catch(() => setQuickAssignStudentsLoading(false)); } else { setQuickAssignStudents([]); } }} placeholder="-- Chọn lớp --" options={teacherManagedGroups.map(g => ({ value: g.id, label: g.name, icon: '🏫' }))} style={{ margin: 0 }} />
                                                        </div>
                                                        <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                                                            <input type="datetime-local" value={quickAssignDueDate} onChange={e => setQuickAssignDueDate(e.target.value)} style={{ width: '100%', padding: '6px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.88rem', color: '#1e293b', minHeight: '38px', boxSizing: 'border-box' }} />
                                                        </div>
                                                    </div>
                                                    {quickAssignGroupId && (
                                                        <div style={{ position: 'relative', zIndex: 15 }}>
                                                            <button type="button" onClick={() => setStudentDropdownOpen(!studentDropdownOpen)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: `1.5px solid ${quickAssignSelectedStudentIds.length > 0 ? '#3b82f6' : '#e2e8f0'}`, background: quickAssignSelectedStudentIds.length > 0 ? '#eff6ff' : '#fff', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontSize: '0.82rem', color: '#334155' }}>
                                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <Users size={14} color="#64748b" />
                                                                    {quickAssignStudentsLoading ? 'Đang tải...' : quickAssignSelectedStudentIds.length > 0 ? `${quickAssignSelectedStudentIds.length} học viên được chọn` : 'Cả lớp (mặc định)'}
                                                                </span>
                                                                <ChevronDown size={14} color="#64748b" style={{ transform: studentDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                                            </button>
                                                            {studentDropdownOpen && !quickAssignStudentsLoading && quickAssignStudents.length > 0 && (
                                                                <div style={{ marginTop: '4px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto' }}>
                                                                    <div style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}>
                                                                        <label style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', cursor: 'pointer', borderRadius: '6px', background: '#f8fafc', fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>
                                                                            <input type="checkbox" checked={quickAssignSelectedStudentIds.length === 0} onChange={() => setQuickAssignSelectedStudentIds([])} style={{ marginRight: '8px', cursor: 'pointer' }} />
                                                                            Cả lớp ({quickAssignStudents.length} học viên)
                                                                        </label>
                                                                    </div>
                                                                    <div style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                        {quickAssignStudents.map(s => {
                                                                            const isChecked = quickAssignSelectedStudentIds.includes(s.uid);
                                                                            return (
                                                                                <label key={s.uid} style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', cursor: 'pointer', borderRadius: '6px', background: isChecked ? '#eff6ff' : 'transparent', transition: 'background 0.15s' }}>
                                                                                    <input type="checkbox" checked={isChecked} onChange={() => { setQuickAssignSelectedStudentIds(prev => isChecked ? prev.filter(id => id !== s.uid) : [...prev, s.uid]); }} style={{ marginRight: '8px', cursor: 'pointer', width: '15px', height: '15px' }} />
                                                                                    <div>
                                                                                        <div style={{ fontSize: '0.82rem', color: isChecked ? '#1d4ed8' : '#334155', fontWeight: isChecked ? 500 : 400 }}>{s.displayName || s.email?.split('@')[0] || 'Học viên'}</div>
                                                                                        {s.email && <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{s.email}</div>}
                                                                                    </div>
                                                                                </label>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>⏰ Thời điểm bắt đầu</div>
                                                        <div style={{ display: 'flex', gap: '6px' }}>
                                                            <button type="button" onClick={() => setQuickAssignScheduledStart('')} style={{ flex: 1, padding: '7px 10px', borderRadius: '8px', border: !quickAssignScheduledStart ? '2px solid #059669' : '1.5px solid #e2e8f0', background: !quickAssignScheduledStart ? 'linear-gradient(135deg, #10b981, #059669)' : '#fff', color: !quickAssignScheduledStart ? '#fff' : '#64748b', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s' }}>Bắt đầu ngay</button>
                                                            <button type="button" onClick={() => setQuickAssignScheduledStart('pending')} style={{ flex: 1, padding: '7px 10px', borderRadius: '8px', border: quickAssignScheduledStart ? '2px solid #d97706' : '1.5px solid #e2e8f0', background: quickAssignScheduledStart ? 'linear-gradient(135deg, #f59e0b, #d97706)' : '#fff', color: quickAssignScheduledStart ? '#fff' : '#64748b', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s' }}>Hẹn ngày...</button>
                                                        </div>
                                                        {quickAssignScheduledStart && (
                                                            <div style={{ marginTop: '6px' }}>
                                                                <input type="datetime-local" value={quickAssignScheduledStart === 'pending' ? '' : quickAssignScheduledStart} onChange={e => setQuickAssignScheduledStart(e.target.value)} style={{ width: '100%', padding: '6px 12px', borderRadius: '8px', border: '1.5px solid #f59e0b', fontSize: '0.85rem', color: '#1e293b', background: '#fffbeb', boxSizing: 'border-box' }} />
                                                                {quickAssignScheduledStart && quickAssignScheduledStart !== 'pending' && quickAssignDueDate && new Date(quickAssignScheduledStart) >= new Date(quickAssignDueDate) && (
                                                                    <p style={{ color: '#ef4444', fontSize: '0.75rem', margin: '4px 0 0', fontWeight: 600 }}>⚠ Ngày bắt đầu phải trước hạn nộp!</p>
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
                                                <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>Bạn chưa quản lý lớp nào.</p>
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
            )}

            {/* CONVERT TO GRAMMAR CONFIRM */}
            {examToConvert && (
                <div className="admin-modal-overlay">
                    <div className="admin-modal" style={{ maxWidth: '480px' }}>
                        <h2 className="admin-modal-title" style={{ color: '#7c3aed' }}><ArrowRightLeft size={24} /> Chuyển thành Bài kỹ năng</h2>
                        <p className="admin-modal-desc">
                            Chuyển <strong>{examToConvert.name}</strong> thành Bài kỹ năng. Bài gốc sẽ được giữ nguyên.
                        </p>
                        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 14px', fontSize: '0.8rem', color: '#1e40af', marginBottom: '16px' }}>
                            ℹ️ Tất cả câu hỏi từ mọi section sẽ được gom lại thành 1 bài duy nhất. Quản lý thời gian sẽ bị bỏ.
                        </div>
                        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '10px 14px', fontSize: '0.8rem', color: '#92400e', marginBottom: '16px' }}>
                            💡 Sau khi chuyển đổi, hãy chọn <strong>Độ tuổi</strong> phù hợp để AI tạo variations chính xác hơn.
                        </div>
                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 14px', fontSize: '0.8rem', color: '#166534', marginBottom: '16px' }}>
                            🔒 Bài mới sẽ được lưu vào mục <strong>Bài kỹ năng Admin</strong>.
                        </div>
                        <div className="admin-modal-actions">
                            <button className="admin-btn admin-btn-secondary" onClick={() => setExamToConvert(null)} disabled={isConvertingToGrammar}>Hủy</button>
                            <button className="admin-btn admin-btn-primary" onClick={handleConfirmConvertToGrammar} disabled={isConvertingToGrammar} style={{ background: '#7c3aed' }}>
                                {isConvertingToGrammar ? 'Đang chuyển đổi...' : '🔄 Xác nhận chuyển đổi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
