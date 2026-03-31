import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function TeacherRoute({ children }) {
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

    // Pending approval or expired
    if (user.status === 'pending' || (user.status === 'approved' && isExpired())) {
        return <Navigate to="/pending" replace />;
    }

    // Must be at least teacher (teachers & admins can access teacher routes)
    if (user.status !== 'approved' || (user.role !== 'teacher' && user.role !== 'admin')) {
        return <Navigate to="/" replace />;
    }

    return children;
}
