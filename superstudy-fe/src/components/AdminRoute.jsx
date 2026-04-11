import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const STAFF_ALLOWED_ADMIN_PATTERNS = [
    /^\/admin$/,
    /^\/admin\/users$/,
    /^\/admin\/groups$/,
    /^\/admin\/groups\/[^/]+$/,
    /^\/admin\/groups\/[^/]+\/students\/[^/]+$/,
    /^\/admin\/reward-points$/,
    /^\/admin\/report-periods$/,
    /^\/admin\/feedback$/,
];

function canStaffAccessAdminPath(pathname) {
    return STAFF_ALLOWED_ADMIN_PATTERNS.some((pattern) => pattern.test(pathname));
}

export default function AdminRoute({ children }) {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }}></div>
            </div>
        );
    }

    if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
        return <Navigate to="/" replace />;
    }

    if (user.role === 'staff' && !canStaffAccessAdminPath(location.pathname)) {
        return <Navigate to="/admin" replace />;
    }

    return children;
}
