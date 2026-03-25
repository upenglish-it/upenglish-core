import React, { useState, useEffect, useMemo } from 'react';
import { Star, ChevronDown, ChevronUp, Users, Sparkles, Send, RefreshCw, Eye } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getAllReportPeriods, computePeriodStatus, getStatusLabel } from '../../services/reportPeriodService';
import {
    RATING_CRITERIA,
    getAllRatingsForPeriod,
    getRatingsForTeacher,
    generateRatingSummaries,
    getAllSummariesForPeriod,
} from '../../services/teacherRatingService';
import { createNotification, queueEmail, buildEmailHtml } from '../../services/notificationService';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import SpiderChart from '../../components/common/SpiderChart';
import Avatar from '../../components/common/Avatar';

const STATUS_STYLES = {
    upcoming: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
    active: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
    grace: { bg: '#fefce8', color: '#ca8a04', border: '#fde68a' },
    closed: { bg: '#f8fafc', color: '#94a3b8', border: '#e2e8f0' },
};

export default function AdminTeacherRatingsPage() {
    const { user } = useAuth();
    const [periods, setPeriods] = useState([]);
    const [selectedPeriodId, setSelectedPeriodId] = useState('');
    const [loading, setLoading] = useState(true);

    // Overview data
    const [overview, setOverview] = useState([]);
    const [overviewLoading, setOverviewLoading] = useState(false);

    // Detail expansion
    const [expandedTeacherId, setExpandedTeacherId] = useState(null);
    const [teacherDetails, setTeacherDetails] = useState({});
    const [detailLoading, setDetailLoading] = useState({});

    // AI Summary
    const [generating, setGenerating] = useState(false);
    const [summaries, setSummaries] = useState([]);
    const [sending, setSending] = useState(false);
    const [sentSuccess, setSentSuccess] = useState(false);

    useEffect(() => {
        loadPeriods();
    }, []);

    async function loadPeriods() {
        setLoading(true);
        try {
            const allPeriods = await getAllReportPeriods();
            setPeriods(allPeriods);

            // Auto-select active or most recent period
            const active = allPeriods.find(p => {
                const s = computePeriodStatus(p);
                return s === 'active' || s === 'grace';
            });
            const target = active || allPeriods[0];
            if (target) {
                setSelectedPeriodId(target.id);
                loadOverview(target.id);
            }
        } catch (err) {
            console.error('Error loading periods:', err);
        }
        setLoading(false);
    }

    async function loadOverview(periodId) {
        if (!periodId) return;
        setOverviewLoading(true);
        try {
            const [data, sums] = await Promise.all([
                getAllRatingsForPeriod(periodId),
                getAllSummariesForPeriod(periodId),
            ]);
            setOverview(data);
            setSummaries(sums);
        } catch (err) {
            console.error('Error loading overview:', err);
        }
        setOverviewLoading(false);
    }

    function handlePeriodChange(periodId) {
        setSelectedPeriodId(periodId);
        setExpandedTeacherId(null);
        setTeacherDetails({});
        loadOverview(periodId);
    }

    async function handleExpandTeacher(teacherId) {
        if (expandedTeacherId === teacherId) {
            setExpandedTeacherId(null);
            return;
        }
        setExpandedTeacherId(teacherId);
        if (!teacherDetails[teacherId]) {
            setDetailLoading(prev => ({ ...prev, [teacherId]: true }));
            try {
                const details = await getRatingsForTeacher(selectedPeriodId, teacherId);
                setTeacherDetails(prev => ({ ...prev, [teacherId]: details }));
            } catch (err) {
                console.error('Error loading teacher details:', err);
            }
            setDetailLoading(prev => ({ ...prev, [teacherId]: false }));
        }
    }

    async function handleGenerateSummaries() {
        if (!selectedPeriodId) return;
        setGenerating(true);
        try {
            const results = await generateRatingSummaries(selectedPeriodId);
            setSummaries(results);
            alert(`Đã tạo tổng hợp AI cho ${results.length} giáo viên!`);
        } catch (err) {
            console.error('Error generating summaries:', err);
            alert(`Lỗi: ${err.message}`);
        }
        setGenerating(false);
    }

    async function handleSendResults() {
        if (!selectedPeriodId || summaries.length === 0) return;
        setSending(true);
        try {
            // Send to each teacher
            for (const summary of summaries) {
                // In-app notification
                await createNotification({
                    userId: summary.teacherId,
                    type: 'teacher_rating_result',
                    title: '📊 Kết quả đánh giá',
                    message: `Kỳ đánh giá đã kết thúc. Điểm tổng: ${summary.overallScore}/100.`,
                    link: '/teacher/ratings',
                });

                // Email
                const criteriaHtml = RATING_CRITERIA.map(c =>
                    `<table width="100%" style="border-collapse:collapse;"><tr>
                        <td style="padding:4px 0;border-bottom:1px solid #f1f5f9;">${c.icon} ${c.label}</td>
                        <td style="padding:4px 0;border-bottom:1px solid #f1f5f9;text-align:right;"><strong>${(summary.averageScores?.[c.key] || 0).toFixed(1)}/10</strong></td>
                    </tr></table>`
                ).join('');

                const emailHtml = buildEmailHtml({
                    emoji: '📊',
                    heading: 'Kết quả đánh giá giáo viên',
                    headingColor: '#4f46e5',
                    body: `
                        <p>Kỳ đánh giá đã kết thúc với <strong>${summary.totalResponses}</strong> phản hồi từ học viên.</p>
                        <div style="margin:12px 0">${criteriaHtml}</div>
                    `,
                    highlight: summary.aiSummary ? `<strong>💡 Nhận xét tổng hợp:</strong><br/>${summary.aiSummary}` : null,
                    highlightBg: '#f0f9ff',
                    highlightBorder: '#4f46e5',
                    ctaText: 'Xem chi tiết',
                });

                // Get teacher email
                try {
                    const { getDoc, doc } = await import('firebase/firestore');
                    const tSnap = await getDoc(doc(db, 'users', summary.teacherId));
                    if (tSnap.exists() && tSnap.data().email) {
                        await queueEmail(tSnap.data().email, {
                            subject: `📊 Kết quả đánh giá — Điểm: ${summary.overallScore}/100`,
                            html: emailHtml,
                        });
                    }
                } catch { /* ignore email error */ }
            }

            // Also send to staff/admins
            const usersSnap = await getDocs(query(collection(db, 'users'), where('role', 'in', ['admin', 'staff'])));
            for (const uDoc of usersSnap.docs) {
                if (uDoc.id === user?.uid) continue; // skip current admin
                await createNotification({
                    userId: uDoc.id,
                    type: 'teacher_rating_result',
                    title: '📊 Kết quả đánh giá GV',
                    message: `Đã tạo kết quả đánh giá cho ${summaries.length} giáo viên.`,
                    link: '/admin/teacher-ratings',
                });
            }

            setSentSuccess(true);
            setTimeout(() => setSentSuccess(false), 3000);
        } catch (err) {
            console.error('Error sending results:', err);
            alert(`Lỗi: ${err.message}`);
        }
        setSending(false);
    }

    const selectedPeriod = periods.find(p => p.id === selectedPeriodId);

    return (
        <div className="admin-page">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                <h1 className="admin-page-title" style={{ margin: 0 }}>
                    <Star size={28} color="#f59e0b" /> Đánh giá Giáo viên
                </h1>
                <p className="admin-page-subtitle">Xem tổng hợp và chi tiết đánh giá giáo viên theo từng kỳ.</p>
            </div>

            {/* Period Selector */}
            <div className="admin-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>Chọn kỳ:</label>
                <select
                    value={selectedPeriodId}
                    onChange={e => handlePeriodChange(e.target.value)}
                    style={{ flex: 1, minWidth: '200px', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', outline: 'none', background: '#fff' }}
                >
                    {periods.map(p => {
                        const status = computePeriodStatus(p);
                        return (
                            <option key={p.id} value={p.id}>
                                {p.label} — {getStatusLabel(status)}
                            </option>
                        );
                    })}
                </select>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                        className="admin-btn admin-btn-primary"
                        onClick={handleGenerateSummaries}
                        disabled={generating || overview.length === 0}
                        style={{ whiteSpace: 'nowrap' }}
                    >
                        {generating ? <><RefreshCw size={16} className="spin" /> Đang tạo...</> : <><Sparkles size={16} /> Tạo tổng hợp AI</>}
                    </button>
                    <button
                        className="admin-btn"
                        onClick={handleSendResults}
                        disabled={sending || summaries.length === 0}
                        style={{ whiteSpace: 'nowrap', background: sentSuccess ? '#22c55e' : '#f59e0b', color: 'white', border: 'none' }}
                    >
                        {sending ? 'Đang gửi...' : sentSuccess ? '✓ Đã gửi!' : <><Send size={16} /> Gửi kết quả</>}
                    </button>
                </div>
            </div>

            {/* Overview Table */}
            {overviewLoading ? (
                <div className="admin-card" style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>Đang tải...</div>
            ) : overview.length === 0 ? (
                <div className="admin-card">
                    <div className="admin-empty-state">
                        <div className="admin-empty-icon"><Users size={32} /></div>
                        <h3>Chưa có đánh giá</h3>
                        <p>Chưa có học viên nào đánh giá trong kỳ này.</p>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {overview.map(t => {
                        const isExpanded = expandedTeacherId === t.teacherId;
                        const details = teacherDetails[t.teacherId];
                        const isDetailLoading = detailLoading[t.teacherId];
                        const summary = summaries.find(s => s.teacherId === t.teacherId);

                        const chartData = RATING_CRITERIA.filter(c => c.type !== 'boolean').map(c => ({
                            label: c.label.length > 10 ? c.label.substring(0, 10) + '…' : c.label,
                            value: t.averageScores[c.key] || 0,
                        }));

                        return (
                            <div key={t.teacherId} className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
                                {/* Teacher Header */}
                                <div
                                    onClick={() => handleExpandTeacher(t.teacherId)}
                                    style={{
                                        padding: '20px 24px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '16px',
                                        transition: 'background 0.2s', background: isExpanded ? 'rgba(99,102,241,0.02)' : 'transparent',
                                    }}
                                >
                                    <Avatar src={t.teacherPhoto} alt={t.teacherName} size={48} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{t.teacherName}</div>
                                        <div style={{ display: 'flex', gap: '16px', marginTop: '4px', fontSize: '0.82rem', color: '#64748b', flexWrap: 'wrap' }}>
                                            <span>{t.totalResponses} đánh giá</span>
                                            <span style={{ fontWeight: 700, color: t.overallScore >= 80 ? '#16a34a' : t.overallScore >= 60 ? '#f59e0b' : '#ef4444' }}>
                                                {t.overallScore}/100 điểm
                                            </span>
                                            {summary?.aiSummary && (
                                                <span style={{ color: '#4f46e5', fontWeight: 600 }}>✨ AI đã tổng hợp</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Mini spider chart */}
                                    <div style={{ flexShrink: 0 }}>
                                        <SpiderChart data={chartData} size={100} color="#6366f1" showLabels={false} />
                                    </div>

                                    {isExpanded ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
                                </div>

                                {/* Expanded Detail */}
                                {isExpanded && (
                                    <div style={{ borderTop: '1px solid #e2e8f0', padding: '20px 24px', background: '#fafbfc' }}>
                                        {/* Score breakdown */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                                            {RATING_CRITERIA.map(c => {
                                                const val = t.averageScores[c.key] || 0;
                                                return (
                                                    <div key={c.key} style={{ padding: '12px 16px', background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <span style={{ fontSize: '0.82rem', color: '#475569' }}>{c.icon} {c.label}</span>
                                                            <span style={{ fontWeight: 800, fontSize: '1.1rem', color: val >= 8 ? '#16a34a' : val >= 5 ? '#f59e0b' : '#ef4444' }}>
                                                                {val.toFixed(1)}
                                                            </span>
                                                        </div>
                                                        <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', width: `${(val / 10) * 100}%`, background: val >= 8 ? '#22c55e' : val >= 5 ? '#f59e0b' : '#ef4444', borderRadius: '3px', transition: 'width 0.6s' }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* AI Summary */}
                                        {summary?.aiSummary && (
                                            <div style={{ padding: '16px 20px', background: '#eff6ff', borderRadius: '16px', border: '1px solid #bfdbfe', marginBottom: '20px' }}>
                                                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1d4ed8', marginBottom: '8px' }}>✨ AI Tổng hợp ẩn danh</div>
                                                <p style={{ margin: 0, fontSize: '0.88rem', color: '#334155', lineHeight: 1.7 }}>{summary.aiSummary}</p>
                                            </div>
                                        )}

                                        {/* Individual ratings (admin only) */}
                                        <h4 style={{ margin: '0 0 12px', fontSize: '0.9rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Eye size={16} color="#4f46e5" /> Chi tiết từng đánh giá (chỉ admin thấy)
                                        </h4>

                                        {isDetailLoading ? (
                                            <div style={{ textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '0.85rem' }}>Đang tải chi tiết...</div>
                                        ) : !details || details.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '0.85rem' }}>Không có dữ liệu</div>
                                        ) : (
                                            <div className="admin-table-container">
                                                <table className="admin-table" style={{ minWidth: '600px' }}>
                                                    <thead>
                                                        <tr>
                                                            <th>Học viên</th>
                                                            {RATING_CRITERIA.map(c => (
                                                                <th key={c.key} style={{ textAlign: 'center', fontSize: '0.72rem' }}>{c.icon}</th>
                                                            ))}
                                                            <th style={{ textAlign: 'center' }}>Tổng</th>
                                                            <th>Nhận xét</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {details.map(d => (
                                                            <tr key={d.id}>
                                                                <td>
                                                                    <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>{d.studentName}</span>
                                                                </td>
                                                                {RATING_CRITERIA.map(c => (
                                                                    <td key={c.key} style={{ textAlign: 'center' }}>
                                                                        <span style={{
                                                                            fontWeight: 700, fontSize: '0.85rem',
                                                                            color: (d.scores?.[c.key] || 0) >= 8 ? '#16a34a' : (d.scores?.[c.key] || 0) >= 5 ? '#f59e0b' : '#ef4444',
                                                                        }}>
                                                                            {d.scores?.[c.key] || 0}
                                                                        </span>
                                                                    </td>
                                                                ))}
                                                                <td style={{ textAlign: 'center' }}>
                                                                    <span style={{
                                                                        padding: '3px 10px', borderRadius: '100px', fontWeight: 800, fontSize: '0.82rem',
                                                                        background: d.totalScore >= 80 ? '#f0fdf4' : d.totalScore >= 60 ? '#fefce8' : '#fef2f2',
                                                                        color: d.totalScore >= 80 ? '#16a34a' : d.totalScore >= 60 ? '#ca8a04' : '#dc2626',
                                                                    }}>
                                                                        {d.totalScore}
                                                                    </span>
                                                                </td>
                                                                <td>
                                                                    <span style={{ fontSize: '0.8rem', color: '#64748b', maxWidth: '200px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                        {d.comment || '—'}
                                                                    </span>
                                                                </td>
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

            <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
