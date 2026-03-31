import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Gamepad2, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getMyGames } from '../../services/miniGameService';

export default function ITDashboardPage() {
    const { user } = useAuth();
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.uid) return;
        setLoading(true);
        getMyGames(user.uid).then(setGames).catch(console.error).finally(() => setLoading(false));
    }, [user?.uid]);

    const stats = {
        total: games.length,
        draft: games.filter(g => g.status === 'draft').length,
        pending: games.filter(g => g.status === 'pending_review').length,
        approved: games.filter(g => g.status === 'approved').length,
        rejected: games.filter(g => g.status === 'rejected').length,
    };

    const recentRejected = games.filter(g => g.status === 'rejected').slice(0, 3);
    const recentPending = games.filter(g => g.status === 'pending_review').slice(0, 3);

    if (loading) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, margin: '0 auto' }}></div>
                <p style={{ color: '#94a3b8', marginTop: '12px' }}>Đang tải...</p>
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
                <div>
                    <h1 className="admin-page-title" style={{ marginBottom: '4px' }}>🖥️ IT Dashboard</h1>
                    <p className="admin-page-subtitle">Quản lý và phát triển Mini Games cho hệ thống SPerStudy</p>
                </div>
                <Link to="/it/games" className="it-game-btn primary" style={{ textDecoration: 'none', padding: '10px 20px', borderRadius: '12px' }}>
                    <Plus size={18} /> Tạo game mới
                </Link>
            </div>

            {/* Stats */}
            <div className="it-stats-grid">
                <div className="it-stat-card">
                    <div className="it-stat-icon" style={{ background: '#ede9fe' }}>🎮</div>
                    <div>
                        <div className="it-stat-value">{stats.total}</div>
                        <div className="it-stat-label">Tổng game</div>
                    </div>
                </div>
                <div className="it-stat-card">
                    <div className="it-stat-icon" style={{ background: '#f1f5f9' }}>📝</div>
                    <div>
                        <div className="it-stat-value">{stats.draft}</div>
                        <div className="it-stat-label">Bản nháp</div>
                    </div>
                </div>
                <div className="it-stat-card">
                    <div className="it-stat-icon" style={{ background: '#fef3c7' }}>⏳</div>
                    <div>
                        <div className="it-stat-value">{stats.pending}</div>
                        <div className="it-stat-label">Chờ duyệt</div>
                    </div>
                </div>
                <div className="it-stat-card">
                    <div className="it-stat-icon" style={{ background: '#dcfce7' }}>✅</div>
                    <div>
                        <div className="it-stat-value">{stats.approved}</div>
                        <div className="it-stat-label">Đã duyệt</div>
                    </div>
                </div>
                <div className="it-stat-card">
                    <div className="it-stat-icon" style={{ background: '#fee2e2' }}>❌</div>
                    <div>
                        <div className="it-stat-value">{stats.rejected}</div>
                        <div className="it-stat-label">Bị từ chối</div>
                    </div>
                </div>
            </div>

            {/* Rejected - needs attention */}
            {recentRejected.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#dc2626', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        ⚠️ Cần sửa lại ({stats.rejected})
                    </h3>
                    {recentRejected.map(game => (
                        <div key={game.id} style={{ background: '#fff', border: '1.5px solid #fecaca', borderRadius: '12px', padding: '14px 16px', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ fontWeight: 700, color: '#1e293b' }}>{game.name}</span>
                                <span className="game-status-badge rejected">Bị từ chối</span>
                            </div>
                            {game.reviewNote && (
                                <div className="it-game-reject-note">
                                    <strong>Ghi chú từ Admin:</strong>
                                    {game.reviewNote}
                                </div>
                            )}
                        </div>
                    ))}
                    <Link to="/it/games?tab=rejected" style={{ fontSize: '0.82rem', color: '#4f46e5', fontWeight: 600 }}>Xem tất cả →</Link>
                </div>
            )}

            {/* Pending */}
            {recentPending.length > 0 && (
                <div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#b45309', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        ⏳ Đang chờ duyệt ({stats.pending})
                    </h3>
                    {recentPending.map(game => (
                        <div key={game.id} style={{ background: '#fff', border: '1.5px solid #fde68a', borderRadius: '12px', padding: '14px 16px', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 700, color: '#1e293b' }}>{game.name}</span>
                                <span className="game-status-badge pending_review">Chờ duyệt</span>
                            </div>
                            <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '4px' }}>{game.description}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty state */}
            {stats.total === 0 && (
                <div className="it-empty-state">
                    <div className="it-empty-state-icon">🎮</div>
                    <h3>Chưa có game nào</h3>
                    <p>Bắt đầu tạo mini game đầu tiên cho giáo viên sử dụng!</p>
                    <Link to="/it/games" className="it-game-btn primary" style={{ textDecoration: 'none', display: 'inline-flex', marginTop: '16px', padding: '10px 24px', borderRadius: '12px' }}>
                        <Plus size={18} /> Tạo game mới
                    </Link>
                </div>
            )}
        </div>
    );
}
