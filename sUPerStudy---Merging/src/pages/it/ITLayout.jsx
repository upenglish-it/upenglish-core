import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Gamepad2, LogOut, Home, Menu, Settings, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Avatar from '../../components/common/Avatar';
import BrandLogo from '../../components/common/BrandLogo';
import '../admin/AdminLayout.css';
import './ITLayout.css';

export default function ITLayout() {
    const { pathname } = useLocation();
    const { signOut, user } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        document.body.classList.add('admin-body');
        return () => document.body.classList.remove('admin-body');
    }, []);

    return (
        <div className="admin-container">
            {sidebarOpen && <div className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
            <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="admin-sidebar-header">
                    <BrandLogo size="1.5rem" />
                </div>
                <nav className="admin-nav">
                    <Link to="/it" className={`admin-nav-item ${pathname === '/it' ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                        <LayoutDashboard size={20} /> Tổng quan
                    </Link>
                    <Link to="/it/games" className={`admin-nav-item ${pathname.includes('/it/games') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                        <Gamepad2 size={20} /> Game của tôi
                    </Link>
                </nav>
            </aside>
            <main className="admin-main">
                <header className="admin-header">
                    <div className="admin-header-left">
                        <button className="admin-menu-btn" onClick={() => setSidebarOpen(true)}>
                            <Menu size={24} />
                        </button>
                        <div className="admin-header-user-profile">
                            <Avatar src={user?.photoURL} alt={user?.displayName} size={40} />
                            <div className="admin-header-user-details mobile-hide">
                                <div className="admin-user-name">{user?.displayName || 'IT'}</div>
                                <span className="admin-role-badge-header it-role-badge">IT Developer</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ flex: 1 }}></div>

                    <div className="admin-header-actions-group">
                        {user?.role === 'admin' && (
                            <>
                                <Link to="/admin" className="admin-header-action-btn" title="Về trang Admin">
                                    <Home size={18} />
                                    <span className="action-text">Admin</span>
                                </Link>
                                <div className="admin-header-divider"></div>
                            </>
                        )}
                        <button onClick={signOut} className="admin-header-action-btn text-danger" title="Đăng xuất">
                            <LogOut size={18} />
                            <span className="action-text">Đăng xuất</span>
                        </button>
                    </div>
                </header>
                <div className="admin-content">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
