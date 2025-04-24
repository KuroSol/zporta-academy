import React, { useState, useContext } from 'react'; // <-- ADD useContext
import { useNavigate } from 'react-router-dom';
import CustomEditor from '../Editor/CustomEditor';
import apiClient from '../../api'; // <-- ADD apiClient (Adjust path if needed)
import { AuthContext } from '../../context/AuthContext'; // <-- ADD AuthContext

const CreatePage = () => {
    const [title, setTitle] = useState('');
    const [permalink, setPermalink] = useState('');
    const [content, setContent] = useState('');
    const [message, setMessage] = useState('');
    const navigate = useNavigate();
    const { token, logout } = useContext(AuthContext);

// handleSave using apiClient
const handleSave = async () => {
    setMessage(''); // Clear previous messages

    // Check if user is logged in using token from context
    if (!token) {
      setMessage('You must be logged in to create a page.');
      // Optional: navigate('/login');
      return;
    }

    // Simple validation (optional but recommended)
    if (!title.trim() || !permalink.trim() || !content.trim()) {
        setMessage('Title, Permalink, and Content are required.');
        return;
    }

    // Payload includes content from state (set by CustomEditor's onSave)
    const payload = { title, permalink, content };

    try {
      // Use apiClient.post - Auth handled by apiClient
      const response = await apiClient.post('/pages/', payload);

      // --- Handle Success ---
      // Axios data is in response.data
      // Check if we got the expected permalink back
      if (response.data && response.data.permalink) {
         setMessage('Page created successfully!');
         // Redirect using the permalink from the response
         navigate(`/${response.data.permalink}`);
      } else {
         // Handle case where API gives 2xx but response is unexpected
         console.error("Create page API response missing permalink:", response.data);
         setMessage("Page created, but failed to get redirect URL.");
         // Maybe navigate to a default page?
         // navigate('/');
      }

    } catch (err) {
      // --- Handle Errors ---
      console.error("Error creating page:", err.response ? err.response.data : err.message);
      // Extract specific error message from API response if available
      const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.message;
      // Handle potential validation errors (if backend returns field errors in an object)
      let displayError = apiErrorMessage;
      if (typeof err.response?.data === 'object' && err.response?.data !== null) {
          const fieldErrors = Object.entries(err.response.data)
                                  .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(' ') : messages}`)
                                  .join(' | ');
          if (fieldErrors) displayError = fieldErrors;
      }
      setMessage(`Failed to create page: ${displayError || "Please try again."}`);

      // Check for authorization errors
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout(); // Call logout from AuthContext
        // navigate('/login'); // Optional redirect
      }
    }
  };

    return (
        <div style={{ padding: '20px' }}>
            <h2>Create New Page</h2>
            {message && <p style={{ color: 'red' }}>{message}</p>}
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    handleSave();
                }}
            >
                <div>
                    <label>Title:</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Enter page title"
                        required
                    />
                </div>
                <div>
                    <label>Permalink:</label>
                    <input
                        type="text"
                        value={permalink}
                        onChange={(e) => setPermalink(e.target.value)}
                        placeholder="Enter permalink (e.g., about-us)"
                        required
                    />
                </div>
                <div>
                    <label>Content:</label>
                    <CustomEditor
                        placeholder="Write your page content here..."
                        onSave={(editorContent) => setContent(editorContent)}
                    />
                </div>
                <button type="submit" style={{ marginTop: '20px' }}>Create Page</button>
            </form>
        </div>
    );
};

export default CreatePage;
