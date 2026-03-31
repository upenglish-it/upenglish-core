import React, { useState, useRef, useEffect } from 'react';
import {
    X, Globe, Users, UserPlus, UsersRound, FileText, Send, CheckCircle, XCircle,
    Clock, ChevronDown, ArrowRightLeft, AlertCircle, Landmark, GraduationCap, Lock,
    Eye, Pencil, Link2
} from 'lucide-react';
import EmailAutocomplete from './EmailAutocomplete';
import CustomSelect from './CustomSelect';
import './ShareModal.css';

/**
 * ShareModal — shared 2-column / 2-tab share modal used across Topics, Grammar, Exams pages.
 *
 * Left column  = "Chia sẻ cho học viên" (student-facing)
 * Right column = "Chia sẻ nội bộ (GV)" (teacher-internal)
 *
 * On mobile (<768px), columns become tabs.
 */
export default function ShareModal({
    resourceToShare,
    onClose,
    user,
    resourceLabel = 'Bài học',       // 'Bài học' | 'Bài Kỹ năng' | 'Đề thi'
    defaultIcon = '📘',

    // ─── Student-facing props ───
    // Public toggle
    showPublicToggle = true,
    isSharing = false,
    onTogglePublic,

    // Group share
    showGroupShare = true,
    allGroups = [],
    shareGroups = [],
    onToggleGroupShare,
    groupDropdownRef,

    // Individual share
    showIndividualShare = true,
    shareEmail = '',
    onShareEmailChange,
    onAddShareEmail,
    onRemoveShareUser,
    shareUsers = [],

    // Quick assign
    showQuickAssign = true,
    teacherManagedGroups = [],
    quickAssignGroupId = '',
    onQuickAssignGroupChange,
    quickAssignDueDate = '',
    onQuickAssignDueDateChange,
    quickAssignScheduledStart = '',
    onQuickAssignScheduledStartChange,
    onQuickAssign,
    isQuickAssigning = false,
    quickAssignSuccess = '',
    existingAssignments = [],
    // Student selection for quick assign
    quickAssignStudents = [],
    quickAssignSelectedStudentIds = [],
    onQuickAssignStudentToggle,
    onQuickAssignSelectAll,
    quickAssignStudentsLoading = false,
    studentDropdownOpen = false,
    onStudentDropdownToggle,
    quickAssignLabel = 'bài học',

    // ─── Internal props ───
    // Collaborators
    showCollab = true,
    collabEmail = '',
    onCollabEmailChange,
    onAddCollaborator,
    onRemoveCollaborator,
    collaborators = [],
    isAddingCollab = false,
    onPreTransferOwnership,
    onSetTransferTarget,
    collabRole = 'editor',
    onCollabRoleChange,
    onUpdateCollaboratorRole,
    collaboratorRoles = {},

    // Proposal
    showProposal = true,
    onSubmitProposal,
    isSubmittingProposal = false,
    currentProposal = null,
    proposalLabel = 'bài học',

    // ─── Teacher sharing (admin content only) ───
    showTeacherShare = false,
    onToggleTeacherVisible,
    teacherShareEmail = '',
    onTeacherShareEmailChange,
    onAddTeacherShare,
    onRemoveTeacherShare,
    sharedTeachers = [],
    isTeacherSharing = false,
}) {
    const [activeTab, setActiveTab] = useState('student');
    const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const internalGroupDropdownRef = useRef(null);
    const effectiveGroupDropdownRef = groupDropdownRef || internalGroupDropdownRef;

    // close group dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(e) {
            if (effectiveGroupDropdownRef.current && !effectiveGroupDropdownRef.current.contains(e.target)) {
                setGroupDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [effectiveGroupDropdownRef]);

    const isOwner = resourceToShare.isOwner || resourceToShare.teacherId === user?.uid;
    const isFolder = resourceToShare.type?.includes('folder');
    const isAdminContent = resourceToShare.isAdmin || resourceToShare.type?.includes('admin');
    const isAppSystemFolder = resourceToShare.isAppSystemFolder;
    const isPublicContent = resourceToShare.isPublic;

    // Determine if student column has any content to show
    const hasStudentContent = showPublicToggle || showGroupShare || showIndividualShare || (showQuickAssign && !isFolder);
    // Any user can share public/admin content or Quick Assign any non-folder resource
    const isCollaborator = resourceToShare.isCollaborator;
    const hasQuickAssignAvailable = showQuickAssign && !isFolder;
    const canShareStudentContent = isOwner || isPublicContent;
    const showStudentColumn = (hasStudentContent && canShareStudentContent) || hasQuickAssignAvailable;
    // Determine if internal column has any content to show
    const hasInternalContent = (showCollab && !isAdminContent) || (showProposal && !isAdminContent) || (showTeacherShare && isAdminContent);

    return (
        <div className="teacher-modal-overlay">
            <div className="teacher-modal wide" style={{ maxWidth: showStudentColumn && hasInternalContent && isOwner ? '900px' : '550px', overflow: 'auto' }}>
                {/* Floating close button */}
                <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                    <button className="teacher-modal-close" onClick={onClose} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Title */}
                <h2 className="admin-modal-title" style={{ justifyContent: 'flex-start', marginBottom: '24px', paddingRight: '40px' }}>
                    Chia sẻ {isFolder ? 'Folder' : resourceLabel}
                </h2>

                {/* Resource info header */}
                <div className="share-modal-header">
                    <div className="admin-topic-icon" style={{ background: `${resourceToShare.color || '#3b82f6'}20`, width: '40px', height: '40px', fontSize: '1.2rem' }}>
                        {resourceToShare.icon || (isFolder ? '📁' : defaultIcon)}
                    </div>
                    <div>
                        <h3>{resourceToShare.name || resourceToShare.title}</h3>
                        <p>{isAppSystemFolder || resourceToShare.isAdmin ? 'Nội dung chính thức (chỉ xem)' : 'Do bạn quản lý'}</p>
                    </div>
                </div>

                {/* Copy Link button */}
                {(isOwner || isPublicContent || isAdminContent || isCollaborator) && (
                    <div style={{ marginBottom: '12px' }}>
                        <button
                            onClick={() => {
                                const resType = resourceToShare.type || '';
                                const resId = resourceToShare.id;
                                const isAdm = resourceToShare.isAdmin;
                                let path = '/';
                                if (isFolder) {
                                    // Folders don't have a direct student link
                                } else if (resType.includes('grammar') || resType.includes('grammar_exercise')) {
                                    path = isAdm ? `/teacher/system-grammar/${resId}` : `/teacher/grammar/${resId}`;
                                } else if (resType.includes('topic')) {
                                    path = isAdm ? `/teacher/system-topics/${resId}` : `/teacher/topics/${resId}`;
                                } else if (resType.includes('exam')) {
                                    path = isAdm ? `/teacher/system-exams/${resId}` : `/teacher/exams/${resId}`;
                                }
                                const fullUrl = `${window.location.origin}${path}`;
                                navigator.clipboard.writeText(fullUrl).then(() => {
                                    setLinkCopied(true);
                                    setTimeout(() => setLinkCopied(false), 2000);
                                });
                            }}
                            style={{
                                width: '100%', padding: '10px 16px', borderRadius: '10px',
                                border: linkCopied ? '1.5px solid #10b981' : '1.5px solid #e2e8f0',
                                background: linkCopied ? '#ecfdf5' : '#f8fafc',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                fontSize: '0.88rem', fontWeight: 500,
                                color: linkCopied ? '#059669' : '#475569',
                                transition: 'all 0.2s'
                            }}
                        >
                            {linkCopied ? <><CheckCircle size={16} /> Đã sao chép link!</> : <><Link2 size={16} /> Sao chép link chia sẻ</>}
                        </button>
                    </div>
                )}

                {/* Not-owner banner */}
                {!isOwner && !isPublicContent && (
                    <div className="share-modal-readonly-banner">
                        <p><AlertCircle size={14} /> {isCollaborator
                            ? 'Bạn là cộng tác viên. Bạn có thể giao bài cho lớp của mình.'
                            : isAdminContent
                                ? 'Nội dung này được Admin chia sẻ. Bạn có thể giao bài cho lớp của mình nhưng không thể chia sẻ tự do cho học viên.'
                                : hasQuickAssignAvailable
                                    ? 'Bạn có thể giao bài này cho lớp mà bạn đang chủ nhiệm.'
                                    : 'Bạn đang xem chia sẻ của tài nguyên này.'
                        }</p>
                    </div>
                )}

                {/* Mobile tabs */}
                {showStudentColumn && hasInternalContent && isOwner && (
                    <div className="share-modal-tabs">
                        <button
                            className={`share-modal-tab tab-student ${activeTab === 'student' ? 'active' : ''}`}
                            onClick={() => setActiveTab('student')}
                        >
                            <GraduationCap size={16} /> Học viên
                        </button>
                        <button
                            className={`share-modal-tab tab-internal ${activeTab === 'internal' ? 'active' : ''}`}
                            onClick={() => setActiveTab('internal')}
                        >
                            <Lock size={16} /> Nội bộ (GV)
                        </button>
                    </div>
                )}

                {/* Two columns */}
                <div className="share-modal-columns">
                    {/* ─── LEFT COLUMN: Student-facing ─── */}
                    {showStudentColumn && (
                        <div className={`share-modal-col ${activeTab === 'student' ? 'active' : ''}`}>
                            {hasInternalContent && isOwner && (
                                <div className="share-modal-col-header student">
                                    <GraduationCap size={18} />
                                    Chia sẻ cho học viên
                                </div>
                            )}
                            {!isOwner && isPublicContent && (
                                <div className="share-modal-col-header student">
                                    <GraduationCap size={18} />
                                    Chia sẻ cho học viên của bạn
                                </div>
                            )}
                            {!isOwner && !isPublicContent && isAdminContent && (
                                <div className="share-modal-col-header student">
                                    <FileText size={18} />
                                    Giao bài cho học viên
                                </div>
                            )}

                            {/* Public Toggle */}
                            {showPublicToggle && isOwner && (
                                <div className="share-modal-section">
                                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontWeight: '600' }}>
                                                <Globe size={18} color={resourceToShare.isPublic ? '#10b981' : '#64748b'} />
                                                Mở công khai
                                            </div>
                                            <button
                                                onClick={onTogglePublic}
                                                disabled={isSharing}
                                                style={{
                                                    position: 'relative',
                                                    width: '40px', height: '24px',
                                                    borderRadius: '12px',
                                                    background: resourceToShare.isPublic ? '#10b981' : '#cbd5e1',
                                                    border: 'none', cursor: 'pointer',
                                                    transition: 'background 0.3s'
                                                }}
                                            >
                                                <div style={{
                                                    position: 'absolute', top: '2px', left: resourceToShare.isPublic ? '18px' : '2px',
                                                    width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
                                                    transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                                }}></div>
                                            </button>
                                        </div>
                                        <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                                            {resourceToShare.isPublic
                                                ? 'Bất kỳ ai sử dụng ứng dụng đều có thể tìm thấy và học bài này.'
                                                : 'Chỉ những người được cấp quyền bên dưới mới có thể truy cập.'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Group share */}
                            {showGroupShare && canShareStudentContent && (
                                <div className="share-modal-section">
                                    <h4><Users size={16} /> Chia sẻ theo lớp/nhóm</h4>
                                    <p>Chia sẻ để thiết lập thành các bài học tự do, học viên có thể tìm đến học theo sở thích.</p>
                                    {allGroups.length > 0 ? (
                                        <div style={{ position: 'relative' }} ref={effectiveGroupDropdownRef}>
                                            <button
                                                onClick={() => setGroupDropdownOpen(!groupDropdownOpen)}
                                                style={{
                                                    width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontSize: '0.85rem'
                                                }}
                                            >
                                                <span style={{ color: shareGroups.length > 0 ? '#0f172a' : '#64748b' }}>
                                                    {shareGroups.length > 0 ? `Đã chọn ${shareGroups.length} lớp/nhóm` : 'Chọn lớp/nhóm...'}
                                                </span>
                                                <ChevronDown size={16} color="#64748b" style={{ transform: groupDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                            </button>

                                            {groupDropdownOpen && (
                                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', zIndex: 10, maxHeight: '200px', overflowY: 'auto' }}>
                                                    <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        {allGroups.map(group => {
                                                            const isSelected = shareGroups.includes(group.id);
                                                            return (
                                                                <label key={group.id} style={{ display: 'flex', alignItems: 'center', padding: '8px', cursor: 'pointer', borderRadius: '6px', background: isSelected ? '#eff6ff' : 'transparent', transition: 'background 0.2s' }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        onChange={() => onToggleGroupShare(group.id)}
                                                                        disabled={isSharing}
                                                                        style={{ marginRight: '10px', cursor: 'pointer', width: '16px', height: '16px' }}
                                                                    />
                                                                    <span style={{ fontSize: '0.85rem', color: isSelected ? '#2563eb' : '#334155', fontWeight: isSelected ? '500' : 'normal' }}>{group.name}</span>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>Không có lớp/nhóm nào trên hệ thống.</p>
                                    )}
                                </div>
                            )}

                            {/* Individual share */}
                            {showIndividualShare && canShareStudentContent && (
                                <div className="share-modal-section">
                                    <h4><UserPlus size={16} /> Chia sẻ cá nhân</h4>
                                    <p>Chia sẻ cho từng cá nhân để thêm vào lộ trình học tự do của riêng họ.</p>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                                        <div style={{ width: '100%' }}>
                                            <EmailAutocomplete
                                                value={shareEmail}
                                                onChange={onShareEmailChange}
                                                onSelect={(email) => onAddShareEmail(email)}
                                                roleFilter="student"
                                                placeholder="Nhập email học viên..."
                                            />
                                        </div>
                                        <button
                                            className="admin-btn admin-btn-primary"
                                            onClick={onAddShareEmail}
                                            disabled={isSharing || !shareEmail}
                                            style={{ width: '100%', padding: '8px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            Thêm
                                        </button>
                                    </div>

                                    {shareUsers.length > 0 && (
                                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                                            {shareUsers.map((u, i) => (
                                                <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: i < shareUsers.length - 1 ? '1px solid #e2e8f0' : 'none', background: '#fafafa' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                                            {u.email.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#0f172a' }}>{u.displayName || 'Học viên'}</div>
                                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{u.email}</div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => onRemoveShareUser(u.id)}
                                                        disabled={isSharing}
                                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                                        title="Xóa quyền truy cập"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Quick Assign (not for folders) */}
                            {showQuickAssign && !isFolder && (
                                <div className="share-modal-section" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                                    <h4><FileText size={16} color="#f59e0b" /> Giao bài cho lớp</h4>
                                    <p>Giao nhanh {quickAssignLabel} này cho 1 lớp mà bạn đang chủ nhiệm.</p>

                                    {/* Existing assignment tags */}
                                    {existingAssignments.length > 0 && (
                                        <div style={{ marginBottom: '12px' }}>
                                            <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>Đã giao cho:</p>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {existingAssignments
                                                    .filter((a, i, arr) => arr.findIndex(x => x.targetId === a.targetId) === i)
                                                    .map(a => (
                                                    <span key={a.id} style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px', background: 'linear-gradient(135deg, #fef3c7, #fde68a)', color: '#92400e', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #fcd34d' }}>
                                                        ✅ {a.groupName || a.targetName || allGroups.find(g => g.id === a.groupId)?.name || teacherManagedGroups.find(g => g.id === a.targetId)?.name || 'Lớp'}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {teacherManagedGroups.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {/* Group select */}
                                            <div>
                                                <label style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '3px', display: 'block' }}>Chọn lớp</label>
                                                <div style={{ position: 'relative', zIndex: 20 }}>
                                                    <CustomSelect
                                                        value={quickAssignGroupId}
                                                        onChange={onQuickAssignGroupChange}
                                                        placeholder="-- Chọn lớp --"
                                                        options={teacherManagedGroups.map(g => ({ value: g.id, label: g.name, icon: '🏫' }))}
                                                        style={{ margin: 0 }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Scheduled Start toggle */}
                                            <div>
                                                <label style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '5px', display: 'block' }}>Thời điểm bắt đầu</label>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => onQuickAssignScheduledStartChange && onQuickAssignScheduledStartChange('')}
                                                        style={{
                                                            flex: 1, padding: '7px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
                                                            border: !quickAssignScheduledStart ? '2px solid #10b981' : '1.5px solid #e2e8f0',
                                                            background: !quickAssignScheduledStart ? '#ecfdf5' : '#fff',
                                                            color: !quickAssignScheduledStart ? '#059669' : '#64748b',
                                                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                                                            transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        <Send size={12} /> Bắt đầu ngay
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => onQuickAssignScheduledStartChange && onQuickAssignScheduledStartChange(quickAssignScheduledStart || 'pending')}
                                                        style={{
                                                            flex: 1, padding: '7px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
                                                            border: quickAssignScheduledStart ? '2px solid #6366f1' : '1.5px solid #e2e8f0',
                                                            background: quickAssignScheduledStart ? '#eef2ff' : '#fff',
                                                            color: quickAssignScheduledStart ? '#4f46e5' : '#64748b',
                                                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                                                            transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        <Clock size={12} /> Hẹn giờ bắt đầu
                                                    </button>
                                                </div>
                                                {quickAssignScheduledStart && (
                                                    <div style={{ marginTop: '6px' }}>
                                                        <input
                                                            type="datetime-local"
                                                            value={quickAssignScheduledStart === 'pending' ? '' : quickAssignScheduledStart}
                                                            onChange={e => onQuickAssignScheduledStartChange && onQuickAssignScheduledStartChange(e.target.value)}
                                                            style={{ width: '100%', padding: '6px 12px', borderRadius: '10px', border: '1.5px solid #c7d2fe', fontSize: '0.88rem', color: '#1e293b', minHeight: '38px', boxSizing: 'border-box', background: '#f5f3ff' }}
                                                        />
                                                        {quickAssignScheduledStart && quickAssignScheduledStart !== 'pending' && quickAssignDueDate && new Date(quickAssignScheduledStart) >= new Date(quickAssignDueDate) && (
                                                            <div style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                                                                <AlertCircle size={12} /> Ngày bắt đầu phải trước hạn nộp
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Due date */}
                                            <div>
                                                <label style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '3px', display: 'block' }}>Hạn nộp (deadline)</label>
                                                <input
                                                    type="datetime-local"
                                                    value={quickAssignDueDate}
                                                    onChange={e => onQuickAssignDueDateChange(e.target.value)}
                                                    style={{ width: '100%', padding: '6px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.88rem', color: '#1e293b', minHeight: '38px', boxSizing: 'border-box' }}
                                                />
                                            </div>

                                            {/* Student selection dropdown */}
                                            {quickAssignGroupId && (
                                                <div style={{ position: 'relative', zIndex: 15 }}>
                                                    <button
                                                        type="button"
                                                        onClick={onStudentDropdownToggle}
                                                        style={{
                                                            width: '100%', padding: '8px 12px', borderRadius: '8px',
                                                            border: `1.5px solid ${quickAssignSelectedStudentIds.length > 0 ? '#3b82f6' : '#e2e8f0'}`,
                                                            background: quickAssignSelectedStudentIds.length > 0 ? '#eff6ff' : '#fff',
                                                            textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                            cursor: 'pointer', fontSize: '0.82rem', color: '#334155'
                                                        }}
                                                    >
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <Users size={14} color="#64748b" />
                                                            {quickAssignStudentsLoading ? 'Đang tải...' :
                                                                quickAssignSelectedStudentIds.length > 0
                                                                    ? `${quickAssignSelectedStudentIds.length} học viên được chọn`
                                                                    : 'Cả lớp (mặc định)'}
                                                        </span>
                                                        <ChevronDown size={14} color="#64748b" style={{ transform: studentDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                                    </button>
                                                    {studentDropdownOpen && !quickAssignStudentsLoading && quickAssignStudents.length > 0 && (
                                                        <div style={{
                                                            marginTop: '4px',
                                                            background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
                                                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                                            maxHeight: '200px', overflowY: 'auto'
                                                        }}>
                                                            <div style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}>
                                                                <label style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', cursor: 'pointer', borderRadius: '6px', background: '#f8fafc', fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={quickAssignSelectedStudentIds.length === 0}
                                                                        onChange={onQuickAssignSelectAll}
                                                                        style={{ marginRight: '8px', cursor: 'pointer' }}
                                                                    />
                                                                    Cả lớp ({quickAssignStudents.length} học viên)
                                                                </label>
                                                            </div>
                                                            <div style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                {quickAssignStudents.map(s => {
                                                                    const isChecked = quickAssignSelectedStudentIds.includes(s.uid);
                                                                    return (
                                                                        <label key={s.uid} style={{
                                                                            display: 'flex', alignItems: 'center', padding: '6px 8px',
                                                                            cursor: 'pointer', borderRadius: '6px',
                                                                            background: isChecked ? '#eff6ff' : 'transparent',
                                                                            transition: 'background 0.15s'
                                                                        }}>
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={isChecked}
                                                                                onChange={() => onQuickAssignStudentToggle(s.uid)}
                                                                                style={{ marginRight: '8px', cursor: 'pointer', width: '15px', height: '15px' }}
                                                                            />
                                                                            <div>
                                                                                <div style={{ fontSize: '0.82rem', color: isChecked ? '#1d4ed8' : '#334155', fontWeight: isChecked ? 500 : 400 }}>
                                                                                    {s.displayName || s.email?.split('@')[0] || 'Học viên'}
                                                                                </div>
                                                                                {s.email && <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{s.email}</div>}
                                                                            </div>
                                                                        </label>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            <button
                                                type="button"
                                                onClick={onQuickAssign}
                                                disabled={isQuickAssigning || !quickAssignGroupId || !quickAssignDueDate || (quickAssignScheduledStart && quickAssignScheduledStart !== 'pending' && quickAssignDueDate && new Date(quickAssignScheduledStart) >= new Date(quickAssignDueDate)) || (quickAssignScheduledStart === 'pending')}
                                                className="admin-btn admin-btn-primary"
                                                style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', opacity: (isQuickAssigning || !quickAssignGroupId || !quickAssignDueDate || (quickAssignScheduledStart === 'pending')) ? 0.6 : 1 }}
                                            >
                                                <Send size={14} />
                                                {isQuickAssigning ? 'Đang giao...' : 'Giao bài'}
                                            </button>
                                            {quickAssignSuccess && (
                                                <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#ecfdf5', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#059669', fontWeight: 500 }}>
                                                    <CheckCircle size={16} /> {quickAssignSuccess}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>Bạn chưa quản lý lớp nào. Liên hệ Admin để được thêm vào lớp.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── RIGHT COLUMN: Internal (for owners only) ─── */}
                    {hasInternalContent && isOwner && (
                        <div className={`share-modal-col ${activeTab === 'internal' ? 'active' : ''}`}>
                            {hasStudentContent && (
                                <div className="share-modal-col-header internal">
                                    <Lock size={18} />
                                    {isAdminContent ? 'Chia sẻ cho giáo viên' : 'Chia sẻ nội bộ (GV)'}
                                </div>
                            )}

                            {/* Teacher Sharing (admin content only) */}
                            {showTeacherShare && isAdminContent && (
                                <div className="share-modal-section">
                                    {/* Toggle all teachers */}
                                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontWeight: '600' }}>
                                                <GraduationCap size={18} color={resourceToShare.teacherVisible ? '#3b82f6' : '#64748b'} />
                                                Cho tất cả GV sử dụng
                                            </div>
                                            <button
                                                onClick={onToggleTeacherVisible}
                                                disabled={isTeacherSharing}
                                                style={{
                                                    position: 'relative',
                                                    width: '40px', height: '24px',
                                                    borderRadius: '12px',
                                                    background: resourceToShare.teacherVisible ? '#3b82f6' : '#cbd5e1',
                                                    border: 'none', cursor: 'pointer',
                                                    transition: 'background 0.3s'
                                                }}
                                            >
                                                <div style={{
                                                    position: 'absolute', top: '2px', left: resourceToShare.teacherVisible ? '18px' : '2px',
                                                    width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
                                                    transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                                }}></div>
                                            </button>
                                        </div>
                                        <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                                            {resourceToShare.teacherVisible
                                                ? 'Tất cả giáo viên đều có thể thấy và giao bài này cho học viên.'
                                                : 'Chỉ những GV được chia sẻ bên dưới mới nhìn thấy.'}
                                        </p>
                                    </div>

                                    {/* Per-teacher sharing */}
                                    <h4><UserPlus size={16} color="#3b82f6" /> Chia sẻ cho GV cụ thể</h4>
                                    <p>Thêm giáo viên cụ thể để họ có thể sử dụng và giao bài này.</p>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                                        <div style={{ width: '100%' }}>
                                            <EmailAutocomplete
                                                value={teacherShareEmail}
                                                onChange={onTeacherShareEmailChange}
                                                onSelect={(email) => onAddTeacherShare(email)}
                                                placeholder="Email giáo viên..."
                                            />
                                        </div>
                                        <button
                                            className="admin-btn admin-btn-primary"
                                            onClick={onAddTeacherShare}
                                            disabled={isTeacherSharing || !teacherShareEmail}
                                            style={{ width: '100%', padding: '8px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none' }}
                                        >
                                            Thêm giáo viên
                                        </button>
                                    </div>

                                    {sharedTeachers.length > 0 && (
                                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                                            {sharedTeachers.map((t, i) => (
                                                <div key={t.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: i < sharedTeachers.length - 1 ? '1px solid #e2e8f0' : 'none', background: '#eff6ff' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                                            {(t.displayName || t.email || 'G').charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#0f172a' }}>{t.displayName || 'Giáo viên'}</div>
                                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{t.email}</div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => onRemoveTeacherShare(t.uid)}
                                                        disabled={isTeacherSharing}
                                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                                        title="Gỡ quyền truy cập"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Collaborators */}
                            {showCollab && !isAdminContent && (
                                <div className="share-modal-section">
                                    <h4><UsersRound size={16} color="#8b5cf6" /> Cộng tác viên</h4>
                                    <p>Thêm giáo viên khác cùng hợp tác quản lý hoặc chuyển quyền sở hữu hoàn toàn.</p>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                                        <div style={{ width: '100%' }}>
                                            <EmailAutocomplete
                                                value={collabEmail}
                                                onChange={onCollabEmailChange}
                                                onSelect={() => {}}
                                                placeholder="Email hệ thống của giáo viên..."
                                            />
                                        </div>
                                        {/* Role picker */}
                                        <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', borderRadius: '8px', padding: '3px' }}>
                                            <button
                                                type="button"
                                                onClick={() => onCollabRoleChange && onCollabRoleChange('editor')}
                                                style={{
                                                    flex: 1, padding: '6px 10px', borderRadius: '6px', border: 'none',
                                                    fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                                    background: collabRole === 'editor' ? '#fff' : 'transparent',
                                                    color: collabRole === 'editor' ? '#7c3aed' : '#64748b',
                                                    boxShadow: collabRole === 'editor' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <Pencil size={13} /> Chỉnh sửa
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onCollabRoleChange && onCollabRoleChange('viewer')}
                                                style={{
                                                    flex: 1, padding: '6px 10px', borderRadius: '6px', border: 'none',
                                                    fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                                    background: collabRole === 'viewer' ? '#fff' : 'transparent',
                                                    color: collabRole === 'viewer' ? '#0ea5e9' : '#64748b',
                                                    boxShadow: collabRole === 'viewer' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <Eye size={13} /> Chỉ sử dụng
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                className="admin-btn admin-btn-primary"
                                                onClick={onAddCollaborator}
                                                disabled={isAddingCollab || !collabEmail}
                                                style={{ flex: 1, background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', border: 'none', padding: '8px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                Thêm
                                            </button>
                                            <button
                                                className="admin-btn admin-btn-secondary"
                                                onClick={() => onPreTransferOwnership(collabEmail)}
                                                disabled={isAddingCollab || !collabEmail}
                                                style={{ flex: 1, padding: '8px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderColor: '#8b5cf6', color: '#8b5cf6', whiteSpace: 'nowrap' }}
                                            >
                                                <ArrowRightLeft size={14} /> Chuyển quyền
                                            </button>
                                        </div>
                                    </div>

                                    {collaborators.length > 0 && (
                                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                                            {collaborators.map((c, i) => {
                                                const role = collaboratorRoles[c.uid] || 'editor';
                                                const isViewer = role === 'viewer';
                                                return (
                                                <div key={c.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: i < collaborators.length - 1 ? '1px solid #e2e8f0' : 'none', background: '#faf5ff' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: isViewer ? '#e0f2fe' : '#ede9fe', color: isViewer ? '#0284c7' : '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold', flexShrink: 0 }}>
                                                            {(c.displayName || 'G').charAt(0).toUpperCase()}
                                                        </div>
                                                        <div style={{ minWidth: 0 }}>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                                <span>{c.displayName || 'Giáo viên'}</span>
                                                                <span style={{
                                                                    fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700,
                                                                    background: isViewer ? '#e0f2fe' : '#ede9fe',
                                                                    color: isViewer ? '#0284c7' : '#7c3aed',
                                                                    display: 'inline-flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap'
                                                                }}>
                                                                    {isViewer ? <><Eye size={10} /> Sử dụng</> : <><Pencil size={10} /> Chỉnh sửa</>}
                                                                </span>
                                                            </div>
                                                            {c.email && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.email}</div>}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                                        <button
                                                            onClick={() => onUpdateCollaboratorRole && onUpdateCollaboratorRole(c.uid, isViewer ? 'editor' : 'viewer')}
                                                            disabled={isAddingCollab}
                                                            style={{ background: 'none', border: '1px solid #e2e8f0', color: isViewer ? '#0ea5e9' : '#8b5cf6', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}
                                                            title={isViewer ? 'Đổi thành Chỉnh sửa' : 'Đổi thành Chỉ sử dụng'}
                                                        >
                                                            {isViewer ? <Pencil size={11} /> : <Eye size={11} />}
                                                            {isViewer ? 'Chỉnh sửa' : 'Sử dụng'}
                                                        </button>
                                                        <button
                                                            onClick={() => onSetTransferTarget(c)}
                                                            disabled={isAddingCollab}
                                                            style={{ background: 'none', border: '1px solid #e2e8f0', color: '#8b5cf6', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                            title="Chuyển quyền sở hữu"
                                                        >
                                                            <ArrowRightLeft size={12} />
                                                        </button>
                                                        <button
                                                            onClick={() => onRemoveCollaborator(c.uid)}
                                                            disabled={isAddingCollab}
                                                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                                            title="Gỡ cộng tác viên"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Proposal */}
                            {showProposal && !isAdminContent && (
                                <div className="share-modal-section" style={{ borderTop: showCollab ? '1px solid #e2e8f0' : 'none', paddingTop: showCollab ? '16px' : 0 }}>
                                    <h4><Landmark size={16} /> {currentProposal?.status === 'approved' ? 'Đề xuất cập nhật nội dung chính thức' : 'Đề xuất thành nội dung chính thức'}</h4>
                                    <p>
                                        Gửi {isFolder ? 'folder' : proposalLabel} này cho Admin duyệt để đưa lên kho nội dung chính thức.
                                    </p>
                                    <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '4px' }}>
                                        <AlertCircle size={16} color="#3b82f6" style={{ flexShrink: 0, marginTop: '1px' }} />
                                        <p style={{ fontSize: '0.8rem', color: '#1e40af', margin: 0, lineHeight: 1.5 }}>
                                            Bạn vẫn giữ nguyên bản gốc và chỉnh sửa nó, nhưng <strong>bản chính thức sẽ không được sửa</strong>. Bạn sẽ cần <strong>đề xuất lại</strong> nếu muốn cập nhật bản chính thức.
                                        </p>
                                    </div>
                                    {currentProposal ? (
                                        <div style={{ padding: '12px 16px', borderRadius: '8px', background: currentProposal.status === 'approved' ? '#ecfdf5' : currentProposal.status === 'rejected' ? '#fef2f2' : '#fffbeb', border: `1px solid ${currentProposal.status === 'approved' ? '#a7f3d0' : currentProposal.status === 'rejected' ? '#fecaca' : '#fde68a'}` }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                {currentProposal.status === 'pending' && <Clock size={16} color="#d97706" />}
                                                {currentProposal.status === 'approved' && <CheckCircle size={16} color="#10b981" />}
                                                {currentProposal.status === 'rejected' && <XCircle size={16} color="#ef4444" />}
                                                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: currentProposal.status === 'approved' ? '#059669' : currentProposal.status === 'rejected' ? '#dc2626' : '#d97706' }}>
                                                    {currentProposal.status === 'pending' && 'Đang chờ Admin duyệt'}
                                                    {currentProposal.status === 'approved' && 'Đã được duyệt ✓'}
                                                    {currentProposal.status === 'rejected' && 'Đã bị từ chối'}
                                                </span>
                                            </div>
                                            {currentProposal.status === 'rejected' && currentProposal.adminNote && (
                                                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '8px 0 0', fontStyle: 'italic' }}>Lý do: {currentProposal.adminNote}</p>
                                            )}
                                            {currentProposal.status === 'rejected' && (
                                                <button onClick={onSubmitProposal} disabled={isSubmittingProposal} className="admin-btn admin-btn-primary" style={{ marginTop: '10px', fontSize: '0.8rem' }}>
                                                    <Send size={14} /> Gửi lại đề xuất
                                                </button>
                                            )}
                                            {currentProposal.status === 'approved' && (
                                                <button onClick={onSubmitProposal} disabled={isSubmittingProposal} className="admin-btn" style={{ marginTop: '10px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '0.8rem', cursor: isSubmittingProposal ? 'not-allowed' : 'pointer', opacity: isSubmittingProposal ? 0.6 : 1 }}>
                                                    <Send size={14} /> {isSubmittingProposal ? 'Đang gửi...' : 'Đề xuất cập nhật tài liệu chính thức'}
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <button onClick={onSubmitProposal} disabled={isSubmittingProposal} className="admin-btn" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '8px', fontSize: '0.85rem', cursor: isSubmittingProposal ? 'not-allowed' : 'pointer', opacity: isSubmittingProposal ? 0.6 : 1 }}>
                                            <Send size={14} /> {isSubmittingProposal ? 'Đang gửi...' : 'Gửi đề xuất chính thức'}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
