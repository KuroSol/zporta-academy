import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api'; 
import './GuideList.css'; 

const GuideList = () => {
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

// useEffect to fetch guides using apiClient
useEffect(() => {
  const fetchGuides = async () => {
    setLoading(true); // Start loading
    setError('');     // Clear previous errors

    try {
      // Use apiClient.get - No auth assumed needed for public list
      const response = await apiClient.get('/users/guides/');

      // Axios data is in response.data
      // Check if we received an array
      if (response.data && Array.isArray(response.data)) {
        setGuides(response.data);
      } else {
        console.warn("Received unexpected format for guides list:", response.data);
        setGuides([]); // Set empty on unexpected format
        setError("Failed to load guides: Unexpected data format.");
      }
    } catch (err) {
      // Handle errors from apiClient
      console.error("Error fetching guides:", err.response ? err.response.data : err.message);
      setGuides([]); // Clear data on error
      // Set error state for display
      const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.message;
      setError(`Failed to fetch guides: ${apiErrorMessage || "Please try again."}`);
      // No logout needed here as it's likely a public endpoint
    } finally {
      setLoading(false); // Stop loading indicator
    }
  };

  fetchGuides(); // Execute the fetch function

  // Empty dependency array means this runs only once on component mount
}, []); // <-- Keep empty array

  if (loading) return <p>Loading guides...</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div className="guide-list-container">
      <h1>Our Guides</h1>
      <div className="guide-grid">
        {guides.map((guide) => (
          <div key={guide.id} className="guide-card">
            <img 
              src={guide.profile_image_url || 'https://via.placeholder.com/150'}
              alt={guide.username}
              className="guide-image"
            />
            <div className="guide-info">
              <h2>{guide.username}</h2>
              <p>{guide.bio || 'No bio available.'}</p>
              <Link to={`/guide/${guide.username}`} className="view-profile-btn">
                View Profile
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GuideList;
