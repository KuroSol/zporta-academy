import React, { useEffect, useState, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaAngleDown,
  FaComment,
  FaCog,
  FaTimes,
  FaSave,
  FaEdit,
  FaTrash,
} from 'react-icons/fa';
import CustomEditor from './components/Editor/CustomEditor';
import AsyncSelect from 'react-select/async';
import apiClient from './api';
import { AuthContext } from './context/AuthContext';
import './DiaryList.css';
import './DiaryManagement.css';
import './DiaryEditor.css'; // Ensure your CSS file is imported

const DiaryEditor = ({ onNoteCreated }) => {
  const navigate = useNavigate();
  const editorRef = useRef(null);
  const [selectedMentions, setSelectedMentions] = useState([]);
  const { logout } = useContext(AuthContext);
  const [error, setError] = useState('');

  // Function to load user options for mention functionality
  const loadUserOptions = async (inputValue, callback) => {
    console.log("--- loadUserOptions called ---");
    console.log("Input Value:", inputValue);
  
    if (inputValue.length < 2) {
      console.log("Input too short, returning empty callback.");
      callback([]);
      return;
    }
  
    console.log("Input >= 2 chars, proceeding to try block.");
    try {
      setError('');
      console.log("Attempting apiClient.get for:", inputValue);
  
      const response = await apiClient.get(`/users/guides/?search=${inputValue}`);
      const data = response.data;
  
      console.log("API Response OK:", data);
  
      const options = data.map(guide => ({
        value: guide.id,
        label: guide.username,
      }));
      console.log("Mapped options:", options);
      callback(options);
  
    } catch (error) {
      console.error('Error fetching users:', error.response ? error.response.data : error.message);
      callback([]);
      setError('Failed to load users for mentioning.');
      if (error.response?.status === 401) logout();
    }
  };
  
  const handleSave = async () => {
    const tokenCheck = localStorage.getItem('token');
    if (!tokenCheck) {
      alert('You must be logged in to save a note.');
      navigate('/login');
      return;
    }
  
    if (!editorRef.current) {
      alert('Editor not loaded.');
      return;
    }
  
    const content = editorRef.current.getContent();
    const privacy = editorRef.current.getPrivacy();
  
    if (!content.trim()) {
      alert('Cannot save an empty note.');
      return;
    }
  
    const mentions = selectedMentions.map(option => option.value);
    setError('');
  
    try {
      const payload = { text: content, privacy: privacy, mentions: mentions };
      const response = await apiClient.post('/notes/', payload);
  
      console.log('Note saved successfully:', response.data);
      alert('Your diary has been saved!');
      if (onNoteCreated) {
        onNoteCreated();
      }
     
    } catch (error) {
      console.error('Error during save:', error.response ? error.response.data : error.message);
      const errorMsg = error.response?.data?.detail || JSON.stringify(error.response?.data) || 'Failed to save the diary.';
      setError(errorMsg);
      alert('An error occurred while saving your diary: ' + errorMsg);
      if (error.response?.status === 401) logout();
    }
  };

  // Handler for cancel button to simply go back to the previous page
  const handleCancel = () => {
    navigate(-1);
  };

  return (
    <div className="diary-editor-container">
      <h1>Diary Editor</h1>
      {error && <p className="error">{error}</p>}
      <CustomEditor
        ref={editorRef}
        placeholder="Write your diary entry here..."
        enablePrivacyToggle={true}
        mediaCategory="diary"
      />
      <div className="mention-container">
        <label>Mention Users:</label>
        <AsyncSelect
          isMulti
          cacheOptions
          defaultOptions
          loadOptions={loadUserOptions}
          onChange={setSelectedMentions}
          placeholder="Type at least 2 characters..."
          classNamePrefix="react-select"
        />
      </div>
      <div className="button-group">
        <button className="zporta-btn" onClick={handleSave}>
          Save
        </button>
        <button className="zporta-btn cancel-btn" onClick={handleCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default DiaryEditor;
