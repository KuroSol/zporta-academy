import React, { createContext, useState } from 'react';
import Modal from '../components/Modal/Modal';

import Login from '../components/Login';

export const AuthModalContext = createContext({
  openLoginModal: () => {},
  closeLoginModal: () => {},
});

export const AuthModalProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const openLoginModal  = () => setIsOpen(true);
  const closeLoginModal = () => setIsOpen(false);

  return (
    <AuthModalContext.Provider value={{ openLoginModal, closeLoginModal }}>
      {children}
      <Modal
        isOpen={isOpen}
        onClose={closeLoginModal}
        title="Log in to continue"
        size="small"
      >
        <Login
          onSuccess={closeLoginModal}  // close modal on successful login
          skipRedirect={true}          // prevent full-page redirect
          inModal={true}               // render the modal-style form
        />
      </Modal>
    </AuthModalContext.Provider>
  );
};
