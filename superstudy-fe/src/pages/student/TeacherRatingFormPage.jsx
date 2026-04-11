import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, Send, CheckCircle, ChevronRight, AlertCircle, Flame } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
    RATING_CRITERIA,
    calculateTotalScore,
    getTeachersForStudent,
    getStudentRatingsForPeriod,
    markRatingStreakBonusAwarded,
    submitRating,
    getActiveRatingPeriod,
} from '../../services/teacherRatingService';
import { awardStreakBonus } from '../../services/userService';
import SpiderChart from '../../components/common/SpiderChart';
import Avatar from '../../components/common/Avatar';

export default function TeacherRatingFormPage() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [activePeriod, setActivePeriod] = useState(null);
    const [teachers, setTeachers] = useState([]);
    const [existingRatings, setExistingRatings] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form state
    const [selectedTeacher, setSelectedTeacher] = useState(null);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [scores, setScores] = useState({});
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [streakBonus, setStreakBonus] = useState(0);

    // Theme support
    const theme = typeof window !== 'undefined' ? (localStorage.getItem('appTheme') || document.documentElement.getAttribute('data-theme') || 'light') : 'light';
    const isDark = theme === 'dark' || theme === 'diamond';
    const tc = {
        pageBg: isDark ? 'var(--bg-primary, #0f0e1a)' : '#f8fafc',
        cardBg: isDark ? 'var(--bg-secondary, #1a1830)' : '#ffffff',
        textPrimary: isDark ? 'var(--text-primary, #e2e0f0)' : '#0f172a',
        textSecondary: isDark ? 'var(--text-secondary, #a5a0c8)' : '#64748b',
        textMuted: isDark ? 'var(--text-muted, #6b6590)' : '#94a3b8',
        border: isDark ? 'var(--border-color, rgba(108,92,231,0.2))' : '#e2e8f0',
        borderLight: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
        cardShadow: isDark ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.06)',
        hoverBg: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc',
        inputBg: isDark ? 'var(--bg-input, rgba(108,92,231,0.06))' : '#fff',
        fixedBarBg: isDark ? 'rgba(15,14,26,0.95)' : 'rgba(248,250,252,0.95)',
        infoBg: isDark ? 'rgba(79,70,229,0.12)' : '#eff6ff',
        infoBorder: isDark ? 'rgba(79,70,229,0.3)' : '#bfdbfe',
        infoText: isDark ? '#a5b4fc' : '#1d4ed8',
        chipBg: isDark ? 'rgba(79,70,229,0.15)' : '#eff6ff',
        chipText: isDark ? '#a5b4fc' : '#2563eb',
        chipBorder: isDark ? 'rgba(79,70,229,0.3)' : '#bfdbfe',
    };

    useEffect(() => {
        if (!user?.uid) return;
        loadData();
    }, [user?.uid]);

    async function loadData() {
        setLoading(true);
        try {
            const period = await getActiveRatingPeriod();
            setActivePeriod(period);

            if (period) {
                const [teacherList, ratings] = await Promise.all([
                    getTeachersForStudent(user.uid).catch(() => []),
                    getStudentRatingsForPeriod(period.id, user.uid).catch(() => []),
                ]);
                setTeachers(teacherList);
                setExistingRatings(ratings);
            }
        } catch (err) {
            console.error('Error loading rating data:', err);
        }
        setLoading(false);
    }

    const ratedKeys = useMemo(() => {
        return new Set(existingRatings.map(r => `${r.teacherId}_${r.groupId || ''}`));
    }, [existingRatings]);

    const spiderData = useMemo(() => {
        return RATING_CRITERIA.filter(c => c.type !== 'boolean').map(c => ({
            label: c.label.length > 12 ? c.label.substring(0, 12) + '…' : c.label,
            value: scores[c.key] || 0,
        }));
    }, [scores]);

    const totalScore = useMemo(() => calculateTotalScore(scores), [scores]);
    const allScoresSet = useMemo(() => RATING_CRITERIA.every(c => {
        if (c.type === 'boolean') return scores[c.key] !== undefined;
        return scores[c.key] > 0;
    }), [scores]);

    function handleSelectTeacher(teacher, groupId) {
        const key = `${teacher.uid}_${groupId || teacher.ratingGroupId || ''}`;
        if (ratedKeys.has(key)) return;
        setSelectedTeacher(teacher);
        setSelectedGroupId(groupId || teacher.ratingGroupId || '');
        setScores({});
        setComment('');
        setSubmitted(false);
        setError('');
    }

    async function handleSubmit() {
        if (!allScoresSet) {
            setError('Vui lòng chấm điểm tất cả tiêu chí');
            return;
        }
        if (!activePeriod || !selectedTeacher) return;

        setSubmitting(true);
        setError('');
        try {
            const createdRatingId = await submitRating({
                periodId: activePeriod.id,
                teacherId: selectedTeacher.uid,
                studentId: user.uid,
                groupId: selectedGroupId || selectedTeacher.commonGroupIds?.[0] || '',
                scores,
                comment,
            });
            setSubmitted(true);
            // Update local state
            const submittedGroupId = selectedGroupId || selectedTeacher.ratingGroupId || '';
            const updatedRatings = [...existingRatings, { id: createdRatingId, teacherId: selectedTeacher.uid, groupId: submittedGroupId }];
            setExistingRatings(updatedRatings);

            // Check if all teachers in the SUBMITTED GROUP are now rated → award per-group streak bonus
            const updatedKeys = new Set(updatedRatings.map(r => `${r.teacherId}_${r.groupId || ''}`));
            const teachersInGroup = teachers.filter(t => t.ratingGroupId === submittedGroupId);
            const groupDone = teachersInGroup.length > 0 && teachersInGroup.every(t => updatedKeys.has(`${t.uid}_${t.ratingGroupId || ''}`));
            if (groupDone && activePeriod?.id) {
                try {
                    const bonusAlreadyAwarded = updatedRatings.some(r =>
                        r.groupId === submittedGroupId && r.streakBonusAwarded
                    );
                    if (!bonusAlreadyAwarded) {
                        let baseDays = 1;
                        if (activePeriod.ratingStartDate && activePeriod.ratingEndDate) {
                            const start = new Date(activePeriod.ratingStartDate + 'T00:00:00');
                            const end = new Date(activePeriod.ratingEndDate + 'T23:59:59');
                            const totalMs = end - start;
                            const elapsed = Date.now() - start;
                            const progress = Math.max(0, Math.min(1, elapsed / totalMs));
                            if (progress <= 1 / 3) baseDays = 3;
                            else if (progress <= 2 / 3) baseDays = 2;
                            else baseDays = 1;
                        }
                        const bonus = baseDays;
                        await awardStreakBonus(user.uid, bonus);
                        if (createdRatingId) {
                            await markRatingStreakBonusAwarded(createdRatingId, bonus, baseDays);
                        }
                        setExistingRatings(prev => prev.map(r =>
                            r.id === createdRatingId
                                ? { ...r, streakBonusAwarded: true, streakBonus: bonus, streakBonusBaseDays: baseDays }
                                : r
                        ));
                        setStreakBonus(prev => prev + bonus);
                    }
                } catch (bonusErr) {
                    console.warn('Could not award streak bonus:', bonusErr);
                }
            }
        } catch (err) {
            setError(err.message || 'Có lỗi xảy ra');
        }
        setSubmitting(false);
    }

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: tc.pageBg }}>
                <div style={{ textAlign: 'center', color: tc.textSecondary }}>
                    <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📝</div>
                    Đang tải...
                </div>
            </div>
        );
    }

    if (!activePeriod) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: tc.pageBg, padding: '24px' }}>
                <div style={{ textAlign: 'center', maxWidth: '400px' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📭</div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: tc.textPrimary, marginBottom: '8px' }}>Chưa đến kỳ đánh giá</h2>
                    <p style={{ fontSize: '0.9rem', color: tc.textSecondary, lineHeight: 1.6, marginBottom: '24px' }}>
                        Hiện tại không có kỳ đánh giá giáo viên nào đang mở. Bạn sẽ nhận thông báo khi có kỳ đánh giá mới.
                    </p>
                    <button
                        onClick={() => navigate('/')}
                        style={{ padding: '12px 28px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}
                    >
                        Về trang chủ
                    </button>
                </div>
            </div>
        );
    }

    // Show success screen after submit
    if (submitted) {
        const allDone = teachers.every(t => ratedKeys.has(`${t.uid}_${t.ratingGroupId || ''}`));
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? tc.pageBg : 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', padding: '24px' }}>
                <div style={{ textAlign: 'center', maxWidth: '400px', animation: 'adminFadeIn 0.4s ease-out' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 8px 32px rgba(34,197,94,0.3)' }}>
                        <CheckCircle size={40} color="white" />
                    </div>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#15803d', marginBottom: '8px' }}>Đã gửi đánh giá!</h2>
                    <p style={{ fontSize: '0.9rem', color: tc.textSecondary, lineHeight: 1.6, marginBottom: streakBonus > 0 ? '12px' : '28px' }}>
                        Cảm ơn bạn đã đánh giá {selectedTeacher?.displayName}. Đánh giá hoàn toàn ẩn danh.
                    </p>
                    {streakBonus > 0 && (
                        <div style={{
                            padding: '14px 20px',
                            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                            borderRadius: '16px',
                            border: '1.5px solid #f59e0b',
                            marginBottom: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            animation: 'adminFadeIn 0.5s ease-out 0.3s both',
                        }}>
                            <Flame size={22} color="#ea580c" />
                            <span style={{ fontWeight: 800, fontSize: '1rem', color: '#92400e' }}>
                                +{streakBonus} ngày streak!
                            </span>
                            <span style={{ fontSize: '0.8rem', color: '#a16207' }}>
                                Phần thưởng hoàn thành đánh giá
                            </span>
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {!allDone && (
                            <button
                                onClick={() => { setSelectedTeacher(null); setSelectedGroupId(''); setSubmitted(false); setScores({}); setComment(''); setStreakBonus(0); }}
                                style={{ padding: '12px 24px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 600, cursor: 'pointer' }}
                            >
                                Đánh giá GV khác
                            </button>
                        )}
                        <button
                            onClick={() => navigate('/')}
                            style={{ padding: '12px 24px', background: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9', color: tc.textSecondary, border: 'none', borderRadius: '14px', fontWeight: 600, cursor: 'pointer' }}
                        >
                            Về trang chủ
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Teacher selection view
    if (!selectedTeacher) {
        const ratingEnd = activePeriod.ratingEndDate ? new Date(activePeriod.ratingEndDate + 'T23:59:59') : null;
        const daysLeft = ratingEnd ? Math.ceil((ratingEnd - new Date()) / (1000 * 60 * 60 * 24)) : null;
        return (
            <div style={{ minHeight: '100vh', background: tc.pageBg, paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
                {/* Header */}
                <div style={{ padding: '24px 20px 32px' }}>
                    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                        <button onClick={() => navigate('/')} style={{ background: tc.hoverBg, border: `1px solid ${tc.border}`, borderRadius: '12px', padding: '8px 16px', color: tc.textSecondary, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', marginBottom: '20px' }}>
                            <ArrowLeft size={16} /> Về trang chủ
                        </button>
                        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 6px', color: tc.textPrimary }}>📝 Đánh giá Giáo viên</h1>
                        <p style={{ fontSize: '0.85rem', color: tc.textMuted, margin: 0 }}>
                            {activePeriod.label} {daysLeft != null && daysLeft >= 0 ? `• Còn ${daysLeft} ngày` : ''}
                        </p>
                    </div>
                </div>

                <div style={{ maxWidth: '600px', margin: '-16px auto 0', padding: '0 16px' }}>
                    {teachers.length === 0 ? (
                        <div style={{ background: tc.cardBg, borderRadius: '20px', padding: '40px 24px', textAlign: 'center', boxShadow: tc.cardShadow }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>👤</div>
                            <p style={{ color: tc.textSecondary, fontSize: '0.9rem' }}>Không tìm thấy giáo viên nào trong nhóm của bạn.</p>
                        </div>
                    ) : (() => {
                        // Group teachers by class (each teacher entry already has ratingGroupId)
                        const groupMap = {};
                        teachers.forEach(t => {
                            const gid = t.ratingGroupId;
                            if (!gid) return;
                            if (!groupMap[gid]) {
                                groupMap[gid] = { groupName: t.ratingGroupName || gid, teachers: [] };
                            }
                            groupMap[gid].teachers.push(t);
                        });
                        const groupEntries = Object.entries(groupMap);
                        const hasMultipleGroups = groupEntries.length > 1;

                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {groupEntries.map(([gid, { groupName, teachers: gTeachers }]) => (
                                    <div key={gid} style={{ background: tc.cardBg, borderRadius: '20px', overflow: 'hidden', boxShadow: tc.cardShadow }}>
                                        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${tc.borderLight}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {hasMultipleGroups && (
                                                <span style={{ padding: '3px 10px', borderRadius: '100px', fontSize: '0.72rem', fontWeight: 700, background: tc.chipBg, color: tc.chipText, border: `1px solid ${tc.chipBorder}` }}>
                                                    {groupName}
                                                </span>
                                            )}
                                            <span style={{ fontSize: '0.82rem', color: tc.textSecondary, fontWeight: 600 }}>
                                                {hasMultipleGroups ? `${gTeachers.length} GV` : `Chọn giáo viên để đánh giá (${gTeachers.length} GV)`}
                                            </span>
                                        </div>
                                        {gTeachers.map((teacher, idx) => {
                                            const isRated = ratedKeys.has(`${teacher.uid}_${teacher.ratingGroupId || ''}`);
                                            return (
                                                <div
                                                    key={`${teacher.uid}_${gid}`}
                                                    onClick={() => handleSelectTeacher(teacher, gid)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '14px',
                                                        padding: '14px 20px',
                                                        borderBottom: idx < gTeachers.length - 1 ? `1px solid ${tc.borderLight}` : 'none',
                                                        cursor: isRated ? 'default' : 'pointer',
                                                        opacity: isRated ? 0.6 : 1,
                                                        transition: 'background 0.15s',
                                                        background: isRated ? tc.hoverBg : 'transparent',
                                                    }}
                                                    onMouseEnter={e => { if (!isRated) e.currentTarget.style.background = tc.hoverBg; }}
                                                    onMouseLeave={e => { if (!isRated) e.currentTarget.style.background = 'transparent'; }}
                                                >
                                                    <Avatar src={teacher.photoURL} alt={teacher.displayName} size={44} />
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontWeight: 700, fontSize: '0.92rem', color: tc.textPrimary }}>{teacher.displayName}</div>
                                                        {!hasMultipleGroups && teacher.groupEntries?.length > 1 && (
                                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '3px' }}>
                                                                {teacher.groupEntries.map(ge => (
                                                                    <span key={ge.groupId} style={{ padding: '1px 8px', borderRadius: '8px', fontSize: '0.68rem', background: tc.hoverBg, color: tc.textSecondary }}>
                                                                        {ge.groupName}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {isRated ? (
                                                        <span style={{ padding: '4px 10px', borderRadius: '100px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                                            <CheckCircle size={13} /> Đã đánh giá
                                                        </span>
                                                    ) : (
                                                        <ChevronRight size={18} color="#cbd5e1" />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        );
                    })()}

                    {/* Info note */}
                    <div style={{ marginTop: '16px', padding: '14px 18px', background: tc.infoBg, borderRadius: '14px', border: `1px solid ${tc.infoBorder}` }}>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: tc.infoText, lineHeight: 1.6 }}>
                            🔒 Đánh giá hoàn toàn <strong>ẩn danh</strong>. Giáo viên và văn phòng chỉ thấy kết quả tổng hợp, không biết ai đánh giá bao nhiêu điểm.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Rating form
    return (
        <div style={{ minHeight: '100vh', background: tc.pageBg, paddingBottom: 'calc(140px + env(safe-area-inset-bottom, 0px))' }}>
            {/* Header */}
            <div style={{ padding: '20px 20px 28px' }}>
                <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                    <button onClick={() => setSelectedTeacher(null)} style={{ background: tc.hoverBg, border: `1px solid ${tc.border}`, borderRadius: '12px', padding: '8px 16px', color: tc.textSecondary, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', marginBottom: '16px' }}>
                        <ArrowLeft size={16} /> Quay lại
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <Avatar src={selectedTeacher.photoURL} alt={selectedTeacher.displayName} size={52} />
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: tc.textPrimary }}>Đánh giá {selectedTeacher.displayName}</h2>
                            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: tc.textMuted }}>{activePeriod.label}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ maxWidth: '600px', margin: '-12px auto 0', padding: '0 16px' }}>
                {/* Criteria Sliders */}
                <div style={{ background: tc.cardBg, borderRadius: '20px', padding: '24px 20px', boxShadow: tc.cardShadow, marginBottom: '16px' }}>
                    <h3 style={{ margin: '0 0 20px', fontSize: '1rem', fontWeight: 700, color: tc.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Star size={20} color="#f59e0b" /> Chấm điểm từng tiêu chí
                    </h3>

                    {RATING_CRITERIA.map(criterion => {
                        const val = scores[criterion.key] || 0;
                        const pct = (val / 10) * 100;

                        // Boolean type: Có / Không toggle
                        if (criterion.type === 'boolean') {
                            const boolVal = scores[criterion.key]; // undefined, 0, or 1
                            return (
                                <div key={criterion.key} style={{ marginBottom: '20px' }}>
                                    <div style={{ marginBottom: '6px' }}>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: tc.textPrimary }}>
                                            {criterion.icon} {criterion.description}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                                        {[{ label: 'Có ✅', value: 1 }, { label: 'Không ❌', value: 0 }].map(opt => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => {
                                                    setScores(prev => ({ ...prev, [criterion.key]: opt.value }));
                                                    setError('');
                                                }}
                                                style={{
                                                    flex: 1, padding: '14px 16px', borderRadius: '14px',
                                                    border: boolVal === opt.value
                                                        ? `2.5px solid ${opt.value === 1 ? '#22c55e' : '#ef4444'}`
                                                        : `2px solid ${tc.border}`,
                                                    background: boolVal === opt.value
                                                        ? (opt.value === 1 ? (isDark ? 'rgba(34,197,94,0.15)' : '#f0fdf4') : (isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2'))
                                                        : tc.cardBg,
                                                    color: boolVal === opt.value
                                                        ? (opt.value === 1 ? '#15803d' : '#dc2626')
                                                        : '#64748b',
                                                    fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                }}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div key={criterion.key} style={{ marginBottom: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <div>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: tc.textPrimary }}>
                                            {criterion.icon} {criterion.label}
                                        </span>
                                    </div>
                                    <span style={{
                                        fontSize: '1rem', fontWeight: 800,
                                        color: val >= 8 ? '#16a34a' : val >= 5 ? '#f59e0b' : val > 0 ? '#ef4444' : '#cbd5e1',
                                        minWidth: '32px', textAlign: 'right',
                                    }}>
                                        {val || '—'}
                                    </span>
                                </div>
                                <p style={{ margin: '0 0 8px', fontSize: '0.78rem', color: tc.textMuted }}>{criterion.description}</p>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="range"
                                        min="0"
                                        max="10"
                                        step="1"
                                        value={val}
                                        onChange={e => {
                                            const v = parseInt(e.target.value);
                                            setScores(prev => ({ ...prev, [criterion.key]: v }));
                                            setError('');
                                        }}
                                        style={{
                                            width: '100%',
                                            appearance: 'none',
                                            height: '8px',
                                            borderRadius: '4px',
                                            background: `linear-gradient(to right, ${val >= 8 ? '#22c55e' : val >= 5 ? '#f59e0b' : '#ef4444'} 0%, ${val >= 8 ? '#22c55e' : val >= 5 ? '#f59e0b' : '#ef4444'} ${pct}%, ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'} ${pct}%, ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'} 100%)`,
                                            outline: 'none',
                                            cursor: 'pointer',
                                        }}
                                    />
                                    {/* Score labels */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                                        {[0, 5, 10].map(n => (
                                            <span key={n} style={{ fontSize: '0.68rem', color: tc.textMuted }}>{n}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Spider Chart Preview */}
                {allScoresSet && (
                    <div style={{ background: tc.cardBg, borderRadius: '20px', padding: '20px', boxShadow: tc.cardShadow, marginBottom: '16px', textAlign: 'center' }}>
                        <h3 style={{ margin: '0 0 8px', fontSize: '0.95rem', fontWeight: 700, color: tc.textPrimary }}>📊 Biểu đồ đánh giá</h3>
                        <SpiderChart data={spiderData} size={260} color="#6366f1" />
                        <div style={{ marginTop: '12px', padding: '10px 16px', background: isDark ? 'rgba(34,197,94,0.1)' : '#f0fdf4', borderRadius: '12px', display: 'inline-block' }}>
                            <span style={{ fontSize: '0.82rem', color: tc.textSecondary }}>Tổng điểm: </span>
                            <span style={{ fontSize: '1.3rem', fontWeight: 800, color: totalScore >= 80 ? '#16a34a' : totalScore >= 60 ? '#f59e0b' : '#ef4444' }}>
                                {totalScore}
                            </span>
                            <span style={{ fontSize: '0.82rem', color: tc.textMuted }}>/100</span>
                        </div>
                    </div>
                )}

                {/* Comment */}
                <div style={{ background: tc.cardBg, borderRadius: '20px', padding: '20px', boxShadow: tc.cardShadow, marginBottom: '16px' }}>
                    <h3 style={{ margin: '0 0 8px', fontSize: '0.95rem', fontWeight: 700, color: tc.textPrimary }}>💬 Nhận xét (tuỳ chọn)</h3>
                    <p style={{ margin: '0 0 12px', fontSize: '0.78rem', color: tc.textMuted }}>
                        Nhận xét sẽ được tổng hợp ẩn danh. GV không biết ai viết.
                    </p>
                    <textarea
                        placeholder="Chia sẻ cảm nhận của bạn về giáo viên..."
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        rows={3}
                        style={{
                            width: '100%', padding: '14px 16px', border: `1.5px solid ${tc.border}`, borderRadius: '14px',
                            fontSize: '0.9rem', resize: 'vertical', outline: 'none', fontFamily: 'inherit',
                            boxSizing: 'border-box', transition: 'border-color 0.2s',
                            background: tc.inputBg, color: tc.textPrimary,
                        }}
                        onFocus={e => e.target.style.borderColor = '#818cf8'}
                        onBlur={e => e.target.style.borderColor = isDark ? 'var(--border-color)' : '#e2e8f0'}
                    />
                </div>

                {/* Error */}
                {error && (
                    <div style={{ padding: '12px 16px', background: '#fef2f2', borderRadius: '14px', border: '1px solid #fecaca', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertCircle size={18} color="#dc2626" />
                        <span style={{ fontSize: '0.85rem', color: '#dc2626' }}>{error}</span>
                    </div>
                )}

                {/* Submit Button */}
                <button
                    onClick={handleSubmit}
                    disabled={!allScoresSet || submitting}
                    style={{
                        width: '100%', padding: '16px', border: 'none', borderRadius: '16px',
                        background: allScoresSet ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : (isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'),
                        color: allScoresSet ? 'white' : '#94a3b8',
                        fontWeight: 700, fontSize: '1rem', cursor: allScoresSet ? 'pointer' : 'not-allowed',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        boxShadow: allScoresSet ? '0 4px 16px rgba(79,70,229,0.3)' : 'none',
                        transition: 'all 0.2s', marginTop: '8px',
                    }}
                >
                    {submitting ? 'Đang gửi...' : (
                        <>
                            <Send size={18} /> Gửi đánh giá ({totalScore}/100 điểm)
                        </>
                    )}
                </button>
            </div>

            {/* Range input custom styles */}
            <style>{`
                input[type="range"]::-webkit-slider-thumb {
                    appearance: none;
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    background: white;
                    border: 3px solid #6366f1;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
                    cursor: pointer;
                    transition: transform 0.15s;
                }
                input[type="range"]::-webkit-slider-thumb:hover {
                    transform: scale(1.2);
                }
                input[type="range"]::-moz-range-thumb {
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    background: white;
                    border: 3px solid #6366f1;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
                    cursor: pointer;
                }
            `}</style>
        </div>
    );
}


