import React, { useState, useEffect, useMemo } from 'react';
import { Star, Calendar, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getAllReportPeriods, computePeriodStatus, getStatusLabel } from '../../services/reportPeriodService';
import { RATING_CRITERIA, getAllSummariesForPeriod, getRatingSummary } from '../../services/teacherRatingService';
import SpiderChart from '../../components/common/SpiderChart';

export default function TeacherRatingResultsPage() {
    const { user } = useAuth();
    const isTeacher = user?.role === 'teacher';
    const isStaffOrAdmin = user?.role === 'staff' || user?.role === 'admin';

    const [periods, setPeriods] = useState([]);
    const [selectedPeriodId, setSelectedPeriodId] = useState('');
    const [loading, setLoading] = useState(true);
    const [periodDropdownOpen, setPeriodDropdownOpen] = useState(false);

    // For teachers: single summary
    const [mySummary, setMySummary] = useState(null);

    // For staff: all summaries
    const [allSummaries, setAllSummaries] = useState([]);
    const [selectedSummary, setSelectedSummary] = useState(null);

    // Group tab state for per-class view
    const [selectedGroupId, setSelectedGroupId] = useState(null); // null = "Tổng hợp"

    useEffect(() => {
        loadPeriods();
    }, []);

    async function loadPeriods() {
        setLoading(true);
        try {
            const allPeriods = await getAllReportPeriods();
            setPeriods(allPeriods);

            // Auto-select most recent closed or active period
            const closed = allPeriods.find(p => computePeriodStatus(p) === 'closed');
            const active = allPeriods.find(p => computePeriodStatus(p) === 'active' || computePeriodStatus(p) === 'grace');
            const target = closed || active || allPeriods[0];
            if (target) {
                setSelectedPeriodId(target.id);
                await loadResults(target.id);
            }
        } catch (err) {
            console.error('Error loading periods:', err);
        }
        setLoading(false);
    }

    async function loadResults(periodId) {
        if (!periodId) return;
        try {
            if (isTeacher) {
                // Teacher only sees their own summary
                const summary = await getRatingSummary(periodId, user.uid);
                setMySummary(summary);
            } else {
                // Staff/Admin sees all summaries (anonymous view)
                const sums = await getAllSummariesForPeriod(periodId);
                setAllSummaries(sums);
                if (sums.length > 0) setSelectedSummary(sums[0]);
            }
        } catch (err) {
            console.error('Error loading results:', err);
        }
    }

    function handlePeriodChange(periodId) {
        setSelectedPeriodId(periodId);
        setMySummary(null);
        setAllSummaries([]);
        setSelectedSummary(null);
        setSelectedGroupId(null);
        setPeriodDropdownOpen(false);
        loadResults(periodId);
    }

    function getScoreColor(val) {
        if (val >= 8) return '#16a34a';
        if (val >= 5) return '#f59e0b';
        return '#ef4444';
    }

    // Get the currently displayed data (aggregate or per-group)
    function getDisplayData(summary) {
        if (!summary) return null;
        if (selectedGroupId && summary.groupScores?.[selectedGroupId]) {
            const gs = summary.groupScores[selectedGroupId];
            return {
                averageScores: gs.averageScores,
                overallScore: gs.overallScore,
                totalResponses: gs.count,
                aiSummary: summary.aiSummary, // AI summary is always the aggregate one
            };
        }
        return summary;
    }

    const statusStyles = {
        active: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', label: '🟢 Đang mở' },
        grace: { bg: '#fefce8', color: '#ca8a04', border: '#fde68a', label: '⏳ Gia hạn' },
        closed: { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0', label: '✅ Đã đóng' },
        upcoming: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', label: '📅 Sắp mở' },
    };

    function renderGroupTabs(summary) {
        if (!summary?.groupScores || Object.keys(summary.groupScores).length <= 1) return null;

        return (
            <div className="admin-card" style={{ padding: '12px 20px' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, marginBottom: '8px' }}>📊 Xem theo lớp:</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {/* Aggregate tab */}
                    <button
                        onClick={() => setSelectedGroupId(null)}
                        style={{
                            padding: '7px 16px', borderRadius: '100px', border: 'none', cursor: 'pointer',
                            fontWeight: 600, fontSize: '0.82rem', transition: 'all 0.2s',
                            background: selectedGroupId === null ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : '#f1f5f9',
                            color: selectedGroupId === null ? 'white' : '#475569',
                            boxShadow: selectedGroupId === null ? '0 2px 8px rgba(79,70,229,0.25)' : 'none',
                        }}
                    >
                        🏠 Tổng hợp
                        <span style={{
                            marginLeft: '6px', fontSize: '0.72rem',
                            opacity: 0.85,
                        }}>
                            {summary.overallScore}/100
                        </span>
                    </button>
                    {/* Per-group tabs */}
                    {Object.entries(summary.groupScores).map(([gid, gs]) => (
                        <button
                            key={gid}
                            onClick={() => setSelectedGroupId(gid)}
                            style={{
                                padding: '7px 16px', borderRadius: '100px', border: 'none', cursor: 'pointer',
                                fontWeight: 600, fontSize: '0.82rem', transition: 'all 0.2s',
                                background: selectedGroupId === gid
                                    ? `linear-gradient(135deg, ${gs.overallScore >= 80 ? '#16a34a' : gs.overallScore >= 60 ? '#ca8a04' : '#dc2626'}, ${gs.overallScore >= 80 ? '#22c55e' : gs.overallScore >= 60 ? '#eab308' : '#ef4444'})`
                                    : '#f1f5f9',
                                color: selectedGroupId === gid ? 'white' : '#475569',
                                boxShadow: selectedGroupId === gid ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
                            }}
                        >
                            {gs.groupName}
                            <span style={{
                                marginLeft: '6px', fontSize: '0.72rem',
                                opacity: 0.85,
                            }}>
                                {gs.overallScore}/100 ({gs.count})
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    function renderSummaryDetail(summary) {
        const displayData = getDisplayData(summary);

        if (!displayData) {
            return (
                <div className="admin-card" style={{ textAlign: 'center', padding: '60px 24px' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📭</div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>Chưa có kết quả</h3>
                    <p style={{ fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.6 }}>
                        Kết quả đánh giá chưa được tạo cho kỳ này. Vui lòng đợi admin tổng hợp.
                    </p>
                </div>
            );
        }

        const chartData = RATING_CRITERIA.filter(c => c.type !== 'boolean').map(c => ({
            label: c.label,
            value: displayData.averageScores?.[c.key] || 0,
        }));

        return (
            <>
                {/* Overall score card */}
                <div className="admin-card" style={{ textAlign: 'center', background: 'linear-gradient(135deg, #fafbfc 0%, #f0f9ff 100%)' }}>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '8px' }}>
                        {selectedGroupId && summary?.groupScores?.[selectedGroupId]
                            ? `Điểm lớp ${summary.groupScores[selectedGroupId].groupName}`
                            : 'Điểm tổng thể'}
                    </div>
                    <div style={{
                        fontSize: '3.5rem', fontWeight: 900, lineHeight: 1,
                        color: displayData.overallScore >= 80 ? '#16a34a' : displayData.overallScore >= 60 ? '#f59e0b' : '#ef4444',
                        marginBottom: '8px',
                    }}>
                        {displayData.overallScore}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>trên thang 100 • {displayData.totalResponses} phản hồi</div>
                </div>

                {/* Spider Chart */}
                <div className="admin-card" style={{ textAlign: 'center' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>📊 Biểu đồ đánh giá chi tiết</h3>
                    <SpiderChart data={chartData} size={320} color="#6366f1" />
                </div>

                {/* Criteria breakdown */}
                <div className="admin-card">
                    <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>📋 Điểm từng tiêu chí</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {RATING_CRITERIA.map(c => {
                            const val = displayData.averageScores?.[c.key] || 0;

                            // Boolean criteria: show as % who said "Có"
                            if (c.type === 'boolean') {
                                const yesPct = Math.round((val / 10) * 100);
                                return (
                                    <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{c.icon}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#334155' }}>{c.description}</span>
                                                <span style={{ fontWeight: 800, fontSize: '1rem', color: yesPct >= 80 ? '#16a34a' : yesPct >= 50 ? '#f59e0b' : '#ef4444' }}>
                                                    {yesPct}%<span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400 }}> Có</span>
                                                </span>
                                            </div>
                                            <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{
                                                    height: '100%', width: `${yesPct}%`,
                                                    background: `linear-gradient(90deg, ${yesPct >= 80 ? '#16a34a' : yesPct >= 50 ? '#f59e0b' : '#ef4444'}, ${yesPct >= 80 ? '#16a34a' : yesPct >= 50 ? '#f59e0b' : '#ef4444'}cc)`,
                                                    borderRadius: '4px', transition: 'width 0.8s ease',
                                                }} />
                                            </div>
                                            <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px', display: 'block' }}>
                                                (trọng số: {c.weight}%)
                                            </span>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{c.icon}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#334155' }}>{c.label}</span>
                                            <span style={{ fontWeight: 800, fontSize: '1rem', color: getScoreColor(val) }}>
                                                {val.toFixed(1)}<span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400 }}>/10</span>
                                            </span>
                                        </div>
                                        <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{
                                                height: '100%', width: `${(val / 10) * 100}%`,
                                                background: `linear-gradient(90deg, ${getScoreColor(val)}, ${getScoreColor(val)}cc)`,
                                                borderRadius: '4px', transition: 'width 0.8s ease',
                                            }} />
                                        </div>
                                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px', display: 'block' }}>
                                            {c.description} (trọng số: {c.weight}%)
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* AI Summary — only show on aggregate view */}
                {!selectedGroupId && displayData.aiSummary && (
                    <div className="admin-card" style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)', border: '1px solid #bfdbfe' }}>
                        <h3 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 700, color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            ✨ Nhận xét tổng hợp từ AI
                        </h3>
                        <p style={{ margin: 0, fontSize: '0.92rem', color: '#334155', lineHeight: 1.8 }}>{displayData.aiSummary}</p>
                        <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(255,255,255,0.6)', borderRadius: '12px' }}>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                                🔒 Nhận xét được AI tổng hợp từ phản hồi ẩn danh của học viên. Không tiết lộ danh tính người đánh giá.
                            </p>
                        </div>
                    </div>
                )}
            </>
        );
    }

    if (loading) {
        return (
            <div className="admin-page">
                <div className="admin-card" style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>Đang tải...</div>
            </div>
        );
    }

    const selectedPeriod = periods.find(p => p.id === selectedPeriodId);
    const selectedStatus = selectedPeriod ? computePeriodStatus(selectedPeriod) : '';
    const selectedStyle = statusStyles[selectedStatus] || statusStyles.closed;

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <div>
                    <h1 className="admin-page-title" style={{ margin: 0 }}>
                        <Star size={28} color="#f59e0b" /> {isTeacher ? 'Đánh giá của tôi' : 'Kết quả đánh giá GV'}
                    </h1>
                    <p className="admin-page-subtitle">Xem kết quả đánh giá và nhận xét của học viên theo từng kỳ.</p>
                </div>
            </div>

            {/* Custom Period selector */}
            <div className="admin-card" style={{ padding: '14px 20px', position: 'relative' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, marginBottom: '8px' }}>
                    <Calendar size={13} style={{ verticalAlign: '-2px', marginRight: '4px' }} />
                    Chọn kỳ:
                </div>

                {/* Selected period display — clickable */}
                <button
                    onClick={() => setPeriodDropdownOpen(!periodDropdownOpen)}
                    style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        padding: '12px 16px',
                        border: `1.5px solid ${periodDropdownOpen ? '#818cf8' : '#e2e8f0'}`,
                        borderRadius: '14px',
                        background: periodDropdownOpen ? '#fafbff' : '#fff',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: periodDropdownOpen ? '0 0 0 3px rgba(99,102,241,0.1)' : '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <div style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            background: selectedStyle.color,
                            boxShadow: `0 0 6px ${selectedStyle.color}40`,
                            flexShrink: 0,
                        }} />
                        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {selectedPeriod?.label || 'Chọn kỳ...'}
                        </span>
                        <span style={{
                            padding: '2px 10px', borderRadius: '100px', fontSize: '0.7rem', fontWeight: 700,
                            background: selectedStyle.bg, color: selectedStyle.color, border: `1px solid ${selectedStyle.border}`,
                            whiteSpace: 'nowrap', flexShrink: 0,
                        }}>
                            {selectedStyle.label}
                        </span>
                    </div>
                    <ChevronDown
                        size={18}
                        color="#94a3b8"
                        style={{
                            transition: 'transform 0.2s',
                            transform: periodDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            flexShrink: 0,
                        }}
                    />
                </button>

                {/* Dropdown options */}
                {periodDropdownOpen && (
                    <>
                        {/* Backdrop to close on outside click */}
                        <div
                            onClick={() => setPeriodDropdownOpen(false)}
                            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
                        />
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: '0',
                            right: '0',
                            marginTop: '4px',
                            background: '#fff',
                            borderRadius: '16px',
                            border: '1.5px solid #e2e8f0',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)',
                            zIndex: 100,
                            maxHeight: '320px',
                            overflowY: 'auto',
                            padding: '6px',
                        }}>
                            {periods.map(p => {
                                const status = computePeriodStatus(p);
                                const style = statusStyles[status] || statusStyles.closed;
                                const isSelected = p.id === selectedPeriodId;

                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => handlePeriodChange(p.id)}
                                        style={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            padding: '10px 14px',
                                            border: 'none',
                                            borderRadius: '12px',
                                            background: isSelected ? 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(79,70,229,0.05))' : 'transparent',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s',
                                            textAlign: 'left',
                                        }}
                                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <div style={{
                                            width: '8px', height: '8px', borderRadius: '50%',
                                            background: style.color,
                                            boxShadow: `0 0 6px ${style.color}40`,
                                            flexShrink: 0,
                                        }} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                fontWeight: isSelected ? 700 : 500,
                                                fontSize: '0.88rem',
                                                color: isSelected ? '#4f46e5' : '#0f172a',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                            }}>
                                                {p.label}
                                            </div>
                                        </div>
                                        <span style={{
                                            padding: '2px 8px', borderRadius: '100px', fontSize: '0.68rem', fontWeight: 700,
                                            background: style.bg, color: style.color, border: `1px solid ${style.border}`,
                                            whiteSpace: 'nowrap', flexShrink: 0,
                                        }}>
                                            {getStatusLabel(status)}
                                        </span>
                                        {isSelected && (
                                            <div style={{
                                                width: '6px', height: '6px', borderRadius: '50%',
                                                background: '#4f46e5',
                                                boxShadow: '0 0 6px rgba(79,70,229,0.4)',
                                                flexShrink: 0,
                                            }} />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Teacher view: group tabs + own results */}
            {isTeacher && (
                <>
                    {renderGroupTabs(mySummary)}
                    {renderSummaryDetail(mySummary)}
                </>
            )}

            {/* Staff view: teacher selector + results */}
            {isStaffOrAdmin && (
                <>
                    {allSummaries.length === 0 ? (
                        renderSummaryDetail(null)
                    ) : (
                        <>
                            {/* Teacher pills */}
                            <div className="admin-card" style={{ padding: '16px 20px' }}>
                                <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600, marginBottom: '10px' }}>Chọn giáo viên:</div>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {allSummaries.map(s => (
                                        <button
                                            key={s.teacherId}
                                            onClick={() => { setSelectedSummary(s); setSelectedGroupId(null); }}
                                            style={{
                                                padding: '8px 16px', borderRadius: '100px', border: 'none', cursor: 'pointer',
                                                fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s',
                                                background: selectedSummary?.teacherId === s.teacherId ? '#4f46e5' : '#f1f5f9',
                                                color: selectedSummary?.teacherId === s.teacherId ? 'white' : '#475569',
                                            }}
                                        >
                                            {s.teacherName}
                                            <span style={{
                                                marginLeft: '6px', fontSize: '0.75rem',
                                                opacity: 0.8,
                                            }}>
                                                {s.overallScore}/100
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {renderGroupTabs(selectedSummary)}
                            {renderSummaryDetail(selectedSummary)}
                        </>
                    )}
                </>
            )}
        </div>
    );
}
