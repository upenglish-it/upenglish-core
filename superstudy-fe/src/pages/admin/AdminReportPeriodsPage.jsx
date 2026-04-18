import React, { useState, useEffect } from 'react';
import { ClipboardList, Plus, Calendar, Clock, Users, CheckCircle, AlertTriangle, Trash2, Edit3, ChevronDown, ChevronUp, Save, X, Settings, ToggleLeft, ToggleRight, Star, Sparkles, Send, RefreshCw, Eye, RotateCcw, Ban, Archive, Undo2 } from 'lucide-react';
import { getAllReportPeriods, createReportPeriod, updateReportPeriod, deleteReportPeriod, restoreReportPeriod, permanentlyDeleteReportPeriod, getDeletedReportPeriods, purgeExpiredDeletedPeriods, computePeriodStatus, getStatusLabel, getDaysRemaining, getReportStatsForPeriod, getReportPeriodDefaults, saveReportPeriodDefaults, ensureCurrentPeriodExists, getTeacherReportDetails } from '../../services/reportPeriodService';
import { RATING_CRITERIA, getAllRatingsForPeriod, getRatingsForTeacher, generateRatingSummaries, generateRatingSummaryForTeacher, getAllSummariesForPeriod, deleteRating, toggleEliminateRating, updateRatingSummary } from '../../services/teacherRatingService';
import { createNotification, queueEmail, buildEmailHtml } from '../../services/notificationService';
import { usersService } from '../../models';
import SpiderChart from '../../components/common/SpiderChart';
import Avatar from '../../components/common/Avatar';
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
    const isStaff = user?.role === 'staff';
    const [periods, setPeriods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ label: '', startDate: '', endDate: '', graceDays: 3, dataStartDate: '', dataEndDate: '', ratingStartDate: '', ratingEndDate: '' });

    // Teacher stats
    const [expandedPeriodId, setExpandedPeriodId] = useState(null);
    const [teacherStats, setTeacherStats] = useState({});
    const [statsLoading, setStatsLoading] = useState({});

    // Delete confirm
    const [deleteTarget, setDeleteTarget] = useState(null);

    // Trash
    const [deletedPeriods, setDeletedPeriods] = useState([]);
    const [showTrash, setShowTrash] = useState(false);
    const [trashLoading, setTrashLoading] = useState(false);
    const [permanentDeleteTarget, setPermanentDeleteTarget] = useState(null);

    // Teacher detail expansion
    const [expandedTeacherId, setExpandedTeacherId] = useState(null);
    const [teacherDetails, setTeacherDetails] = useState({}); // { [teacherId]: [...students] }
    const [detailLoading, setDetailLoading] = useState({});

    // Auto-create defaults
    const [defaults, setDefaults] = useState({ enabled: false, startDay: 1, endDay: 28, graceDays: 3, dataStartDay: 1, dataEndDay: 28, ratingStartDay: 0, ratingEndDay: 0 });
    const [showDefaults, setShowDefaults] = useState(false);
    const [savingDefaults, setSavingDefaults] = useState(false);
    const [defaultsSaved, setDefaultsSaved] = useState(false);

    // ─── Teacher Rating State ───
    const [ratingOverview, setRatingOverview] = useState({}); // periodId -> [{teacherId, ...}]
    const [ratingLoading, setRatingLoading] = useState({});
    const [ratingDetails, setRatingDetails] = useState({}); // periodId_teacherId -> [ratings]
    const [ratingDetailLoading, setRatingDetailLoading] = useState({});
    const [ratingSummaries, setRatingSummaries] = useState({}); // periodId -> [summaries]
    const [expandedRatingTeacherId, setExpandedRatingTeacherId] = useState(null);
    const [generatingPeriodId, setGeneratingPeriodId] = useState(null);
    const [sendingPeriodId, setSendingPeriodId] = useState(null);
    const [sentSuccessPeriodId, setSentSuccessPeriodId] = useState(null);
    const [generatingTeacherId, setGeneratingTeacherId] = useState(null);
    const [sendingTeacherId, setSendingTeacherId] = useState(null);
    const [resetRatingTarget, setResetRatingTarget] = useState(null); // { id, periodId, teacherId }

    // Toast notification
    const [toast, setToast] = useState(null);
    useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

    useEffect(() => {
        loadPage();
    }, []);

    async function loadPage() {
        setLoading(true);
        try {
            // Auto-purge expired trash (30 days)
            await purgeExpiredDeletedPeriods();

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

    async function loadTrash() {
        setTrashLoading(true);
        try {
            const data = await getDeletedReportPeriods();
            setDeletedPeriods(data);
        } catch (err) {
            console.error('Error loading trash:', err);
        }
        setTrashLoading(false);
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
                if (activePeriod.ratingStartDate && activePeriod.ratingEndDate) {
                    loadRatingOverview(activePeriod.id);
                }
            }
        } catch (err) {
            console.error('Error loading report periods:', err);
        }
    }

    async function loadTeacherStats(period) {
        if (teacherStats[period.id] !== undefined || statsLoading[period.id]) return;
        setStatsLoading(prev => ({ ...prev, [period.id]: true }));
        try {
            const stats = await getReportStatsForPeriod(period.startDate, period.endDate, period.id);
            setTeacherStats(prev => ({ ...prev, [period.id]: stats || [] }));
        } catch (err) {
            console.error('Error loading teacher stats:', err);
            setTeacherStats(prev => ({ ...prev, [period.id]: [] }));
        }
        setStatsLoading(prev => ({ ...prev, [period.id]: false }));
    }

    function handleToggleExpand(period) {
        if (expandedPeriodId === period.id) {
            setExpandedPeriodId(null);
        } else {
            setExpandedPeriodId(period.id);
            loadTeacherStats(period);
            if (period.ratingStartDate && period.ratingEndDate) {
                loadRatingOverview(period.id);
            }
        }
    }

    // ─── Teacher Rating Functions ───
    async function loadRatingOverview(periodId) {
        if (ratingOverview[periodId] !== undefined || ratingLoading[periodId]) return;
        setRatingLoading(prev => ({ ...prev, [periodId]: true }));
        try {
            const [data, sums] = await Promise.all([
                getAllRatingsForPeriod(periodId),
                getAllSummariesForPeriod(periodId),
            ]);
            setRatingOverview(prev => ({ ...prev, [periodId]: data || [] }));
            setRatingSummaries(prev => ({ ...prev, [periodId]: sums || [] }));
        } catch (err) {
            console.error('Error loading rating overview:', err);
            setRatingOverview(prev => ({ ...prev, [periodId]: [] }));
            setRatingSummaries(prev => ({ ...prev, [periodId]: [] }));
        }
        setRatingLoading(prev => ({ ...prev, [periodId]: false }));
    }

    async function handleExpandRatingTeacher(periodId, teacherId) {
        const key = `${periodId}_${teacherId}`;
        if (expandedRatingTeacherId === key) { setExpandedRatingTeacherId(null); return; }
        setExpandedRatingTeacherId(key);
        if (!ratingDetails[key]) {
            setRatingDetailLoading(prev => ({ ...prev, [key]: true }));
            try {
                const details = await getRatingsForTeacher(periodId, teacherId);
                setRatingDetails(prev => ({ ...prev, [key]: details }));
            } catch (err) { console.error('Error loading rating details:', err); }
            setRatingDetailLoading(prev => ({ ...prev, [key]: false }));
        }
    }

    async function handleGenerateRatingSummaries(periodId) {
        setGeneratingPeriodId(periodId);
        try {
            const results = await generateRatingSummaries(periodId);
            setRatingSummaries(prev => ({ ...prev, [periodId]: results }));
            setToast({ type: 'success', text: `Đã tạo tổng hợp cho ${results.length} giáo viên!` });
        } catch (err) { console.error(err); setToast({ type: 'error', text: `Lỗi: ${err.message}` }); }
        setGeneratingPeriodId(null);
    }

    async function handleSendRatingResults(periodId) {
        const sums = ratingSummaries[periodId];
        if (!sums || sums.length === 0) return;
        setSendingPeriodId(periodId);
        try {
            for (const summary of sums) {
                await createNotification({ userId: summary.teacherId, type: 'teacher_rating_result', title: '📊 Kết quả đánh giá', message: `Kỳ đánh giá đã kết thúc. Điểm tổng: ${summary.overallScore}/100.`, link: '/teacher/ratings' });
                const criteriaHtml = RATING_CRITERIA.map(c => {
                    const val = summary.averageScores?.[c.key] || 0;
                    const display = c.type === 'boolean'
                        ? `${Math.round((val / 10) * 100)}% Có`
                        : `${val.toFixed(1)}/10`;
                    const label = c.type === 'boolean' ? c.description : c.label;
                    return `<table width="100%" style="border-collapse:collapse;"><tr><td style="padding:4px 0;border-bottom:1px solid #f1f5f9;">${c.icon} ${label}</td><td style="padding:4px 0;border-bottom:1px solid #f1f5f9;text-align:right;"><strong>${display}</strong></td></tr></table>`;
                }).join('');
                const emailHtml = buildEmailHtml({ emoji: '📊', heading: 'Kết quả đánh giá giáo viên', headingColor: '#4f46e5', body: `<p>Kỳ đánh giá đã kết thúc với <strong>${summary.totalResponses}</strong> phản hồi từ học viên.</p><div style="margin:12px 0">${criteriaHtml}</div>`, highlight: summary.aiSummary ? `<strong>💡 Nhận xét tổng hợp:</strong><br/>${summary.aiSummary}` : null, highlightBg: '#f0f9ff', highlightBorder: '#4f46e5', ctaText: 'Xem chi tiết' });
                try {
                    const teacher = await usersService.findOne(summary.teacherId);
                    if (teacher?.email) await queueEmail(teacher.email, { subject: `📊 Kết quả đánh giá — Điểm: ${summary.overallScore}/100`, html: emailHtml });
                } catch { /* ignore */ }
            }
            const [admins, staff] = await Promise.all([
                usersService.findAll({ role: 'admin' }),
                usersService.findAll({ role: 'staff' }),
            ]);
            for (const recipient of [...(admins || []), ...(staff || [])]) {
                const recipientId = recipient?.id || recipient?._id || recipient?.uid;
                if (!recipientId || recipientId === user?.uid) continue;
                await createNotification({ userId: recipientId, type: 'teacher_rating_result', title: '📊 Kết quả đánh giá GV', message: `Đã tạo kết quả đánh giá cho ${sums.length} giáo viên.`, link: '/admin/report-periods' });
            }
            setSentSuccessPeriodId(periodId);
            setTimeout(() => setSentSuccessPeriodId(null), 3000);
        } catch (err) { console.error(err); setToast({ type: 'error', text: `Lỗi: ${err.message}` }); }
        setSendingPeriodId(null);
    }

    function openCreateForm() {
        setEditingId(null);
        setForm({ label: '', startDate: '', endDate: '', graceDays: 3, dataStartDate: '', dataEndDate: '', ratingStartDate: '', ratingEndDate: '' });
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
            dataEndDate: period.dataEndDate || '',
            ratingStartDate: period.ratingStartDate || '',
            ratingEndDate: period.ratingEndDate || '',
        });
        setIsFormOpen(true);
    }

    async function handleSave(e) {
        e.preventDefault();
        if (!form.startDate || !form.endDate) return;
        if (form.startDate > form.endDate) {
            setToast({ type: 'error', text: 'Ngày bắt đầu phải trước ngày kết thúc' });
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
                ratingStartDate: form.ratingStartDate || '',
                ratingEndDate: form.ratingEndDate || '',
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
            setToast({ type: 'error', text: 'Lỗi khi lưu kỳ báo cáo' });
        }
        setSaving(false);
    }

    async function handleDelete(periodId) {
        try {
            await deleteReportPeriod(periodId);
            setDeleteTarget(null);
            setPeriods(prev => prev.filter(p => p.id !== periodId));
            setToast({ type: 'success', text: 'Đã chuyển vào thùng rác' });
        } catch (err) {
            console.error('Error deleting report period:', err);
            setToast({ type: 'error', text: 'Lỗi khi xoá kỳ báo cáo' });
        }
    }

    async function handleRestore(periodId) {
        try {
            await restoreReportPeriod(periodId);
            setDeletedPeriods(prev => prev.filter(p => p.id !== periodId));
            setTeacherStats({});
            await loadPeriods();
            setToast({ type: 'success', text: 'Đã khôi phục kỳ báo cáo' });
        } catch (err) {
            console.error('Error restoring report period:', err);
            setToast({ type: 'error', text: 'Lỗi khi khôi phục' });
        }
    }

    async function handlePermanentDelete(periodId) {
        try {
            await permanentlyDeleteReportPeriod(periodId);
            setPermanentDeleteTarget(null);
            setDeletedPeriods(prev => prev.filter(p => p.id !== periodId));
            setToast({ type: 'success', text: 'Đã xoá vĩnh viễn' });
        } catch (err) {
            console.error('Error permanently deleting:', err);
            setToast({ type: 'error', text: 'Lỗi khi xoá vĩnh viễn' });
        }
    }

    return (
        <div className="admin-page">
            {toast && (
                <div style={{
                    position: 'fixed', top: '24px', right: '24px', zIndex: 10000,
                    padding: '14px 24px', borderRadius: '12px',
                    background: toast.type === 'success' ? '#ecfdf5' : '#fef2f2',
                    color: toast.type === 'success' ? '#065f46' : '#991b1b',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontWeight: 600, fontSize: '0.9rem',
                    animation: 'adminFadeIn 0.2s ease-out'
                }}>{toast.text}</div>
            )}
            <div className="admin-page-header">
                <h1 className="admin-page-title" style={{ margin: 0 }}>
                    <ClipboardList size={28} color="#4f46e5" /> Kỳ báo cáo
                </h1>
                <p className="admin-page-subtitle">Tạo, quản lý các kỳ đánh giá và báo cáo theo giai đoạn.</p>
                {!isStaff && (
                    <div className="admin-header-actions" style={{ display: 'flex', gap: '8px' }}>
                        <button className="admin-btn admin-btn-primary" onClick={openCreateForm}>
                            <Plus size={18} /> Tạo kỳ mới
                        </button>
                    </div>
                )}
            </div>

            {/* Auto-create Settings — admin only */}
            {!isStaff && <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
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
                        <div className="rp-settings-toggle" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
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
                                <div className="rp-settings-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Ngày bắt đầu</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Ngày</span>
                                            <input
                                                id="report-default-start-day"
                                                name="reportDefaultStartDay"
                                                aria-label="Ngày bắt đầu mặc định"
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
                                                id="report-default-end-day"
                                                name="reportDefaultEndDay"
                                                aria-label="Ngày kết thúc mặc định"
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
                                                id="report-default-grace-days"
                                                name="reportDefaultGraceDays"
                                                aria-label="Số ngày trễ mặc định"
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

                                <div style={{ padding: '12px 16px', background: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd', marginBottom: '16px' }}>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0369a1', marginBottom: '10px' }}>
                                        📊 Khoảng dữ liệu báo cáo
                                    </div>
                                    <div className="rp-settings-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Dữ liệu từ ngày</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Ngày</span>
                                                <input
                                                    id="report-default-data-start-day"
                                                    name="reportDefaultDataStartDay"
                                                    aria-label="Ngày bắt đầu dữ liệu mặc định"
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
                                                    id="report-default-data-end-day"
                                                    name="reportDefaultDataEndDay"
                                                    aria-label="Ngày kết thúc dữ liệu mặc định"
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

                                {/* Rating period - same level as main inputs */}
                                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#92400e', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    ⭐ Kỳ đánh giá giáo viên
                                </div>
                                <div className="rp-settings-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '4px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>HV đánh giá từ ngày</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Ngày</span>
                                            <input
                                                id="report-default-rating-start-day"
                                                name="reportDefaultRatingStartDay"
                                                aria-label="Ngày bắt đầu đánh giá mặc định"
                                                type="number" min="0" max="28"
                                                value={defaults.ratingStartDay || 0}
                                                onChange={e => setDefaults(d => ({ ...d, ratingStartDay: parseInt(e.target.value) || 0 }))}
                                                style={{ width: '70px', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '0.9rem', textAlign: 'center', outline: 'none' }}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>HV đánh giá đến ngày</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Ngày</span>
                                            <input
                                                id="report-default-rating-end-day"
                                                name="reportDefaultRatingEndDay"
                                                aria-label="Ngày kết thúc đánh giá mặc định"
                                                type="number" min="0" max="28"
                                                value={defaults.ratingEndDay || 0}
                                                onChange={e => setDefaults(d => ({ ...d, ratingEndDay: parseInt(e.target.value) || 0 }))}
                                                style={{ width: '70px', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '0.9rem', textAlign: 'center', outline: 'none' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <p style={{ margin: '0 0 12px', fontSize: '0.78rem', color: '#94a3b8' }}>
                                    Để 0 nếu không muốn tự động mở kỳ đánh giá GV. VD: ngày 20 → ngày 5 (tháng sau) nghĩa là HV đánh giá sau kỳ báo cáo.
                                </p>
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
                                        setToast({ type: 'error', text: 'Lỗi khi lưu cài đặt' });
                                    }
                                    setSavingDefaults(false);
                                }}
                            >
                                <Save size={16} /> {savingDefaults ? 'Đang lưu...' : defaultsSaved ? '✓ Đã lưu' : 'Lưu cài đặt'}
                            </button>
                        </div>
                    </div>
                )}
            </div>}

            {/* Create/Edit Form — admin only */}
            {!isStaff && isFormOpen && (
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

                        <div className="rp-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Nhãn (tên kỳ)</label>
                                <input
                                    id="report-period-label"
                                    name="reportPeriodLabel"
                                    aria-label="Nhãn kỳ báo cáo"
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
                                    id="report-period-start-date"
                                    name="reportPeriodStartDate"
                                    aria-label="Từ ngày"
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
                                    id="report-period-end-date"
                                    name="reportPeriodEndDate"
                                    aria-label="Đến ngày"
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
                                    id="report-period-grace-days"
                                    name="reportPeriodGraceDays"
                                    aria-label="Số ngày trễ cho phép"
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
                            <div className="rp-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Dữ liệu từ ngày</label>
                                    <input
                                        id="report-period-data-start-date"
                                        name="reportPeriodDataStartDate"
                                        aria-label="Dữ liệu từ ngày"
                                        type="date"
                                        value={form.dataStartDate}
                                        onChange={e => setForm(f => ({ ...f, dataStartDate: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Dữ liệu đến ngày</label>
                                    <input
                                        id="report-period-data-end-date"
                                        name="reportPeriodDataEndDate"
                                        aria-label="Dữ liệu đến ngày"
                                        type="date"
                                        value={form.dataEndDate}
                                        onChange={e => setForm(f => ({ ...f, dataEndDate: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: '#0284c7', marginTop: '8px', display: 'block' }}>GV sẽ thấy bộ lọc thời gian này khi xem tiến độ học viên. Báo cáo tạo từ bộ lọc này mới được tính.</span>
                        </div>

                        {/* Rating Period Section */}
                        <div style={{ marginTop: '16px', padding: '14px 18px', background: '#fefce8', borderRadius: '14px', border: '1px solid #fde68a' }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#92400e', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                ⭐ Kỳ đánh giá giáo viên
                            </div>
                            <div className="rp-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>HV đánh giá từ ngày</label>
                                    <input
                                        id="report-period-rating-start-date"
                                        name="reportPeriodRatingStartDate"
                                        aria-label="Học viên đánh giá từ ngày"
                                        type="date"
                                        value={form.ratingStartDate}
                                        onChange={e => setForm(f => ({ ...f, ratingStartDate: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>HV đánh giá đến ngày</label>
                                    <input
                                        id="report-period-rating-end-date"
                                        name="reportPeriodRatingEndDate"
                                        aria-label="Học viên đánh giá đến ngày"
                                        type="date"
                                        value={form.ratingEndDate}
                                        onChange={e => setForm(f => ({ ...f, ratingEndDate: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: '#92400e', marginTop: '8px', display: 'block' }}>Để trống nếu không mở đánh giá GV trong kỳ này. Học viên chỉ thấy form đánh giá trong khoảng thời gian này.</span>
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
                                    className="rp-period-header"
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
                                        <div className="rp-dates-row" style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '0.82rem', color: '#64748b', flexWrap: 'wrap' }}>
                                            {/* Report Period column */}
                                            <div style={{ padding: '8px 14px', background: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd', flex: '1 1 180px', minWidth: 0 }}>
                                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0369a1', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Calendar size={12} /> Kỳ báo cáo
                                                </div>
                                                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>
                                                    {formatDate(period.startDate)} → {formatDate(period.endDate)}
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                                                    {period.graceDays > 0 && (
                                                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                                            <Clock size={11} style={{ verticalAlign: '-2px' }} /> Trễ {period.graceDays} ngày
                                                        </span>
                                                    )}
                                                    {status === 'active' && (
                                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: daysRemaining <= 2 ? '#dc2626' : daysRemaining <= 5 ? '#ca8a04' : '#16a34a' }}>
                                                            Còn {daysRemaining} ngày
                                                        </span>
                                                    )}
                                                    {status === 'grace' && (
                                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ca8a04' }}>Đang gia hạn</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Rating Period column */}
                                            {period.ratingStartDate && period.ratingEndDate ? (() => {
                                                const today = new Date(); today.setHours(0, 0, 0, 0);
                                                const rStart = new Date(period.ratingStartDate + 'T00:00:00');
                                                const rEnd = new Date(period.ratingEndDate + 'T23:59:59');
                                                const rStatus = today < rStart ? 'upcoming' : today <= rEnd ? 'active' : 'closed';
                                                const rDaysLeft = Math.ceil((rEnd - today) / (1000 * 60 * 60 * 24));
                                                const rStatusColor = rStatus === 'active' ? '#16a34a' : rStatus === 'upcoming' ? '#2563eb' : '#94a3b8';
                                                const rStatusLabel = rStatus === 'active' ? 'Đang mở' : rStatus === 'upcoming' ? 'Sắp mở' : 'Đã đóng';
                                                return (
                                                    <div style={{ padding: '8px 14px', background: '#fefce8', borderRadius: '12px', border: '1px solid #fde68a', flex: '1 1 180px', minWidth: 0 }}>
                                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#92400e', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            ⭐ Đánh giá GV
                                                            <span style={{ padding: '1px 6px', borderRadius: '100px', fontSize: '0.65rem', fontWeight: 700, background: rStatus === 'active' ? '#f0fdf4' : rStatus === 'upcoming' ? '#eff6ff' : '#f8fafc', color: rStatusColor, border: `1px solid ${rStatus === 'active' ? '#bbf7d0' : rStatus === 'upcoming' ? '#bfdbfe' : '#e2e8f0'}` }}>
                                                                {rStatusLabel}
                                                            </span>
                                                        </div>
                                                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>
                                                            {formatDate(period.ratingStartDate)} → {formatDate(period.ratingEndDate)}
                                                        </div>
                                                        {rStatus === 'active' && (
                                                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: rDaysLeft <= 2 ? '#dc2626' : rDaysLeft <= 5 ? '#ca8a04' : '#16a34a', marginTop: '4px' }}>
                                                                Còn {rDaysLeft} ngày
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })() : (
                                                <div style={{ padding: '8px 14px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #e2e8f0', flex: '1 1 180px', minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>⭐ Đánh giá GV: <em>Chưa thiết lập</em></span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="rp-period-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                        {!isStaff && (
                                            <>
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
                                            </>
                                        )}
                                        {isExpanded ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
                                    </div>
                                </div>

                                {/* Delete Confirmation */}
                                {deleteTarget === period.id && (
                                    <div className="rp-delete-confirm" style={{ padding: '12px 24px', background: '#fefce8', borderTop: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.85rem', color: '#92400e', fontWeight: 500 }}>Chuyển vào thùng rác? (Tự xoá sau 30 ngày)</span>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button className="admin-btn admin-btn-secondary" style={{ padding: '6px 14px', fontSize: '0.82rem' }} onClick={() => setDeleteTarget(null)}>Huỷ</button>
                                            <button className="admin-btn" style={{ padding: '6px 14px', fontSize: '0.82rem', background: '#f59e0b', color: 'white', border: 'none' }} onClick={() => handleDelete(period.id)}>
                                                <Archive size={14} /> Chuyển vào thùng rác
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
                                                <table className="admin-table rp-teacher-stats-table" style={{ minWidth: '500px' }}>
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
                                                                    <td data-label="Giáo viên">
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                            {isTeacherExpanded ? <ChevronUp size={14} color="#64748b" /> : <ChevronDown size={14} color="#94a3b8" />}
                                                                            <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>{t.teacherName}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td data-label="Lớp">
                                                                        <span style={{ fontSize: '0.82rem', color: '#64748b' }}>{t.groups.join(', ') || '—'}</span>
                                                                    </td>
                                                                    <td data-label="Đã gửi" style={{ textAlign: 'center' }}>
                                                                        <span style={{ fontWeight: 700, color: '#16a34a', fontSize: '0.9rem' }}>{t.sentCount}</span>
                                                                        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>/{t.totalStudents}</span>
                                                                    </td>
                                                                    <td data-label="Gửi trễ" style={{ textAlign: 'center' }}>
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
                                                                    <td data-label="Chưa gửi" style={{ textAlign: 'center' }}>
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
                                                                    <td data-label="Tiến độ">
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
                                                <div className="rp-stats-summary" style={{
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

                                        {/* ═══ TEACHER RATINGS SECTION ═══ */}
                                        {(period.ratingStartDate && period.ratingEndDate) && (() => {
                                            const pRatings = ratingOverview[period.id];
                                            const pSummaries = ratingSummaries[period.id] || [];
                                            const isRatingLoading = ratingLoading[period.id];
                                            const isGenerating = generatingPeriodId === period.id;
                                            const isSending = sendingPeriodId === period.id;
                                            const isSent = sentSuccessPeriodId === period.id;

                                            return (
                                                <div style={{ marginTop: '24px' }}>
                                                    <div className="rp-rating-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                                                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <Star size={18} color="#f59e0b" /> Đánh giá Giáo viên
                                                        </h4>
                                                        {!isStaff && (
                                                            <div className="rp-action-buttons" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                                <button className="admin-btn admin-btn-primary" onClick={() => handleGenerateRatingSummaries(period.id)} disabled={isGenerating || !pRatings || pRatings.length === 0} style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
                                                                    {isGenerating ? <><RefreshCw size={14} className="spin" /> Đang tạo...</> : <><Sparkles size={14} /> Tạo tổng hợp AI</>}
                                                                </button>
                                                                <button className="admin-btn" onClick={() => handleSendRatingResults(period.id)} disabled={isSending || pSummaries.length === 0} style={{ padding: '6px 14px', fontSize: '0.8rem', background: isSent ? '#22c55e' : '#f59e0b', color: 'white', border: 'none' }}>
                                                                    {isSending ? 'Đang gửi...' : isSent ? '✓ Đã gửi!' : <><Send size={14} /> Gửi kết quả</>}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {isRatingLoading ? (
                                                        <div style={{ textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '0.85rem' }}>Đang tải đánh giá...</div>
                                                    ) : !pRatings || pRatings.length === 0 ? (
                                                        <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '0.85rem', background: '#fff', borderRadius: '14px', border: '1px dashed #e2e8f0' }}>Chưa có học viên nào đánh giá trong kỳ này.</div>
                                                    ) : (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                            {pRatings.map(t => {
                                                                const rKey = `${period.id}_${t.teacherId}`;
                                                                const isRExpanded = expandedRatingTeacherId === rKey;
                                                                const rDetails = ratingDetails[rKey];
                                                                const isRDetailLoading = ratingDetailLoading[rKey];
                                                                const summary = pSummaries.find(s => s.teacherId === t.teacherId);
                                                                const chartData = RATING_CRITERIA.filter(c => c.type !== 'boolean').map(c => ({ label: c.label.length > 10 ? c.label.substring(0, 10) + '…' : c.label, value: t.averageScores[c.key] || 0 }));

                                                                return (
                                                                    <div key={t.teacherId} style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                                                        <div className="rp-rating-card-header" onClick={() => handleExpandRatingTeacher(period.id, t.teacherId)} style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px', transition: 'background 0.15s', background: isRExpanded ? 'rgba(245,158,11,0.03)' : 'transparent' }}>
                                                                            <Avatar src={t.teacherPhoto} alt={t.teacherName} size={40} />
                                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{t.teacherName}</div>
                                                                                <div style={{ display: 'flex', gap: '12px', marginTop: '3px', fontSize: '0.78rem', color: '#64748b', flexWrap: 'wrap', alignItems: 'center' }}>
                                                                                    <span>{t.totalResponses} đánh giá</span>
                                                                                    <span style={{ fontWeight: 700, color: t.overallScore >= 80 ? '#16a34a' : t.overallScore >= 60 ? '#f59e0b' : '#ef4444' }}>{t.overallScore}/100</span>
                                                                                    {summary?.aiSummary && <span style={{ color: '#4f46e5', fontWeight: 600 }}>✨ Đã tổng hợp</span>}
                                                                                </div>
                                                                                {t.groupScores && Object.keys(t.groupScores).length > 0 && (
                                                                                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                                                                                        {Object.entries(t.groupScores).map(([gid, gs]) => (
                                                                                            <span key={gid} style={{
                                                                                                padding: '2px 8px',
                                                                                                borderRadius: '100px',
                                                                                                fontSize: '0.68rem',
                                                                                                fontWeight: 700,
                                                                                                background: gs.overallScore >= 80 ? '#f0fdf4' : gs.overallScore >= 60 ? '#fefce8' : '#fef2f2',
                                                                                                color: gs.overallScore >= 80 ? '#15803d' : gs.overallScore >= 60 ? '#a16207' : '#dc2626',
                                                                                                border: `1px solid ${gs.overallScore >= 80 ? '#bbf7d0' : gs.overallScore >= 60 ? '#fde68a' : '#fecaca'}`,
                                                                                            }}>
                                                                                                {gs.groupName}: {gs.overallScore}/100 ({gs.count})
                                                                                            </span>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <div style={{ flexShrink: 0 }}><SpiderChart data={chartData} size={80} color="#f59e0b" showLabels={false} /></div>
                                                                            {isRExpanded ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
                                                                        </div>

                                                                        {isRExpanded && (
                                                                            <div style={{ borderTop: '1px solid #f1f5f9', padding: '16px 18px', background: '#fffbeb' }}>
                                                                                <div className="rp-rating-criteria-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px', marginBottom: '14px' }}>
                                                                                    {RATING_CRITERIA.map(c => {
                                                                                        const val = t.averageScores[c.key] || 0;
                                                                                        const isBoolean = c.type === 'boolean';
                                                                                        const yesPct = Math.round((val / 10) * 100);
                                                                                        return (
                                                                                            <div key={c.key} style={{ padding: '8px 12px', background: '#fff', borderRadius: '10px', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column' }}>
                                                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                                                                                    <span style={{ fontSize: '0.75rem', color: '#475569' }}>{c.icon} {isBoolean ? c.description : c.label}</span>
                                                                                                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: isBoolean ? (yesPct >= 80 ? '#16a34a' : yesPct >= 50 ? '#f59e0b' : '#ef4444') : (val >= 8 ? '#16a34a' : val >= 5 ? '#f59e0b' : '#ef4444'), flexShrink: 0 }}>
                                                                                                        {isBoolean ? `${yesPct}%` : val.toFixed(1)}
                                                                                                    </span>
                                                                                                </div>
                                                                                                <div style={{ marginTop: 'auto', paddingTop: '6px' }}>
                                                                                                    <div style={{ height: '4px', background: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
                                                                                                        <div style={{ height: '100%', width: `${isBoolean ? yesPct : (val / 10) * 100}%`, background: isBoolean ? (yesPct >= 80 ? '#22c55e' : yesPct >= 50 ? '#f59e0b' : '#ef4444') : (val >= 8 ? '#22c55e' : val >= 5 ? '#f59e0b' : '#ef4444'), borderRadius: '2px' }} />
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>

                                                                                {summary?.aiSummary != null && (() => {
                                                                                    return (
                                                                                        <div style={{ padding: '12px 16px', background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe', marginBottom: '14px' }}>
                                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                                                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1d4ed8' }}>✨ Tổng hợp ẩn danh</div>
                                                                                                {!isStaff && (
                                                                                                <button
                                                                                                    onClick={async (e) => {
                                                                                                        e.stopPropagation();
                                                                                                        const textarea = e.target.closest('div').parentElement.querySelector('textarea');
                                                                                                        if (!textarea || !summary?.id) return;
                                                                                                        const newText = textarea.value.trim();
                                                                                                        try {
                                                                                                            await updateRatingSummary(summary.id, { aiSummary: newText });
                                                                                                            setRatingSummaries(prev => {
                                                                                                                const arr = (prev[period.id] || []).map(s => s.teacherId === t.teacherId ? { ...s, aiSummary: newText } : s);
                                                                                                                return { ...prev, [period.id]: arr };
                                                                                                            });
                                                                                                            setToast({ type: 'success', text: 'Đã lưu nhận xét' });
                                                                                                        } catch (err) { setToast({ type: 'error', text: err.message }); }
                                                                                                    }}
                                                                                                    style={{ background: 'none', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '3px 10px', fontSize: '0.72rem', color: '#1d4ed8', cursor: 'pointer', fontWeight: 600 }}
                                                                                                >
                                                                                                    <Save size={11} style={{ marginRight: '3px', verticalAlign: 'middle' }} /> Lưu
                                                                                                </button>
                                                                                                )}
                                                                                            </div>
                                                                                            {isStaff ? (
                                                                                                <p style={{ margin: 0, fontSize: '0.82rem', color: '#334155', lineHeight: 1.7 }}>{summary.aiSummary}</p>
                                                                                            ) : (
                                                                                            <textarea
                                                                                                defaultValue={summary.aiSummary}
                                                                                                onClick={e => e.stopPropagation()}
                                                                                                ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                                                                                                onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                                                                                style={{
                                                                                                    width: '100%', minHeight: '70px', padding: '10px 12px',
                                                                                                    fontSize: '0.82rem', color: '#334155', lineHeight: 1.7,
                                                                                                    border: '1px solid #bfdbfe', borderRadius: '8px',
                                                                                                    background: '#fff', resize: 'none', fontFamily: 'inherit',
                                                                                                    boxSizing: 'border-box', outline: 'none', overflow: 'hidden',
                                                                                                }}
                                                                                                onFocus={e => e.target.style.borderColor = '#6366f1'}
                                                                                                onBlur={e => e.target.style.borderColor = '#bfdbfe'}
                                                                                            />
                                                                                            )}
                                                                                        </div>
                                                                                    );
                                                                                })()}

                                                                                {/* Per-teacher actions — admin only */}
                                                                                {!isStaff && (
                                                                                <div className="rp-action-buttons" style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                                                                                    <button
                                                                                        className="admin-btn"
                                                                                        disabled={generatingTeacherId === t.teacherId}
                                                                                        onClick={async (e) => {
                                                                                            e.stopPropagation();
                                                                                            setGeneratingTeacherId(t.teacherId);
                                                                                            try {
                                                                                                const result = await generateRatingSummaryForTeacher(period.id, t.teacherId);
                                                                                                setRatingSummaries(prev => {
                                                                                                    const existing = prev[period.id] || [];
                                                                                                    const filtered = existing.filter(s => s.teacherId !== t.teacherId);
                                                                                                    return { ...prev, [period.id]: [...filtered, result] };
                                                                                                });
                                                                                                setToast({ type: 'success', text: `Đã tạo tổng hợp cho ${t.teacherName}` });
                                                                                            } catch (err) { setToast({ type: 'error', text: err.message }); }
                                                                                            setGeneratingTeacherId(null);
                                                                                        }}
                                                                                        style={{ padding: '5px 12px', fontSize: '0.75rem', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                                                    >
                                                                                        {generatingTeacherId === t.teacherId ? 'Đang tạo...' : <><Sparkles size={12} /> Tạo tổng hợp</>}
                                                                                    </button>
                                                                                    <button
                                                                                        className="admin-btn"
                                                                                        disabled={sendingTeacherId === t.teacherId || !summary}
                                                                                        onClick={async (e) => {
                                                                                            e.stopPropagation();
                                                                                            if (!summary) return;
                                                                                            setSendingTeacherId(t.teacherId);
                                                                                            try {
                                                                                                await createNotification({ userId: summary.teacherId, type: 'teacher_rating_result', title: '📊 Kết quả đánh giá', message: `Kỳ đánh giá đã kết thúc. Điểm tổng: ${summary.overallScore}/100.`, link: '/teacher/ratings' });
                                                                                                const criteriaHtml = RATING_CRITERIA.map(c => {
                                                                                                    const val = summary.averageScores?.[c.key] || 0;
                                                                                                    const display = c.type === 'boolean' ? `${Math.round((val / 10) * 100)}% Có` : `${val.toFixed(1)}/10`;
                                                                                                    const label = c.type === 'boolean' ? c.description : c.label;
                                                                                                    return `<table width="100%" style="border-collapse:collapse;"><tr><td style="padding:4px 0;border-bottom:1px solid #f1f5f9;">${c.icon} ${label}</td><td style="padding:4px 0;border-bottom:1px solid #f1f5f9;text-align:right;"><strong>${display}</strong></td></tr></table>`;
                                                                                                }).join('');
                                                                                                const emailHtml = buildEmailHtml({ emoji: '📊', heading: 'Kết quả đánh giá giáo viên', headingColor: '#4f46e5', body: `<p>Kỳ đánh giá đã kết thúc với <strong>${summary.totalResponses}</strong> phản hồi từ học viên.</p><div style="margin:12px 0">${criteriaHtml}</div>`, highlight: summary.aiSummary ? `<strong>💡 Nhận xét tổng hợp:</strong><br/>${summary.aiSummary}` : null, highlightBg: '#f0f9ff', highlightBorder: '#4f46e5', ctaText: 'Xem chi tiết' });
                                                                                                try {
                                                                                                    const teacher = await usersService.findOne(summary.teacherId);
                                                                                                    if (teacher?.email) await queueEmail(teacher.email, { subject: `📊 Kết quả đánh giá — Điểm: ${summary.overallScore}/100`, html: emailHtml });
                                                                                                } catch { /* ignore */ }
                                                                                                setToast({ type: 'success', text: `Đã gửi kết quả cho ${t.teacherName}` });
                                                                                            } catch (err) { setToast({ type: 'error', text: err.message }); }
                                                                                            setSendingTeacherId(null);
                                                                                        }}
                                                                                        style={{ padding: '5px 12px', fontSize: '0.75rem', background: summary ? '#f59e0b' : '#e2e8f0', color: summary ? 'white' : '#94a3b8', border: 'none', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                                                    >
                                                                                        {sendingTeacherId === t.teacherId ? 'Đang gửi...' : <><Send size={12} /> Gửi kết quả</>}
                                                                                    </button>
                                                                                </div>
                                                                                )}

                                                                                <h5 style={{ margin: '0 0 8px', fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                    <Eye size={14} color="#4f46e5" /> Chi tiết từng đánh giá
                                                                                </h5>
                                                                                {isRDetailLoading ? (
                                                                                    <div style={{ textAlign: 'center', padding: '12px', color: '#64748b', fontSize: '0.82rem' }}>Đang tải...</div>
                                                                                ) : !rDetails || rDetails.length === 0 ? (
                                                                                    <div style={{ textAlign: 'center', padding: '12px', color: '#94a3b8', fontSize: '0.82rem' }}>Không có dữ liệu</div>
                                                                                ) : (
                                                                                    <div className="admin-table-container">
                                                                                        <table className="admin-table" style={{ minWidth: '500px', fontSize: '0.82rem' }}>
                                                                                            <thead>
                                                                                                <tr>
                                                                                                    <th>Học viên</th>
                                                                                                    {RATING_CRITERIA.map(c => <th key={c.key} style={{ textAlign: 'center', fontSize: '0.68rem' }}>{c.icon}</th>)}
                                                                                                    <th style={{ textAlign: 'center' }}>Tổng</th>
                                                                                                    <th>Nhận xét</th>
                                                                                                    {!isStaff && <th style={{ textAlign: 'center', fontSize: '0.72rem' }}>Thao tác</th>}
                                                                                                </tr>
                                                                                            </thead>
                                                                                            <tbody>
                                                                                                {rDetails.map((d, index) => (
                                                                                                    <tr key={d.id} style={{ opacity: d.eliminated ? 0.4 : 1, textDecoration: d.eliminated ? 'line-through' : 'none' }}>
                                                                                                        <td><span style={{ fontWeight: 600, color: '#0f172a' }}>{isStaff ? `Học viên ${index + 1}` : d.studentName}</span></td>
                                                                                                        {RATING_CRITERIA.map(c => (
                                                                                                            <td key={c.key} style={{ textAlign: 'center' }}>
                                                                                                                <span style={{ fontWeight: 700, color: (d.scores?.[c.key] || 0) >= 8 ? '#16a34a' : (d.scores?.[c.key] || 0) >= 5 ? '#f59e0b' : '#ef4444' }}>{c.type === 'boolean' ? (d.scores?.[c.key] ? '✅' : '❌') : (d.scores?.[c.key] || 0)}</span>
                                                                                                            </td>
                                                                                                        ))}
                                                                                                        <td style={{ textAlign: 'center' }}>
                                                                                                            <span style={{ padding: '2px 8px', borderRadius: '100px', fontWeight: 800, fontSize: '0.78rem', background: d.totalScore >= 80 ? '#f0fdf4' : d.totalScore >= 60 ? '#fefce8' : '#fef2f2', color: d.totalScore >= 80 ? '#16a34a' : d.totalScore >= 60 ? '#ca8a04' : '#dc2626' }}>{d.totalScore}</span>
                                                                                                        </td>
                                                                                                        <td><span style={{ fontSize: '0.78rem', color: '#64748b', maxWidth: '180px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.comment || '—'}</span></td>
                                                                                                        {!isStaff && (
                                                                                                        <td style={{ textAlign: 'center' }}>
                                                                                                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                                                                                <button
                                                                                                                    title={d.eliminated ? 'Bỏ loại trừ' : 'Loại trừ khỏi tổng hợp'}
                                                                                                                    onClick={async (e) => {
                                                                                                                        e.stopPropagation();
                                                                                                                        try {
                                                                                                                            await toggleEliminateRating(d.id, !d.eliminated);
                                                                                                                            // Update local state
                                                                                                                            const rKey = `${period.id}_${t.teacherId}`;
                                                                                                                            setRatingDetails(prev => ({
                                                                                                                                ...prev,
                                                                                                                                [rKey]: prev[rKey].map(r => r.id === d.id ? { ...r, eliminated: !d.eliminated } : r)
                                                                                                                            }));
                                                                                                                            setToast({ type: 'success', text: d.eliminated ? 'Đã khôi phục đánh giá' : 'Đã loại trừ đánh giá' });
                                                                                                                        } catch (err) { setToast({ type: 'error', text: err.message }); }
                                                                                                                    }}
                                                                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px', color: d.eliminated ? '#16a34a' : '#94a3b8' }}
                                                                                                                >
                                                                                                                    {d.eliminated ? <RotateCcw size={14} /> : <Ban size={14} />}
                                                                                                                </button>
                                                                                                                <button
                                                                                                                    title="Reset để HV đánh giá lại"
                                                                                                                    onClick={(e) => {
                                                                                                                        e.stopPropagation();
                                                                                                                        setResetRatingTarget({ id: d.id, periodId: period.id, teacherId: t.teacherId });
                                                                                                                    }}
                                                                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px', color: '#94a3b8' }}
                                                                                                                >
                                                                                                                    <RotateCcw size={14} />
                                                                                                                </button>
                                                                                                            </div>
                                                                                                            {resetRatingTarget?.id === d.id && (
                                                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', padding: '6px 10px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                                                                                                                    <span style={{ fontSize: '0.72rem', color: '#991b1b', flex: 1 }}>Xoá để HV đánh giá lại?</span>
                                                                                                                    <button
                                                                                                                        onClick={async (e) => {
                                                                                                                            e.stopPropagation();
                                                                                                                            try {
                                                                                                                                await deleteRating(d.id);
                                                                                                                                const rKey = `${period.id}_${t.teacherId}`;
                                                                                                                                setRatingDetails(prev => ({
                                                                                                                                    ...prev,
                                                                                                                                    [rKey]: prev[rKey].filter(r => r.id !== d.id)
                                                                                                                                }));
                                                                                                                                setToast({ type: 'success', text: 'Đã reset — HV có thể đánh giá lại' });
                                                                                                                            } catch (err) { setToast({ type: 'error', text: err.message }); }
                                                                                                                            setResetRatingTarget(null);
                                                                                                                        }}
                                                                                                                        style={{ padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700, background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                                                                                                    >Xác nhận</button>
                                                                                                                    <button
                                                                                                                        onClick={(e) => { e.stopPropagation(); setResetRatingTarget(null); }}
                                                                                                                        style={{ padding: '3px 10px', fontSize: '0.72rem', fontWeight: 600, background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                                                                                                    >Huỷ</button>
                                                                                                                </div>
                                                                                                            )}
                                                                                                        </td>
                                                                                                        )}
                                                                                                    </tr>
                                                                                                ))}
                                                                                            </tbody>
                                                                                        </table>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
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

            {/* ═══ TRASH BUTTON ═══ */}
            {!isStaff && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
                    <button
                        className="admin-btn"
                        onClick={() => { setShowTrash(!showTrash); if (!showTrash) loadTrash(); }}
                        style={{
                            padding: '8px 16px', fontSize: '0.85rem', borderRadius: '12px',
                            background: showTrash ? '#fef2f2' : '#f8fafc',
                            color: showTrash ? '#dc2626' : '#64748b',
                            border: `1.5px solid ${showTrash ? '#fecaca' : '#e2e8f0'}`,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                            fontWeight: 600, transition: 'all 0.2s'
                        }}
                    >
                        <Archive size={16} /> Thùng rác
                        {deletedPeriods.length > 0 && (
                            <span style={{
                                padding: '1px 7px', borderRadius: '100px', fontSize: '0.7rem', fontWeight: 800,
                                background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                                marginLeft: '2px'
                            }}>{deletedPeriods.length}</span>
                        )}
                    </button>
                </div>
            )}

            {/* ═══ TRASH SECTION ═══ */}
            {showTrash && (
                <div className="admin-card" style={{ border: '1.5px dashed #fecaca', background: '#fffbfb', animation: 'adminFadeIn 0.2s ease-out' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Archive size={20} color="#dc2626" /> Thùng rác
                        </h3>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Tự xoá vĩnh viễn sau 30 ngày</span>
                    </div>

                    {trashLoading ? (
                        <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '0.9rem' }}>Đang tải...</div>
                    ) : deletedPeriods.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '0.85rem' }}>
                            🗑️ Thùng rác trống
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {deletedPeriods.map(period => {
                                const deletedAt = period.deletedAt
                                    ? (typeof period.deletedAt?.toDate === 'function'
                                        ? period.deletedAt.toDate()
                                        : new Date(period.deletedAt))
                                    : null;
                                const daysLeft = deletedAt ? Math.max(0, 30 - Math.floor((Date.now() - deletedAt) / (1000 * 60 * 60 * 24))) : 30;

                                return (
                                    <div key={period.id} className="rp-trash-item" style={{
                                        padding: '14px 18px', borderRadius: '12px',
                                        background: '#fff', border: '1px solid #fecaca',
                                        display: 'flex', alignItems: 'center', gap: '14px',
                                        flexWrap: 'wrap'
                                    }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#64748b', textDecoration: 'line-through' }}>
                                                {period.label || 'Kỳ báo cáo'}
                                            </div>
                                            <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '0.78rem', color: '#94a3b8', flexWrap: 'wrap' }}>
                                                <span>{formatDate(period.startDate)} → {formatDate(period.endDate)}</span>
                                                {deletedAt && (
                                                    <span>Đã xoá: {deletedAt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                                )}
                                                <span style={{
                                                    padding: '1px 8px', borderRadius: '100px', fontSize: '0.7rem', fontWeight: 700,
                                                    background: daysLeft <= 7 ? '#fef2f2' : '#f8fafc',
                                                    color: daysLeft <= 7 ? '#dc2626' : '#64748b',
                                                    border: `1px solid ${daysLeft <= 7 ? '#fecaca' : '#e2e8f0'}`
                                                }}>
                                                    Còn {daysLeft} ngày
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                            <button
                                                onClick={() => handleRestore(period.id)}
                                                className="admin-btn"
                                                style={{
                                                    padding: '6px 14px', fontSize: '0.8rem', borderRadius: '10px',
                                                    background: '#f0fdf4', color: '#16a34a',
                                                    border: '1.5px solid #bbf7d0', cursor: 'pointer',
                                                    fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px'
                                                }}
                                            >
                                                <Undo2 size={14} /> Khôi phục
                                            </button>
                                            <button
                                                onClick={() => setPermanentDeleteTarget(period.id)}
                                                className="admin-btn"
                                                style={{
                                                    padding: '6px 14px', fontSize: '0.8rem', borderRadius: '10px',
                                                    background: '#fef2f2', color: '#dc2626',
                                                    border: '1.5px solid #fecaca', cursor: 'pointer',
                                                    fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px'
                                                }}
                                            >
                                                <Trash2 size={14} /> Xoá vĩnh viễn
                                            </button>
                                        </div>

                                        {permanentDeleteTarget === period.id && (
                                            <div style={{
                                                width: '100%', padding: '10px 14px', marginTop: '4px',
                                                background: '#fef2f2', borderRadius: '10px', border: '1px solid #fecaca',
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap'
                                            }}>
                                                <span style={{ fontSize: '0.82rem', color: '#dc2626', fontWeight: 500 }}>⚠️ Xoá vĩnh viễn? Không thể hoàn tác!</span>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button className="admin-btn admin-btn-secondary" style={{ padding: '5px 12px', fontSize: '0.78rem' }} onClick={() => setPermanentDeleteTarget(null)}>Huỷ</button>
                                                    <button className="admin-btn" style={{ padding: '5px 12px', fontSize: '0.78rem', background: '#dc2626', color: 'white', border: 'none' }} onClick={() => handlePermanentDelete(period.id)}>
                                                        <Trash2 size={12} /> Xác nhận xoá
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}





