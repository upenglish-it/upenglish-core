import { useState, useEffect } from 'react';
import { getGroups, saveGroup, deleteGroup, getFolders, getGrammarFolders, addUserToGroup, removeUserFromGroup, searchIsmsAccounts, getGroupMembers, getWhitelistEmails, updateWhitelistEntry } from '../../services/adminService';
import { Link } from 'react-router-dom';
import { Layers, Plus, Edit, Trash2, Tag, Save, X, FolderOpen, Users, Check, Search, UserPlus, UserMinus, User, Shield, Award, BarChart3, Mail, Briefcase, Eye, EyeOff, Gift } from 'lucide-react';
import Avatar from '../../components/common/Avatar';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminGroupsPage() {
    const { user } = useAuth();
    const isStaff = user?.role === 'staff';
    const [groups, setGroups] = useState([]);
    const [vocabFolders, setVocabFolders] = useState([]);
    const [grammarFolders, setGrammarFolders] = useState([]);
    const [loading, setLoading] = useState(true);

    const [formOpen, setFormOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        id: '', name: '', description: '', folderAccess: [], isHidden: false, enableRewardPoints: false
    });
    const [groupToDelete, setGroupToDelete] = useState(null);
    const [alertMessage, setAlertMessage] = useState(null);

    // Members Modal States
    const [membersModalOpen, setMembersModalOpen] = useState(false);
    const [selectedGroupForMembers, setSelectedGroupForMembers] = useState(null);
    const [currentMembers, setCurrentMembers] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [memberSearchQuery, setMemberSearchQuery] = useState('');
    const [isUsersLoading, setIsUsersLoading] = useState(false);
    const [isUpdatingMember, setIsUpdatingMember] = useState(false);
    const [groupSearchTerm, setGroupSearchTerm] = useState('');
    const [whitelistEmails, setWhitelistEmails] = useState([]);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (alertMessage) {
            const timer = setTimeout(() => setAlertMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [alertMessage]);

    useEffect(() => {
        let isActive = true;
        if (!membersModalOpen || !selectedGroupForMembers) return;

        const fetchSearch = async () => {
            try {
                const results = await searchIsmsAccounts(memberSearchQuery);
                if (isActive) setSearchResults(results);
            } catch (err) {
                console.error(err);
            }
        };

        const timer = setTimeout(fetchSearch, 300);
        return () => {
            isActive = false;
            clearTimeout(timer);
        };
    }, [memberSearchQuery, membersModalOpen, selectedGroupForMembers]);

    async function loadData() {
        setLoading(true);
        try {
            const [groupsList, vFolders, gFolders] = await Promise.all([
                getGroups(true), // Fetch all groups, including hidden ones
                getFolders(),
                getGrammarFolders()
            ]);
            setGroups(groupsList);
            setVocabFolders(vFolders);
            setGrammarFolders(gFolders);
        } catch (error) {
            console.error("Lỗi tải dữ liệu nhóm:", error);
            setAlertMessage({ type: 'error', text: 'Lỗi tải dữ liệu. Vui lòng thử lại.' });
        }
        setLoading(false);
    }

    function openAddForm() {
        setFormData({ id: '', name: '', description: '', folderAccess: [], isHidden: false, enableRewardPoints: false });
        setIsEditing(false);
        setFormOpen(true);
    }

    function openEditForm(group) {
        setFormData({ ...group });
        setIsEditing(true);
        setFormOpen(true);
    }

    async function openMembersModal(group) {
        setSelectedGroupForMembers(group);
        setMemberSearchQuery('');
        setMembersModalOpen(true);
        setIsUsersLoading(true);
        try {
            const [membersList, wlList] = await Promise.all([
                getGroupMembers(group.id),
                getWhitelistEmails()
            ]);
            setCurrentMembers(membersList);
            setWhitelistEmails(wlList);
            setSearchResults([]);
        } catch (error) {
            console.error("Lỗi tải người dùng:", error);
            setAlertMessage({ type: 'error', text: 'Lỗi tải dữ liệu người dùng.' });
        }
        setIsUsersLoading(false);
    }

    async function handleAddMember(user) {
        if (!selectedGroupForMembers || isUpdatingMember) return;
        setIsUpdatingMember(true);
        try {
            await addUserToGroup(user.uid, selectedGroupForMembers.id);
            // Cập nhật state local
            setCurrentMembers(prev => [...prev, { ...user, groupIds: [...(user.groupIds || []), selectedGroupForMembers.id] }]);
            setSearchResults(prev => prev.filter(u => u.uid !== user.uid));
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'Lỗi thêm thành viên: ' + error.message });
        }
        setIsUpdatingMember(false);
    }

    async function handleRemoveMember(user) {
        if (!selectedGroupForMembers || isUpdatingMember) return;
        setIsUpdatingMember(true);
        try {
            await removeUserFromGroup(user.uid, selectedGroupForMembers.id);
            // Cập nhật state local
            setCurrentMembers(prev => prev.filter(u => u.uid !== user.uid));
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'Lỗi xóa thành viên: ' + error.message });
        }
        setIsUpdatingMember(false);
    }

    async function handleAddWhitelistMember(wlEntry) {
        if (!selectedGroupForMembers || isUpdatingMember) return;
        setIsUpdatingMember(true);
        try {
            const currentGroupIds = Array.isArray(wlEntry.groupIds) ? wlEntry.groupIds : [];
            await updateWhitelistEntry(wlEntry.email, {
                groupIds: [...new Set([...currentGroupIds, selectedGroupForMembers.id])]
            });
            setWhitelistEmails(prev => prev.map(w =>
                w.email === wlEntry.email
                    ? { ...w, groupIds: [...new Set([...(w.groupIds || []), selectedGroupForMembers.id])] }
                    : w
            ));
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'Lỗi thêm email pre-approved: ' + error.message });
        }
        setIsUpdatingMember(false);
    }

    async function handleRemoveWhitelistMember(wlEntry) {
        if (!selectedGroupForMembers || isUpdatingMember) return;
        setIsUpdatingMember(true);
        try {
            const updatedGroupIds = (wlEntry.groupIds || []).filter(id => id !== selectedGroupForMembers.id);
            await updateWhitelistEntry(wlEntry.email, { groupIds: updatedGroupIds });
            setWhitelistEmails(prev => prev.map(w =>
                w.email === wlEntry.email
                    ? { ...w, groupIds: updatedGroupIds }
                    : w
            ));
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'Lỗi xóa email pre-approved: ' + error.message });
        }
        setIsUpdatingMember(false);
    }

    async function handleSubmit(e) {
        e.preventDefault();

        const existingId = String(formData.id || '').trim();
        let finalId = isEditing
            ? existingId
            : existingId.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        if (!finalId && !isEditing) {
            finalId = formData.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
        }

        if (!finalId) {
            setAlertMessage({ type: 'error', text: 'Tên hoặc ID không hợp lệ.' });
            return;
        }

        try {
            await saveGroup({ ...formData, id: finalId }, { createOnly: !isEditing });
            setFormOpen(false);
            setAlertMessage({ type: 'success', text: isEditing ? "Cập nhật Nhóm thành công!" : "Tạo Nhóm thành công!" });
            loadData();
        } catch (error) {
            setAlertMessage({ type: 'error', text: "Lỗi lưu nhóm: " + error.message });
        }
    }

    async function handleConfirmDelete() {
        if (!groupToDelete) return;
        try {
            await deleteGroup(groupToDelete.id);
            setGroups(prev => prev.filter(g => g.id !== groupToDelete.id));
            setAlertMessage({ type: 'success', text: "Đã xóa nhóm thành công!" });
            setFormOpen(false); // Close form if deleting from inside edit form
        } catch (error) {
            setAlertMessage({ type: 'error', text: "Lỗi xóa nhóm: " + error.message });
        }
        setGroupToDelete(null);
    }

    async function handleToggleHide(group) {
        try {
            const newStatus = !group.isHidden;
            await saveGroup({ ...group, isHidden: newStatus });
            setAlertMessage({
                type: 'success',
                text: newStatus ? `Đã ẩn nhóm "${group.name}"` : `Đã hiện lại nhóm "${group.name}"`
            });
            loadData();
        } catch (error) {
            setAlertMessage({ type: 'error', text: "Lỗi: " + error.message });
        }
    }

    function toggleFolderAccess(folderId) {
        setFormData(prev => {
            const current = new Set(prev.folderAccess || []);
            if (current.has(folderId)) {
                current.delete(folderId);
            } else {
                current.add(folderId);
            }
            return { ...prev, folderAccess: Array.from(current) };
        });
    }

    const filteredGroups = groups.filter(g =>
        (g.name || '').toLowerCase().includes(groupSearchTerm.toLowerCase()) ||
        (g.id || '').toLowerCase().includes(groupSearchTerm.toLowerCase())
    ).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const visibleGroups = filteredGroups.filter(g => !g.isHidden);
    const hiddenGroups = filteredGroups.filter(g => g.isHidden);

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <h1 className="admin-page-title">Quản lý Nhóm học viên</h1>
                <p className="admin-page-subtitle">Tạo và quản lý các nhóm học viên để giao bài tập, chia sẻ nội dung.</p>
                <div className="admin-header-actions">
                    <button className="admin-btn admin-btn-primary" onClick={openAddForm}>
                        <Plus size={16} /> Tạo Nhóm mới
                    </button>
                </div>
            </div>

            {alertMessage && (
                <div className={`admin-alert ${alertMessage.type}`}>
                    {alertMessage.text}
                </div>
            )}

            <div>
                <div className="admin-search-box">
                    <Search size={16} className="search-icon" />
                    <input
                        id="admin-groups-search"
                        name="adminGroupsSearch"
                        type="text"
                        aria-label="Tìm tên hoặc ID nhóm"
                        placeholder="Tìm tên hoặc ID nhóm..."
                        value={groupSearchTerm}
                        onChange={e => setGroupSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="admin-card">
                {loading ? (
                    <div className="admin-empty-state">Đang tải dữ liệu...</div>
                ) : filteredGroups.length === 0 ? (
                    <div className="admin-empty-state">
                        <div className="admin-empty-icon"><Users size={28} /></div>
                        <h3>Chưa có Nhóm nào</h3>
                        <p>Tạo nhóm để cấp quyền truy cập Bài học (Vocab, Kỹ năng) cho nhiều học viên cùng lúc.</p>
                    </div>
                ) : (
                    <div className="admin-table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Nhóm</th>
                                    <th>Mô tả</th>
                                    <th>Quyền Folder (Vocab, Kỹ năng)</th>
                                    <th className="text-right">Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleGroups.map(group => (
                                    <tr key={group.id}>
                                        <td data-label="Nhóm">
                                            <div className="admin-topic-cell">
                                                <div className="admin-topic-icon" style={{ background: '#f8fafc', color: '#3b82f6' }}>
                                                    <Layers size={20} />
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <div className="admin-topic-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        {group.name}
                                                        {group.enableRewardPoints && (
                                                            <span title="Tích điểm đổi quà" style={{ fontSize: '0.75rem', background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: '6px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                                <Gift size={12} /> Điểm
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="admin-topic-id">ID: {group.id}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td data-label="Mô tả" className="admin-text-muted">{group.description}</td>
                                        <td data-label="Folders">
                                            {(() => {
                                                const allFolders = [...vocabFolders, ...grammarFolders];
                                                const groupFolders = allFolders.filter(f => (group.folderAccess || []).includes(f.id));
                                                if (groupFolders.length === 0) return <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>Chưa cấp quyền</span>;
                                                return (
                                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                        {groupFolders.map(f => {
                                                            const isGrammar = grammarFolders.some(gf => gf.id === f.id);
                                                            let typeLabel = "Vocab";
                                                            let typeColor = "#3b82f6";
                                                            if (isGrammar) { typeLabel = "Kỹ năng"; typeColor = "#10b981"; }

                                                            return (
                                                                <span key={f.id} title={typeLabel} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', fontWeight: 600, background: '#f8fafc', color: '#475569', padding: '2px 6px', borderRadius: '4px', border: `1px solid ${typeColor}40` }}>
                                                                    <span style={{ color: typeColor, fontSize: '0.6rem', opacity: 0.8 }}>●</span> {f.icon || '📁'} {f.name}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td data-label="Hành động" className="text-right">
                                            <div className="admin-table-actions">
                                                <Link to={`/admin/groups/${group.id}`} className="admin-action-btn" title="Xem chi tiết: Thống kê & Bài luyện">
                                                    <BarChart3 size={16} />
                                                </Link>
                                                        <button className="admin-action-btn" onClick={() => openMembersModal(group)} title="Quản lý thành viên">
                                                            <Users size={16} />
                                                        </button>
                                                        <button className="admin-action-btn" onClick={() => openEditForm(group)} title="Sửa nhóm">
                                                            <Edit size={16} />
                                                        </button>
                                                        <button className="admin-action-btn" onClick={() => handleToggleHide(group)} title="Ẩn nhóm học xong">
                                                            <EyeOff size={16} />
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

            {hiddenGroups.length > 0 && (
                <div style={{ marginTop: '32px' }}>
                    <h2 style={{ fontSize: '1.25rem', color: '#64748b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Layers size={20} /> Các nhóm đã ẩn (Đã học xong)
                    </h2>
                    <div className="admin-card" style={{ opacity: 0.8 }}>
                        <div className="admin-table-container">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Nhóm</th>
                                        <th>Mô tả</th>
                                        <th>Quyền Folder (Vocab, Kỹ năng)</th>
                                        <th className="text-right">Hành động</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {hiddenGroups.map(group => (
                                        <tr key={group.id}>
                                            <td data-label="Nhóm">
                                                <div className="admin-topic-cell">
                                                    <div className="admin-topic-icon" style={{ background: '#f1f5f9', color: '#94a3b8' }}>
                                                        <Layers size={20} />
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        <div className="admin-topic-name" style={{ color: '#64748b' }}>{group.name}</div>
                                                        <div className="admin-topic-id">ID: {group.id}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td data-label="Mô tả" className="admin-text-muted">{group.description}</td>
                                            <td data-label="Folders">
                                                {(() => {
                                                    const allFolders = [...vocabFolders, ...grammarFolders];
                                                    const groupFolders = allFolders.filter(f => (group.folderAccess || []).includes(f.id));
                                                    if (groupFolders.length === 0) return <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>Chưa cấp quyền</span>;
                                                    return (
                                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                            {groupFolders.map(f => {
                                                                const isGrammar = grammarFolders.some(gf => gf.id === f.id);
                                                                let typeLabel = "Vocab";
                                                                let typeColor = "#94a3b8"; // Grayscale for hidden

                                                                return (
                                                                    <span key={f.id} title={typeLabel} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', fontWeight: 600, background: '#f8fafc', color: '#64748b', padding: '2px 6px', borderRadius: '4px', border: `1px solid ${typeColor}40` }}>
                                                                        <span style={{ color: typeColor, fontSize: '0.6rem', opacity: 0.8 }}>●</span> {f.icon || '📁'} {f.name}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td data-label="Hành động" className="text-right">
                                                <div className="admin-table-actions">
                                                    <Link to={`/admin/groups/${group.id}`} className="admin-action-btn" title="Xem chi tiết: Thống kê & Bài luyện">
                                                        <BarChart3 size={16} />
                                                    </Link>
                                                        <button className="admin-action-btn" onClick={() => openMembersModal(group)} title="Quản lý thành viên">
                                                            <Users size={16} />
                                                        </button>
                                                        <button className="admin-action-btn" onClick={() => openEditForm(group)} title="Sửa nhóm">
                                                            <Edit size={16} />
                                                        </button>
                                                        <button className="admin-action-btn" onClick={() => handleToggleHide(group)} title="Hiện lại nhóm">
                                                            <Eye size={16} color="#10b981" />
                                                        </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* FORM MODAL */}
            {formOpen && (
                <div className="teacher-modal-overlay">
                    <div className="teacher-modal wide">
                        <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                            <button className="teacher-modal-close" onClick={() => setFormOpen(false)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <h2 className="admin-modal-title" style={{ justifyContent: 'flex-start', marginBottom: '24px', paddingRight: '40px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Users size={24} color="var(--color-primary)" />
                                {isEditing ? 'Sửa Nhóm Học Viên' : 'Tạo Nhóm Mới'}
                            </div>
                        </h2>
                        <form onSubmit={handleSubmit}>
                            <div className="admin-form-group">
                                <label>Tên Nhóm <span className="text-danger">*</span></label>
                                <input
                                    id="admin-group-name"
                                    name="adminGroupName"
                                    type="text"
                                    className="admin-form-input"
                                    placeholder="Ví dụ: Lớp IELTS nâng cao A"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="admin-form-group">
                                <label>Mã ID (tùy chọn) <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal' }}>- tự động tạo nếu để trống</span></label>
                                <input
                                    id="admin-group-id"
                                    name="adminGroupId"
                                    type="text"
                                    className="admin-form-input"
                                    placeholder="ielts-nang-cao"
                                    value={formData.id}
                                    onChange={e => setFormData({ ...formData, id: e.target.value })}
                                    disabled={isEditing}
                                />
                            </div>
                            <div className="admin-form-group">
                                <label>Mô tả (tùy chọn)</label>
                                <textarea
                                    id="admin-group-description"
                                    name="adminGroupDescription"
                                    className="admin-form-input admin-form-textarea"
                                    placeholder="Thông tin về nhóm này..."
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    rows="2"
                                ></textarea>
                            </div>
                            <div className="admin-form-group" style={{ marginTop: '16px' }}>
                                <label style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 600 }}>Cấp quyền Folder Bài học cho Nhóm này</span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--color-primary)', background: 'var(--color-primary-light)20', padding: '2px 8px', borderRadius: '12px' }}>
                                        Đã chọn {(formData.folderAccess || []).length}
                                    </span>
                                </label>
                                <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', background: '#f8fafc' }}>
                                    {vocabFolders.length === 0 && grammarFolders.length === 0 ? (
                                        <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
                                            Chưa có Folder Bài học nào trong hệ thống.
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                            {/* VOCAB FOLDERS */}
                                            {vocabFolders.length > 0 && (
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                                                        <Tag size={16} color="#3b82f6" />
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Folders Từ vựng</span>
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
                                                        {vocabFolders.map(f => {
                                                            const isSelected = (formData.folderAccess || []).includes(f.id);
                                                            return (
                                                                <div
                                                                    key={f.id}
                                                                    onClick={() => toggleFolderAccess(f.id)}
                                                                    style={{
                                                                        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px',
                                                                        background: isSelected ? '#eff6ff' : '#fff',
                                                                        border: `1px solid ${isSelected ? '#3b82f6' : '#e2e8f0'}`,
                                                                        borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s'
                                                                    }}
                                                                >
                                                                    <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `2px solid ${isSelected ? '#3b82f6' : '#cbd5e1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSelected ? '#3b82f6' : 'transparent', flexShrink: 0 }}>
                                                                        {isSelected && <Check size={12} color="#fff" />}
                                                                    </div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                                                                        <span style={{ fontSize: '1.1rem' }}>{f.icon || '📁'}</span>
                                                                        <span style={{ fontSize: '0.85rem', fontWeight: isSelected ? 600 : 400, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{f.name}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* GRAMMAR FOLDERS */}
                                            {grammarFolders.length > 0 && (
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                                                        <FolderOpen size={16} color="#10b981" />
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Folders Kỹ năng</span>
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
                                                        {grammarFolders.map(f => {
                                                            const isSelected = (formData.folderAccess || []).includes(f.id);
                                                            return (
                                                                <div
                                                                    key={f.id}
                                                                    onClick={() => toggleFolderAccess(f.id)}
                                                                    style={{
                                                                        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px',
                                                                        background: isSelected ? '#ecfdf5' : '#fff',
                                                                        border: `1px solid ${isSelected ? '#10b981' : '#e2e8f0'}`,
                                                                        borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s'
                                                                    }}
                                                                >
                                                                    <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `2px solid ${isSelected ? '#10b981' : '#cbd5e1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSelected ? '#10b981' : 'transparent', flexShrink: 0 }}>
                                                                        {isSelected && <Check size={12} color="#fff" />}
                                                                    </div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                                                                        <span style={{ fontSize: '1.1rem' }}>{f.icon || '📁'}</span>
                                                                        <span style={{ fontSize: '0.85rem', fontWeight: isSelected ? 600 : 400, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{f.name}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* REWARD POINTS TOGGLE */}
                            <div className="admin-form-group" style={{ marginTop: '20px' }}>
                                <div
                                    onClick={() => setFormData(prev => ({ ...prev, enableRewardPoints: !prev.enableRewardPoints }))}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '14px 16px', borderRadius: '12px', cursor: 'pointer',
                                        background: formData.enableRewardPoints ? '#fffbeb' : '#f8fafc',
                                        border: `1.5px solid ${formData.enableRewardPoints ? '#f59e0b' : '#e2e8f0'}`,
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Gift size={20} color={formData.enableRewardPoints ? '#f59e0b' : '#94a3b8'} />
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: formData.enableRewardPoints ? '#92400e' : '#475569' }}>🎁 Tích điểm đổi quà</div>
                                            <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>Bật để theo dõi điểm thưởng và lịch sử đổi quà của từng học viên trong lớp này</div>
                                        </div>
                                    </div>
                                    <div style={{ width: '44px', height: '24px', borderRadius: '12px', background: formData.enableRewardPoints ? '#f59e0b' : '#cbd5e1', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                                        <div style={{ width: '20px', height: '20px', borderRadius: '10px', background: '#fff', position: 'absolute', top: '2px', left: formData.enableRewardPoints ? '22px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                                    </div>
                                </div>
                            </div>

                            <div className="admin-modal-actions" style={{ marginTop: '32px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                {isEditing && (
                                    <div style={{ display: 'flex', flex: 1, gap: '8px', minWidth: '180px' }}>
                                        <button
                                            type="button"
                                            className="admin-btn"
                                            onClick={() => setFormData({ ...formData, isHidden: !formData.isHidden })}
                                            style={{ flex: 1, justifyContent: 'center', background: formData.isHidden ? '#fff5f5' : '#f8fafc', color: formData.isHidden ? '#e03131' : '#64748b', border: `1px solid ${formData.isHidden ? '#ffc9c9' : '#e2e8f0'}`, padding: '8px 10px', fontSize: '0.85rem', height: '40px', whiteSpace: 'nowrap', gap: '6px' }}
                                            title="Nhóm bị đóng sẽ chuyển xuống khu vực riêng ở cuối trang Quản lý Nhóm và học viên/giáo viên sẽ không nhìn thấy."
                                        >
                                            {formData.isHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                                            {formData.isHidden ? 'Mở lại Nhóm' : 'Đóng Nhóm'}
                                        </button>
                                        <button type="button" className="admin-btn admin-btn-danger" onClick={() => setGroupToDelete(formData)} style={{ flex: 1, justifyContent: 'center', background: '#fff5f5', color: '#e03131', border: '1px solid #ffc9c9', padding: '8px 10px', fontSize: '0.85rem', height: '40px', whiteSpace: 'nowrap', gap: '6px' }}>
                                            <Trash2 size={16} /> Xóa Nhóm
                                        </button>
                                    </div>
                                )}
                                <div style={{ display: 'flex', flex: 1, gap: '8px', minWidth: '180px' }}>
                                    <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setFormOpen(false)} style={{ flex: 1, justifyContent: 'center' }}>Hủy</button>
                                    <button type="submit" className="admin-btn admin-btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '8px 16px', fontSize: '0.85rem', height: '40px', whiteSpace: 'nowrap', gap: '6px' }}>
                                        <Save size={16} /> {isEditing ? 'Cập nhật' : 'Tạo Nhóm'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div >
                </div>
            )}

            {/* DELETE MODAL */}
            {
                groupToDelete && (
                    <div className="teacher-modal-overlay">
                        <div className="teacher-modal">
                            <h2 className="admin-modal-title" style={{ color: '#ef4444', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Trash2 size={24} /> Xác nhận xóa
                                </div>
                            </h2>
                            <p className="admin-modal-desc">
                                Bạn có chắc muốn xóa nhóm <strong>{groupToDelete.name}</strong> không?
                                <br /><br />
                                <strong>Lưu ý:</strong> Hành động này sẽ khiến các User trong nhóm mất quyền truy cập vào các bài học có sẵn của nhóm.
                            </p>
                            <div className="admin-modal-actions" style={{ marginTop: '24px', flexDirection: 'row' }}>
                                <button className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setGroupToDelete(null)}>Hủy</button>
                                <button className="admin-btn admin-btn-primary" style={{ backgroundColor: '#ef4444', flex: 1 }} onClick={handleConfirmDelete}>Xóa nhóm</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* MEMBERS MODAL */}
            {
                membersModalOpen && selectedGroupForMembers && (
                    <div className="teacher-modal-overlay">
                        <div className="teacher-modal wide">
                            <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                                <button className="teacher-modal-close" onClick={() => setMembersModalOpen(false)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '24px', flexShrink: 0, paddingRight: '40px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', overflow: 'hidden' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', flexShrink: 0 }}>
                                        <Users size={24} />
                                    </div>
                                    <div style={{ overflow: 'hidden' }}>
                                        <h2 className="admin-modal-title" style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', paddingBottom: 0 }}>Quản lý Thành viên</h2>
                                        <div style={{ fontSize: '1rem', color: '#64748b', fontWeight: 500, marginTop: '4px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>Nhóm: {selectedGroupForMembers.name}</div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', paddingRight: '4px', flexGrow: 1 }}>
                                {isUsersLoading ? (
                                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', color: '#64748b' }}>Đang tải dữ liệu người dùng...</div>
                                ) : (
                                    <>
                                        {/* SEARCH AND ADD */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#fff', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '1rem' }}>Thêm thành viên mới</div>
                                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                <Search size={20} style={{ position: 'absolute', left: '16px', color: '#94a3b8', pointerEvents: 'none' }} />
                                                <input
                                                    id="admin-group-member-search"
                                                    name="adminGroupMemberSearch"
                                                    type="text"
                                                    aria-label="Tìm tên hoặc email thành viên"
                                                    style={{ width: '100%', padding: '14px 16px 14px 48px', background: '#fff', border: '2px solid #f1f5f9', borderRadius: '16px', fontSize: '1rem', fontWeight: 600, color: '#0f172a', transition: 'all 0.2s ease', outline: 'none' }}
                                                    placeholder="Tìm tên hoặc email..."
                                                    value={memberSearchQuery}
                                                    onChange={e => setMemberSearchQuery(e.target.value)}
                                                />
                                            </div>

                                            {memberSearchQuery.trim().length > 0 && (
                                                <div style={{ maxHeight: '200px', overflowY: 'auto', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '8px' }}>
                                                    {(() => {
                                                        const unassignedUsers = searchResults.filter(u => !currentMembers.find(m => m.uid === u.uid));
                                                        const sortedUsers = [...unassignedUsers].sort((a, b) => {
                                                            const roleWeight = { admin: 4, staff: 3, teacher: 2, user: 1 };
                                                            const weightA = roleWeight[a.role || 'user'] || 1;
                                                            const weightB = roleWeight[b.role || 'user'] || 1;
                                                            if (weightA !== weightB) {
                                                                return weightB - weightA;
                                                            }

                                                            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                                                            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                                                            return timeA - timeB;
                                                        });

                                                        if (sortedUsers.length === 0 && whitelistEmails.filter(w =>
                                                            !(w.groupIds || []).includes(selectedGroupForMembers.id) &&
                                                            w.email.toLowerCase().includes(memberSearchQuery.toLowerCase())
                                                        ).length === 0) return <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>Không tìm thấy người dùng phù hợp.</div>;

                                                        return <>
                                                            {sortedUsers.map(user => (
                                                                <div key={user.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1, paddingRight: '12px' }}>
                                                                        <Avatar src={user.photoURL} alt={user.displayName} size={36} />
                                                                        <div style={{ minWidth: 0, flex: 1 }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
                                                                                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{user.displayName || 'Chưa cập nhật'}</div>
                                                                                <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '8px', background: '#eff6ff', color: '#3b82f6', fontWeight: 700 }}>
                                                                                    {user.role === 'admin' ? 'Admin' : user.role === 'teacher' ? 'Giáo viên' : user.role === 'staff' ? 'Nhân viên VP' : 'Học viên'}
                                                                                </span>
                                                                            </div>
                                                                            <div style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{user.email}</div>
                                                                        </div>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => handleAddMember(user)}
                                                                        disabled={isUpdatingMember}
                                                                        style={{ flexShrink: 0, padding: '8px 16px', borderRadius: '12px', background: '#eff6ff', color: '#3b82f6', border: 'none', fontSize: '0.85rem', fontWeight: 700, cursor: isUpdatingMember ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s ease' }}
                                                                    >
                                                                        <Plus size={16} /> Thêm
                                                                    </button>
                                                                </div>
                                                            ))}
                                                            {/* Whitelist emails matching search */}
                                                            {(() => {
                                                                const memberEmails = currentMembers.map(m => (m.email || '').toLowerCase());
                                                                const unassignedWl = whitelistEmails.filter(w =>
                                                                    !(w.groupIds || []).includes(selectedGroupForMembers.id) &&
                                                                    !memberEmails.includes(w.email.toLowerCase())
                                                                );
                                                                const searchLower = memberSearchQuery.toLowerCase();
                                                                const filteredWl = unassignedWl.filter(w =>
                                                                    w.email.toLowerCase().includes(searchLower)
                                                                );
                                                                return filteredWl.map(wl => (
                                                                    <div key={`wl-${wl.email}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1, paddingRight: '12px' }}>
                                                                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                                                <Mail size={18} color="#22c55e" />
                                                                            </div>
                                                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
                                                                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{wl.email}</div>
                                                                                    <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '8px', background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>Chưa đăng nhập</span>
                                                                                </div>
                                                                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Pre-approved • {wl.role === 'teacher' ? 'Giáo viên' : wl.role === 'admin' ? 'Admin' : wl.role === 'staff' ? 'Nhân viên VP' : 'Học viên'}</div>
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => handleAddWhitelistMember(wl)}
                                                                            disabled={isUpdatingMember}
                                                                            style={{ flexShrink: 0, padding: '8px 16px', borderRadius: '12px', background: '#f0fdf4', color: '#16a34a', border: 'none', fontSize: '0.85rem', fontWeight: 700, cursor: isUpdatingMember ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s ease' }}
                                                                        >
                                                                            <Plus size={16} /> Thêm
                                                                        </button>
                                                                    </div>
                                                                ));
                                                            })()}
                                                        </>;
                                                    })()}
                                                </div>
                                            )}
                                        </div>

                                        {/* CURRENT MEMBERS */}
                                        <div style={{ marginTop: '12px' }}>
                                            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '1.1rem', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span>Thành viên trong nhóm</span>
                                                <span style={{ fontSize: '0.85rem', background: '#e2e8f0', padding: '4px 12px', borderRadius: '20px', color: '#475569', fontWeight: 700 }}>
                                                    <span>{currentMembers.length} người</span>
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {(() => {
                                                    const members = currentMembers;

                                                    if (members.length === 0) return <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem', background: '#f8fafc' }}>Nhóm này chưa có thành viên nào.</div>;

                                                    // Sắp xếp: Admin -> Teacher/Staff -> User, user cũ -> mới
                                                    const sortedMembers = [...members].sort((a, b) => {
                                                        const roleWeight = { admin: 4, staff: 3, teacher: 2, user: 1 };
                                                        const weightA = roleWeight[a.role || 'user'] || 1;
                                                        const weightB = roleWeight[b.role || 'user'] || 1;
                                                        if (weightA !== weightB) {
                                                            return weightB - weightA;
                                                        }

                                                        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                                                        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                                                        return timeA - timeB;
                                                    });

                                                    const sortedMemberRows = sortedMembers.map((user, idx) => (
                                                        <div key={user.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#fff', border: '1px solid #f1f5f9', borderRadius: '16px', transition: 'all 0.2s ease', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1, paddingRight: '8px' }}>
                                                                <Avatar src={user.photoURL} alt={user.displayName} size={48} />
                                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                                                        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{user.displayName || 'Chưa cập nhật'}</div>
                                                                        <span style={{ fontSize: '0.75rem', padding: '2px 10px', borderRadius: '10px', background: '#eff6ff', color: '#3b82f6', fontWeight: 700, textTransform: 'capitalize' }}>
                                                                            {user.role === 'admin' ? 'Admin' : user.role === 'teacher' ? 'Giáo viên' : user.role === 'staff' ? 'Nhân viên VP' : 'Học viên'}
                                                                        </span>
                                                                    </div>
                                                                    <div style={{ fontSize: '0.9rem', color: '#64748b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{user.email}</div>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => handleRemoveMember(user)}
                                                                disabled={isUpdatingMember}
                                                                style={{ flexShrink: 0, width: '40px', height: '40px', borderRadius: '12px', background: '#fee2e2', color: '#ef4444', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isUpdatingMember ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
                                                                title="Xóa khỏi nhóm"
                                                            >
                                                                <UserMinus size={20} />
                                                            </button>
                                                        </div>
                                                    ));

                                                    return sortedMemberRows;
                                                })()}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}
