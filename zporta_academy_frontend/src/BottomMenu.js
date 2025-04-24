import React, { useState } from 'react';
import { 
  FaPlus, FaTimes, FaBook, FaChalkboardTeacher, 
  FaQuestion, FaBookOpen, FaPencilAlt  
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import './BottomMenu.css';

const BottomMenu = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleAction = (action) => {
    setOpen(false);
    switch(action) {
      case 'course': navigate('/admin/create-course'); break;
      case 'lesson': navigate('/admin/create-lesson'); break;
      case 'quiz': navigate('/admin/create-quiz'); break;
      case 'diary': navigate('/diary'); break;
      case 'post': navigate('/admin/create-post'); break;
      default: break;
    }
  };

  return (
    <div className="radial-menu-container"> {/* This was missing */}
      <div className={`radial-menu ${open ? 'open' : ''}`}>
        <button className="radial-menu-button main-button" onClick={() => setOpen(!open)}>
          {open ? <FaTimes size={24} /> : <FaPlus size={24} />}
        </button>
        <button className="radial-menu-button item item-1" onClick={() => handleAction('course')}>
          <FaBook size={20} />
        </button>
        <button className="radial-menu-button item item-2" onClick={() => handleAction('lesson')}>
          <FaChalkboardTeacher size={20} />
        </button>
        <button className="radial-menu-button item item-3" onClick={() => handleAction('quiz')}>
          <FaQuestion size={20} />
        </button>
        <button className="radial-menu-button item item-4" onClick={() => handleAction('diary')}>
          <FaBookOpen size={20} />
        </button>
        {/*<button className="radial-menu-button item item-5" onClick={() => handleAction('post')}>
          <FaPencilAlt size={20} />
        </button>
        */}
      </div>
    </div>
  );
};

export default BottomMenu;
