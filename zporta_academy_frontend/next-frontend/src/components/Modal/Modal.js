// src/components/Modal/Modal.js
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';
import { FaTimes } from 'react-icons/fa';

/**
 * A reusable, accessible, and responsive modal component.
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Controls if the modal is visible.
 * @param {function} props.onClose - Function to call when the modal should be closed.
 * @param {string} [props.title] - Optional title for the modal header.
 * @param {React.ReactNode} props.children - The content to display inside the modal.
 * @param {string} [props.size='medium'] - Size of the modal: 'small', 'medium', 'large', 'fullscreen'.
 */
const Modal = ({ isOpen, onClose, title, children, size = 'medium' }) => {
  // Lock/unlock background scroll by toggling no-scroll on html/body
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    if (isOpen) {
      html.classList.add(styles['no-scroll']);
      body.classList.add(styles['no-scroll']);
    } else {
      html.classList.remove(styles['no-scroll']);
      body.classList.remove(styles['no-scroll']);
    }

    return () => {
      html.classList.remove(styles['no-scroll']);
      body.classList.remove(styles['no-scroll']);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const contentClass = `${styles.modalContent} ${styles[size] || styles.medium}`;

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={contentClass} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          {title && <h2 className={styles.modalTitle}>{title}</h2>}
          <button
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close modal"
          >
            <FaTimes />
          </button>
        </div>
        <div className={styles.modalBody}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
