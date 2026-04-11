import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    Clock3,
    FilePenLine,
    Gamepad2,
    Layers3,
    Plus,
    Sparkles
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getMyGames } from '../../services/miniGameService';

const STAT_CARDS = [
    {
        key: 'total',
        label: 'Tổng game',
        tone: 'primary',
        icon: Layers3,
        helper: 'Tất cả mini game bạn đang quản lý'
    },
    {
        key: 'draft',
        label: 'Bản nháp',
        tone: 'neutral',
        icon: FilePenLine,
        helper: 'Cần hoàn thiện trước khi gửi duyệt'
    },
    {
        key: 'pending',
        label: 'Chờ duyệt',
        tone: 'warning',
        icon: Clock3,
        helper: 'Đã gửi admin và đang đợi phản hồi'
    },
    {
        key: 'approved',
        label: 'Đã duyệt',
        tone: 'success',
        icon: CheckCircle2,
        helper: 'Sẵn sàng để giáo viên sử dụng'
    },
    {
        key: 'rejected',
        label: 'Cần sửa',
        tone: 'danger',
        icon: AlertTriangle,
        helper: 'Ưu tiên xử lý theo góp ý từ admin'
    }
];

const WORKFLOW_STEPS = [
    'Tạo game và upload file HTML hoặc ZIP dist.',
    'Preview để kiểm tra dữ liệu vocab/grammar trước khi nộp.',
    'Nộp duyệt, theo dõi phản hồi và chỉnh lại nếu cần.'
];

export default function ITDashboardPage() {
    const { user } = useAuth();
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.uid) return;
        setLoading(true);
        getMyGames(user.uid)
            .then(setGames)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [user?.uid]);

    const stats = {
        total: games.length,
        draft: games.filter(game => game.status === 'draft').length,
        pending: games.filter(game => game.status === 'pending_review').length,
        approved: games.filter(game => game.status === 'approved').length,
        rejected: games.filter(game => game.status === 'rejected').length
    };

    const recentRejected = games.filter(game => game.status === 'rejected').slice(0, 3);
    const recentPending = games.filter(game => game.status === 'pending_review').slice(0, 3);

    if (loading) {
        return (
            <div className="it-page it-page-loading">
                <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }}></div>
                <p className="it-loading-copy">Đang tải dashboard mini game...</p>
            </div>
        );
    }

    return (
        <div className="admin-page it-page it-dashboard-page">
            <section className="it-hero-card">
                <div className="it-hero-content">
                    <span className="it-hero-kicker">Mini Game Studio</span>
                    <h1 className="it-hero-title">
                        <Gamepad2 size={26} />
                        Bảng điều khiển IT
                    </h1>
                    <p className="it-hero-subtitle">
                        Quản lý toàn bộ mini game, theo dõi trạng thái duyệt và giữ trải nghiệm giáo viên gọn gàng, ổn định.
                    </p>

                    <div className="it-hero-pills">
                        <span className="it-hero-pill">
                            <Sparkles size={14} />
                            {stats.total > 0 ? `${stats.total} game đang hoạt động trong studio` : 'Sẵn sàng tạo mini game đầu tiên'}
                        </span>
                        <span className="it-hero-pill subtle">
                            {stats.rejected > 0 ? `${stats.rejected} game cần chỉnh` : 'Không có game bị trả về'}
                        </span>
                        <span className="it-hero-pill subtle">
                            {stats.pending > 0 ? `${stats.pending} game đang chờ admin` : 'Chưa có game đang chờ duyệt'}
                        </span>
                    </div>
                </div>

                <div className="it-hero-actions">
                    <Link to="/it/games" className="it-game-btn primary">
                        <Plus size={18} />
                        Tạo game mới
                    </Link>
                    <Link to="/it/games" className="it-game-btn secondary">
                        Quản lý thư viện
                        <ArrowRight size={16} />
                    </Link>
                </div>
            </section>

            <section className="it-stats-grid">
                {STAT_CARDS.map(({ key, label, tone, icon: Icon, helper }) => (
                    <article key={key} className={`it-stat-card tone-${tone}`}>
                        <div className="it-stat-icon">
                            <Icon size={20} />
                        </div>
                        <div className="it-stat-content">
                            <div className="it-stat-value">{stats[key]}</div>
                            <div className="it-stat-label">{label}</div>
                            <div className="it-stat-helper">{helper}</div>
                        </div>
                    </article>
                ))}
            </section>

            {stats.total === 0 ? (
                <section className="it-empty-state it-empty-state-panel">
                    <div className="it-empty-state-icon">🎮</div>
                    <h3>Kho mini game của bạn vẫn đang trống</h3>
                    <p>Bắt đầu bằng một game nhỏ, preview ngay trong hệ thống rồi nộp admin duyệt khi đã ổn.</p>
                    <Link to="/it/games" className="it-game-btn primary">
                        <Plus size={18} />
                        Tạo game đầu tiên
                    </Link>
                </section>
            ) : (
                <section className="it-section-grid">
                    <article className="it-section-card">
                        <div className="it-section-header">
                            <div className="it-section-title-group">
                                <span className="it-section-kicker danger">Ưu tiên xử lý</span>
                                <h2 className="it-section-title">Game cần chỉnh sửa</h2>
                                <p className="it-section-description">Những game bị từ chối gần đây và cần bạn xem lại ghi chú từ admin.</p>
                            </div>
                            <Link to="/it/games?tab=rejected" className="it-section-link">
                                Xem tất cả
                                <ArrowRight size={14} />
                            </Link>
                        </div>

                        {recentRejected.length > 0 ? (
                            <div className="it-dashboard-list">
                                {recentRejected.map(game => (
                                    <div key={game.id} className="it-dashboard-list-item tone-danger">
                                        <div className="it-dashboard-list-icon">
                                            <AlertTriangle size={16} />
                                        </div>
                                        <div className="it-dashboard-list-body">
                                            <div className="it-dashboard-list-title-row">
                                                <span className="it-dashboard-list-title">{game.name}</span>
                                                <span className="game-status-badge rejected">Bị từ chối</span>
                                            </div>
                                            {game.reviewNote ? (
                                                <div className="it-game-reject-note compact">
                                                    <strong>Ghi chú từ Admin</strong>
                                                    {game.reviewNote}
                                                </div>
                                            ) : (
                                                <p className="it-dashboard-list-copy">Kiểm tra lại cấu hình hoặc UX của game trước khi nộp lại.</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="it-section-empty">
                                Không có game nào bị trả về. Luồng phát triển đang khá sạch.
                            </div>
                        )}
                    </article>

                    <article className="it-section-card">
                        <div className="it-section-header">
                            <div className="it-section-title-group">
                                <span className="it-section-kicker warning">Theo dõi tiến độ</span>
                                <h2 className="it-section-title">Game đang chờ duyệt</h2>
                                <p className="it-section-description">Các game mới nhất đã gửi admin và đang đợi phản hồi.</p>
                            </div>
                            <Link to="/it/games?tab=pending_review" className="it-section-link">
                                Mở danh sách
                                <ArrowRight size={14} />
                            </Link>
                        </div>

                        {recentPending.length > 0 ? (
                            <div className="it-dashboard-list">
                                {recentPending.map(game => (
                                    <div key={game.id} className="it-dashboard-list-item tone-warning">
                                        <div className="it-dashboard-list-icon">
                                            <Clock3 size={16} />
                                        </div>
                                        <div className="it-dashboard-list-body">
                                            <div className="it-dashboard-list-title-row">
                                                <span className="it-dashboard-list-title">{game.name}</span>
                                                <span className="game-status-badge pending_review">Chờ duyệt</span>
                                            </div>
                                            <p className="it-dashboard-list-copy">{game.description || 'Chưa có mô tả cho game này.'}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="it-section-empty">
                                Hiện chưa có game nào đang chờ duyệt. Bạn có thể hoàn thiện bản nháp tiếp theo.
                            </div>
                        )}
                    </article>
                </section>
            )}

            <section className="it-section-card it-workflow-card">
                <div className="it-section-header">
                    <div className="it-section-title-group">
                        <span className="it-section-kicker success">Quy trình gọn</span>
                        <h2 className="it-section-title">Nhịp làm việc đề xuất</h2>
                        <p className="it-section-description">Một flow ngắn để IT không bị trôi giữa bản nháp, preview và feedback.</p>
                    </div>
                </div>

                <div className="it-workflow-grid">
                    {WORKFLOW_STEPS.map((step, index) => (
                        <div key={step} className="it-workflow-step">
                            <div className="it-workflow-index">{index + 1}</div>
                            <p>{step}</p>
                        </div>
                    ))}
                </div>

                <div className="it-workflow-summary">
                    <div className="it-workflow-summary-item">
                        <span className="label">Nháp</span>
                        <strong>{stats.draft}</strong>
                    </div>
                    <div className="it-workflow-summary-item">
                        <span className="label">Chờ duyệt</span>
                        <strong>{stats.pending}</strong>
                    </div>
                    <div className="it-workflow-summary-item">
                        <span className="label">Đã duyệt</span>
                        <strong>{stats.approved}</strong>
                    </div>
                </div>
            </section>
        </div>
    );
}
