import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "../../styles/admin.module.css";

export default function AssetsPage() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [copySnippet, setCopySnippet] = useState(null);
  const [imageAssetId, setImageAssetId] = useState(null);
  const [audioAssetId, setAudioAssetId] = useState(null);
  const [provider, setProvider] = useState("");
  const [pageSize] = useState(20);
  const [page, setPage] = useState(1);

  // Get auth token (from localStorage or context)
  const getToken = () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("authToken");
    }
    return null;
  };

  const getCsrfToken = () => {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  };

  // Fetch assets list
  const fetchAssets = async () => {
    try {
      setLoading(true);
      const token = getToken();
      let url = "/api/assets/?";

      if (filter) url += `kind=${filter}&`;
      if (search) url += `search=${search}&`;
      url += `page=${page}`;

      const headers = {};
      if (token) headers["Authorization"] = `Token ${token}`;

      const response = await fetch(url, {
        headers,
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to fetch assets");

      const data = await response.json();
      setAssets(data.results || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [filter, search, page]);

  // Upload asset
  const handleUpload = async (e, kind) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      kind === "image" ? setUploadingImage(true) : setUploadingAudio(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", kind);
      if (provider) formData.append("provider", provider);

      const token = getToken();
      const csrf = getCsrfToken();
      const headers = {};
      if (token) headers["Authorization"] = `Token ${token}`;
      if (!token && csrf) headers["X-CSRFToken"] = csrf;

      const response = await fetch("/api/assets/", {
        method: "POST",
        headers,
        body: formData,
        credentials: "include",
      });

      if (!response.ok) throw new Error("Upload failed");

      const newAsset = await response.json();

      if (kind === "image") {
        setImageAssetId(newAsset.id);
      } else {
        setAudioAssetId(newAsset.id);
      }

      setUploadSuccess(`${kind} uploaded successfully!`);
      setTimeout(() => setUploadSuccess(null), 3000);

      // Refresh list
      fetchAssets();
      e.target.value = "";
    } catch (err) {
      setUploadError(err.message);
    } finally {
      kind === "image" ? setUploadingImage(false) : setUploadingAudio(false);
    }
  };

  // Generate and copy JSON snippet
  const generateAndCopySnippet = async () => {
    if (!imageAssetId && !audioAssetId) {
      alert("Upload at least one asset first");
      return;
    }

    try {
      const token = getToken();
      const csrf = getCsrfToken();
      const headers = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Token ${token}`;
      if (!token && csrf) headers["X-CSRFToken"] = csrf;

      const idsToResolve = [];
      if (imageAssetId) idsToResolve.push(imageAssetId);
      if (audioAssetId) idsToResolve.push(audioAssetId);

      const response = await fetch("/api/assets/resolve/", {
        method: "POST",
        headers,
        body: JSON.stringify({ ids: idsToResolve }),
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to resolve assets");

      const data = await response.json();
      const assetMap = {};

      data.assets.forEach((asset) => {
        assetMap[asset.id] = asset;
      });

      const snippet = {
        ...(imageAssetId && { image_asset_id: imageAssetId }),
        ...(imageAssetId &&
          assetMap[imageAssetId] && { image_url: assetMap[imageAssetId].url }),
        ...(audioAssetId && { audio_asset_id: audioAssetId }),
        ...(audioAssetId &&
          assetMap[audioAssetId] && { audio_url: assetMap[audioAssetId].url }),
      };

      const snippetJson = JSON.stringify(snippet, null, 2);
      setCopySnippet(snippetJson);

      // Copy to clipboard
      await navigator.clipboard.writeText(snippetJson);
      alert("JSON snippet copied to clipboard!");
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Delete asset
  const handleDelete = async (id) => {
    if (!confirm("Delete this asset?")) return;

    try {
      const token = getToken();
      const csrf = getCsrfToken();
      const headers = {};
      if (token) headers["Authorization"] = `Token ${token}`;
      if (!token && csrf) headers["X-CSRFToken"] = csrf;

      const response = await fetch(`/api/assets/${id}/`, {
        method: "DELETE",
        headers,
        credentials: "include",
      });

      if (!response.ok) throw new Error("Delete failed");

      // Clear state if deleted asset is selected
      if (id === imageAssetId) setImageAssetId(null);
      if (id === audioAssetId) setAudioAssetId(null);

      fetchAssets();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className={styles.container}>
      <h1>Asset Library</h1>

      <div className={styles.section}>
        <h2>Upload Assets</h2>

        <div className={styles.uploadControls}>
          <div className={styles.uploadGroup}>
            <label>Provider (optional):</label>
            <input
              type="text"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="e.g., Gemini, Google AI Studio"
              className={styles.input}
            />
          </div>

          <div className={styles.uploadGroup}>
            <label>Upload Image:</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleUpload(e, "image")}
              disabled={uploadingImage}
              className={styles.input}
            />
            {uploadingImage && <span>Uploading...</span>}
          </div>

          <div className={styles.uploadGroup}>
            <label>Upload Audio:</label>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => handleUpload(e, "audio")}
              disabled={uploadingAudio}
              className={styles.input}
            />
            {uploadingAudio && <span>Uploading...</span>}
          </div>
        </div>

        {uploadError && <div className={styles.error}>{uploadError}</div>}
        {uploadSuccess && <div className={styles.success}>{uploadSuccess}</div>}
      </div>

      {/* Display selected assets and JSON snippet */}
      {(imageAssetId || audioAssetId) && (
        <div className={styles.section}>
          <h2>Selected Assets</h2>
          <div className={styles.selectedAssets}>
            {imageAssetId && (
              <div className={styles.assetBadge}>
                Image ID: {imageAssetId.substring(0, 8)}...
                <button
                  onClick={() => setImageAssetId(null)}
                  className={styles.removeBtn}
                >
                  ×
                </button>
              </div>
            )}
            {audioAssetId && (
              <div className={styles.assetBadge}>
                Audio ID: {audioAssetId.substring(0, 8)}...
                <button
                  onClick={() => setAudioAssetId(null)}
                  className={styles.removeBtn}
                >
                  ×
                </button>
              </div>
            )}
          </div>

          <button
            onClick={generateAndCopySnippet}
            className={styles.primaryBtn}
          >
            Copy JSON Snippet
          </button>

          {copySnippet && <pre className={styles.codeBlock}>{copySnippet}</pre>}
        </div>
      )}

      {/* List assets */}
      <div className={styles.section}>
        <h2>Uploaded Assets</h2>

        <div className={styles.filters}>
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className={styles.input}
          />
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
            className={styles.select}
          >
            <option value="">All Types</option>
            <option value="image">Images</option>
            <option value="audio">Audio</option>
          </select>
        </div>

        {loading && <p>Loading...</p>}
        {error && <div className={styles.error}>{error}</div>}

        {!loading && assets.length === 0 && (
          <p>No assets found. Upload one to get started!</p>
        )}

        {!loading && assets.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Filename</th>
                <th>Name</th>
                <th>Provider</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.id}>
                  <td>
                    <span className={`${styles.badge} ${styles[asset.kind]}`}>
                      {asset.kind}
                    </span>
                  </td>
                  <td>{asset.original_filename}</td>
                  <td>{asset.suggested_name}</td>
                  <td>{asset.provider || "-"}</td>
                  <td>{new Date(asset.created_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      onClick={() => {
                        const assetType =
                          asset.kind === "image"
                            ? setImageAssetId
                            : setAudioAssetId;
                        assetType(asset.id);
                      }}
                      className={styles.selectBtn}
                    >
                      Select
                    </button>
                    <a
                      href={asset.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.viewBtn}
                    >
                      View
                    </a>
                    <button
                      onClick={() => handleDelete(asset.id)}
                      className={styles.deleteBtn}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className={styles.pagination}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className={styles.btn}
          >
            ← Previous
          </button>
          <span>Page {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={assets.length < pageSize}
            className={styles.btn}
          >
            Next →
          </button>
        </div>
      </div>

      <div className={styles.help}>
        <h3>How It Works</h3>
        <ol>
          <li>
            Upload image/audio files generated from Gemini, Google AI Studio,
            etc.
          </li>
          <li>Select the assets you want to use</li>
          <li>
            Click &quot;Copy JSON Snippet&quot; to get the ready-to-paste config
          </li>
          <li>Paste the JSON into your provider configuration</li>
        </ol>
      </div>
    </div>
  );
}
