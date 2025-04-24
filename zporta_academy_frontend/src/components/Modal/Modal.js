import React from 'react';
import styles from './Modal.module.css'; // Make sure this path is correct

const Modal = ({ children, isOpen, onClose }) => {
    if (!isOpen) {
        return null;
    }

    // Function to handle overlay click without closing if content is clicked
    const handleOverlayClick = (e) => {
         // Only close if the overlay itself (the background) is clicked
         if (e.target === e.currentTarget) {
             onClose();
         }
    };

    return (
        <div className={styles.modalOverlay} onClick={handleOverlayClick}> {/* Close on overlay click */}
            <div className={styles.modalContent}> {/* Removed stopPropagation */}
                <button className={styles.closeButton} onClick={onClose}>
                    &times; {/* Close icon */}
                </button>
                {/* Render the content passed to the modal (e.g., CreateLesson form) */}
                {children}
            </div>
        </div>
    );
};

export default Modal;