import React, { createContext, useState, useContext } from 'react';
import Modal from '../components/Modal/Modal';           // adjust import path if needed
import Login from '../Login';                         // reuse your Login component

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
        {/* Use your existing Login component but prevent it from redirecting */}
        <Login 
          onSuccess={closeLoginModal}   // close modal on successful login
          skipRedirect={true}           // see next step
        />
      </Modal>
    </AuthModalContext.Provider>
  );
};
