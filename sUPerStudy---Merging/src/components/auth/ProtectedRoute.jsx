import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function ProtectedRoute({ children }) {
    const { user, loading, signOut, isExpired } = useAuth();

    useEffect(() => {
        if (user && user.disabled) {
            signOut();
        }
    }, [user, signOut]);

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner" />
                <p>Đang tải...</p>
            </div>
        );
    }

    if (!user || user.disabled) {
        return <Navigate to="/login" replace />;
    }

    // Pending approval or expired → redirect to pending page
    if (user.status === 'pending' || (user.status === 'approved' && isExpired())) {
        return <Navigate to="/pending" replace />;
    }

    // Not approved (e.g. rejected or no status)
    if (user.status !== 'approved') {
        return <Navigate to="/login" replace />;
    }

    // Staff cannot access the main app interface at all
    if (user.role === 'staff') {
        return <Navigate to="/admin" replace />;
    }

    // Redirect admin/teacher to their panel by default unless they manually switched to App mode
    const viewMode = sessionStorage.getItem('viewMode');
    if (viewMode !== 'app') {
        if (user.role === 'admin') {
            return <Navigate to="/admin" replace />;
        }
        if (user.role === 'teacher') {
            return <Navigate to="/teacher" replace />;
        }
    }

    return children;
}
