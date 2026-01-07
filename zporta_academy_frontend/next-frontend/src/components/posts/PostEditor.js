import React, { useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import CustomEditor from "@/components/Editor/CustomEditor";
import apiClient from "@/api";
import { AuthContext } from "@/context/AuthContext";
import styles from "@/styles/admin/CreatePost.module.css";

const normalizeTag = (raw) => {
  if (!raw) return "";
  return raw
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9\-]/g, "")
    .replace(/-+/g, "-")
    .toLowerCase();
};

const PostEditor = ({ mode = "create", initialPost = null }) => {
  const isEdit = mode === "edit";
  const router = useRouter();
  const { logout, user } = useContext(AuthContext);

  const [title, setTitle] = useState(initialPost?.title || "");
  const [coverImage, setCoverImage] = useState(null);
  const [existingCoverUrl, setExistingCoverUrl] = useState(
    initialPost?.og_image_url || ""
  );
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [saving, setSaving] = useState(false);

  const [tagInput, setTagInput] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [selectedTags, setSelectedTags] = useState(initialPost?.tags || []);

  const editorRef = useRef(null);
  const [initialContent, setInitialContent] = useState(
    initialPost?.content || ""
  );

  const isOwner = !isEdit
    ? true
    : !!(
        user?.username &&
        initialPost?.created_by &&
        user.username.toLowerCase() === initialPost.created_by.toLowerCase()
      );

  // Keep local state in sync if a different post is passed in
  useEffect(() => {
    if (!initialPost) return;
    setTitle(initialPost.title || "");
    setExistingCoverUrl(initialPost.og_image_url || "");
    setSelectedTags(initialPost.tags || []);
    setInitialContent(initialPost.content || "");
  }, [initialPost]);

  const fetchTagSuggestions = async (query) => {
    if (!query || !query.trim()) {
      setTagSuggestions([]);
      return;
    }
    try {
      const res = await apiClient.get(
        `/tags/?search=${encodeURIComponent(query)}&page_size=8`
      );
      const list = Array.isArray(res.data)
        ? res.data
        : res.data?.results || [];
      setTagSuggestions(list);
    } catch (error) {
      console.error("Failed to fetch tag suggestions", error);
    }
  };

  const handleAddTag = (tagLike) => {
    const name = typeof tagLike === "string" ? tagLike : tagLike?.name;
    const normalized = normalizeTag(name);
    if (!normalized) return;
    const exists = selectedTags.some(
      (t) => normalizeTag(t.name) === normalized
    );
    if (exists) return;

    const tagPayload =
      typeof tagLike === "string"
        ? { id: null, name: normalized, slug: normalized }
        : tagLike;
    setSelectedTags((prev) => [...prev, tagPayload]);
    setTagInput("");
    setTagSuggestions([]);
  };

  const handleRemoveTag = (tagSlugOrName) => {
    const normalized = normalizeTag(tagSlugOrName.name || tagSlugOrName.slug || tagSlugOrName);
    setSelectedTags((prev) =>
      prev.filter((t) => normalizeTag(t.slug || t.name) !== normalized)
    );
  };

  const handleSave = async () => {
    if (saving) return;

    if (isEdit && !isOwner) {
      setMessage("Only the creator can edit this post.");
      setMessageType("error");
      return;
    }

    const editorContent = editorRef.current
      ? editorRef.current.getContent()
      : initialContent || "";

    if (!title.trim()) {
      setMessage("Title cannot be empty.");
      setMessageType("error");
      return;
    }
    if (!editorContent || !editorContent.trim()) {
      setMessage("Content cannot be empty.");
      setMessageType("error");
      return;
    }

    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("content", editorContent);
    if (coverImage) {
      formData.append("og_image", coverImage);
    }
    selectedTags.forEach((tag) => {
      const value = tag?.name || "";
      if (value) {
        formData.append("tag_names", normalizeTag(value));
      }
    });

    setSaving(true);
    setMessage("");

    try {
      const endpoint = isEdit
        ? `/posts/${initialPost.permalink}/update/`
        : "/posts/";
      const response = await apiClient[isEdit ? "patch" : "post"](
        endpoint,
        formData
      );
      const data = response.data;
      setMessage(isEdit ? "Post updated successfully." : "Post created successfully!");
      setMessageType("success");
      if (data?.permalink) {
        router.push(`/posts/${data.permalink}`);
      } else {
        router.push("/posts");
      }
    } catch (error) {
      console.error("Error saving post:", error);
      let errorMsg = "Failed to save post.";
      if (error?.data) {
        if (typeof error.data === "object") {
          errorMsg = Object.entries(error.data)
            .map(([field, messages]) => {
              const text = Array.isArray(messages)
                ? messages.join(" ")
                : messages;
              return `${field}: ${text}`;
            })
            .join(" | ");
        } else {
          errorMsg = error.data;
        }
      } else if (error?.message) {
        errorMsg = error.message;
      }
      setMessage(errorMsg);
      setMessageType("error");
      if (error?.status === 401 || error?.status === 403) {
        logout();
      }
    } finally {
      setSaving(false);
    }
  };

  if (isEdit && !isOwner) {
    return (
      <div className={styles.createPostContainer}>
        <h2>Edit Post</h2>
        <p className={`${styles.message} ${styles.messageError}`}>
          You can only edit posts you created.
        </p>
        {initialPost?.permalink && (
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => router.push(`/posts/${initialPost.permalink}`)}
          >
            View post
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.createPostContainer}>
      <div className={styles.headerRow}>
        <h2>{isEdit ? "Edit Post" : "Create New Post"}</h2>
        {isEdit && initialPost?.permalink && (
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => router.push(`/posts/${initialPost.permalink}`)}
          >
            View Live
          </button>
        )}
      </div>
      {message && (
        <p
          className={`${styles.message} ${
            messageType === "success"
              ? styles.messageSuccess
              : styles.messageError
          }`}
        >
          {message}
        </p>
      )}
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
        <div className={styles.inputGroup}>
          <label>Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter post title"
            required
          />
        </div>

        <div className={styles.inputGroup}>
          <label>Tags</label>
          <div className={styles.tagInputRow}>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => {
                setTagInput(e.target.value);
                fetchTagSuggestions(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTag(tagInput);
                }
              }}
              placeholder="Add a tag and press Enter"
            />
            <button
              type="button"
              onClick={() => handleAddTag(tagInput)}
              className={styles.tagAddButton}
            >
              Add
            </button>
          </div>
          {tagSuggestions.length > 0 && (
            <div className={styles.tagSuggestions}>
              {tagSuggestions.map((tag) => (
                <button
                  key={tag.id || tag.slug || tag.name}
                  type="button"
                  onClick={() => handleAddTag(tag)}
                  className={styles.tagSuggestion}
                >
                  #{tag.name}
                </button>
              ))}
            </div>
          )}
          {selectedTags.length > 0 && (
            <div className={styles.selectedTags}>
              {selectedTags.map((tag) => (
                <span
                  key={tag.id || tag.slug || tag.name}
                  className={styles.tagChip}
                >
                  #{tag.name}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    aria-label={`Remove tag ${tag.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className={styles.inputGroup}>
          <label>Cover Image (optional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setCoverImage(e.target.files[0]);
              } else {
                setCoverImage(null);
              }
            }}
          />
          {(coverImage || existingCoverUrl) && (
            <div className={styles.coverPreview}>
              <img
                src={coverImage ? URL.createObjectURL(coverImage) : existingCoverUrl}
                alt="Cover preview"
                onError={(ev) => {
                  ev.target.onerror = null;
                  ev.target.src = "https://placehold.co/800x400/ccd5e0/1f2937?text=Cover";
                }}
              />
            </div>
          )}
        </div>

        <div className={styles.inputGroup}>
          <label>Content</label>
          <CustomEditor
            ref={editorRef}
            placeholder="Write your post content here..."
            mediaCategory="post"
            initialContent={initialContent}
          />
        </div>

        <button
          type="submit"
          className={styles.savePostButton}
          disabled={saving}
        >
          {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Post"}
        </button>
      </form>
    </div>
  );
};

export default PostEditor;
