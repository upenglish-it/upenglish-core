import { useState, useEffect, useRef } from 'react';
import { db } from '../../config/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { getGroups } from '../../services/adminService';
import { addPoints, subtractPoints, redeemGift, getRewardHistory } from '../../services/rewardPointsService';
import { Gift, Plus, Minus, History, Search, ChevronDown, Star, Package, X, Award, Users, TrendingUp, TrendingDown, Check, Loader } from 'lucide-react';
import Avatar from '../../components/common/Avatar';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminRewardPointsPage() {
    const { user } = useAuth();
    const isTeacher = user?.role === 'teacher';
    const [groups, setGroups] = useState([]);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [students, setStudents] = useState([]);
    const [allUsersCache, setAllUsersCache] = useState([]); // cached all users for cross-group search
    const [loading, setLoading] = useState(true);
    const [studentsLoading, setStudentsLoading] = useState(false);
    const [toast, setToast] = useState(null); // { type: 'success'|'error', text: string }
    function showToast(text, type = 'success') { setToast({ text, type }); }

    // Inline point editing
    const [inlineAmounts, setInlineAmounts] = useState({}); // uid → string
    const [inlineReasons, setInlineReasons] = useState({}); // uid → string
    const [savingUid, setSavingUid] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Redeem Modal
    const [redeemModal, setRedeemModal] = useState(null); // { userId, displayName, points }
    const [redeemAmount, setRedeemAmount] = useState('');
    const [redeemGiftName, setRedeemGiftName] = useState('');

    // History Modal
    const [historyModal, setHistoryModal] = useState(null); // { userId, displayName }
    const [historyData, setHistoryData] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Search
    const [searchTerm, setSearchTerm] = useState('');

    // Custom dropdown
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(e) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        loadGroups();
    }, []);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3500);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    async function loadGroups() {
        setLoading(true);
        try {
            const groupsList = await getGroups(true);
            let rewardGroups = groupsList.filter(g => g.enableRewardPoints && !g.isHidden);

            // Teachers only see their own groups
            if (isTeacher && user?.groupIds) {
                rewardGroups = rewardGroups.filter(g => user.groupIds.includes(g.id));
            }

            setGroups(rewardGroups);
            if (rewardGroups.length > 0) {
                setSelectedGroupId(rewardGroups[0].id);
                await loadStudents(rewardGroups[0].id);
            }
        } catch (error) {
            console.error('Error loading groups:', error);
            showToast('Lỗi tải dữ liệu nhóm.', 'error');
        }
        setLoading(false);
    }

    async function loadStudents(groupId) {
        setStudentsLoading(true);
        try {
            // Read users for this group only
            const usersSnap = await getDocs(collection(db, 'users'));
            const groupMembers = [];
            usersSnap.forEach(docSnap => {
                const data = docSnap.data();
                if ((data.groupIds || []).includes(groupId) && (data.role === 'user' || !data.role) && !data.isDeleted) {
                    groupMembers.push({ uid: docSnap.id, ...data });
                }
            });

            // Read centralized reward points for group members
            const rewardSnap = await getDocs(collection(db, 'reward_points'));
            const rewardMap = {};
            rewardSnap.forEach(d => { rewardMap[d.id] = d.data().points || 0; });

            const merged = groupMembers.map(m => ({ ...m, points: rewardMap[m.uid] || 0 }));
            setStudents(merged.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '')));
        } catch (error) {
            console.error('Error loading students:', error);
            showToast('Lỗi tải dữ liệu học viên.', 'error');
        }
        setStudentsLoading(false);
    }

    async function handleGroupChange(groupId) {
        setSelectedGroupId(groupId);
        setSearchTerm('');
        await loadStudents(groupId);
    }

    async function handleInlinePoints(student, isAdd) {
        const uid = student.uid;
        const amount = parseInt(inlineAmounts[uid]);
        if (!amount || amount <= 0) {
            showToast('Nhập số điểm > 0.', 'error');
            return;
        }
        setSavingUid(uid);
        try {
            const reason = inlineReasons[uid] || '';
            const name = student.displayName || student.email;
            const groupName = selectedGroup?.name || '';
            let newPts;
            if (isAdd) {
                await addPoints(uid, amount, reason, user?.uid, name, selectedGroupId, groupName);
                newPts = (student.points || 0) + amount;
                showToast(`+${amount} điểm cho ${name}`);
            } else {
                newPts = await subtractPoints(uid, amount, reason, user?.uid, name, selectedGroupId, groupName);
                showToast(`−${amount} điểm của ${name}`);
            }
            // Update both students and cache
            const updatePts = s => s.uid === uid ? { ...s, points: newPts } : s;
            setStudents(prev => prev.map(updatePts));
            setAllUsersCache(prev => prev.map(updatePts));
            setInlineAmounts(prev => ({ ...prev, [uid]: '' }));
            setInlineReasons(prev => ({ ...prev, [uid]: '' }));
        } catch (error) {
            showToast('Lỗi: ' + error.message, 'error');
        }
        setSavingUid(null);
    }

    async function handleRedeem(e) {
        e.preventDefault();
        if (!redeemModal || isSubmitting) return;
        const amount = parseInt(redeemAmount);
        if (!amount || amount <= 0) {
            showToast('Vui lòng nhập số điểm hợp lệ (> 0).', 'error');
            return;
        }
        if (!redeemGiftName.trim()) {
            showToast('Vui lòng nhập tên quà tặng.', 'error');
            return;
        }
        setIsSubmitting(true);
        try {
            await redeemGift(redeemModal.uid, amount, redeemGiftName.trim(), user?.uid, selectedGroupId, selectedGroup?.name || '');
            const updatePts = s => s.uid === redeemModal.uid ? { ...s, points: (s.points || 0) - amount } : s;
            setStudents(prev => prev.map(updatePts));
            setAllUsersCache(prev => prev.map(updatePts));
            showToast(`${redeemModal.displayName || 'Học viên'} đã đổi "${redeemGiftName.trim()}" (${amount} điểm).`);
            setRedeemModal(null);
            setRedeemAmount('');
            setRedeemGiftName('');
        } catch (error) {
            showToast(error.message, 'error');
        }
        setIsSubmitting(false);
    }

    async function openHistoryModal(student) {
        setHistoryModal(student);
        setHistoryLoading(true);
        try {
            const history = await getRewardHistory(student.uid);
            setHistoryData(history);
        } catch (error) {
            console.error('Error loading history:', error);
            showToast('Lỗi tải lịch sử.', 'error');
        }
        setHistoryLoading(false);
    }

    const selectedGroup = groups.find(g => g.id === selectedGroupId);

    // Cross-group search: lazy-load cache only when needed
    const filteredStudents = (() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) {
            return students; // no search → show selected group's students
        }
        // If cache is loaded, search across all groups by displayName only
        if (allUsersCache.length > 0) {
            return allUsersCache.filter(u =>
                (u.groupIds || []).length > 0 &&
                (u.displayName || '').toLowerCase().includes(term)
            );
        }
        // Cache not loaded yet → search within current group only
        return students.filter(s =>
            (s.displayName || '').toLowerCase().includes(term)
        );
    })();

    // Lazy-load cross-group cache when user starts typing (2+ chars)
    useEffect(() => {
        if (searchTerm.trim().length >= 2 && allUsersCache.length === 0) {
            (async () => {
                try {
                    const usersSnap = await getDocs(collection(db, 'users'));
                    let allUsers = [];
                    usersSnap.forEach(docSnap => {
                        const data = docSnap.data();
                        if ((data.role === 'user' || !data.role) && !data.isDeleted) {
                            allUsers.push({ uid: docSnap.id, ...data });
                        }
                    });
                    const rewardSnap = await getDocs(collection(db, 'reward_points'));
                    const rewardMap = {};
                    rewardSnap.forEach(d => { rewardMap[d.id] = d.data().points || 0; });
                    allUsers = allUsers.map(u => ({ ...u, points: rewardMap[u.uid] || 0 }));
                    setAllUsersCache(allUsers);
                } catch (e) {
                    console.warn('Could not load cross-group search cache:', e);
                }
            })();
        }
    }, [searchTerm]);

    function formatDate(timestamp) {
        if (!timestamp) return '—';
        const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <h1 className="admin-page-title">🎁 Tích điểm đổi quà</h1>
                <p className="admin-page-subtitle">Quản lý hệ thống điểm thưởng và phần quà dành cho học viên.</p>
            </div>

            {toast && (
                <div style={{
                    position: 'fixed', top: '24px', right: '24px', zIndex: 10000,
                    padding: '14px 24px', borderRadius: '12px',
                    background: toast.type === 'success' ? '#ecfdf5' : '#fef2f2',
                    color: toast.type === 'success' ? '#065f46' : '#991b1b',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)', fontWeight: 600, fontSize: '0.9rem',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    animation: 'slideInRight 0.2s ease'
                }}>
                    {toast.type === 'success' ? '✅' : '❌'} {toast.text}
                </div>
            )}

            {loading ? (
                <div className="admin-empty-state">Đang tải dữ liệu...</div>
            ) : groups.length === 0 ? (
                <div className="admin-card">
                    <div className="admin-empty-state">
                        <div className="admin-empty-icon"><Gift size={28} /></div>
                        <h3>Chưa có lớp nào bật tích điểm</h3>
                        <p>Vào <strong>Quản lý Nhóm học viên</strong> → Sửa nhóm → bật "🎁 Tích điểm đổi quà" để bắt đầu.</p>
                    </div>
                </div>
            ) : (
                <>
                    {/* Group Selector + Search */}
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div ref={dropdownRef} style={{ position: 'relative', flex: '0 1 280px', minWidth: '180px' }}>
                            <button
                                type="button"
                                onClick={() => setDropdownOpen(p => !p)}
                                style={{
                                    width: '100%', padding: '10px 36px 10px 14px', borderRadius: '12px',
                                    border: '1.5px solid #e2e8f0', fontSize: '0.92rem', fontWeight: 600,
                                    color: '#0f172a', background: '#fff', cursor: 'pointer', outline: 'none',
                                    textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px'
                                }}
                            >
                                {selectedGroup?.name || 'Chọn lớp'}
                            </button>
                            <ChevronDown size={18} style={{ position: 'absolute', right: '12px', top: '50%', transform: `translateY(-50%) rotate(${dropdownOpen ? 180 : 0}deg)`, pointerEvents: 'none', color: '#94a3b8', transition: 'transform 0.2s' }} />
                            {dropdownOpen && (
                                <div style={{
                                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100,
                                    background: '#fff', borderRadius: '12px', border: '1.5px solid #e2e8f0',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.1)', maxHeight: '240px', overflowY: 'auto',
                                    padding: '4px'
                                }}>
                                    {groups.map(g => (
                                        <div
                                            key={g.id}
                                            onClick={() => { handleGroupChange(g.id); setDropdownOpen(false); }}
                                            style={{
                                                padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                                                fontSize: '0.9rem', fontWeight: g.id === selectedGroupId ? 700 : 500,
                                                color: g.id === selectedGroupId ? '#6366f1' : '#334155',
                                                background: g.id === selectedGroupId ? '#eef2ff' : 'transparent',
                                                transition: 'background 0.15s'
                                            }}
                                            onMouseEnter={e => { if (g.id !== selectedGroupId) e.currentTarget.style.background = '#f8fafc'; }}
                                            onMouseLeave={e => { if (g.id !== selectedGroupId) e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            {g.name}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="admin-search-box" style={{ flex: '1 1 200px', margin: 0 }}>
                            <Search size={16} className="search-icon" />
                            <input
                                type="text"
                                placeholder="Tìm học viên..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Students List */}
                    <div className="admin-card">
                        {studentsLoading ? (
                            <div className="admin-empty-state">Đang tải dữ liệu học viên...</div>
                        ) : filteredStudents.length === 0 ? (
                            <div className="admin-empty-state">
                                <div className="admin-empty-icon"><Users size={28} /></div>
                                <h3>{searchTerm ? 'Không tìm thấy học viên' : 'Chưa có học viên trong lớp này'}</h3>
                                <p>Thêm học viên vào nhóm từ trang Quản lý Nhóm học viên.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {filteredStudents.map(student => {
                                    const uid = student.uid;
                                    const isSaving = savingUid === uid;
                                    const amt = inlineAmounts[uid] || '';
                                    return (
                                        <div key={uid} style={{
                                            display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                                            borderRadius: '14px', background: '#fff', border: '1px solid #e2e8f0',
                                            flexWrap: 'wrap', transition: 'box-shadow 0.15s',
                                        }}>
                                            {/* Avatar + Name */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 180px', minWidth: 0 }}>
                                                <Avatar src={student.photoURL} alt={student.displayName} size={36} />
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{student.displayName || 'Chưa cập nhật'}</div>
                                                </div>
                                            </div>

                                            {/* Points badge */}
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: '4px',
                                                fontSize: '1rem', fontWeight: 800,
                                                color: student.points > 0 ? '#f59e0b' : '#94a3b8',
                                                background: student.points > 0 ? '#fffbeb' : '#f8fafc',
                                                padding: '4px 12px', borderRadius: '20px',
                                                border: `1px solid ${student.points > 0 ? '#fde68a' : '#e2e8f0'}`,
                                                flexShrink: 0
                                            }}>
                                                <Star size={14} /> {student.points || 0}
                                            </div>

                                            {/* Inline controls: − [input] + */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                                <button
                                                    onClick={() => handleInlinePoints(student, false)}
                                                    disabled={isSaving || !amt}
                                                    title="Trừ điểm"
                                                    style={{
                                                        width: '32px', height: '32px', borderRadius: '8px', border: '1.5px solid #fecaca',
                                                        background: amt ? '#fef2f2' : '#f8fafc', color: amt ? '#dc2626' : '#cbd5e1',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        cursor: amt ? 'pointer' : 'default', fontWeight: 900, fontSize: '1.1rem',
                                                        transition: 'all 0.15s'
                                                    }}
                                                >
                                                    {isSaving ? <Loader size={14} className="spin" /> : <Minus size={16} />}
                                                </button>
                                                <input
                                                    type="number"
                                                    placeholder="0"
                                                    value={amt}
                                                    onChange={e => setInlineAmounts(prev => ({ ...prev, [uid]: e.target.value }))}
                                                    style={{
                                                        width: '52px', height: '32px', borderRadius: '8px', border: '1.5px solid #e2e8f0',
                                                        textAlign: 'center', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a',
                                                        outline: 'none', padding: '0 4px'
                                                    }}
                                                    min="1"
                                                />
                                                <button
                                                    onClick={() => handleInlinePoints(student, true)}
                                                    disabled={isSaving || !amt}
                                                    title="Cộng điểm"
                                                    style={{
                                                        width: '32px', height: '32px', borderRadius: '8px', border: '1.5px solid #bbf7d0',
                                                        background: amt ? '#f0fdf4' : '#f8fafc', color: amt ? '#16a34a' : '#cbd5e1',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        cursor: amt ? 'pointer' : 'default', fontWeight: 900, fontSize: '1.1rem',
                                                        transition: 'all 0.15s'
                                                    }}
                                                >
                                                    {isSaving ? <Loader size={14} className="spin" /> : <Plus size={16} />}
                                                </button>
                                            </div>

                                            {/* Reason input */}
                                            <input
                                                type="text"
                                                placeholder="Lý do..."
                                                value={inlineReasons[uid] || ''}
                                                onChange={e => setInlineReasons(prev => ({ ...prev, [uid]: e.target.value }))}
                                                style={{
                                                    flex: '1 1 120px', height: '32px', borderRadius: '8px', border: '1.5px solid #e2e8f0',
                                                    fontSize: '0.82rem', color: '#475569', padding: '0 10px', outline: 'none',
                                                    minWidth: '80px'
                                                }}
                                            />

                                            {/* Gift + History buttons */}
                                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                                <button
                                                    className="admin-action-btn"
                                                    onClick={() => { setRedeemModal(student); setRedeemAmount(''); setRedeemGiftName(''); }}
                                                    title="Đổi quà"
                                                    style={{ color: '#f59e0b', background: '#fffbeb', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #fde68a' }}
                                                >
                                                    <Gift size={15} />
                                                </button>
                                                <button
                                                    className="admin-action-btn"
                                                    onClick={() => openHistoryModal(student)}
                                                    title="Lịch sử"
                                                    style={{ color: '#6366f1', background: '#eef2ff', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #c7d2fe' }}
                                                >
                                                    <History size={15} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}



            {/* REDEEM MODAL */}
            {redeemModal && (
                <div className="teacher-modal-overlay">
                    <div className="teacher-modal" style={{ maxWidth: '480px' }}>
                        <div className="teacher-modal-header">
                            <h3 className="teacher-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Gift size={22} color="#f59e0b" /> Đổi quà
                            </h3>
                            <button className="teacher-modal-close" onClick={() => setRedeemModal(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '4px' }}>
                            Đổi quà cho <strong>{redeemModal.displayName || redeemModal.email}</strong>
                        </p>
                        <p style={{ fontSize: '0.85rem', color: '#f59e0b', fontWeight: 700, marginBottom: '16px' }}>
                            ⭐ Điểm hiện có: {redeemModal.points || 0}
                        </p>
                        <form onSubmit={handleRedeem}>
                            <div className="admin-form-group" style={{ marginBottom: '16px' }}>
                                <label>Tên quà tặng <span className="text-danger">*</span></label>
                                <input
                                    type="text"
                                    className="admin-form-input"
                                    placeholder="Ví dụ: Bút bi, Sticker, Sổ tay…"
                                    value={redeemGiftName}
                                    onChange={e => setRedeemGiftName(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="admin-form-group" style={{ marginBottom: '20px' }}>
                                <label>Số điểm trừ <span className="text-danger">*</span></label>
                                <input
                                    type="number"
                                    className="admin-form-input"
                                    placeholder="Ví dụ: 50"
                                    value={redeemAmount}
                                    onChange={e => setRedeemAmount(e.target.value)}
                                    min="1"
                                    max={redeemModal.points || 0}
                                    required
                                />
                            </div>
                            <div className="admin-modal-actions" style={{ flexDirection: 'row' }}>
                                <button type="button" className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setRedeemModal(null)}>Hủy</button>
                                <button type="submit" className="admin-btn admin-btn-primary" style={{ flex: 1, background: '#f59e0b' }} disabled={isSubmitting}>
                                    <Gift size={16} /> {isSubmitting ? 'Đang xử lý...' : 'Đổi quà'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* HISTORY MODAL */}
            {historyModal && (
                <div className="teacher-modal-overlay">
                    <div className="teacher-modal wide" style={{ maxWidth: '640px' }}>
                        <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                            <button className="teacher-modal-close" onClick={() => setHistoryModal(null)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <h2 className="admin-modal-title" style={{ justifyContent: 'flex-start', marginBottom: '20px', paddingRight: '40px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <History size={22} color="#6366f1" /> Lịch sử tích điểm & đổi quà
                            </div>
                        </h2>
                        <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '20px' }}>
                            {historyModal.displayName || historyModal.email}
                        </p>

                        {historyLoading ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Đang tải lịch sử...</div>
                        ) : historyData.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                                <History size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                                <p>Chưa có lịch sử tích điểm / đổi quà.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
                                {historyData.map(item => {
                                    const isEarn = item.type === 'earn';
                                    const isDeduct = item.type === 'deduct';
                                    const isRedeem = item.type === 'redeem';
                                    const bgColor = isEarn ? '#f0fdf4' : isDeduct ? '#fef2f2' : '#fffbeb';
                                    const borderColor = isEarn ? '#bbf7d0' : isDeduct ? '#fecaca' : '#fde68a';
                                    const iconBg = isEarn ? '#dcfce7' : isDeduct ? '#fee2e2' : '#fef3c7';
                                    const iconColor = isEarn ? '#16a34a' : isDeduct ? '#dc2626' : '#f59e0b';
                                    const amountColor = isEarn ? '#16a34a' : '#dc2626';
                                    const tagBg = isEarn ? '#dcfce7' : isDeduct ? '#fee2e2' : '#fef3c7';
                                    const tagColor = isEarn ? '#15803d' : isDeduct ? '#991b1b' : '#92400e';
                                    const label = isEarn ? 'Cộng điểm' : isDeduct ? 'Trừ điểm' : 'Đổi quà';
                                    const icon = isEarn ? <TrendingUp size={20} /> : isDeduct ? <TrendingDown size={20} /> : <Gift size={20} />;
                                    return (
                                        <div
                                            key={item.id}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '12px',
                                                padding: '14px 16px', borderRadius: '14px',
                                                background: bgColor, border: `1px solid ${borderColor}`,
                                            }}
                                        >
                                            <div style={{
                                                width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: iconBg, color: iconColor
                                            }}>
                                                {icon}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                    <span style={{ fontWeight: 800, fontSize: '1rem', color: amountColor }}>
                                                        {isEarn ? '+' : '−'}{item.amount} điểm
                                                    </span>
                                                    <span style={{
                                                        fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '8px',
                                                        background: tagBg, color: tagColor
                                                    }}>
                                                        {label}
                                                    </span>
                                                </div>
                                                {(isEarn || isDeduct) && item.reason && (
                                                    <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '4px' }}>
                                                        Lý do: {item.reason}
                                                    </div>
                                                )}
                                                {isRedeem && item.giftName && (
                                                    <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Package size={14} /> {item.giftName}
                                                    </div>
                                                )}
                                                {item.groupName && (
                                                    <div style={{ fontSize: '0.75rem', color: '#6366f1', marginTop: '4px', fontWeight: 600 }}>
                                                        📍 {item.groupName}
                                                    </div>
                                                )}
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                                                    {formatDate(item.createdAt)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
