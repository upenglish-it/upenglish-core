import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function ITRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }}></div>
            </div>
        );
    }

    // Allow IT and Admin roles
    if (!user || (user.role !== 'it' && user.role !== 'admin')) {
        return <Navigate to="/" replace />;
    }

    return children;
}
