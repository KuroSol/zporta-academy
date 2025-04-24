import React, { useEffect, useState, useContext, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { FaRegClock, FaUser, FaEdit, FaTrash } from "react-icons/fa";
import CustomEditor from "./Editor/CustomEditor";
import apiClient from "../api";
import { AuthContext } from "../context/AuthContext";
import "./PostDetail.css";
import "./Editor/ViewerAccordion.css"; // Ensure this path is correct and file exists

// --- Initialize Accordions Function (OUTSIDE Component) ---
// REPLACE your existing initializeAccordions function with this entire block:

function initializeAccordions(containerElement) {
  if (!containerElement) { return; }
  const accordions = containerElement.querySelectorAll(':scope > .accordion-item');

  accordions.forEach((accordion) => {
      const header = accordion.querySelector(':scope > .accordion-header');
      const contents = accordion.querySelectorAll(':scope > .accordion-content');
      const defaultState = accordion.getAttribute('data-default-state') || 'closed';

      if (!header || contents.length === 0 || accordion.dataset.accordionInitialized === 'true') {
          return;
      }
      accordion.dataset.accordionInitialized = 'true';

      if (defaultState === 'open') {
          accordion.classList.add('is-open');
          contents.forEach(content => {
               setTimeout(() => {
                   if(accordion.classList.contains('is-open')) {
                      content.style.maxHeight = content.scrollHeight + 'px';
                   }
              }, 50);
          });
      } else {
          accordion.classList.remove('is-open');
          contents.forEach(content => { content.style.maxHeight = '0px'; });
      }

      const clickHandler = () => {
        const isOpen = accordion.classList.toggle('is-open');
        contents.forEach(content => {
            if (isOpen) {
                // Try a slightly longer delay before getting scrollHeight
                setTimeout(() => {
                    if(accordion.classList.contains('is-open')) {
                         const calculatedHeight = content.scrollHeight;
                         // console.log('Setting max-height to:', calculatedHeight + 'px', content); // Keep for debugging
                         content.style.maxHeight = calculatedHeight + 'px';
                    }
               }, 100); // <<< INCREASED DELAY (e.g., from 0/10 to 100ms)
            } else {
                // Setting to 0 can be immediate
                content.style.maxHeight = '0px';
            }
        });
    };
    // Remove previous listener before adding new one
     if(header.__accordionClickHandler__) {
        header.removeEventListener('click', header.__accordionClickHandler__);
     }
    header.addEventListener('click', clickHandler);
    header.__accordionClickHandler__ = clickHandler;
      contents.forEach(content => {
           requestAnimationFrame(() => { initializeAccordions(content); });
      });
  });
}
// --- End Replace Block ---
// --- End Initialize Accordions Function ---
// Add this function definition
const sanitizeContentViewerHTML = (htmlString) => {
  if (!htmlString) return "";
  try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, 'text/html');
      const editableElements = doc.querySelectorAll('[contenteditable="true"]');
      editableElements.forEach(el => {
          el.removeAttribute('contenteditable');
      });
      // Make sure to return the content of the body,
      // otherwise you might get extra <html><head></head><body>...</body></html> tags
      return doc.body.innerHTML;
  } catch (error) {
      console.error("Error sanitizing HTML for viewer:", error);
      return htmlString; // Fallback to original on error
  }
};

const PostDetail = () => {
    const { '*': permalink } = useParams();
    const navigate = useNavigate();
    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [editMode, setEditMode] = useState(false);
    const [editPost, setEditPost] = useState({ title: "", content: "" });
    const editorRef = useRef(null);
    const contentDisplayRef = useRef(null); // Ref for view mode content
    const { token, user, logout } = useContext(AuthContext);

    const stripHTML = (html) => {
        if (!html) return '';
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = html;
        return tempDiv.textContent || tempDiv.innerText || "";
    };

    // Fetch post details
    useEffect(() => {
        let isMounted = true;
        const fetchPost = async () => {
            // No need to set loading true if already true
            // setLoading(true); // Already true initially
            setError('');
            try {
                const response = await apiClient.get(`/posts/${encodeURIComponent(permalink)}/`);
                if (isMounted) { setPost(response.data); }
            } catch (err) {
                console.error("Error fetching post:", err.response ? err.response.data : err.message);
                if (isMounted) {
                    setError(err.response?.status === 404 ? "Post not found." : "Error fetching post.");
                }
            } finally {
                 if (isMounted) { setLoading(false); }
            }
        };

        if (permalink) { fetchPost(); }
        else {
            setError("Invalid post URL.");
            setLoading(false);
        }
        return () => { isMounted = false; };
    }, [permalink]);


    // Initialize accordions on content load/change in view mode
    useEffect(() => {
        if (!editMode && post?.content && contentDisplayRef.current) {
             // Simple initialization call
             initializeAccordions(contentDisplayRef.current);
        }
        // Cleanup might be needed here eventually if listeners aren't removed otherwise
    }, [editMode, post?.content]);


    const isOwner = post && user && post.created_by === user.username;

    const handleDelete = async () => {
         if (!post || !window.confirm("Are you sure you want to delete this post?")) return;
         setError('');
         try {
             await apiClient.delete(`/posts/${encodeURIComponent(permalink)}/delete/`);
             alert("Post deleted successfully.");
             navigate("/explore");
         } catch (err) {
             console.error("Error deleting post:", err.response ? err.response.data : err.message);
             setError(err.response?.data?.detail || "Failed to delete post.");
             alert("Error deleting post.");
             // Consider logout on auth error
         }
     };

    const handleEditClick = () => {
        if (!post) return;
        setEditPost({ title: post.title, content: post.content });
        setEditMode(true);
    };

    const handleCancelEdit = () => {
        setEditMode(false);
        setError('');
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();
        if (!editorRef.current || !post) return;
        const updatedContent = editorRef.current.getContent();
        if (!editPost.title?.trim() || !updatedContent?.trim()) {
             alert("Title and Content cannot be empty."); return;
         }
        const payload = { title: editPost.title, content: updatedContent };
        setError('');
        try {
            const response = await apiClient.put(`/posts/${encodeURIComponent(permalink)}/update/`, payload);
            setPost(response.data); // Update local state with response
            setEditMode(false);
            alert("Post updated successfully!");
        } catch (err) {
            console.error("Error updating post:", err.response ? err.response.data : err.message);
            setError(JSON.stringify(err.response?.data) || "Failed to update post.");
            alert("Error updating post.");
            // Consider logout on auth error
        }
    };

    // --- Render Logic ---
    if (loading) return <p>Loading post...</p>;
    if (error && !post) return <p className="error" style={{ color: 'red' }}>{error}</p>;
    if (!post) return <p>Post not found.</p>;

    // --- JSX ---
    return (
        <div className="post-detail-container">
            <Helmet>
                <title>{post.seo_title || post.title}</title>
                <meta name="description" content={post.seo_description || stripHTML(post.content || '').substring(0, 160)} />
            </Helmet>

            {editMode ? (
                <div className="edit-post-form">
                    <h2>Edit Post</h2>
                    {error && <p className="error" style={{ color: 'red' }}>{error}</p>}
                    <form onSubmit={handleSaveEdit}>
                         <div className="form-group">
                             <label>Title:</label>
                             <input type="text" value={editPost.title || ""} onChange={(e) => setEditPost({ ...editPost, title: e.target.value })} required />
                         </div>
                         <div className="form-group">
                             <label>Content:</label>
                             <CustomEditor
                                ref={editorRef}
                                initialContent={editPost.content}
                                mediaCategory="post"
                            />
                         </div>
                         <div className="form-actions">
                             <button type="submit" className="save-btn">Save Changes</button>
                             <button type="button" className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                         </div>
                    </form>
                </div>
            ) : (
                <>
                    <h1 className="post-title">{post.title}</h1>
                    {post.og_image_url && ( <div className="post-image-container"><img src={post.og_image_url} alt={post.title} className="post-banner" /></div> )}

                    <div
                        ref={contentDisplayRef}
                        className="post-content displayed-content"
                        // Call the sanitize function HERE:
                        dangerouslySetInnerHTML={{ __html: sanitizeContentViewerHTML(post.content || "") }}
                    />

                    <p className="post-meta"> <FaUser /> {post.created_by || 'Unknown'} | <FaRegClock /> {post.created_at ? new Date(post.created_at).toLocaleDateString() : 'Unknown Date'} </p>
                    {isOwner && (
                        <div className="post-actions">
                            <button type="button" onClick={handleEditClick}><FaEdit /> Edit Post</button>
                            <button type="button" onClick={handleDelete}><FaTrash /> Delete Post</button>
                        </div>
                    )}
                     {error && <p className="error" style={{ color: 'red' }}>{error}</p>}
                </>
            )}
        </div>
    );
};

export default PostDetail;