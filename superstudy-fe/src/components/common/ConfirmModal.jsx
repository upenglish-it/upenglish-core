import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import './ConfirmModal.css';

const ConfirmModal = ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'Xác nhận',
    cancelText = 'Hủy',
    type = 'danger' // danger | primary | warning
}) => {
    if (!isOpen) return null;

    return (
        <div className="custom-modal-overlay">
            <div className="custom-modal-content">
                <div className="custom-modal-header">
                    <div className={`custom-modal-icon ${type}`}>
                        <AlertTriangle size={24} />
                    </div>
                    <h3 className="custom-modal-title">{title}</h3>
                    <button className="custom-modal-close" onClick={onCancel}>
                        <X size={20} />
                    </button>
                </div>
                <div className="custom-modal-body">
                    <p>{message}</p>
                </div>
                <div className="custom-modal-footer">
                    <button className="custom-modal-btn cancel" onClick={onCancel}>
                        {cancelText}
                    </button>
                    <button className={`custom-modal-btn confirm ${type}`} onClick={onConfirm}>
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
