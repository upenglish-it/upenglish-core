import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, ChevronRight, Gamepad2, Play, Search, Shapes } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getAdminTopicWords, getAdminTopics, getFolders, getGrammarFolders } from '../../services/adminService';
import { getApprovedGames } from '../../services/miniGameService';
import {
    getCollaboratedResources,
    getSharedAndPublicTeacherTopicFolders,
    getSharedAndPublicTeacherTopics,
    getTeacherTopicFolders,
    getTeacherTopics,
    getTeacherTopicWords
} from '../../services/teacherService';
import {
    getGrammarExercises,
    getGrammarQuestions,
    getSharedAndPublicTeacherGrammarFolders,
    getTeacherGrammarFolders
} from '../../services/grammarService';
import GameLauncher from '../../components/games/GameLauncher';
import {
    buildMiniGameGrammarPayload,
    buildMiniGameVocabularyPayload,
    getMiniGameDefaultSource,
    getMiniGameLaunchUrl,
    getMiniGameMinItems,
    normalizeMiniGameWords
} from '../../services/miniGameRuntime';

const DATA_TYPE_LABELS = {
    vocabulary: '📚 Từ vựng',
    grammar: '📝 Ngữ pháp',
    both: '📚📝 Cả hai'
};

const SOURCE_META = {
    vocabulary: { icon: '📚', label: 'bài học từ vựng', empty: 'Chưa có bài học nào. Hãy tạo bài học trong mục "Bài học từ vựng".' },
    grammar: { icon: '📝', label: 'bài kỹ năng', empty: 'Chưa có bài kỹ năng nào. Hãy tạo bài trong mục "Kỹ năng".' }
};

const FOLDER_PANEL_TRANSITION_MS = 260;

function getCountLabel(sourceType) {
    return sourceType === 'grammar' ? 'câu' : 'mục';
}

function enforceItemLimits(game, items, sourceType) {
    const minItems = getMiniGameMinItems(game);
    const countLabel = getCountLabel(sourceType);

    if (minItems && items.length < minItems) {
        throw new Error(`Game này cần ít nhất ${minItems} ${countLabel}. Nguồn bạn chọn chỉ có ${items.length} ${countLabel}.`);
    }

    return items;
}

function uniqueIds(values = []) {
    return [...new Set((values || []).filter(Boolean))];
}

function getCreatedAtMs(resource) {
    if (resource?.createdAt?.toMillis) return resource.createdAt.toMillis();
    if (resource?.createdAt?.seconds) return resource.createdAt.seconds * 1000;
    const parsed = resource?.createdAt ? new Date(resource.createdAt).getTime() : 0;
    return Number.isNaN(parsed) ? 0 : parsed;
}

function sortByCreatedAtDesc(resources = []) {
    return [...resources].sort((a, b) => getCreatedAtMs(b) - getCreatedAtMs(a));
}

function getResourceKey(resource, fallbackSource = 'resource') {
    return `${resource?.source || fallbackSource}:${resource?.id || ''}`;
}

function getFolderKey(folder, fallbackSource = 'folder') {
    return `${folder?.folderSource || fallbackSource}:${folder?.id || ''}`;
}

function getUngroupedSectionKey(sourceType) {
    return `ungrouped:${sourceType}`;
}

function normalizeFolderRecord(folder, itemIdsField, folderSource, itemSource = folderSource) {
    return {
        ...folder,
        folderSource,
        itemResourceKeys: uniqueIds(folder?.[itemIdsField] || []).map(id => getResourceKey({ id, source: itemSource }))
    };
}

function buildFolderSections(resources = [], folders = [], search = '', sourceType = 'resource') {
    const query = search.trim().toLowerCase();
    const resourceMap = new Map(resources.map(resource => [resource.resourceKey || getResourceKey(resource, sourceType), resource]));
    const groupedResourceKeys = new Set();

    const sections = folders.map(folder => {
        const folderResources = (folder.itemResourceKeys || [])
            .map(itemKey => resourceMap.get(itemKey))
            .filter(Boolean);

        folderResources.forEach(resource => groupedResourceKeys.add(resource.resourceKey || getResourceKey(resource, sourceType)));

        const folderMatches = !query || (folder.name || '').toLowerCase().includes(query);
        const visibleResources = folderMatches
            ? folderResources
            : folderResources.filter(resource => (resource.name || '').toLowerCase().includes(query));

        if (visibleResources.length === 0) return null;

        return {
            ...folder,
            resources: visibleResources,
            sectionKey: getFolderKey(folder)
        };
    }).filter(Boolean);

    const ungroupedResources = resources.filter(resource => (
        !groupedResourceKeys.has(resource.resourceKey || getResourceKey(resource, sourceType)) &&
        (!query || (resource.name || '').toLowerCase().includes(query))
    ));

    if (ungroupedResources.length > 0) {
        sections.push({
            id: '__ungrouped__',
            name: 'Chưa vào folder',
            icon: '🗂️',
            color: '#94a3b8',
            resources: ungroupedResources,
            isUngrouped: true,
            sectionKey: getUngroupedSectionKey(sourceType)
        });
    }

    return sections;
}

export default function TeacherMiniGamesPage() {
    const { user } = useAuth();
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const [selectedGame, setSelectedGame] = useState(null);
    const [showDataSelector, setShowDataSelector] = useState(false);
    const [topics, setTopics] = useState([]);
    const [topicFolders, setTopicFolders] = useState([]);
    const [topicsLoading, setTopicsLoading] = useState(false);
    const [grammarExercises, setGrammarExercises] = useState([]);
    const [grammarFolders, setGrammarFolders] = useState([]);
    const [grammarLoading, setGrammarLoading] = useState(false);
    const [selectedResourceKey, setSelectedResourceKey] = useState(null);
    const [currentFolderSectionKey, setCurrentFolderSectionKey] = useState(null);
    const [isFolderDetailVisible, setIsFolderDetailVisible] = useState(false);
    const [resourceSearch, setResourceSearch] = useState('');
    const [selectedSource, setSelectedSource] = useState('vocabulary');

    const [launcherGame, setLauncherGame] = useState(null);
    const [launcherData, setLauncherData] = useState(null);
    const [toast, setToast] = useState(null);
    const folderTransitionTimeoutRef = useRef(null);
    const folderTransitionFrameRef = useRef(null);

    useEffect(() => {
        getApprovedGames().then(setGames).catch(console.error).finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!toast) return;
        const timeoutId = window.setTimeout(() => setToast(null), 4000);
        return () => window.clearTimeout(timeoutId);
    }, [toast]);

    useEffect(() => {
        return () => {
            if (folderTransitionTimeoutRef.current) {
                window.clearTimeout(folderTransitionTimeoutRef.current);
            }
            if (folderTransitionFrameRef.current) {
                window.cancelAnimationFrame(folderTransitionFrameRef.current);
            }
        };
    }, []);

    const showToast = (message, type = 'error') => {
        setToast({ message, type });
    };

    const filteredGames = games.filter(game => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (game.name || '').toLowerCase().includes(q) || (game.description || '').toLowerCase().includes(q);
    });

    const clearFolderTransitionHandles = () => {
        if (folderTransitionTimeoutRef.current) {
            window.clearTimeout(folderTransitionTimeoutRef.current);
            folderTransitionTimeoutRef.current = null;
        }
        if (folderTransitionFrameRef.current) {
            window.cancelAnimationFrame(folderTransitionFrameRef.current);
            folderTransitionFrameRef.current = null;
        }
    };

    const resetFolderNavigation = () => {
        clearFolderTransitionHandles();
        setIsFolderDetailVisible(false);
        setCurrentFolderSectionKey(null);
    };

    const openFolderSection = (sectionKey) => {
        clearFolderTransitionHandles();
        setCurrentFolderSectionKey(sectionKey);
        folderTransitionFrameRef.current = window.requestAnimationFrame(() => {
            setIsFolderDetailVisible(true);
            folderTransitionFrameRef.current = null;
        });
    };

    const closeFolderSection = () => {
        clearFolderTransitionHandles();
        setIsFolderDetailVisible(false);
        folderTransitionTimeoutRef.current = window.setTimeout(() => {
            setCurrentFolderSectionKey(null);
            folderTransitionTimeoutRef.current = null;
        }, FOLDER_PANEL_TRANSITION_MS);
    };

    const loadAccessibleVocabularyData = async () => {
        if (!user?.uid) {
            return { topics: [], folders: [] };
        }

        const topicAccessIds = uniqueIds(user.mergedTopicAccess || user.topicAccess || []);
        const folderAccessIds = uniqueIds(user.mergedFolderAccess || user.folderAccess || []);

        const [ownTopics, collaboratedTopics, ownTeacherFolders, teacherSharedFolders, adminTopics, adminFolders] = await Promise.all([
            getTeacherTopics(user.uid),
            getCollaboratedResources('teacher_topics', user.uid),
            getTeacherTopicFolders(user.uid),
            getSharedAndPublicTeacherTopicFolders(folderAccessIds),
            getAdminTopics(),
            getFolders()
        ]);

        const teacherFolderTopicIds = uniqueIds(teacherSharedFolders.flatMap(folder => folder.topicIds || []));
        const sharedTeacherTopics = await getSharedAndPublicTeacherTopics(uniqueIds([
            ...topicAccessIds,
            ...teacherFolderTopicIds
        ]));

        const accessibleAdminFolderTopicIds = new Set(
            uniqueIds(
                adminFolders
                    .filter(folder => (
                        folder.isPublic ||
                        folder.teacherVisible ||
                        (folder.sharedWithTeacherIds && folder.sharedWithTeacherIds.includes(user.uid)) ||
                        folderAccessIds.includes(folder.id)
                    ))
                    .flatMap(folder => folder.topicIds || [])
            )
        );

        const topicMap = new Map();
        const teacherFolderMap = new Map();
        const addTopic = (topic, source) => {
            if (!topic?.id) return;
            const resourceKey = getResourceKey({ id: topic.id, source });
            topicMap.set(resourceKey, { ...topic, source, resourceKey });
        };
        const addTeacherFolder = (folder) => {
            if (!folder?.id) return;
            teacherFolderMap.set(folder.id, normalizeFolderRecord(folder, 'topicIds', 'teacher', 'teacher'));
        };

        ownTopics.forEach(topic => addTopic(topic, 'teacher'));
        collaboratedTopics.forEach(topic => {
            if (!topic?.isDeleted) addTopic(topic, 'teacher');
        });
        sharedTeacherTopics.forEach(topic => addTopic(topic, 'teacher'));
        ownTeacherFolders.forEach(addTeacherFolder);
        teacherSharedFolders.forEach(addTeacherFolder);

        adminTopics.forEach(topic => {
            const isAccessible = (
                topic.isPublic === true ||
                topic.teacherVisible === true ||
                (topic.sharedWithTeacherIds && topic.sharedWithTeacherIds.includes(user.uid)) ||
                topicAccessIds.includes(topic.id) ||
                accessibleAdminFolderTopicIds.has(topic.id)
            );

            if (isAccessible) {
                addTopic(topic, 'official');
            }
        });

        const visibleAdminFolders = adminFolders
            .filter(folder => (
                folder.isPublic ||
                folder.teacherVisible ||
                (folder.sharedWithTeacherIds && folder.sharedWithTeacherIds.includes(user.uid)) ||
                folderAccessIds.includes(folder.id)
            ))
            .map(folder => normalizeFolderRecord(folder, 'topicIds', 'official', 'official'));

        return {
            topics: sortByCreatedAtDesc(Array.from(topicMap.values())),
            folders: [...Array.from(teacherFolderMap.values()), ...visibleAdminFolders]
        };
    };

    const loadAccessibleGrammarData = async () => {
        if (!user?.uid) {
            return { exercises: [], folders: [] };
        }

        const grammarAccessIds = uniqueIds(user.mergedGrammarAccess || user.grammarAccess || []);
        const folderAccessIds = uniqueIds(user.mergedFolderAccess || user.folderAccess || []);

        const [
            ownExercises,
            collaboratedExercises,
            allExercises,
            ownTeacherFolders,
            sharedTeacherFolders,
            adminFolders
        ] = await Promise.all([
            getGrammarExercises(user.uid),
            getCollaboratedResources('grammar_exercises', user.uid),
            getGrammarExercises(null),
            getTeacherGrammarFolders(user.uid),
            getSharedAndPublicTeacherGrammarFolders(folderAccessIds),
            getGrammarFolders()
        ]);

        const visibleAdminFolders = adminFolders.filter(folder => (
            folder.isPublic ||
            folder.teacherVisible ||
            (folder.sharedWithTeacherIds && folder.sharedWithTeacherIds.includes(user.uid)) ||
            folderAccessIds.includes(folder.id)
        ));

        const accessibleFolderExerciseIds = new Set(
            uniqueIds([
                ...sharedTeacherFolders.flatMap(folder => folder.exerciseIds || []),
                ...visibleAdminFolders.flatMap(folder => folder.exerciseIds || [])
            ])
        );

        const exerciseMap = new Map();
        const teacherFolderMap = new Map();
        const addExercise = (exercise) => {
            if (!exercise?.id) return;
            const resourceKey = getResourceKey({ id: exercise.id, source: 'grammar' });
            exerciseMap.set(exercise.id, { ...exercise, source: 'grammar', resourceKey });
        };
        const addTeacherFolder = (folder) => {
            if (!folder?.id) return;
            teacherFolderMap.set(folder.id, normalizeFolderRecord(folder, 'exerciseIds', 'teacher', 'grammar'));
        };

        ownExercises.forEach(addExercise);
        collaboratedExercises.forEach(exercise => {
            if (!exercise?.isDeleted) addExercise(exercise);
        });
        ownTeacherFolders.forEach(addTeacherFolder);
        sharedTeacherFolders.forEach(addTeacherFolder);

        allExercises.forEach(exercise => {
            const isAccessible = (
                exerciseMap.has(exercise.id) ||
                exercise.isPublic === true ||
                exercise.teacherVisible === true ||
                (exercise.sharedWithTeacherIds && exercise.sharedWithTeacherIds.includes(user.uid)) ||
                grammarAccessIds.includes(exercise.id) ||
                accessibleFolderExerciseIds.has(exercise.id)
            );

            if (isAccessible) {
                addExercise(exercise);
            }
        });

        return {
            exercises: sortByCreatedAtDesc(Array.from(exerciseMap.values())),
            folders: [
                ...Array.from(teacherFolderMap.values()),
                ...visibleAdminFolders.map(folder => normalizeFolderRecord(folder, 'exerciseIds', 'official', 'grammar'))
            ]
        };
    };

    const loadGameSources = async (game) => {
        const shouldLoadTopics = game.dataType !== 'grammar';
        const shouldLoadGrammar = game.dataType !== 'vocabulary';

        const tasks = [];

        if (shouldLoadTopics && user?.uid) {
            setTopicsLoading(true);
            tasks.push(
                loadAccessibleVocabularyData()
                    .then(({ topics: nextTopics, folders }) => {
                        setTopics(nextTopics);
                        setTopicFolders(folders);
                    })
                    .catch(error => {
                        console.error('Error loading topics:', error);
                        setTopics([]);
                        setTopicFolders([]);
                    })
                    .finally(() => setTopicsLoading(false))
            );
        } else {
            setTopics([]);
            setTopicFolders([]);
            setTopicsLoading(false);
        }

        if (shouldLoadGrammar && user?.uid) {
            setGrammarLoading(true);
            tasks.push(
                loadAccessibleGrammarData()
                    .then(({ exercises, folders }) => {
                        setGrammarExercises(exercises);
                        setGrammarFolders(folders);
                    })
                    .catch(error => {
                        console.error('Error loading grammar exercises:', error);
                        setGrammarExercises([]);
                        setGrammarFolders([]);
                    })
                    .finally(() => setGrammarLoading(false))
            );
        } else {
            setGrammarExercises([]);
            setGrammarFolders([]);
            setGrammarLoading(false);
        }

        await Promise.all(tasks);
    };

    const handleSelectGame = async (game) => {
        setSelectedGame(game);
        setSelectedSource(getMiniGameDefaultSource(game));
        setShowDataSelector(true);
        setSelectedResourceKey(null);
        resetFolderNavigation();
        setResourceSearch('');
        await loadGameSources(game);
    };

    const isGrammarSource = selectedSource === 'grammar';
    const activeResources = isGrammarSource ? grammarExercises : topics;
    const activeFolders = isGrammarSource ? grammarFolders : topicFolders;
    const activeLoading = isGrammarSource ? grammarLoading : topicsLoading;
    const allResourceSections = buildFolderSections(activeResources, activeFolders, '', selectedSource);
    const filteredResourceSections = buildFolderSections(activeResources, activeFolders, resourceSearch, selectedSource);
    const activeFolderSection = currentFolderSectionKey
        ? allResourceSections.find(section => section.sectionKey === currentFolderSectionKey) || null
        : null;
    const filteredActiveFolderSection = currentFolderSectionKey
        ? filteredResourceSections.find(section => section.sectionKey === currentFolderSectionKey) || null
        : null;
    const visibleFolderSections = filteredResourceSections;
    const visibleResourcesInActiveFolder = activeFolderSection
        ? (filteredActiveFolderSection?.resources || [])
        : [];

    const launchVocabularyGame = async (topic) => {
        if (!topic?.id) {
            throw new Error('Không xác định được bài học từ vựng để chạy game.');
        }

        const words = topic.source === 'official'
            ? await getAdminTopicWords(topic.id)
            : await getTeacherTopicWords(topic.id);

        if (!words || words.length === 0) {
            throw new Error('Bài học này chưa có từ vựng nào. Vui lòng chọn bài khác.');
        }

        const normalizedWords = normalizeMiniGameWords(words);
        if (normalizedWords.length < 2) {
            throw new Error('Bài học này chưa có đủ ít nhất 2 từ có cả từ tiếng Anh và nghĩa tiếng Việt để chạy game.');
        }

        const limitedWords = enforceItemLimits(selectedGame, normalizedWords, 'vocabulary');
        return buildMiniGameVocabularyPayload(selectedGame, limitedWords);
    };

    const launchGrammarGame = async (exerciseId) => {
        const questions = await getGrammarQuestions(exerciseId);
        if (!questions || questions.length === 0) {
            throw new Error('Bài kỹ năng này chưa có câu hỏi nào. Vui lòng chọn bài khác.');
        }

        const limitedQuestions = enforceItemLimits(selectedGame, questions, 'grammar');
        return buildMiniGameGrammarPayload(selectedGame, limitedQuestions);
    };

    const handleSelectResource = async (resource) => {
        const resourceKey = getResourceKey(resource, selectedSource);
        setSelectedResourceKey(resourceKey);

        try {
            const gameData = isGrammarSource
                ? await launchGrammarGame(resource.id)
                : await launchVocabularyGame(resource);

            setLauncherGame(selectedGame);
            setLauncherData(gameData);
            setShowDataSelector(false);
            resetFolderNavigation();
        } catch (error) {
            console.error('Error preparing mini game data:', error);
            showToast(error.message || 'Lỗi khi chuẩn bị dữ liệu cho game.', 'error');
            setSelectedResourceKey(null);
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
            {toast && (
                <div
                    style={{
                        position: 'fixed',
                        top: '20px',
                        right: '20px',
                        zIndex: 10001,
                        minWidth: '280px',
                        maxWidth: '420px',
                        padding: '14px 16px',
                        borderRadius: '16px',
                        border: `1px solid ${toast.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
                        background: toast.type === 'error' ? '#fef2f2' : '#ecfdf5',
                        color: toast.type === 'error' ? '#991b1b' : '#166534',
                        boxShadow: '0 18px 40px rgba(15, 23, 42, 0.16)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px'
                    }}
                >
                    <span style={{ fontSize: '1.1rem', lineHeight: 1.4 }}>
                        {toast.type === 'error' ? '⚠️' : '✅'}
                    </span>
                    <div style={{ flex: 1, fontSize: '0.9rem', fontWeight: 600, lineHeight: 1.45 }}>
                        {toast.message}
                    </div>
                    <button
                        type="button"
                        onClick={() => setToast(null)}
                        style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: '2px' }}
                    >
                        ✕
                    </button>
                </div>
            )}

            <div className="admin-page-header">
                <div>
                    <h1 className="admin-page-title" style={{ margin: 0 }}>🎮 Mini Games</h1>
                    <p className="admin-page-subtitle">Chọn game và dữ liệu để học viên chơi trên lớp</p>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
                <div style={{ position: 'relative', maxWidth: '400px', flex: '1 1 300px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input id="teacher-mini-games-search" name="teacherMiniGamesSearch" type="text" placeholder="Tìm game..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.88rem', outline: 'none' }} />
                </div>
            </div>

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

            {showDataSelector && selectedGame && (
                <div className="teacher-modal-overlay" onClick={() => { resetFolderNavigation(); setShowDataSelector(false); }}>
                    <div className="teacher-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px', width: '95%' }}>
                        <div className="teacher-modal-header">
                            <h3 className="teacher-modal-title">
                                <Gamepad2 size={22} color="#4f46e5" /> {selectedGame.name}
                            </h3>
                            <button className="teacher-modal-close" onClick={() => { resetFolderNavigation(); setShowDataSelector(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
                        </div>

                        <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '16px' }}>
                            {selectedGame.dataType === 'both'
                                ? 'Chọn nguồn dữ liệu bạn muốn dùng cho lần chơi này.'
                                : `Chọn ${SOURCE_META[selectedSource].label} để sử dụng trong game:`}
                        </p>

                        {selectedGame.dataType === 'both' && (
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                                <button type="button" onClick={() => { setSelectedSource('vocabulary'); setSelectedResourceKey(null); resetFolderNavigation(); }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 12px', borderRadius: '12px', border: `1.5px solid ${selectedSource === 'vocabulary' ? '#4f46e5' : '#e2e8f0'}`, background: selectedSource === 'vocabulary' ? '#eef2ff' : '#fff', color: selectedSource === 'vocabulary' ? '#4338ca' : '#475569', fontWeight: 700, cursor: 'pointer' }}>
                                    <BookOpen size={16} /> Vocab
                                </button>
                                <button type="button" onClick={() => { setSelectedSource('grammar'); setSelectedResourceKey(null); resetFolderNavigation(); }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 12px', borderRadius: '12px', border: `1.5px solid ${selectedSource === 'grammar' ? '#4f46e5' : '#e2e8f0'}`, background: selectedSource === 'grammar' ? '#eef2ff' : '#fff', color: selectedSource === 'grammar' ? '#4338ca' : '#475569', fontWeight: 700, cursor: 'pointer' }}>
                                    <Shapes size={16} /> Grammar
                                </button>
                            </div>
                        )}

                        <div style={{ position: 'relative', marginBottom: '12px' }}>
                            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input id="teacher-mini-games-resource-search" name="teacherMiniGamesResourceSearch" type="text" placeholder={activeFolderSection ? `Tìm trong folder ${activeFolderSection.name || ''}...` : `Tìm ${SOURCE_META[selectedSource].label}...`} value={resourceSearch} onChange={e => setResourceSearch(e.target.value)} style={{ width: '100%', padding: '9px 12px 9px 36px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.85rem', outline: 'none' }} />
                        </div>

                        {activeLoading ? (
                            <div style={{ textAlign: 'center', padding: '24px' }}>
                                <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3, margin: '0 auto' }}></div>
                            </div>
                        ) : (
                            <div style={{ maxHeight: '350px', overflow: 'hidden', position: 'relative' }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        width: '100%',
                                        transform: isFolderDetailVisible ? 'translateX(-100%)' : 'translateX(0%)',
                                        transition: `transform ${FOLDER_PANEL_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
                                        willChange: 'transform'
                                    }}
                                >
                                    <div style={{ flex: '0 0 100%', minWidth: 0 }}>
                                        {visibleFolderSections.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                                                <p>{resourceSearch ? 'Không tìm thấy folder hoặc bài học phù hợp.' : SOURCE_META[selectedSource].empty}</p>
                                            </div>
                                        ) : (
                                            <div style={{ maxHeight: '350px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '2px' }}>
                                                {visibleFolderSections.map(section => (
                                                    <button
                                                        key={section.sectionKey}
                                                        type="button"
                                                        onClick={() => openFolderSection(section.sectionKey)}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            gap: '12px',
                                                            padding: '14px',
                                                            borderRadius: '14px',
                                                            border: '1.5px solid #e2e8f0',
                                                            background: '#fff',
                                                            cursor: 'pointer',
                                                            textAlign: 'left',
                                                            width: '100%',
                                                            transition: 'transform 0.22s ease, box-shadow 0.22s ease',
                                                            boxShadow: '0 0 0 rgba(79, 70, 229, 0)'
                                                        }}
                                                    >
                                                        <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <span style={{ fontSize: '1rem' }}>{section.icon || '📁'}</span>
                                                            <div style={{ minWidth: 0 }}>
                                                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    {section.name || 'Folder không tên'}
                                                                </div>
                                                                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                                                    {section.resources.length} {selectedSource === 'grammar' ? 'bài' : 'bộ'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <ChevronRight size={16} color="#64748b" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ flex: '0 0 100%', minWidth: 0, boxSizing: 'border-box' }}>
                                        <div style={{ maxHeight: '350px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '10px' }}>
                                            {activeFolderSection ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={closeFolderSection}
                                                        style={{
                                                            width: '100%',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            padding: '10px 12px',
                                                            borderRadius: '12px',
                                                            border: '1.5px solid #e2e8f0',
                                                            background: '#fff',
                                                            color: '#334155',
                                                            fontSize: '0.88rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <ArrowLeft size={16} />
                                                        <span>Quay lại danh sách folder</span>
                                                    </button>

                                                    <div style={{ padding: '2px 4px 8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <span style={{ fontSize: '1rem' }}>{activeFolderSection.icon || '📁'}</span>
                                                        <div>
                                                            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#1e293b' }}>{activeFolderSection.name || 'Folder không tên'}</div>
                                                            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                                                {visibleResourcesInActiveFolder.length} {selectedSource === 'grammar' ? 'bài' : 'bộ'}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {visibleResourcesInActiveFolder.length === 0 ? (
                                                        <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                                                            <p>{resourceSearch ? 'Không tìm thấy mục nào trong folder này.' : 'Folder này hiện chưa có nội dung phù hợp.'}</p>
                                                        </div>
                                                    ) : (
                                                        visibleResourcesInActiveFolder.map(resource => (
                                                            <button key={getResourceKey(resource, selectedSource)} type="button" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '12px', border: `1.5px solid ${selectedResourceKey === getResourceKey(resource, selectedSource) ? '#4f46e5' : '#e2e8f0'}`, background: selectedResourceKey === getResourceKey(resource, selectedSource) ? '#ede9fe' : '#fff', cursor: selectedResourceKey === getResourceKey(resource, selectedSource) ? 'wait' : 'pointer', textAlign: 'left', transition: 'all 0.2s', width: '100%', fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }} onClick={() => handleSelectResource(resource)} disabled={selectedResourceKey === getResourceKey(resource, selectedSource)}>
                                                                <span>{SOURCE_META[selectedSource].icon} {resource.name}</span>
                                                                {selectedResourceKey === getResourceKey(resource, selectedSource) && (
                                                                    <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></div>
                                                                )}
                                                            </button>
                                                        ))
                                                    )}
                                                </>
                                            ) : (
                                                <div style={{ minHeight: '1px' }} />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {launcherGame && launcherData && (
                <GameLauncher
                    gameUrl={getMiniGameLaunchUrl(launcherGame)}
                    gameName={launcherGame.name}
                    gameData={launcherData}
                    onClose={() => { setLauncherGame(null); setLauncherData(null); }}
                    onComplete={(summary) => console.log('Game complete:', summary)}
                />
            )}
        </div>
    );
}
