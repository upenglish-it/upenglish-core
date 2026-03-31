import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
    updateUserRole, toggleUserDisabled, getUserLearningStats, deleteUserProgress,
    approveUser, rejectUser, renewUser,
    addEmailToWhitelist, removeEmailFromWhitelist, getWhitelistEmails, updateWhitelistDisplayName, updateWhitelistEntry,
    getFolders, updateUserFolderAccess, getUserFolderAccess,
    getGroups, updateUserGroups, permanentDeleteUser, updateUserDisplayName, changeUserEmail,
    softDeleteUser, restoreUser, getAllUsers
} from '../../services/adminService';
import {
    User, Shield, X, Calendar, Hash, Mail, Award, Lock, Unlock,
    ShieldCheck, ShieldOff, Trash2, BookOpen, BarChart3, RefreshCw,
    CheckCircle, XCircle, Clock, UserPlus, Plus, Timer, Users, FolderOpen, Save, Layers, Search, Briefcase,
    Edit, Check, RotateCcw, Archive, Monitor
} from 'lucide-react';
import Avatar from '../../components/common/Avatar';
import CustomSelect from '../../components/common/CustomSelect';

const DURATION_OPTIONS = [
    { label: '7 ngày', value: 7 },
    { label: '30 ngày', value: 30 },
    { label: '90 ngày', value: 90 },
    { label: '365 ngày', value: 365 },
    { label: 'Vĩnh viễn', value: null },
    { label: 'Chọn ngày', value: 'custom' },
];

export default function AdminUsersPage() {
    const { user: currentAdmin } = useAuth();
    const isStaff = currentAdmin?.role === 'staff';
    const location = useLocation();
    const hasHandledNotification = useRef(false);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('approved'); // pending | approved | whitelist
    const [selectedUser, setSelectedUser] = useState(null);
    const [userStats, setUserStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [confirmAction, setConfirmAction] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [alertMessage, setAlertMessage] = useState(null);
    const [folders, setFolders] = useState([]);

    // Role modal
    const [changeRoleModal, setChangeRoleModal] = useState(null);

    // Approve modal
    const [approveModal, setApproveModal] = useState(null); // { user }
    const [approveRole, setApproveRole] = useState('user');
    const [approveDuration, setApproveDuration] = useState(30);
    const [approveCustomDate, setApproveCustomDate] = useState('');
    const [approveFolderIds, setApproveFolderIds] = useState([]);
    const [approveGroupIds, setApproveGroupIds] = useState([]);

    // Whitelist
    const [whitelist, setWhitelist] = useState([]);
    const [whitelistForm, setWhitelistForm] = useState(false);
    const [wlEmail, setWlEmail] = useState('');
    const [wlDisplayName, setWlDisplayName] = useState('');
    const [wlRole, setWlRole] = useState('user');
    const [wlDuration, setWlDuration] = useState(30);
    const [wlCustomDate, setWlCustomDate] = useState('');
    const [wlGroupIds, setWlGroupIds] = useState([]);
    const [wlFolderIds, setWlFolderIds] = useState([]);

    const [groups, setGroups] = useState([]);

    const roleOptions = [
        { value: 'user', label: 'Học viên', icon: <User size={16} /> },
        { value: 'it', label: 'IT', icon: <Monitor size={16} /> },
        { value: 'staff', label: 'Nhân viên VP', icon: <Briefcase size={16} /> },
        { value: 'teacher', label: 'Giáo viên', icon: <Award size={16} /> },
        ...(currentAdmin?.role === 'admin' ? [{ value: 'admin', label: 'Admin', icon: <ShieldCheck size={16} /> }] : [])
    ];

    // User Detail Additional State
    const [userFolderIds, setUserFolderIds] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [userGroupIds, setUserGroupIds] = useState([]);
    const [isSavingFolders, setIsSavingFolders] = useState(false);

    const [isEditingName, setIsEditingName] = useState(false);
    const [tempDisplayName, setTempDisplayName] = useState('');

    const [isEditingEmail, setIsEditingEmail] = useState(false);
    const [tempEmail, setTempEmail] = useState('');

    // Whitelist editing 
    const [editingWlId, setEditingWlId] = useState(null);
    const [wlTempName, setWlTempName] = useState('');

    // Whitelist edit modal
    const [editWlModal, setEditWlModal] = useState(null);
    const [editWlName, setEditWlName] = useState('');
    const [editWlRole, setEditWlRole] = useState('user');
    const [editWlDuration, setEditWlDuration] = useState(30);
    const [editWlCustomDate, setEditWlCustomDate] = useState('');
    const [editWlGroupIds, setEditWlGroupIds] = useState([]);
    const [editWlFolderIds, setEditWlFolderIds] = useState([]);

    useEffect(() => {
        loadUsers();
        loadWhitelist();
        loadDataLists();
    }, []);

    // Auto-open user detail popup when navigated from notification
    useEffect(() => {
        const notifData = location.state?.notificationData;
        if (!notifData || hasHandledNotification.current || loading || users.length === 0) return;

        if (notifData.type === 'accounts_expiring') {
            hasHandledNotification.current = true;
            const expiringIds = notifData.expiringUserIds;
            if (expiringIds && expiringIds.length > 0) {
                // Open detail for the first expiring user
                const firstUser = users.find(u => expiringIds.includes(u.uid));
                if (firstUser) {
                    openUserDetail(firstUser);
                }
            } else {
                // Fallback: find users that are expiring within 7 days (for old notifications without expiringUserIds)
                const now = new Date();
                const sevenDaysLater = new Date(now.getTime() + 7 * 86400000);
                const expiringUsers = users.filter(u => {
                    if (!u.expiresAt || u.status !== 'approved') return false;
                    const d = u.expiresAt.toDate ? u.expiresAt.toDate() : new Date(u.expiresAt);
                    return d >= now && d <= sevenDaysLater;
                });
                if (expiringUsers.length > 0) {
                    openUserDetail(expiringUsers[0]);
                }
            }
            // Clear location state to prevent re-triggering
            window.history.replaceState({}, '');
        }
    }, [location.state, loading, users]);

    async function loadDataLists() {
        try {
            const [foldersList, groupsList] = await Promise.all([getFolders(), getGroups()]);
            setFolders(foldersList);
            setGroups(groupsList);
        } catch (error) {
            console.error(error);
        }
    }

    async function loadUsers() {
        setLoading(true);
        try {
            const usersList = await getAllUsers();
            usersList.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
            setUsers(usersList);
        } catch (error) {
            console.error(error);
        }
        setLoading(false);
    }

    async function loadWhitelist() {
        try {
            const list = await getWhitelistEmails();
            setWhitelist(list);
        } catch (err) {
            console.error(err);
        }
    }

    function formatDate(timestamp) {
        if (!timestamp) return '—';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function formatDateTime(timestamp) {
        if (!timestamp) return '—';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('vi-VN');
    }

    function isSelf(uid) {
        return currentAdmin?.uid === uid;
    }

    function isUserExpired(u) {
        if (!u.expiresAt) return false;
        const d = u.expiresAt.toDate ? u.expiresAt.toDate() : new Date(u.expiresAt);
        return d <= new Date();
    }

    // Filtered lists
    const pendingUsers = users.filter(u => u.status === 'pending' && !u.isDeleted);
    const archivedUsers = users.filter(u => u.isDeleted);
    const approvedUsersRaw = users.filter(u => u.status === 'approved' && !u.isDeleted);
    const approvedUsers = approvedUsersRaw
        .filter(u => {
            const matchesSearch = (u.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (u.email || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesRole = roleFilter === 'all' || u.role === roleFilter;
            return matchesSearch && matchesRole;
        })
        .sort((a, b) => {
            const rolePriority = { admin: 0, staff: 1, teacher: 2, user: 3 };
            const priorityA = rolePriority[a.role || 'user'];
            const priorityB = rolePriority[b.role || 'user'];

            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }

            // Same role, sort by name A-Z (Vietnamese locale)
            const nameA = (a.displayName || a.email || '').toLowerCase();
            const nameB = (b.displayName || b.email || '').toLowerCase();
            return nameA.localeCompare(nameB, 'vi');
        });

    // Whitelist emails that haven't joined yet
    const pendingInvitesRaw = whitelist.filter(w =>
        !users.some(u => u.email.toLowerCase() === w.email.toLowerCase())
    );
    const pendingInvites = searchTerm
        ? pendingInvitesRaw.filter(w =>
            (w.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (w.email || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
        : pendingInvitesRaw;

    async function openUserDetail(u) {
        setSelectedUser(u);
        setIsEditingName(false);
        setIsEditingEmail(false);
        setTempDisplayName(u.displayName || '');
        setUserStats(null);
        setUserFolderIds([]);
        setUserGroupIds(u.groupIds || []);
        setStatsLoading(true);
        try {
            const [stats, folderIds] = await Promise.all([
                getUserLearningStats(u.uid),
                getUserFolderAccess(u.uid)
            ]);
            setUserStats(stats);
            setUserFolderIds(folderIds);
        } catch (err) {
            setUserStats({ totalWords: 0, learnedWords: 0, totalReviews: 0 });
        }
        setStatsLoading(false);
    }

    async function handleUpdateName() {
        if (!selectedUser || !tempDisplayName.trim()) return;
        setActionLoading(true);
        try {
            await updateUserDisplayName(selectedUser.uid, tempDisplayName.trim());
            setSelectedUser({ ...selectedUser, displayName: tempDisplayName.trim() });
            setUsers(prev => prev.map(u => u.uid === selectedUser.uid ? { ...u, displayName: tempDisplayName.trim() } : u));
            setIsEditingName(false);
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi: ' + err.message });
        }
        setActionLoading(false);
    }

    async function handleUpdateEmail() {
        if (!selectedUser || !tempEmail.trim()) return;
        const newEmail = tempEmail.trim().toLowerCase();
        if (newEmail === selectedUser.email) { setIsEditingEmail(false); return; }
        setActionLoading(true);
        try {
            await changeUserEmail(selectedUser.uid, newEmail);
            setSelectedUser({ ...selectedUser, email: newEmail });
            setUsers(prev => prev.map(u => u.uid === selectedUser.uid ? { ...u, email: newEmail } : u));
            setIsEditingEmail(false);
            setAlertMessage({ type: 'success', text: `Đã đổi email thành ${newEmail}` });
        } catch (err) {
            const msg = err?.message?.includes('already-exists') ? 'Email này đã được sử dụng bởi tài khoản khác.' : ('Lỗi: ' + (err?.message || 'Không xác định'));
            setAlertMessage({ type: 'error', text: msg });
        }
        setActionLoading(false);
    }

    async function handleSaveUserPermissions() {
        if (!selectedUser) return;
        setIsSavingFolders(true);
        try {
            await updateUserFolderAccess(selectedUser.uid, userFolderIds);
            await updateUserGroups(selectedUser.uid, userGroupIds);

            // Cập nhật state local để hiển thị nhạy bén hơn
            setSelectedUser({ ...selectedUser, groupIds: userGroupIds });

        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi: ' + err.message });
        }
        setIsSavingFolders(false);
    }

    function toggleUserFolder(folderId) {
        setUserFolderIds(prev => prev.includes(folderId) ? prev.filter(id => id !== folderId) : [...prev, folderId]);
    }

    function toggleUserGroup(groupId) {
        setUserGroupIds(prev => prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]);
    }

    // ===== APPROVE =====
    function openApproveModal(u) {
        setApproveModal({ user: u });
        setApproveRole('user');
        setApproveDuration(30);
        setApproveCustomDate('');
        setApproveFolderIds([]);
        setApproveGroupIds([]);
    }

    function toggleApproveFolder(folderId) {
        setApproveFolderIds(prev => prev.includes(folderId) ? prev.filter(id => id !== folderId) : [...prev, folderId]);
    }

    function toggleApproveGroup(groupId) {
        setApproveGroupIds(prev => prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]);
    }

    async function handleApprove() {
        if (!approveModal) return;
        setActionLoading(true);
        try {
            const finalDuration = approveDuration === 'custom' ? null : approveDuration;
            const finalCustomDate = approveDuration === 'custom' ? approveCustomDate : null;
            await approveUser(approveModal.user.uid, approveRole, finalDuration, finalCustomDate);
            await updateUserFolderAccess(approveModal.user.uid, approveFolderIds);
            await updateUserGroups(approveModal.user.uid, approveGroupIds);
            setApproveModal(null);
            await loadUsers();
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi: ' + err.message });
        }
        setActionLoading(false);
    }

    // ===== REJECT / DELETE =====
    function handleReject(u) {
        setConfirmAction({
            type: 'reject',
            message: `Từ chối & xóa tài khoản ${u.email}?`,
            action: async () => { await rejectUser(u.uid); }
        });
    }

    function handleDelete(u) {
        if (currentAdmin?.role === 'staff' && u.role === 'admin') {
            setAlertMessage({ type: 'error', text: 'Nhân viên VP không có quyền xóa tài khoản của Admin!' });
            return;
        }

        setConfirmAction({
            type: 'delete',
            message: `Chuyển tài khoản ${u.email} vào "Người dùng cũ"? Bạn có thể khôi phục sau này.`,
            action: async () => { await softDeleteUser(u.uid); }
        });
    }

    function handlePermanentDelete(u) {
        setConfirmAction({
            type: 'delete',
            message: `Xóa vĩnh viễn tài khoản ${u.email} khỏi Firebase Auth và Firestore? Hành động này KHÔNG THỂ hoàn tác.`,
            action: async () => { await permanentDeleteUser(u.uid); }
        });
    }

    function handleRestore(u) {
        setConfirmAction({
            type: 'restore',
            message: `Khôi phục tài khoản ${u.email}?`,
            action: async () => { await restoreUser(u.uid); }
        });
    }

    // ===== RENEW =====
    function openRenewModal(u) {
        setApproveModal({ user: u, isRenew: true });
        setApproveRole(u.role || 'user');
        setApproveDuration(30);
        setApproveCustomDate('');
    }

    async function handleRenew() {
        if (!approveModal) return;
        setActionLoading(true);
        try {
            const finalDuration = approveDuration === 'custom' ? null : approveDuration;
            const finalCustomDate = approveDuration === 'custom' ? approveCustomDate : null;
            await renewUser(approveModal.user.uid, finalDuration, finalCustomDate);
            setApproveModal(null);
            await loadUsers();
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi: ' + err.message });
        }
        setActionLoading(false);
    }

    // ===== OTHER ACTIONS =====
    function openRoleModal(u) {
        if (isSelf(u.uid)) return;
        setChangeRoleModal({ user: u, role: u.role || 'user' });
    }

    async function handleConfirmChangeRole() {
        if (!changeRoleModal) return;

        // Staff protection check
        if (currentAdmin?.role === 'staff' && changeRoleModal.user.role === 'admin') {
            setAlertMessage({ type: 'error', text: 'Nhân viên VP không có quyền thay đổi vai trò của Admin!' });
            return;
        }

        setActionLoading(true);
        try {
            await updateUserRole(changeRoleModal.user.uid, changeRoleModal.role);
            setChangeRoleModal(null);
            if (selectedUser && selectedUser.uid === changeRoleModal.user.uid) {
                setSelectedUser({ ...selectedUser, role: changeRoleModal.role });
            }
            await loadUsers();
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi: ' + err.message });
        }
        setActionLoading(false);
    }

    function handleToggleDisabled(u) {
        if (isSelf(u.uid)) return;

        if (currentAdmin?.role === 'staff' && u.role === 'admin') {
            setAlertMessage({ type: 'error', text: 'Nhân viên VP không có quyền khóa tài khoản của Admin!' });
            return;
        }

        const willDisable = !u.disabled;
        setConfirmAction({
            type: 'disable', message: `${willDisable ? 'Khóa' : 'Mở khóa'} tài khoản ${u.email}?`,
            action: async () => { await toggleUserDisabled(u.uid, willDisable); }
        });
    }

    function handleDeleteProgress(u) {
        setConfirmAction({
            type: 'delete', message: `Xóa TOÀN BỘ tiến trình học tập của ${u.email}? Không thể hoàn tác!`,
            action: async () => { await deleteUserProgress(u.uid); }
        });
    }

    async function executeConfirmAction() {
        if (!confirmAction) return;
        setActionLoading(true);
        try {
            await confirmAction.action();
            setConfirmAction(null);
            setSelectedUser(null);
            await loadUsers();
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi: ' + err.message });
        }
        setActionLoading(false);
    }

    // ===== WHITELIST =====
    async function handleAddWhitelist(e) {
        e.preventDefault();
        if (!wlEmail.trim()) return;
        setActionLoading(true);
        try {
            const finalDuration = wlDuration === 'custom' ? null : wlDuration;
            const finalCustomDate = wlDuration === 'custom' ? wlCustomDate : null;
            await addEmailToWhitelist(wlEmail, wlRole, finalDuration, finalCustomDate, currentAdmin?.email || '', {
                groupIds: wlGroupIds,
                folderAccess: wlFolderIds,
                displayName: wlDisplayName.trim(),
            });
            setWlEmail('');
            setWlDisplayName('');
            setWlGroupIds([]);
            setWlFolderIds([]);
            setWlCustomDate('');
            setWhitelistForm(false);
            await loadWhitelist();
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi: ' + err.message });
        }
        setActionLoading(false);
    }

    async function handleUpdateWhitelistName(email) {
        if (!wlTempName.trim()) {
            setEditingWlId(null);
            return;
        }
        setActionLoading(true);
        try {
            await updateWhitelistDisplayName(email, wlTempName);
            setEditingWlId(null);
            await loadWhitelist();
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi: ' + err.message });
        }
        setActionLoading(false);
    }

    function openEditWlModal(w) {
        setEditWlModal(w);
        setEditWlName(w.displayName || '');
        setEditWlRole(w.role || 'user');
        setEditWlDuration(w.durationDays || (w.customExpiresAt ? 'custom' : null));
        setEditWlCustomDate(w.customExpiresAt || '');
        setEditWlGroupIds(w.groupIds || []);
        setEditWlFolderIds(w.folderAccess || []);
    }

    async function handleSaveEditWl() {
        if (!editWlModal) return;
        setActionLoading(true);
        try {
            await updateWhitelistEntry(editWlModal.email, {
                displayName: editWlName.trim(),
                role: editWlRole,
                durationDays: editWlDuration === 'custom' ? null : editWlDuration,
                customExpiresAt: editWlDuration === 'custom' ? editWlCustomDate : null,
                groupIds: editWlGroupIds,
                folderAccess: editWlFolderIds,
            });
            setEditWlModal(null);
            await loadWhitelist();
        } catch (err) {
            setAlertMessage({ type: 'error', text: 'Lỗi: ' + err.message });
        }
        setActionLoading(false);
    }

    function handleRemoveWhitelist(wl) {
        if (currentAdmin?.role === 'staff' && wl.role === 'admin') {
            setAlertMessage({ type: 'error', text: 'Nhân viên VP không có quyền xóa Admin khỏi danh sách pre-approve!' });
            return;
        }

        setConfirmAction({
            type: 'delete', message: `Xóa ${wl.email} khỏi danh sách pre-approve?`,
            action: async () => { await removeEmailFromWhitelist(wl.email); await loadWhitelist(); }
        });
    }

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <h1 className="admin-page-title">Quản lý Người dùng</h1>
                <p className="admin-page-subtitle">Duyệt, phân quyền và quản lý tài khoản học viên, giáo viên, nhân viên.</p>
            </div>

            {/* TABS */}
            <div className="admin-tabs-container">
                <button
                    onClick={() => setActiveTab('approved')}
                    className={activeTab === 'approved' ? 'active' : ''}
                >
                    <Users size={16} /> <span className="admin-tab-label">Đã duyệt</span>
                </button>
                <button
                    onClick={() => setActiveTab('pending')}
                    className={activeTab === 'pending' ? 'active' : ''}
                >
                    <Clock size={16} /> <span className="admin-tab-label">Chờ duyệt</span>
                    {pendingUsers.length > 0 && (
                        <span style={{ background: '#ef4444', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                            {pendingUsers.length <= 99 ? pendingUsers.length : '99+'}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('archived')}
                    className={activeTab === 'archived' ? 'active' : ''}
                >
                    <Archive size={16} /> <span className="admin-tab-label">Người dùng cũ</span>
                    {archivedUsers.length > 0 && (
                        <span style={{ background: '#94a3b8', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                            {archivedUsers.length <= 99 ? archivedUsers.length : '99+'}
                        </span>
                    )}
                </button>
            </div>

            {/* ===== TAB: PENDING ===== */}
            {
                activeTab === 'pending' && (
                    <div className="admin-card">
                        {loading ? (
                            <div className="admin-empty-state">Đang tải...</div>
                        ) : pendingUsers.length === 0 ? (
                            <div className="admin-empty-state" style={{ padding: '48px 24px' }}>
                                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                                    <CheckCircle size={28} color="#22c55e" />
                                </div>
                                <h3 style={{ margin: '0 0 4px', fontWeight: 700 }}>Không có yêu cầu nào</h3>
                                <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>Tất cả người dùng đã được phê duyệt.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {pendingUsers.map(u => (
                                    <div key={u.uid} style={{
                                        display: 'flex', alignItems: 'center', gap: '14px', padding: '16px',
                                        background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)', flexWrap: 'wrap'
                                    }}>
                                        <Avatar src={u.photoURL} alt={u.displayName} size={44} style={{ border: '2px solid #fde68a' }} />
                                        <div style={{ flex: 1, minWidth: '140px' }}>
                                            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{u.displayName || u.email}</div>
                                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{u.email}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#b45309', marginTop: '2px' }}>Đăng ký: {formatDate(u.createdAt)}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                            <button className="admin-btn admin-btn-primary" style={{ fontSize: '0.85rem', padding: '8px 16px' }} onClick={() => openApproveModal(u)}>
                                                <CheckCircle size={16} /> Duyệt
                                            </button>
                                            <button className="admin-btn admin-btn-secondary" style={{ fontSize: '0.85rem', padding: '8px 16px', color: '#ef4444', borderColor: '#fecaca' }} onClick={() => handleReject(u)}>
                                                <XCircle size={16} /> Từ chối
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )
            }

            {/* ===== TAB: APPROVED ===== */}
            {
                activeTab === 'approved' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* UNIFIED SEARCH BAR */}
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                            <div className="admin-search-box" style={{ flex: 1, minWidth: '240px', maxWidth: '460px' }}>
                                <Search size={18} className="search-icon" />
                                <input
                                    type="text"
                                    placeholder="Tìm tên hoặc email..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div style={{ width: '160px' }}>
                                <CustomSelect
                                    value={roleFilter}
                                    onChange={setRoleFilter}
                                    options={[
                                        { value: 'all', label: 'Tất cả vai trò' },
                                        ...roleOptions
                                    ]}
                                    placeholder="Lọc vai trò"
                                    style={{ marginBottom: 0 }}
                                />
                            </div>
                        </div>
                        {/* TRẠNG THÁI WAITING / PRE-APPROVE */}
                        <div className="admin-card">
                            <div className="admin-card-header" style={{ marginBottom: pendingInvites.length > 0 ? '16px' : '0' }}>
                                <div>
                                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', color: '#1e293b' }}>Danh sách Pre-approve</h3>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                                        Thêm email vào danh sách để hệ thống tự động duyệt.
                                    </p>
                                </div>
                                <button className="admin-btn admin-btn-primary" onClick={() => setWhitelistForm(true)}>
                                    <Plus size={16} /> Thêm email
                                </button>
                            </div>

                            {pendingInvites.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {pendingInvites.map(w => (
                                        <div key={w.id} className="wl-item">
                                            <div className="wl-item-icon">
                                                <Mail size={18} color="#22c55e" />
                                            </div>
                                            <div className="wl-item-content">
                                                <div className="wl-item-name-row">
                                                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#101828' }}>
                                                        {w.displayName || <span style={{ color: '#94a3b8', fontWeight: 400, fontStyle: 'italic' }}>Chưa đặt tên</span>}
                                                    </div>
                                                </div>
                                                <div className="wl-item-email">{w.email}</div>

                                                <div className="wl-item-info-row">
                                                    {w.role === 'admin' ? (
                                                        <span className="admin-role-badge admin">Admin</span>
                                                    ) : w.role === 'teacher' ? (
                                                        <span className="admin-role-badge teacher">Giáo viên</span>
                                                    ) : w.role === 'staff' ? (
                                                        <span className="admin-role-badge staff">Nhân viên VP</span>
                                                    ) : w.role === 'it' ? (
                                                        <span className="admin-role-badge" style={{ background: '#f0fdf4', color: '#15803d' }}>IT</span>
                                                    ) : (
                                                        <span className="admin-role-badge user">Học viên</span>
                                                    )}
                                                    <span style={{ color: '#cbd5e1' }}>•</span>
                                                    <span>Hạn: {w.durationDays ? `${w.durationDays} ngày` : 'Vĩnh viễn'}</span>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                                <button
                                                    className="admin-action-btn"
                                                    style={{ border: 'none', background: '#eff6ff', color: '#3b82f6', flexShrink: 0 }}
                                                    onClick={() => openEditWlModal(w)}
                                                    title="Chỉnh sửa"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                {!(currentAdmin?.role === 'staff' && w.role === 'admin') && (
                                                    <button
                                                        className="admin-action-btn danger"
                                                        style={{ border: 'none', background: '#fee2e2', flexShrink: 0 }}
                                                        onClick={() => handleRemoveWhitelist(w)}
                                                        title="Xóa"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="admin-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
                                <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1e293b', whiteSpace: 'nowrap' }}>Thành viên hiện tại</h3>
                            </div>
                            {loading ? (
                                <div className="admin-empty-state">Đang tải...</div>
                            ) : approvedUsers.length === 0 ? (
                                <div className="admin-empty-state"><h3>Chưa có người dùng đã duyệt</h3></div>
                            ) : (
                                <div className="admin-table-container">
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th>Người dùng</th>

                                                <th>Hạn sử dụng</th>
                                                <th>Trạng thái</th>
                                                <th className="text-right">Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {approvedUsers.map(u => {
                                                const expired = isUserExpired(u);
                                                return (
                                                    <tr key={u.uid} style={u.disabled || expired ? { opacity: 0.55 } : undefined}>
                                                        <td data-label="Người dùng">
                                                            <div className="admin-topic-cell">
                                                                <div className="admin-user-icon" style={u.disabled ? { background: '#fee2e2' } : undefined}>
                                                                    <Avatar src={u.photoURL} alt={u.displayName} size={36} />
                                                                </div>
                                                                <div>
                                                                    <div className="admin-topic-name">
                                                                        {u.displayName || u.email}
                                                                        {isSelf(u.uid) && <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)' }}>(Bạn)</span>}
                                                                        {u.role === 'admin' ? (
                                                                            <span className="admin-role-badge admin"><Shield size={12} /> Admin</span>
                                                                        ) : u.role === 'teacher' ? (
                                                                            <span className="admin-role-badge teacher"><Award size={12} /> Giáo viên</span>
                                                                        ) : u.role === 'staff' ? (
                                                                            <span className="admin-role-badge staff"><Briefcase size={12} /> Nhân viên VP</span>
                                                                        ) : u.role === 'it' ? (
                                                                            <span className="admin-role-badge" style={{ background: '#f0fdf4', color: '#15803d' }}><Monitor size={12} /> IT</span>
                                                                        ) : (
                                                                            <span className="admin-role-badge user">Học viên</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="admin-topic-id">{u.email}</div>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        <td data-label="Hạn sử dụng" className="admin-text-muted" style={{ fontSize: '0.85rem' }}>
                                                            {u.expiresAt ? formatDate(u.expiresAt) : 'Vĩnh viễn'}
                                                        </td>
                                                        <td data-label="Trạng thái">
                                                            {u.disabled ? (
                                                                <span className="admin-status-badge" style={{ background: '#fee2e2', color: '#dc2626' }}><Lock size={12} /> Bị khóa</span>
                                                            ) : expired ? (
                                                                <span className="admin-status-badge" style={{ background: '#fef3c7', color: '#d97706' }}><Timer size={12} /> Hết hạn</span>
                                                            ) : (
                                                                <span className="admin-status-badge active">Hoạt động</span>
                                                            )}
                                                        </td>
                                                        <td data-label="Thao tác" className="text-right">
                                                            <div className="admin-table-actions">
                                                                <button className="admin-action-btn" onClick={() => openUserDetail(u)} title="Chi tiết"><BarChart3 size={16} /></button>
                                                                {!isSelf(u.uid) && (
                                                                    <>
                                                                        {expired && (
                                                                            <button className="admin-action-btn" onClick={() => openRenewModal(u)} title="Gia hạn" style={{ color: '#f59e0b' }}>
                                                                                <Timer size={16} />
                                                                            </button>
                                                                        )}
                                                                        {/* Staff cannot modify admins */}
                                                                        {!(currentAdmin?.role === 'staff' && u.role === 'admin') && (
                                                                            <>
                                                                                <button className="admin-action-btn" onClick={() => openRoleModal(u)} title="Đổi vai trò">
                                                                                    {u.role === 'admin' ? <ShieldCheck size={16} /> : u.role === 'teacher' ? <Award size={16} /> : u.role === 'staff' ? <Briefcase size={16} /> : u.role === 'it' ? <Monitor size={16} /> : <User size={16} />}
                                                                                </button>
                                                                                <button className={`admin-action-btn ${u.disabled ? '' : 'danger'}`} onClick={() => handleToggleDisabled(u)} title={u.disabled ? 'Mở khóa' : 'Khóa'}>
                                                                                    {u.disabled ? <Unlock size={16} /> : <Lock size={16} />}
                                                                                </button>
                                                                                <button className="admin-action-btn danger" onClick={() => handleDelete(u)} title="Xoá">
                                                                                    <Trash2 size={16} />
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {/* ===== TAB: ARCHIVED ===== */}
            {
                activeTab === 'archived' && (
                    <div className="admin-card">
                        {loading ? (
                            <div className="admin-empty-state">Đang tải...</div>
                        ) : archivedUsers.length === 0 ? (
                            <div className="admin-empty-state" style={{ padding: '48px 24px' }}>
                                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                                    <CheckCircle size={28} color="#22c55e" />
                                </div>
                                <h3 style={{ margin: '0 0 4px', fontWeight: 700 }}>Không có người dùng cũ</h3>
                                <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>Tài khoản bị xoá sẽ xuất hiện ở đây.</p>
                            </div>
                        ) : (
                            <div className="admin-table-container">
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Người dùng</th>
                                            <th>Ngày xoá</th>
                                            <th className="text-right">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {archivedUsers.map(u => (
                                            <tr key={u.uid} style={{ opacity: 0.7 }}>
                                                <td data-label="Người dùng">
                                                    <div className="admin-topic-cell">
                                                        <div className="admin-user-icon" style={{ background: '#f1f5f9' }}>
                                                            <Avatar src={u.photoURL} alt={u.displayName} size={36} />
                                                        </div>
                                                        <div>
                                                            <div className="admin-topic-name">
                                                                {u.displayName || u.email}
                                                                {u.role === 'admin' ? (
                                                                    <span className="admin-role-badge admin"><Shield size={12} /> Admin</span>
                                                                ) : u.role === 'teacher' ? (
                                                                    <span className="admin-role-badge teacher"><Award size={12} /> Giáo viên</span>
                                                                ) : u.role === 'staff' ? (
                                                                    <span className="admin-role-badge staff"><Briefcase size={12} /> Nhân viên VP</span>
                                                                ) : u.role === 'it' ? (
                                                                    <span className="admin-role-badge" style={{ background: '#f0fdf4', color: '#15803d' }}><Monitor size={12} /> IT</span>
                                                                ) : (
                                                                    <span className="admin-role-badge user">Học viên</span>
                                                                )}
                                                            </div>
                                                            <div className="admin-topic-id">{u.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td data-label="Ngày xoá" className="admin-text-muted" style={{ fontSize: '0.85rem' }}>
                                                    {formatDate(u.deletedAt)}
                                                </td>
                                                <td data-label="Thao tác" className="text-right">
                                                    <div className="admin-table-actions">
                                                        <button className="admin-action-btn" onClick={() => handleRestore(u)} title="Khôi phục" style={{ color: '#22c55e' }}>
                                                            <RotateCcw size={16} />
                                                        </button>
                                                        <button className="admin-action-btn danger" onClick={() => handlePermanentDelete(u)} title="Xoá vĩnh viễn">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )
            }

            {/* ===== USER DETAIL MODAL ===== */}
            {
                selectedUser && (
                    <div className="teacher-modal-overlay" style={{ zIndex: 1000 }}>
                        <div className="teacher-modal wide" style={{ maxWidth: '560px' }}>
                            <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                                <button className="teacher-modal-close" onClick={() => setSelectedUser(null)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '24px', paddingRight: '40px' }}>
                                <h2 className="admin-modal-title" style={{ margin: 0 }}>Thông tin chi tiết</h2>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: '#f0f4ff', borderRadius: '12px', border: '1px solid #e0e7ff' }}>
                                    <Avatar src={selectedUser.photoURL} alt={selectedUser.displayName} size={56} style={{ border: '3px solid #e0e7ff' }} />
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        {isEditingName ? (
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <input
                                                    type="text"
                                                    value={tempDisplayName}
                                                    onChange={e => setTempDisplayName(e.target.value)}
                                                    autoFocus
                                                    className="admin-input"
                                                    style={{ padding: '6px 10px', fontSize: '1rem', border: '1px solid #cbd5e1', borderRadius: '8px', width: '100%' }}
                                                />
                                                <button onClick={handleUpdateName} className="admin-action-btn" style={{ color: '#10b981', background: '#ecfdf5' }} title="Lưu"><Check size={18} /></button>
                                                <button onClick={() => setIsEditingName(false)} className="admin-action-btn" style={{ color: '#ef4444', background: '#fef2f2' }} title="Hủy"><X size={18} /></button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                                <div style={{ fontWeight: 700, fontSize: '1.1rem', wordBreak: 'break-word', minWidth: 0 }}>{selectedUser.displayName || selectedUser.email}</div>
                                                <button onClick={() => { setIsEditingName(true); setTempDisplayName(selectedUser.displayName || ''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', flexShrink: 0, marginTop: '-2px' }} title="Đổi tên">
                                                    <Edit size={14} />
                                                </button>
                                            </div>
                                        )}
                                        <div style={{ fontSize: '0.85rem', color: '#64748b', wordBreak: 'break-all', minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {isEditingEmail ? (
                                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: '100%' }}>
                                                    <input
                                                        type="email"
                                                        value={tempEmail}
                                                        onChange={e => setTempEmail(e.target.value)}
                                                        autoFocus
                                                        className="admin-input"
                                                        style={{ padding: '4px 8px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px', flex: 1 }}
                                                        onKeyDown={e => { if (e.key === 'Enter') handleUpdateEmail(); if (e.key === 'Escape') setIsEditingEmail(false); }}
                                                    />
                                                    <button onClick={handleUpdateEmail} disabled={actionLoading} className="admin-action-btn" style={{ color: '#10b981', background: '#ecfdf5', padding: '4px' }} title="Lưu"><Check size={14} /></button>
                                                    <button onClick={() => setIsEditingEmail(false)} className="admin-action-btn" style={{ color: '#ef4444', background: '#fef2f2', padding: '4px' }} title="Hủy"><X size={14} /></button>
                                                </div>
                                            ) : (
                                                <>
                                                    {selectedUser.email}
                                                    <button onClick={() => { setIsEditingEmail(true); setTempEmail(selectedUser.email || ''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px', flexShrink: 0 }} title="Đổi email">
                                                        <Edit size={12} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ flexShrink: 0, alignSelf: 'center' }}>
                                        {selectedUser.role === 'admin' ? (
                                            <span className="admin-role-badge admin" style={{ fontSize: '0.75rem' }}><Shield size={12} /> Admin</span>
                                        ) : selectedUser.role === 'teacher' ? (
                                            <span className="admin-role-badge teacher" style={{ fontSize: '0.75rem' }}><Award size={12} /> Giáo viên</span>
                                        ) : selectedUser.role === 'staff' ? (
                                            <span className="admin-role-badge staff" style={{ fontSize: '0.75rem' }}><Briefcase size={12} /> Nhân viên VP</span>
                                        ) : selectedUser.role === 'it' ? (
                                            <span className="admin-role-badge" style={{ fontSize: '0.75rem', background: '#f0fdf4', color: '#15803d' }}><Monitor size={12} /> IT</span>
                                        ) : (
                                            <span className="admin-role-badge user" style={{ fontSize: '0.75rem' }}>Học viên</span>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#475569', fontSize: '0.9rem' }}>
                                        <Hash size={16} style={{ color: '#94a3b8', flexShrink: 0 }} />
                                        <span><strong>UID:</strong> <code style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px' }}>{selectedUser.uid}</code></span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#475569', fontSize: '0.9rem' }}>
                                        <Calendar size={16} style={{ color: '#94a3b8', flexShrink: 0 }} /> <span><strong>Tham gia:</strong> {formatDateTime(selectedUser.createdAt)}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#475569', fontSize: '0.9rem' }}>
                                        <Timer size={16} style={{ color: '#94a3b8', flexShrink: 0 }} /> <span><strong>Hạn:</strong> {selectedUser.expiresAt ? formatDate(selectedUser.expiresAt) : 'Vĩnh viễn'}</span>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div>
                                    <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><BookOpen size={16} /> Thống kê</p>
                                    {statsLoading ? (
                                        <div style={{ textAlign: 'center', padding: '12px', color: '#94a3b8' }}>Đang tải...</div>
                                    ) : userStats && (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                                            <div style={{ textAlign: 'center', padding: '12px 6px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                                                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16a34a' }}>{userStats.learnedWords}</div>
                                                <div style={{ fontSize: '0.7rem', color: '#4ade80', fontWeight: 600 }}>Đã thuộc</div>
                                            </div>
                                            <div style={{ textAlign: 'center', padding: '12px 6px', background: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                                                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2563eb' }}>{userStats.totalWords}</div>
                                                <div style={{ fontSize: '0.7rem', color: '#60a5fa', fontWeight: 600 }}>Đã học</div>
                                            </div>
                                            <div style={{ textAlign: 'center', padding: '12px 6px', background: '#fefce8', borderRadius: '10px', border: '1px solid #fde68a' }}>
                                                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ca8a04' }}>{userStats.totalReviews}</div>
                                                <div style={{ fontSize: '0.7rem', color: '#facc15', fontWeight: 600 }}>Lượt ôn</div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Permissions Assignment */}
                                {!isSelf(selectedUser.uid) && selectedUser.role !== 'admin' && selectedUser.role !== 'staff' && selectedUser.role !== 'it' && (
                                    <div>
                                        <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <ShieldCheck size={16} /> Phân quyền truy cập
                                        </p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {/* Groups */}
                                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column' }}>
                                                <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Layers size={14} /> Thuộc Nhóm (Groups)
                                                </p>
                                                <div style={{ flex: 1, minHeight: 0 }}>
                                                    {groups.length === 0 ? (
                                                        <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>Chưa có Nhóm nào.</p>
                                                    ) : (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto', paddingRight: '4px' }}>
                                                            {groups.map(g => (
                                                                <label key={g.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.8rem', color: '#475569', cursor: 'pointer', background: '#fff', padding: '6px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                                                    <input type="checkbox" checked={userGroupIds.includes(g.id)} onChange={() => toggleUserGroup(g.id)} style={{ accentColor: 'var(--color-primary)', marginTop: '2px' }} />
                                                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.3 }}>{g.name}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ marginTop: '12px' }}>
                                            <button className="admin-btn admin-btn-primary" style={{ width: '100%', fontSize: '0.85rem', padding: '8px' }} onClick={handleSaveUserPermissions} disabled={isSavingFolders}>
                                                {isSavingFolders ? 'Đang lưu...' : <><Save size={14} /> Lưu quyền cho User này</>}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                {!isSelf(selectedUser.uid) && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px', borderTop: '1px solid #e2e8f0' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                            <button className="admin-btn admin-btn-secondary" style={{ fontSize: '0.85rem', padding: '10px' }} onClick={() => openRoleModal(selectedUser)}>
                                                <Shield size={16} /> Đổi vai trò
                                            </button>
                                            <button className="admin-btn admin-btn-secondary" onClick={() => handleToggleDisabled(selectedUser)}
                                                style={{ fontSize: '0.85rem', padding: '10px', ...(selectedUser.disabled ? { background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' } : { background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' }) }}>
                                                {selectedUser.disabled ? <><Unlock size={16} /> Mở khóa</> : <><Lock size={16} /> Khóa</>}
                                            </button>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                            <button className="admin-btn admin-btn-secondary" style={{ fontSize: '0.85rem', padding: '10px', color: '#f59e0b', borderColor: '#fde68a' }} onClick={() => { setSelectedUser(null); openRenewModal(selectedUser); }}>
                                                <Timer size={16} /> Gia hạn
                                            </button>
                                            <button className="admin-btn" style={{ fontSize: '0.85rem', padding: '10px', background: '#fff', border: '1px dashed #fca5a5', color: '#ef4444' }} onClick={() => handleDeleteProgress(selectedUser)}>
                                                <Trash2 size={16} /> Xóa tiến trình
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {isSelf(selectedUser.uid) && (
                                    <div style={{ padding: '10px', background: '#fffbeb', borderRadius: '10px', border: '1px solid #fde68a', textAlign: 'center' }}>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#92400e' }}>⚠️ Không thể thay đổi quyền/khóa tài khoản chính mình.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ===== APPROVE / RENEW MODAL ===== */}
            {
                approveModal && (
                    <div className="teacher-modal-overlay" style={{ zIndex: 1001 }}>
                        <div className="teacher-modal wide" style={{ maxWidth: !approveModal.isRenew && approveRole !== 'admin' && approveRole !== 'staff' && approveRole !== 'it' && groups.length > 0 ? '720px' : '440px' }}>
                            <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                                <button className="teacher-modal-close" onClick={() => setApproveModal(null)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <h2 className="admin-modal-title" style={{ color: '#10b981', justifyContent: 'flex-start', marginBottom: '16px', paddingRight: '40px' }}>
                                <CheckCircle size={22} /> {approveModal.isRenew ? 'Gia hạn' : 'Phê duyệt'} tài khoản
                            </h2>
                            <p className="admin-modal-desc" style={{ marginBottom: '16px' }}>
                                {approveModal.user.displayName || approveModal.user.email}
                            </p>

                            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                                {/* Left column - Form fields */}
                                <div style={{ flex: '1 1 280px', minWidth: 0 }}>
                                    {!approveModal.isRenew && (
                                        <div style={{ marginBottom: '16px' }}>
                                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Vai trò</label>
                                            <CustomSelect
                                                value={approveRole}
                                                onChange={setApproveRole}
                                                options={roleOptions}
                                                placeholder="Chọn vai trò..."
                                            />
                                        </div>
                                    )}

                                    {approveRole !== 'admin' && approveRole !== 'staff' && approveRole !== 'it' && (
                                        <div style={{ marginBottom: '16px' }}>
                                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Thời hạn sử dụng</label>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                                                {DURATION_OPTIONS.map(opt => (
                                                    <button key={String(opt.value)} type="button"
                                                        onClick={() => setApproveDuration(opt.value)}
                                                        style={{
                                                            padding: '8px', border: '2px solid',
                                                            borderColor: approveDuration === opt.value ? '#3b82f6' : '#e2e8f0',
                                                            background: approveDuration === opt.value ? '#eff6ff' : '#fff',
                                                            color: approveDuration === opt.value ? '#2563eb' : '#64748b',
                                                            borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                                                        }}>
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                            {approveDuration === 'custom' && (
                                                <div style={{ marginTop: '10px' }}>
                                                    <input type="date"
                                                        className="admin-form-input"
                                                        style={{ width: '100%', borderColor: '#3b82f6', background: '#eff6ff' }}
                                                        value={approveCustomDate}
                                                        onChange={e => setApproveCustomDate(e.target.value)}
                                                        required
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Right column - Group permissions */}
                                {!approveModal.isRenew && approveRole !== 'admin' && approveRole !== 'staff' && approveRole !== 'it' && groups.length > 0 && (
                                    <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                            Phân quyền truy cập (tuỳ chọn)
                                        </label>
                                        <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '4px' }}><Layers size={12} /> Thuộc Nhóm</p>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto', paddingRight: '2px' }}>
                                                {groups.map(g => (
                                                    <label key={g.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.75rem', color: '#475569', cursor: 'pointer', background: '#fff', padding: '4px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                                        <input type="checkbox" checked={approveGroupIds.includes(g.id)} onChange={() => toggleApproveGroup(g.id)} style={{ accentColor: 'var(--color-primary)', marginTop: '2px' }} />
                                                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.3 }}>{g.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="admin-modal-actions" style={{ flexDirection: 'row' }}>
                                <button className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setApproveModal(null)} disabled={actionLoading}>Hủy</button>
                                <button className="admin-btn admin-btn-primary" style={{ flex: 1 }} onClick={approveModal.isRenew ? handleRenew : handleApprove} disabled={actionLoading}>
                                    {actionLoading ? 'Đang xử lý...' : (approveModal.isRenew ? 'Gia hạn' : 'Phê duyệt')}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ===== WHITELIST FORM MODAL ===== */}
            {
                whitelistForm && (
                    <div className="teacher-modal-overlay" style={{ zIndex: 1001 }}>
                        <div className="teacher-modal wide" style={{ maxWidth: wlRole !== 'admin' && wlRole !== 'staff' && wlRole !== 'it' && groups.length > 0 ? '720px' : '440px' }}>
                            <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                                <button className="teacher-modal-close" onClick={() => setWhitelistForm(false)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <h2 className="admin-modal-title" style={{ color: '#10b981', justifyContent: 'flex-start', marginBottom: '24px', paddingRight: '40px' }}>
                                <UserPlus size={22} /> Thêm email Pre-approve
                            </h2>
                            <form onSubmit={handleAddWhitelist}>
                                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                                    {/* Left column - Form fields */}
                                    <div style={{ flex: '1 1 280px', minWidth: 0 }}>
                                        <div style={{ marginBottom: '14px' }}>
                                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Email</label>
                                            <input type="email" className="admin-form-input" style={{ width: '100%' }} placeholder="student@gmail.com"
                                                value={wlEmail} onChange={e => setWlEmail(e.target.value)} required autoFocus />
                                        </div>
                                        <div style={{ marginBottom: '14px' }}>
                                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Tên học viên (Tùy chọn)</label>
                                            <input type="text" className="admin-form-input" style={{ width: '100%' }} placeholder="Họ và tên..."
                                                value={wlDisplayName} onChange={e => setWlDisplayName(e.target.value)} />
                                        </div>
                                        <div style={{ marginBottom: '14px' }}>
                                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Vai trò</label>
                                            <CustomSelect
                                                value={wlRole}
                                                onChange={setWlRole}
                                                options={roleOptions}
                                                placeholder="Chọn vai trò..."
                                            />
                                        </div>
                                        {wlRole !== 'admin' && wlRole !== 'staff' && wlRole !== 'it' && (
                                            <div style={{ marginBottom: '14px' }}>
                                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Thời hạn</label>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                                                    {DURATION_OPTIONS.map(opt => (
                                                        <button key={String(opt.value)} type="button"
                                                            onClick={() => setWlDuration(opt.value)}
                                                            style={{
                                                                padding: '8px', border: '2px solid',
                                                                borderColor: wlDuration === opt.value ? '#10b981' : '#e2e8f0',
                                                                background: wlDuration === opt.value ? '#f0fdf4' : '#fff',
                                                                color: wlDuration === opt.value ? '#059669' : '#64748b',
                                                                borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                                                            }}>
                                                            {opt.label}
                                                        </button>
                                                    ))}
                                                </div>
                                                {wlDuration === 'custom' && (
                                                    <div style={{ marginTop: '10px' }}>
                                                        <input type="date"
                                                            className="admin-form-input"
                                                            style={{ width: '100%', borderColor: '#10b981', background: '#f0fdf4' }}
                                                            value={wlCustomDate}
                                                            onChange={e => setWlCustomDate(e.target.value)}
                                                            required
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Right column - Group permissions */}
                                    {wlRole !== 'admin' && wlRole !== 'staff' && wlRole !== 'it' && groups.length > 0 && (
                                        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                                Phân quyền truy cập (tuỳ chọn)
                                            </label>
                                            <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '4px' }}><Layers size={12} /> Thuộc Nhóm</p>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto', paddingRight: '2px' }}>
                                                    {groups.map(g => (
                                                        <label key={g.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.75rem', color: '#475569', cursor: 'pointer', background: '#fff', padding: '4px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                                            <input type="checkbox" checked={wlGroupIds.includes(g.id)} onChange={() => setWlGroupIds(prev => prev.includes(g.id) ? prev.filter(id => id !== g.id) : [...prev, g.id])} style={{ accentColor: 'var(--color-primary)', marginTop: '2px' }} />
                                                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.3 }}>{g.name}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="admin-modal-actions">
                                    <button type="submit" className="admin-btn admin-btn-primary" style={{ width: '100%' }} disabled={actionLoading || !wlEmail.trim()}>
                                        {actionLoading ? 'Đang lưu...' : 'Thêm vào danh sách'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* ===== EDIT WHITELIST MODAL ===== */}
            {
                editWlModal && (
                    <div className="teacher-modal-overlay" style={{ zIndex: 1001 }}>
                        <div className="teacher-modal wide" style={{ maxWidth: editWlRole !== 'admin' && editWlRole !== 'staff' && editWlRole !== 'it' && groups.length > 0 ? '720px' : '440px' }}>
                            <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                                <button className="teacher-modal-close" onClick={() => setEditWlModal(null)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <h2 className="admin-modal-title" style={{ color: '#3b82f6', justifyContent: 'flex-start', marginBottom: '16px', paddingRight: '40px' }}>
                                <Edit size={22} /> Chỉnh sửa Pre-approve
                            </h2>
                            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '16px' }}>{editWlModal.email}</p>

                            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                                {/* Left column - Form fields */}
                                <div style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Tên hiển thị</label>
                                        <input type="text" className="admin-form-input" style={{ width: '100%' }} placeholder="Họ và tên..."
                                            value={editWlName} onChange={e => setEditWlName(e.target.value)} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Vai trò</label>
                                        <CustomSelect
                                            value={editWlRole}
                                            onChange={setEditWlRole}
                                            options={roleOptions}
                                            placeholder="Chọn vai trò..."
                                        />
                                    </div>
                                    {editWlRole !== 'admin' && editWlRole !== 'staff' && editWlRole !== 'it' && (
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Thời hạn</label>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                                                {DURATION_OPTIONS.map(opt => (
                                                    <button key={String(opt.value)} type="button"
                                                        onClick={() => setEditWlDuration(opt.value)}
                                                        style={{
                                                            padding: '8px', border: '2px solid',
                                                            borderColor: editWlDuration === opt.value ? '#3b82f6' : '#e2e8f0',
                                                            background: editWlDuration === opt.value ? '#eff6ff' : '#fff',
                                                            color: editWlDuration === opt.value ? '#2563eb' : '#64748b',
                                                            borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                                                        }}>
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                            {editWlDuration === 'custom' && (
                                                <div style={{ marginTop: '10px' }}>
                                                    <input type="date"
                                                        className="admin-form-input"
                                                        style={{ width: '100%', borderColor: '#3b82f6', background: '#eff6ff' }}
                                                        value={editWlCustomDate}
                                                        onChange={e => setEditWlCustomDate(e.target.value)}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Right column - Group permissions */}
                                {editWlRole !== 'admin' && editWlRole !== 'staff' && editWlRole !== 'it' && groups.length > 0 && (
                                    <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                            Phân quyền truy cập
                                        </label>
                                        <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '4px' }}><Layers size={12} /> Thuộc Nhóm</p>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto', paddingRight: '2px' }}>
                                                {groups.map(g => (
                                                    <label key={g.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.75rem', color: '#475569', cursor: 'pointer', background: '#fff', padding: '4px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                                        <input type="checkbox" checked={editWlGroupIds.includes(g.id)} onChange={() => setEditWlGroupIds(prev => prev.includes(g.id) ? prev.filter(id => id !== g.id) : [...prev, g.id])} style={{ accentColor: 'var(--color-primary)', marginTop: '2px' }} />
                                                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.3 }}>{g.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="admin-modal-actions" style={{ flexDirection: 'row', marginTop: '20px' }}>
                                <button className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setEditWlModal(null)} disabled={actionLoading}>Hủy</button>
                                <button className="admin-btn admin-btn-primary" style={{ flex: 1 }} onClick={handleSaveEditWl} disabled={actionLoading}>
                                    {actionLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ===== ROLE MODAL ===== */}
            {
                changeRoleModal && (
                    <div className="teacher-modal-overlay" style={{ zIndex: 1002 }}>
                        <div className="teacher-modal">
                            <h2 className="admin-modal-title">Đổi vai trò</h2>
                            <p style={{ marginBottom: '16px', fontSize: '0.9rem', color: '#475569' }}>
                                Chọn vai trò mới cho <strong>{changeRoleModal.user.email}</strong>
                            </p>
                            <div style={{ marginBottom: '20px' }}>
                                <CustomSelect
                                    value={changeRoleModal.role}
                                    onChange={newRole => setChangeRoleModal({ ...changeRoleModal, role: newRole })}
                                    options={roleOptions}
                                    placeholder="Chọn vai trò..."
                                />
                            </div>
                            <div className="admin-modal-actions" style={{ flexDirection: 'row' }}>
                                <button className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setChangeRoleModal(null)} disabled={actionLoading}>Hủy</button>
                                <button className="admin-btn admin-btn-primary" style={{ flex: 1 }} onClick={handleConfirmChangeRole} disabled={actionLoading}>
                                    {actionLoading ? 'Đang xử lý...' : 'Lưu thay đổi'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ===== CONFIRM =====  */}
            {
                confirmAction && (
                    <div className="teacher-modal-overlay" style={{ zIndex: 1002 }}>
                        <div className="teacher-modal">
                            <h2 className="admin-modal-title">Xác nhận</h2>
                            <p className="admin-modal-desc">{confirmAction.message}</p>
                            <div className="admin-modal-actions" style={{ flexDirection: 'row' }}>
                                <button className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmAction(null)} disabled={actionLoading}>Hủy</button>
                                <button className="admin-btn admin-btn-primary" style={{ flex: 1, ...(confirmAction.type === 'delete' || confirmAction.type === 'reject' ? { backgroundColor: '#ef4444' } : {}) }}
                                    onClick={executeConfirmAction} disabled={actionLoading}>
                                    {actionLoading ? 'Đang xử lý...' : 'Xác nhận'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ===== ALERT ===== */}
            {
                alertMessage && (
                    <div className="teacher-modal-overlay" style={{ zIndex: 1003 }}>
                        <div className="teacher-modal">
                            <h2 className="admin-modal-title">
                                {alertMessage.type === 'success' ? <span style={{ color: '#10b981' }}>Thành công</span> : <span style={{ color: '#ef4444' }}>Lỗi</span>}
                            </h2>
                            <p className="admin-modal-desc">{alertMessage.text}</p>
                            <div className="admin-modal-actions" style={{ flexDirection: 'row' }}>
                                <button className="admin-btn admin-btn-primary" style={{ flex: 1 }} onClick={() => setAlertMessage(null)}>Đóng</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
