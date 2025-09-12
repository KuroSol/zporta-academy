import React, { useState, useRef, useContext } from "react";
import { useRouter } from "next/router";
import CustomEditor from "@/components/Editor/CustomEditor";
import apiClient from "@/api";
import { AuthContext } from "@/context/AuthContext";
import styles from "@/styles/admin/CreatePost.module.css";

const CreatePost = () => {
    const [title, setTitle] = useState("");
    // No separate content state needed if using ref on save
    const [coverImage, setCoverImage] = useState(null);
    const [message, setMessage] = useState("");
    const router = useRouter();
    const editorRef = useRef(null);
    const { logout } = useContext(AuthContext); // <-- Use Context

    const handleSave = async () => {
        // Removed manual token retrieval
        // const token = localStorage.getItem("token");
        // if (!token) { ... } // Rely on 401 error handling now

        // Retrieve the content from the editor using its ref
        const editorContent = editorRef.current ? editorRef.current.getContent() : "";
        if (!editorContent || !editorContent.trim()) {
            setMessage("Content cannot be empty.");
            return;
        }
        if (!title.trim()) {
             setMessage("Title cannot be empty.");
             return;
        }


        // Build a FormData object
        const formData = new FormData();
        formData.append("title", title);
        formData.append("content", editorContent);
        if (coverImage) {
            formData.append("og_image", coverImage); // Ensure backend expects 'og_image'
        }
        // Add any other fields your Post model needs from state here

        setMessage(''); // Clear previous message

        try {
            // Use apiClient.post with relative URL '/posts/'.
            // Pass formData directly. Auth token added by interceptor.
            // Axios handles Content-Type for FormData automatically.
            const response = await apiClient.post('/posts/', formData);

            // If await finishes without error, it succeeded (2xx status)
            const data = response.data;
            setMessage("Post created successfully!");
            console.log("Post created:", data);

            // Navigate using the permalink from the response data
            // Double-check this path against your App.js router setup for viewing posts
            if (data.permalink) {
              router.push(`/posts/${data.permalink}`);
            } else {
              router.push('/explore');
            }

        } catch (error) {
            // Handle Axios errors
            console.error("Error creating post:", error);
            if (error.response && error.response.data) {
               let errorMsg = "Failed to create post.";
               if (typeof error.response.data === 'object') {
                 // Format DRF validation errors
                 errorMsg = Object.entries(error.response.data)
                   .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(' ') : messages}`)
                   .join(' | ');
               } else {
                 errorMsg = error.response.data.error || error.response.data.detail || errorMsg;
               }
               setMessage(errorMsg);
            } else if (error.request) {
              setMessage('Network error. Could not connect to the server.');
            } else {
              setMessage('An unexpected error occurred while creating the post.');
            }
             // Logout on authentication errors
             if (error.response?.status === 401 || error.response?.status === 403) {
                 logout();
             }
        }
    };

    // JSX using form's onSubmit
    return (
        <div className={styles.createPostContainer}>
            <h2>Create New Post</h2>
            {/* Use a more specific error/success class */}
            {message && <p className={styles.message}>{message}</p>}
            <form className={styles.form}
                onSubmit={(e) => {
                    e.preventDefault(); // Prevent default form submission
                    handleSave(); // Call save handler
                }}
            >
                <div className={styles.inputGroup}>
                    <label>Title:</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Enter post title"
                        required
                    />
                </div>
                <div className={styles.inputGroup}>
                    <label>Cover Image (optional):</label>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                                setCoverImage(e.target.files[0]);
                            } else {
                                 setCoverImage(null); // Handle case where file selection is cancelled
                            }
                        }}
                    />
                    {/* Optional: Preview selected image */}
                    {coverImage && <img src={URL.createObjectURL(coverImage)} alt="Cover preview" style={{maxWidth: '200px', marginTop: '10px'}} />}
                </div>
                <div className={styles.inputGroup}>
                    <label>Content:</label>
                    {/* Pass mediaCategory="post" */}
                    <CustomEditor
                        ref={editorRef}
                        placeholder="Write your post content here..."
                        // onSave is not used if content is retrieved via ref on submit
                        // onSave={(editorContent) => setContent(editorContent)} // Remove if not needed
                        mediaCategory="post" // For uploads within the editor
                    />
                </div>
                <button type="submit" className={styles.savePostButton}>
                    Create Post
                </button>
            </form>
        </div>
    );
};

export default CreatePost;