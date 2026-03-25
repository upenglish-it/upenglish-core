import { useState, useEffect } from 'react';
import { Gamepad2, Play, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getApprovedGames } from '../../services/miniGameService';
import { getTeacherTopics, getTeacherTopicWords } from '../../services/teacherService';
import GameLauncher from '../../components/games/GameLauncher';

const DATA_TYPE_LABELS = {
    vocabulary: '📚 Từ vựng',
    grammar: '📝 Ngữ pháp',
    both: '📚📝 Cả hai'
};

export default function TeacherMiniGamesPage() {
    const { user } = useAuth();
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Data selector state
    const [selectedGame, setSelectedGame] = useState(null);
    const [showDataSelector, setShowDataSelector] = useState(false);
    const [topics, setTopics] = useState([]);
    const [topicsLoading, setTopicsLoading] = useState(false);
    const [selectedTopicId, setSelectedTopicId] = useState(null);
    const [topicSearch, setTopicSearch] = useState('');

    // Game launcher state
    const [launcherGame, setLauncherGame] = useState(null);
    const [launcherData, setLauncherData] = useState(null);

    useEffect(() => {
        setLoading(true);
        getApprovedGames().then(setGames).catch(console.error).finally(() => setLoading(false));
    }, []);

    const filteredGames = games.filter(g => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (g.name || '').toLowerCase().includes(q) || (g.description || '').toLowerCase().includes(q);
    });

    // When teacher clicks a game → open data selector
    const handleSelectGame = async (game) => {
        setSelectedGame(game);
        setShowDataSelector(true);
        setSelectedTopicId(null);
        setTopicSearch('');

        // Load teacher topics
        if (user?.uid) {
            setTopicsLoading(true);
            try {
                const t = await getTeacherTopics(user.uid);
                setTopics(t);
            } catch (e) {
                console.error('Error loading topics:', e);
            } finally {
                setTopicsLoading(false);
            }
        }
    };

    const filteredTopics = topics.filter(t => {
        if (!topicSearch) return true;
        return (t.name || '').toLowerCase().includes(topicSearch.toLowerCase());
    });

    // When teacher selects a topic → fetch words and launch game
    const handleSelectTopic = async (topicId) => {
        setSelectedTopicId(topicId);
        try {
            const words = await getTeacherTopicWords(topicId);
            if (!words || words.length === 0) {
                alert('Bài học này chưa có từ vựng nào. Vui lòng chọn bài khác.');
                setSelectedTopicId(null);
                return;
            }

            // Check min words
            if (selectedGame.minWords && words.length < selectedGame.minWords) {
                alert(`Game này cần ít nhất ${selectedGame.minWords} từ. Bài học bạn chọn chỉ có ${words.length} từ.`);
                setSelectedTopicId(null);
                return;
            }

            // Format data for game
            const gameData = {
                dataType: selectedGame.dataType || 'vocabulary',
                words: words.map(w => ({
                    word: w.word,
                    meaning: w.meaning,
                    phonetic: w.phonetic || undefined,
                    example: w.example || undefined,
                    imageUrl: w.imageUrl || undefined,
                    wordType: w.wordType || undefined
                }))
            };

            // Limit to maxWords if set
            if (selectedGame.maxWords && gameData.words.length > selectedGame.maxWords) {
                // Shuffle and take maxWords
                const shuffled = [...gameData.words].sort(() => Math.random() - 0.5);
                gameData.words = shuffled.slice(0, selectedGame.maxWords);
            }

            setLauncherGame(selectedGame);
            setLauncherData(gameData);
            setShowDataSelector(false);
        } catch (e) {
            console.error('Error loading topic words:', e);
            alert('Lỗi khi tải từ vựng.');
            setSelectedTopicId(null);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, margin: '0 auto' }}></div>
            </div>
        );
    }

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <div>
                    <h1 className="admin-page-title" style={{ margin: 0 }}>🎮 Mini Games</h1>
                    <p className="admin-page-subtitle">Chọn game và bài học để học viên chơi trên lớp</p>
                </div>
            </div>

            {/* Search */}
            <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
                <div style={{ position: 'relative', maxWidth: '400px', flex: '1 1 300px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input type="text" placeholder="Tìm game..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.88rem', outline: 'none' }} />
                </div>
            </div>

            {/* Games grid */}
            {filteredGames.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 20px', color: '#94a3b8' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎮</div>
                    <h3 style={{ fontSize: '1.1rem', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>Chưa có game nào</h3>
                    <p style={{ fontSize: '0.85rem' }}>Bộ phận IT đang phát triển các mini games. Hãy kiểm tra lại sau!</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                    {filteredGames.map(game => (
                        <div key={game.id} style={{ background: '#fff', borderRadius: '16px', border: '1.5px solid #e2e8f0', overflow: 'hidden', transition: 'all 0.2s', cursor: 'pointer' }} onClick={() => handleSelectGame(game)}>
                            <div style={{ width: '100%', height: '140px', background: 'linear-gradient(135deg, #e0e7ff, #c7d2fe)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem' }}>
                                {game.thumbnail ? <img src={game.thumbnail} alt={game.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🎮'}
                            </div>
                            <div style={{ padding: '14px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                    <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>{game.name}</span>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: '#f0fdf4', color: '#16a34a' }}>
                                        {DATA_TYPE_LABELS[game.dataType]}
                                    </span>
                                </div>
                                <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.45, marginBottom: '12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {game.description || 'Chưa có mô tả'}
                                </p>
                                <button style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #4f46e5, #6366f1)', color: '#fff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s' }} onClick={(e) => { e.stopPropagation(); handleSelectGame(game); }}>
                                    <Play size={16} /> Chơi game
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Data Selector Modal */}
            {showDataSelector && selectedGame && (
                <div className="teacher-modal-overlay" onClick={() => setShowDataSelector(false)}>
                    <div className="teacher-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '95%' }}>
                        <div className="teacher-modal-header">
                            <h3 className="teacher-modal-title">
                                <Gamepad2 size={22} color="#4f46e5" /> {selectedGame.name}
                            </h3>
                            <button className="teacher-modal-close" onClick={() => setShowDataSelector(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
                        </div>

                        <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '16px' }}>
                            Chọn bài học từ vựng để sử dụng trong game:
                        </p>

                        {/* Search topics */}
                        <div style={{ position: 'relative', marginBottom: '12px' }}>
                            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input type="text" placeholder="Tìm bài học..." value={topicSearch} onChange={e => setTopicSearch(e.target.value)} style={{ width: '100%', padding: '9px 12px 9px 36px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.85rem', outline: 'none' }} />
                        </div>

                        {topicsLoading ? (
                            <div style={{ textAlign: 'center', padding: '24px' }}>
                                <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3, margin: '0 auto' }}></div>
                            </div>
                        ) : filteredTopics.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                                <p>Chưa có bài học nào. Hãy tạo bài học trong mục "Bài học từ vựng".</p>
                            </div>
                        ) : (
                            <div style={{ maxHeight: '350px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {filteredTopics.map(topic => (
                                    <button key={topic.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '12px', border: `1.5px solid ${selectedTopicId === topic.id ? '#4f46e5' : '#e2e8f0'}`, background: selectedTopicId === topic.id ? '#ede9fe' : '#fff', cursor: selectedTopicId === topic.id ? 'wait' : 'pointer', textAlign: 'left', transition: 'all 0.2s', width: '100%', fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }} onClick={() => handleSelectTopic(topic.id)} disabled={selectedTopicId === topic.id}>
                                        <span>📚 {topic.name}</span>
                                        {selectedTopicId === topic.id && (
                                            <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Game Launcher */}
            {launcherGame && launcherData && (
                <GameLauncher
                    gameUrl={launcherGame.gameUrl}
                    gameName={launcherGame.name}
                    gameData={launcherData}
                    onClose={() => { setLauncherGame(null); setLauncherData(null); }}
                    onComplete={(summary) => console.log('Game complete:', summary)}
                />
            )}
        </div>
    );
}
