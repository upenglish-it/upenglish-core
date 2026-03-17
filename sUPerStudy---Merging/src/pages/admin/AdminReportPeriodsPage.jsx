import React, { useState, useEffect } from 'react';
import { ClipboardList, Plus, Calendar, Clock, Users, CheckCircle, AlertTriangle, Trash2, Edit3, ChevronDown, ChevronUp, Save, X, Settings, ToggleLeft, ToggleRight } from 'lucide-react';
import { getAllReportPeriods, createReportPeriod, updateReportPeriod, deleteReportPeriod, computePeriodStatus, getStatusLabel, getDaysRemaining, getReportStatsForPeriod, getReportPeriodDefaults, saveReportPeriodDefaults, ensureCurrentPeriodExists, getTeacherReportDetails } from '../../services/reportPeriodService';
import { useAuth } from '../../contexts/AuthContext';

const STATUS_STYLES = {
    upcoming: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', icon: '🗓️' },
    active: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', icon: '🟢' },
    grace: { bg: '#fefce8', color: '#ca8a04', border: '#fde68a', icon: '⚠️' },
    closed: { bg: '#f8fafc', color: '#94a3b8', border: '#e2e8f0', icon: '⏹️' },
};

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function AdminReportPeriodsPage() {
    const { user } = useAuth();
    const [periods, setPeriods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ label: '', startDate: '', endDate: '', graceDays: 3, dataStartDate: '', dataEndDate: '' });

    // Teacher stats
    const [expandedPeriodId, setExpandedPeriodId] = useState(null);
    const [teacherStats, setTeacherStats] = useState({});
    const [statsLoading, setStatsLoading] = useState({});

    // Delete confirm
    const [deleteTarget, setDeleteTarget] = useState(null);

    // Teacher detail expansion
    const [expandedTeacherId, setExpandedTeacherId] = useState(null);
    const [teacherDetails, setTeacherDetails] = useState({}); // { [teacherId]: [...students] }
    const [detailLoading, setDetailLoading] = useState({});

    // Auto-create defaults
    const [defaults, setDefaults] = useState({ enabled: false, startDay: 1, endDay: 28, graceDays: 3, dataStartDay: 1, dataEndDay: 28 });
    const [showDefaults, setShowDefaults] = useState(false);
    const [savingDefaults, setSavingDefaults] = useState(false);
    const [defaultsSaved, setDefaultsSaved] = useState(false);

    useEffect(() => {
        loadPage();
    }, []);

    async function loadPage() {
        setLoading(true);
        try {
            // Load defaults
            const defs = await getReportPeriodDefaults();
            if (defs) setDefaults(defs);

            // Auto-create if enabled
            await ensureCurrentPeriodExists();

            // Load all periods
            await loadPeriods();
        } catch (err) {
            console.error('Error loading page:', err);
        }
        setLoading(false);
    }

    async function loadPeriods() {
        try {
            const data = await getAllReportPeriods();
            setPeriods(data);

            // Auto-expand the active/grace period
            const activePeriod = data.find(p => {
                const s = computePeriodStatus(p);
                return s === 'active' || s === 'grace';
            });
            if (activePeriod) {
                setExpandedPeriodId(activePeriod.id);
                loadTeacherStats(activePeriod);
            }
        } catch (err) {
            console.error('Error loading report periods:', err);
        }
    }

    async function loadTeacherStats(period) {
        if (teacherStats[period.id] || statsLoading[period.id]) return;
        setStatsLoading(prev => ({ ...prev, [period.id]: true }));
        try {
            const stats = await getReportStatsForPeriod(period.startDate, period.endDate, period.id);
            setTeacherStats(prev => ({ ...prev, [period.id]: stats }));
        } catch (err) {
            console.error('Error loading teacher stats:', err);
        }
        setStatsLoading(prev => ({ ...prev, [period.id]: false }));
    }

    function handleToggleExpand(period) {
        if (expandedPeriodId === period.id) {
            setExpandedPeriodId(null);
        } else {
            setExpandedPeriodId(period.id);
            loadTeacherStats(period);
        }
    }

    function openCreateForm() {
        setEditingId(null);
        setForm({ label: '', startDate: '', endDate: '', graceDays: 3, dataStartDate: '', dataEndDate: '' });
        setIsFormOpen(true);
    }

    function openEditForm(period) {
        setEditingId(period.id);
        setForm({
            label: period.label || '',
            startDate: period.startDate || '',
            endDate: period.endDate || '',
            graceDays: period.graceDays ?? 3,
            dataStartDate: period.dataStartDate || '',
            dataEndDate: period.dataEndDate || ''
        });
        setIsFormOpen(true);
    }

    async function handleSave(e) {
        e.preventDefault();
        if (!form.startDate || !form.endDate) return;
        if (form.startDate > form.endDate) {
            alert('Ngày bắt đầu phải trước ngày kết thúc');
            return;
        }

        setSaving(true);
        try {
            const data = {
                label: form.label.trim() || `Kỳ báo cáo ${formatDate(form.startDate)} → ${formatDate(form.endDate)}`,
                startDate: form.startDate,
                endDate: form.endDate,
                graceDays: parseInt(form.graceDays) || 0,
                dataStartDate: form.dataStartDate || '',
                dataEndDate: form.dataEndDate || '',
                createdBy: user?.uid
            };

            if (editingId) {
                await updateReportPeriod(editingId, data);
            } else {
                await createReportPeriod(data);
            }

            setIsFormOpen(false);
            setEditingId(null);
            // Clear cached stats so they reload
            setTeacherStats({});
            await loadPeriods();
        } catch (err) {
            console.error('Error saving report period:', err);
            alert('Lỗi khi lưu kỳ báo cáo');
        }
        setSaving(false);
    }

    async function handleDelete(periodId) {
        try {
            await deleteReportPeriod(periodId);
            setDeleteTarget(null);
            setPeriods(prev => prev.filter(p => p.id !== periodId));
        } catch (err) {
            console.error('Error deleting report period:', err);
            alert('Lỗi khi xoá kỳ báo cáo');
        }
    }

    return (
        <div className="admin-page">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                <h1 className="admin-page-title" style={{ margin: 0 }}>
                    <ClipboardList size={28} color="#4f46e5" /> Kỳ báo cáo
                </h1>
                <button className="admin-btn admin-btn-primary" onClick={openCreateForm}>
                    <Plus size={18} /> Tạo kỳ mới
                </button>
            </div>

            {/* Auto-create Settings */}
            <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                    onClick={() => setShowDefaults(!showDefaults)}
                    style={{
                        padding: '16px 24px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '12px',
                        background: defaults.enabled ? 'rgba(34,197,94,0.04)' : 'transparent'
                    }}
                >
                    <Settings size={18} color="#64748b" />
                    <span style={{ flex: 1, fontWeight: 600, fontSize: '0.9rem', color: '#334155' }}>Tự động tạo kỳ báo cáo</span>
                    <span style={{
                        padding: '3px 10px', borderRadius: '100px', fontSize: '0.72rem', fontWeight: 700,
                        background: defaults.enabled ? '#f0fdf4' : '#f8fafc',
                        color: defaults.enabled ? '#16a34a' : '#94a3b8',
                        border: `1px solid ${defaults.enabled ? '#bbf7d0' : '#e2e8f0'}`
                    }}>
                        {defaults.enabled ? 'Đang bật' : 'Tắt'}
                    </span>
                    {showDefaults ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
                </div>

                {showDefaults && (
                    <div style={{ borderTop: '1px solid #e2e8f0', padding: '20px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <button
                                onClick={() => setDefaults(d => ({ ...d, enabled: !d.enabled }))}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                            >
                                {defaults.enabled
                                    ? <ToggleRight size={32} color="#22c55e" />
                                    : <ToggleLeft size={32} color="#cbd5e1" />
                                }
                            </button>
                            <span style={{ fontSize: '0.85rem', color: '#475569' }}>
                                {defaults.enabled ? 'Hệ thống sẽ tự tạo kỳ báo cáo hàng tháng' : 'Bật để tự động tạo kỳ báo cáo mỗi tháng'}
                            </span>
                        </div>

                        {defaults.enabled && (
                            <>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Ngày bắt đầu</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Ngày</span>
                                            <input
                                                type="number" min="1" max="28"
                                                value={defaults.startDay}
                                                onChange={e => setDefaults(d => ({ ...d, startDay: parseInt(e.target.value) || 1 }))}
                                                style={{ width: '70px', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '0.9rem', textAlign: 'center', outline: 'none' }}
                                            />
                                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>hàng tháng</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Ngày kết thúc</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Ngày</span>
                                            <input
                                                type="number" min="1" max="28"
                                                value={defaults.endDay}
                                                onChange={e => setDefaults(d => ({ ...d, endDay: parseInt(e.target.value) || 28 }))}
                                                style={{ width: '70px', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '0.9rem', textAlign: 'center', outline: 'none' }}
                                            />
                                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>hàng tháng</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Số ngày trễ</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <input
                                                type="number" min="0" max="14"
                                                value={defaults.graceDays}
                                                onChange={e => setDefaults(d => ({ ...d, graceDays: parseInt(e.target.value) || 0 }))}
                                                style={{ width: '70px', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '0.9rem', textAlign: 'center', outline: 'none' }}
                                            />
                                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>ngày</span>
                                        </div>
                                    </div>
                                </div>
                                <p style={{ margin: '0 0 12px', fontSize: '0.78rem', color: '#94a3b8' }}>
                                    VD: Kỳ từ ngày {defaults.startDay} → ngày {defaults.endDay} mỗi tháng, cho phép trễ {defaults.graceDays} ngày.
                                </p>

                                <div style={{ padding: '12px 16px', background: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd', marginBottom: '12px' }}>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0369a1', marginBottom: '10px' }}>
                                        📊 Khoảng dữ liệu báo cáo
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Dữ liệu từ ngày</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Ngày</span>
                                                <input
                                                    type="number" min="1" max="28"
                                                    value={defaults.dataStartDay || defaults.startDay}
                                                    onChange={e => setDefaults(d => ({ ...d, dataStartDay: parseInt(e.target.value) || 1 }))}
                                                    style={{ width: '70px', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '0.9rem', textAlign: 'center', outline: 'none' }}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Dữ liệu đến ngày</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Ngày</span>
                                                <input
                                                    type="number" min="1" max="28"
                                                    value={defaults.dataEndDay || defaults.endDay}
                                                    onChange={e => setDefaults(d => ({ ...d, dataEndDay: parseInt(e.target.value) || 28 }))}
                                                    style={{ width: '70px', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '0.9rem', textAlign: 'center', outline: 'none' }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <span style={{ fontSize: '0.72rem', color: '#0284c7', marginTop: '6px', display: 'block' }}>GV sẽ thấy bộ lọc thời gian này. Báo cáo tạo từ bộ lọc này mới được tính.</span>
                                </div>
                            </>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                className="admin-btn admin-btn-primary"
                                disabled={savingDefaults}
                                onClick={async () => {
                                    setSavingDefaults(true);
                                    try {
                                        await saveReportPeriodDefaults(defaults);
                                        setDefaultsSaved(true);
                                        setTimeout(() => setDefaultsSaved(false), 2500);
                                        // Trigger auto-create if just enabled
                                        if (defaults.enabled) {
                                            const created = await ensureCurrentPeriodExists();
                                            if (created) {
                                                setTeacherStats({});
                                                await loadPeriods();
                                            }
                                        }
                                    } catch (err) {
                                        console.error('Error saving defaults:', err);
                                        alert('Lỗi khi lưu cài đặt');
                                    }
                                    setSavingDefaults(false);
                                }}
                            >
                                <Save size={16} /> {savingDefaults ? 'Đang lưu...' : defaultsSaved ? '✓ Đã lưu' : 'Lưu cài đặt'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Create/Edit Form */}
            {isFormOpen && (
                <div className="admin-card" style={{ border: '2px solid #818cf8', animation: 'adminFadeIn 0.2s ease-out' }}>
                    <form onSubmit={handleSave}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {editingId ? <><Edit3 size={20} color="#4f46e5" /> Chỉnh sửa kỳ</> : <><Plus size={20} color="#4f46e5" /> Tạo kỳ báo cáo mới</>}
                            </h3>
                            <button type="button" onClick={() => setIsFormOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#94a3b8' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Nhãn (tên kỳ)</label>
                                <input
                                    type="text"
                                    placeholder="VD: Kỳ báo cáo tháng 3/2026"
                                    value={form.label}
                                    onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Từ ngày</label>
                                <input
                                    type="date"
                                    required
                                    value={form.startDate}
                                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Đến ngày</label>
                                <input
                                    type="date"
                                    required
                                    value={form.endDate}
                                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Số ngày trễ cho phép</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="30"
                                    value={form.graceDays}
                                    onChange={e => setForm(f => ({ ...f, graceDays: e.target.value }))}
                                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                                />
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>GV gửi sau hạn sẽ bị đánh dấu "Trễ"</span>
                            </div>
                        </div>

                        <div style={{ marginTop: '16px', padding: '14px 18px', background: '#f0f9ff', borderRadius: '14px', border: '1px solid #bae6fd' }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0369a1', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                📊 Khoảng dữ liệu báo cáo
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Dữ liệu từ ngày</label>
                                    <input
                                        type="date"
                                        value={form.dataStartDate}
                                        onChange={e => setForm(f => ({ ...f, dataStartDate: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Dữ liệu đến ngày</label>
                                    <input
                                        type="date"
                                        value={form.dataEndDate}
                                        onChange={e => setForm(f => ({ ...f, dataEndDate: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: '#0284c7', marginTop: '8px', display: 'block' }}>GV sẽ thấy bộ lọc thời gian này khi xem tiến độ học viên. Báo cáo tạo từ bộ lọc này mới được tính.</span>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
                            <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setIsFormOpen(false)}>Huỷ</button>
                            <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
                                <Save size={16} /> {saving ? 'Đang lưu...' : (editingId ? 'Lưu thay đổi' : 'Tạo kỳ báo cáo')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Periods List */}
            {loading ? (
                <div className="admin-card" style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>Đang tải...</div>
            ) : periods.length === 0 ? (
                <div className="admin-card">
                    <div className="admin-empty-state">
                        <div className="admin-empty-icon"><ClipboardList size={32} /></div>
                        <h3>Chưa có kỳ báo cáo nào</h3>
                        <p>Tạo kỳ báo cáo để nhắc giáo viên gửi báo cáo kỹ năng cho học viên đúng hạn.</p>
                        <button className="admin-btn admin-btn-primary" onClick={openCreateForm}>
                            <Plus size={18} /> Tạo kỳ đầu tiên
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {periods.map(period => {
                        const status = computePeriodStatus(period);
                        const style = STATUS_STYLES[status];
                        const daysRemaining = getDaysRemaining(period.endDate);
                        const isExpanded = expandedPeriodId === period.id;
                        const stats = teacherStats[period.id];
                        const isStatsLoading = statsLoading[period.id];

                        return (
                            <div key={period.id} className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
                                {/* Period Header */}
                                <div
                                    onClick={() => handleToggleExpand(period)}
                                    style={{
                                        padding: '20px 24px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '16px',
                                        transition: 'background 0.2s',
                                        background: isExpanded ? 'rgba(99,102,241,0.02)' : 'transparent'
                                    }}
                                >
                                    <div style={{
                                        padding: '10px',
                                        borderRadius: '14px',
                                        background: style.bg,
                                        border: `1.5px solid ${style.border}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.2rem',
                                        flexShrink: 0
                                    }}>
                                        {style.icon}
                                    </div>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>
                                                {period.label || 'Kỳ báo cáo'}
                                            </span>
                                            <span style={{
                                                padding: '3px 10px',
                                                borderRadius: '100px',
                                                fontSize: '0.72rem',
                                                fontWeight: 700,
                                                background: style.bg,
                                                color: style.color,
                                                border: `1px solid ${style.border}`
                                            }}>
                                                {getStatusLabel(status)}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '0.82rem', color: '#64748b', flexWrap: 'wrap' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Calendar size={14} /> {formatDate(period.startDate)} → {formatDate(period.endDate)}
                                            </span>
                                            {period.graceDays > 0 && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Clock size={14} /> Trễ tối đa {period.graceDays} ngày
                                                </span>
                                            )}
                                            {(status === 'active') && (
                                                <span style={{ fontWeight: 600, color: daysRemaining <= 2 ? '#dc2626' : daysRemaining <= 5 ? '#ca8a04' : '#16a34a' }}>
                                                    Còn {daysRemaining} ngày
                                                </span>
                                            )}
                                            {(status === 'grace') && (
                                                <span style={{ fontWeight: 600, color: '#ca8a04' }}>
                                                    Đang trong thời hạn gia hạn
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                        <button
                                            onClick={e => { e.stopPropagation(); openEditForm(period); }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', color: '#64748b', transition: 'all 0.2s' }}
                                            title="Chỉnh sửa"
                                        >
                                            <Edit3 size={16} />
                                        </button>
                                        <button
                                            onClick={e => { e.stopPropagation(); setDeleteTarget(period.id); }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', color: '#94a3b8', transition: 'all 0.2s' }}
                                            title="Xoá"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                        {isExpanded ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
                                    </div>
                                </div>

                                {/* Delete Confirmation */}
                                {deleteTarget === period.id && (
                                    <div style={{ padding: '12px 24px', background: '#fef2f2', borderTop: '1px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.85rem', color: '#dc2626', fontWeight: 500 }}>Xác nhận xoá kỳ báo cáo này?</span>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button className="admin-btn admin-btn-secondary" style={{ padding: '6px 14px', fontSize: '0.82rem' }} onClick={() => setDeleteTarget(null)}>Huỷ</button>
                                            <button className="admin-btn" style={{ padding: '6px 14px', fontSize: '0.82rem', background: '#dc2626', color: 'white', border: 'none' }} onClick={() => handleDelete(period.id)}>
                                                <Trash2 size={14} /> Xoá
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Expanded: Teacher Stats */}
                                {isExpanded && (
                                    <div style={{ borderTop: '1px solid #e2e8f0', padding: '20px 24px', background: '#fafbfc' }}>
                                        <h4 style={{ margin: '0 0 16px', fontSize: '0.95rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Users size={18} color="#4f46e5" /> Trạng thái gửi báo cáo theo giáo viên
                                        </h4>

                                        {isStatsLoading ? (
                                            <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '0.9rem' }}>Đang tải thống kê...</div>
                                        ) : !stats || stats.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '0.85rem' }}>Không có dữ liệu giáo viên</div>
                                        ) : (
                                            <div className="admin-table-container">
                                                <table className="admin-table" style={{ minWidth: '500px' }}>
                                                    <thead>
                                                        <tr>
                                                            <th>Giáo viên</th>
                                                            <th>Lớp</th>
                                                            <th style={{ textAlign: 'center' }}>Đã gửi</th>
                                                            <th style={{ textAlign: 'center' }}>Gửi trễ</th>
                                                            <th style={{ textAlign: 'center' }}>Chưa gửi</th>
                                                            <th>Tiến độ</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {stats.map(t => {
                                                            const missing = t.totalStudents - t.sentCount;
                                                            const progress = t.totalStudents > 0 ? Math.round((t.sentCount / t.totalStudents) * 100) : 0;
                                                            const isDone = missing <= 0;
                                                            const isTeacherExpanded = expandedTeacherId === `${period.id}_${t.teacherId}`;
                                                            const detailKey = `${period.id}_${t.teacherId}`;
                                                            const details = teacherDetails[detailKey];
                                                            const isDetailLoading = detailLoading[detailKey];

                                                            return (
                                                                <React.Fragment key={t.teacherId}>
                                                                <tr
                                                                    onClick={async () => {
                                                                        if (isTeacherExpanded) {
                                                                            setExpandedTeacherId(null);
                                                                            return;
                                                                        }
                                                                        setExpandedTeacherId(detailKey);
                                                                        if (!teacherDetails[detailKey] && !detailLoading[detailKey]) {
                                                                            setDetailLoading(prev => ({ ...prev, [detailKey]: true }));
                                                                            try {
                                                                                const d = await getTeacherReportDetails(t.teacherId, period.startDate, period.endDate, period.id);
                                                                                setTeacherDetails(prev => ({ ...prev, [detailKey]: d }));
                                                                            } catch (err) {
                                                                                console.error('Error loading teacher details:', err);
                                                                            }
                                                                            setDetailLoading(prev => ({ ...prev, [detailKey]: false }));
                                                                        }
                                                                    }}
                                                                    style={{ cursor: 'pointer', transition: 'background 0.15s', background: isTeacherExpanded ? 'rgba(99,102,241,0.04)' : undefined }}
                                                                    onMouseEnter={e => { if (!isTeacherExpanded) e.currentTarget.style.background = '#f8fafc'; }}
                                                                    onMouseLeave={e => { if (!isTeacherExpanded) e.currentTarget.style.background = ''; }}
                                                                >
                                                                    <td>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                            {isTeacherExpanded ? <ChevronUp size={14} color="#64748b" /> : <ChevronDown size={14} color="#94a3b8" />}
                                                                            <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>{t.teacherName}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td>
                                                                        <span style={{ fontSize: '0.82rem', color: '#64748b' }}>{t.groups.join(', ') || '—'}</span>
                                                                    </td>
                                                                    <td style={{ textAlign: 'center' }}>
                                                                        <span style={{ fontWeight: 700, color: '#16a34a', fontSize: '0.9rem' }}>{t.sentCount}</span>
                                                                        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>/{t.totalStudents}</span>
                                                                    </td>
                                                                    <td style={{ textAlign: 'center' }}>
                                                                        {t.lateCount > 0 ? (
                                                                            <span style={{
                                                                                display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                                                padding: '2px 8px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700,
                                                                                background: '#fefce8', color: '#ca8a04', border: '1px solid #fde68a'
                                                                            }}>
                                                                                {t.lateCount}
                                                                            </span>
                                                                        ) : (
                                                                            <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>—</span>
                                                                        )}
                                                                    </td>
                                                                    <td style={{ textAlign: 'center' }}>
                                                                        {missing > 0 ? (
                                                                            <span style={{
                                                                                display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                                                padding: '2px 8px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700,
                                                                                background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca'
                                                                            }}>
                                                                                {missing}
                                                                            </span>
                                                                        ) : (
                                                                            <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>—</span>
                                                                        )}
                                                                    </td>
                                                                    <td>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '140px' }}>
                                                                            <div style={{ flex: 1, height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                                                                <div style={{
                                                                                    height: '100%',
                                                                                    width: `${progress}%`,
                                                                                    background: isDone ? '#22c55e' : progress >= 50 ? '#f59e0b' : '#ef4444',
                                                                                    borderRadius: '4px',
                                                                                    transition: 'width 0.8s ease'
                                                                                }} />
                                                                            </div>
                                                                            {isDone ? (
                                                                                <CheckCircle size={16} color="#22c55e" />
                                                                            ) : (
                                                                                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b' }}>{progress}%</span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>

                                                                {/* Expanded detail rows */}
                                                                {isTeacherExpanded && (
                                                                    <tr>
                                                                        <td colSpan={6} style={{ padding: 0 }}>
                                                                            <div style={{ background: '#f8fafc', padding: '12px 20px 16px 44px', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                                                                                {isDetailLoading ? (
                                                                                    <div style={{ textAlign: 'center', padding: '16px', color: '#64748b', fontSize: '0.82rem' }}>Đang tải chi tiết...</div>
                                                                                ) : !details || details.length === 0 ? (
                                                                                    <div style={{ textAlign: 'center', padding: '16px', color: '#94a3b8', fontSize: '0.82rem' }}>Không có dữ liệu</div>
                                                                                ) : (
                                                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                                                                        <thead>
                                                                                            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                                                                <th style={{ textAlign: 'left', padding: '6px 10px', color: '#64748b', fontWeight: 600, fontSize: '0.75rem' }}>Học viên</th>
                                                                                                <th style={{ textAlign: 'left', padding: '6px 10px', color: '#64748b', fontWeight: 600, fontSize: '0.75rem' }}>Lớp</th>
                                                                                                <th style={{ textAlign: 'center', padding: '6px 10px', color: '#64748b', fontWeight: 600, fontSize: '0.75rem' }}>Trạng thái</th>
                                                                                                <th style={{ textAlign: 'left', padding: '6px 10px', color: '#64748b', fontWeight: 600, fontSize: '0.75rem' }}>Ngày gửi</th>
                                                                                            </tr>
                                                                                        </thead>
                                                                                        <tbody>
                                                                                            {details.map(d => {
                                                                                                const statusConfig = {
                                                                                                    sent: { label: '✅ Đã gửi', bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
                                                                                                    late: { label: '⏰ Gửi trễ', bg: '#fefce8', color: '#ca8a04', border: '#fde68a' },
                                                                                                    pending: { label: '🔴 Chưa gửi', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' }
                                                                                                };
                                                                                                const sc = statusConfig[d.status] || statusConfig.pending;

                                                                                                return (
                                                                                                    <tr key={d.studentId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                                                        <td style={{ padding: '8px 10px', fontWeight: 500, color: '#0f172a' }}>
                                                                                                            <a
                                                                                                                href={`/admin/groups/${d.groupId}/students/${d.studentId}`}
                                                                                                                target="_blank"
                                                                                                                rel="noopener noreferrer"
                                                                                                                style={{ color: '#4f46e5', textDecoration: 'none', fontWeight: 600 }}
                                                                                                                onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                                                                                                                onMouseLeave={e => e.target.style.textDecoration = 'none'}
                                                                                                                onClick={e => e.stopPropagation()}
                                                                                                            >
                                                                                                                {d.studentName}
                                                                                                            </a>
                                                                                                        </td>
                                                                                                        <td style={{ padding: '8px 10px', color: '#64748b' }}>{d.groupName}</td>
                                                                                                        <td style={{ textAlign: 'center', padding: '8px 10px' }}>
                                                                                                            <span style={{
                                                                                                                display: 'inline-block', padding: '2px 10px', borderRadius: '100px',
                                                                                                                fontSize: '0.72rem', fontWeight: 700,
                                                                                                                background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`
                                                                                                            }}>
                                                                                                                {sc.label}
                                                                                                            </span>
                                                                                                        </td>
                                                                                                        <td style={{ padding: '8px 10px', color: '#64748b' }}>
                                                                                                            {d.sentAt ? d.sentAt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                                                                                        </td>
                                                                                                    </tr>
                                                                                                );
                                                                                            })}
                                                                                        </tbody>
                                                                                    </table>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        {/* Summary */}
                                        {stats && stats.length > 0 && (() => {
                                            const totalSent = stats.reduce((s, t) => s + t.sentCount, 0);
                                            const totalStudents = stats.reduce((s, t) => s + t.totalStudents, 0);
                                            const totalLate = stats.reduce((s, t) => s + t.lateCount, 0);
                                            const totalMissing = totalStudents - totalSent;

                                            return (
                                                <div style={{
                                                    display: 'flex', gap: '16px', marginTop: '16px', flexWrap: 'wrap',
                                                    padding: '14px 18px', background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
                                                        <span style={{ fontSize: '0.82rem', color: '#475569' }}>Đã gửi: <strong>{totalSent}</strong></span>
                                                    </div>
                                                    {totalLate > 0 && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
                                                            <span style={{ fontSize: '0.82rem', color: '#475569' }}>Gửi trễ: <strong>{totalLate}</strong></span>
                                                        </div>
                                                    )}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: totalMissing > 0 ? '#ef4444' : '#cbd5e1' }} />
                                                        <span style={{ fontSize: '0.82rem', color: '#475569' }}>Chưa gửi: <strong>{totalMissing}</strong></span>
                                                    </div>
                                                    <div style={{ marginLeft: 'auto', fontSize: '0.82rem', color: '#94a3b8' }}>
                                                        Tổng: {totalStudents} học viên
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
