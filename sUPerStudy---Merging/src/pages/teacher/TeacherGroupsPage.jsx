import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getTeacherGroups, getStudentsInGroup } from '../../services/teacherService';
import { getActiveReportPeriod, getGroupReportStatus, computePeriodStatus } from '../../services/reportPeriodService';
import { Layers, Users, ChevronRight, ClipboardList, CheckCircle, AlertTriangle } from 'lucide-react';

export default function TeacherGroupsPage() {
    const { user } = useAuth();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Report period
    const [activePeriod, setActivePeriod] = useState(null);
    const [groupReportStats, setGroupReportStats] = useState({}); // { [groupId]: { sent, total } }

    useEffect(() => {
        loadGroups();
    }, [user]);

    async function loadGroups() {
        if (!user?.groupIds || user.groupIds.length === 0) {
            setGroups([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const data = await getTeacherGroups(user.groupIds);
            setGroups(data);

            // Load report period + per-group stats
            const period = await getActiveReportPeriod();
            setActivePeriod(period);
            if (period && data.length > 0) {
                const statsMap = {};
                await Promise.all(data.map(async (group) => {
                    try {
                        const [students, reportStatus] = await Promise.all([
                            getStudentsInGroup(group.id),
                            getGroupReportStatus(group.id, period.startDate, period.endDate, period.id)
                        ]);
                        statsMap[group.id] = {
                            sent: reportStatus.sentStudentIds.size,
                            late: reportStatus.lateStudentIds.size,
                            total: students.length
                        };
                    } catch (e) {
                        console.warn('Error loading report stats for group', group.id, e);
                    }
                }));
                setGroupReportStats(statsMap);
            }
        } catch (err) {
            console.error(err);
            setError('Lỗi tải danh sách lớp học.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="admin-page">


            {error && (
                <div className="admin-alert error">
                    {error}
                </div>
            )}

            <div className="admin-card">
                {loading ? (
                    <div className="admin-empty-state">Đang tải dữ liệu...</div>
                ) : groups.length === 0 ? (
                    <div className="admin-empty-state">
                        <div className="admin-empty-icon"><Layers size={28} /></div>
                        <h3>Chưa được phân công</h3>
                        <p>Bạn hiện chưa được phân công quản lý lớp học (Group) nào. Vui lòng liên hệ Admin.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                        {groups.map(group => {
                            const stats = groupReportStats[group.id];
                            const periodStatus = activePeriod ? computePeriodStatus(activePeriod) : null;
                            const missing = stats ? stats.total - stats.sent : 0;

                            return (
                                <Link key={group.id} to={`/teacher/groups/${group.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                    <div style={{
                                        background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column',
                                        transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)', cursor: 'pointer',
                                        height: '100%',
                                    }}
                                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = 'var(--color-primary-light)' }}
                                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#e2e8f0' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                                            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Users size={24} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', color: '#0f172a', fontWeight: 700 }}>{group.name}</h3>
                                                <span style={{ fontSize: '0.8rem', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>ID: {group.id}</span>
                                            </div>
                                        </div>
                                        <p style={{ margin: '0 0 16px 0', fontSize: '0.95rem', color: '#475569', flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            {group.description || 'Không có mô tả'}
                                        </p>

                                        {/* Report period stats */}
                                        {activePeriod && stats && (
                                            <div style={{
                                                padding: '10px 14px', borderRadius: '12px', marginBottom: '16px',
                                                background: missing > 0 ? (periodStatus === 'grace' ? '#fef2f2' : '#eff6ff') : '#f0fdf4',
                                                border: `1px solid ${missing > 0 ? (periodStatus === 'grace' ? '#fecaca' : '#bfdbfe') : '#bbf7d0'}`
                                            }}>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <ClipboardList size={12} /> {activePeriod.label || 'Kỳ báo cáo'}
                                                </div>
                                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem', fontWeight: 700, color: '#16a34a' }}>
                                                        <CheckCircle size={14} /> {stats.sent}/{stats.total} đã gửi
                                                    </span>
                                                    {missing > 0 && (
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                            fontSize: '0.82rem', fontWeight: 700,
                                                            color: periodStatus === 'grace' ? '#dc2626' : '#2563eb'
                                                        }}>
                                                            <AlertTriangle size={14} /> {missing} chưa gửi
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                                            <span style={{ fontSize: '0.9rem', color: 'var(--color-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                Xem danh sách học viên <ChevronRight size={16} />
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
