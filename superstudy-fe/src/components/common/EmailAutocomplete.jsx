import { useState, useEffect, useRef } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getWhitelistEmails } from '../../services/adminService';
import { Mail } from 'lucide-react';

let cachedUsers = null;
let cachedWhitelist = null;

export default function EmailAutocomplete({ value, onChange, onSubmit, onSelect, disabled, placeholder, roleFilter }) {
    const [suggestions, setSuggestions] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [allEmails, setAllEmails] = useState([]);
    const wrapperRef = useRef(null);

    useEffect(() => {
        async function loadEmails() {
            try {
                if (!cachedUsers) {
                    const snap = await getDocs(collection(db, 'users'));
                    const users = [];
                    snap.forEach(doc => users.push({ uid: doc.id, ...doc.data() }));
                    cachedUsers = users;
                }
                if (!cachedWhitelist) {
                    cachedWhitelist = await getWhitelistEmails();
                }

                const registeredEmails = new Set(cachedUsers.map(u => (u.email || '').toLowerCase()));
                let combined = [
                    ...cachedUsers.map(u => ({
                        email: u.email,
                        displayName: u.displayName || '',
                        type: 'user',
                        role: u.role || ''
                    })),
                    ...cachedWhitelist
                        .filter(w => !registeredEmails.has(w.email.toLowerCase()))
                        .map(w => ({
                            email: w.email,
                            displayName: '',
                            type: 'whitelist',
                            role: w.role || ''
                        }))
                ];
                // Filter by role if roleFilter is provided
                if (roleFilter) {
                    combined = combined.filter(e => e.role === roleFilter);
                }
                setAllEmails(combined);
            } catch (err) {
                console.error('Error loading emails for autocomplete:', err);
            }
        }
        loadEmails();
    }, [roleFilter]);

    useEffect(() => {
        function handleClickOutside(e) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!value || value.trim().length === 0) {
            setSuggestions([]);
            setShowDropdown(false);
            return;
        }
        const search = value.toLowerCase();
        const filtered = allEmails.filter(e =>
            e.email.toLowerCase().includes(search) ||
            (e.displayName && e.displayName.toLowerCase().includes(search))
        ).slice(0, 8);
        setSuggestions(filtered);
        setShowDropdown(filtered.length > 0);
    }, [value, allEmails]);

    function handleSelect(email) {
        onChange(email);
        setShowDropdown(false);
        // Auto-submit after selecting
        setTimeout(() => {
            if (onSubmit) onSubmit(email);
        }, 50);
    }

    const inputRef = useRef(null);

    // Calculate fixed dropdown position
    const [dropdownStyle, setDropdownStyle] = useState({});
    useEffect(() => {
        if (showDropdown && inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect();
            setDropdownStyle({
                position: 'fixed',
                top: rect.bottom + 4,
                left: rect.left,
                width: rect.width,
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                zIndex: 9999,
                maxHeight: '200px',
                overflowY: 'auto',
            });
        }
    }, [showDropdown, value]);

    return (
        <div ref={wrapperRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <input
                ref={inputRef}
                type="email"
                value={value}
                onChange={e => onChange(e.target.value)}
                disabled={disabled}
                placeholder={placeholder || "Nhập email học viên..."}
                required
                style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '0.85rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    outline: 'none',
                    boxSizing: 'border-box'
                }}
                onFocus={() => {
                    if (value && value.trim().length > 0 && suggestions.length > 0) {
                        setShowDropdown(true);
                    }
                }}
                onKeyDown={e => {
                    if (e.key === 'Escape') setShowDropdown(false);
                }}
            />
            {showDropdown && (
                <div style={dropdownStyle}>
                    {suggestions.map((s, i) => (
                        <div
                            key={s.email + i}
                            onClick={() => handleSelect(s.email)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '8px 12px',
                                cursor: 'pointer',
                                borderBottom: i < suggestions.length - 1 ? '1px solid #f1f5f9' : 'none',
                                transition: 'background 0.15s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            {s.type === 'whitelist' ? (
                                <div style={{
                                    width: '28px', height: '28px', borderRadius: '50%',
                                    background: '#f0fdf4', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', flexShrink: 0
                                }}>
                                    <Mail size={14} color="#22c55e" />
                                </div>
                            ) : (
                                <div style={{
                                    width: '28px', height: '28px', borderRadius: '50%',
                                    background: '#eff6ff', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', flexShrink: 0, fontSize: '0.7rem',
                                    fontWeight: 700, color: '#3b82f6'
                                }}>
                                    {(s.displayName || s.email).charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{
                                    fontSize: '0.85rem', fontWeight: 600, color: '#1e293b',
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                }}>
                                    {s.email}
                                </div>
                                {(s.displayName || s.type === 'whitelist') && (
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                        {s.displayName || (s.type === 'whitelist' ? 'Pre-approved' : '')}
                                        {s.type === 'whitelist' && (
                                            <span style={{
                                                marginLeft: '6px', fontSize: '0.6rem',
                                                padding: '1px 4px', borderRadius: '3px',
                                                background: '#fef3c7', color: '#92400e', fontWeight: 600
                                            }}>
                                                Chưa đăng nhập
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
