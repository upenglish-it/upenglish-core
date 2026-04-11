import { Link } from 'react-router-dom';
import { forwardRef } from 'react';

/**
 * AppLink — wrapper around React Router <Link> that works correctly
 * both inside the normal app and when embedded in an iframe.
 * 
 * Left-click: uses React Router (client-side navigation, no reload)
 * Middle-click / Ctrl+click: opens correct URL via __APP_BASE__ + _preview param
 */
const AppLink = forwardRef(function AppLink({ to, children, ...props }, ref) {
    return <Link ref={ref} to={to} {...props}>{children}</Link>;
});

export default AppLink;
