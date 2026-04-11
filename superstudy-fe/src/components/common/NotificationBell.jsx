import { useState, useEffect, useRef } from 'react';
import { Bell, Check, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToUserNotifications, markNotificationAsRead, markAllNotificationsAsRead, cleanupOldReadNotifications, clearAllNotifications } from '../../services/notificationService';
import './NotificationBell.css';

export default function NotificationBell() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        if (!user?.uid) return;

        // Auto-cleanup old read notifications (>7 days) on mount
        cleanupOldReadNotifications(user.uid).catch(console.error);

        const unsubscribe = subscribeToUserNotifications(user.uid, (data) => {
            setNotifications(data);
        });

        return () => unsubscribe();
    }, [user?.uid]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const formatNotificationTime = (createdAt) => {
        if (!createdAt) return 'Vừa xong';
        const rawDate = createdAt?.toDate ? createdAt.toDate() : createdAt;
        const parsedDate = rawDate instanceof Date ? rawDate : new Date(rawDate);
        return Number.isNaN(parsedDate.getTime())
            ? 'Vừa xong'
            : parsedDate.toLocaleString('vi-VN');
    };

    const handleNotificationClick = async (notification) => {
        if (!notification.isRead) {
            await markNotificationAsRead(notification.id);
        }
        setIsOpen(false);
        if (notification.link) {
            navigate(notification.link, { state: { notificationData: notification } });
        }
    };

    const handleMarkAllRead = async (e) => {
        e.stopPropagation();
        await markAllNotificationsAsRead(user?.uid);
    };

    const handleClearAll = async (e) => {
        e.stopPropagation();
        setIsClearing(true);
        try {
            await clearAllNotifications(user?.uid);
        } catch (err) {
            console.error('Error clearing notifications:', err);
        }
        setIsClearing(false);
    };

    return (
        <div className="notification-bell-container" ref={dropdownRef}>
            <button
                className="notification-bell-btn"
                onClick={() => setIsOpen(!isOpen)}
                title="Thông báo"
            >
                <Bell size={18} />
                {unreadCount > 0 && (
                    <span className="notification-badge">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="notification-dropdown">
                    <div className="notification-header">
                        <h3>Thông báo</h3>
                        {unreadCount > 0 && (
                            <button className="mark-all-read-btn" onClick={handleMarkAllRead}>
                                <Check size={14} />
                                Đánh dấu đã đọc
                            </button>
                        )}
                    </div>

                    <div className="notification-list">
                        {notifications.length === 0 ? (
                            <div className="notification-empty">Không có thông báo nào</div>
                        ) : (
                            notifications.map(notif => (
                                <div
                                    key={notif.id}
                                    className={`notification-item ${!notif.isRead ? 'unread' : ''}`}
                                    onClick={() => handleNotificationClick(notif)}
                                >
                                    <div className="notification-content">
                                        <div className="notification-title">{notif.title}</div>
                                        <div className="notification-message">{notif.message}</div>
                                        <div className="notification-time">
                                            {formatNotificationTime(notif.createdAt)}
                                        </div>
                                    </div>
                                    {!notif.isRead && <div className="notification-dot" />}
                                </div>
                            ))
                        )}
                    </div>

                    {notifications.length > 0 && (
                        <div className="notification-footer">
                            <button className="notification-clear-btn" onClick={handleClearAll} disabled={isClearing}>
                                <Trash2 size={13} />
                                {isClearing ? 'Đang xoá...' : 'Xoá tất cả thông báo'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
