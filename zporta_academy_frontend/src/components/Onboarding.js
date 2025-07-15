// src/components/Onboarding.js
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api';
import { AuthContext } from '../context/AuthContext';
import styles from './Onboarding.module.css';

export default function Onboarding() {
  const navigate = useNavigate();
  const { token } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [regions, setRegions] = useState([]);
  const [prefs, setPrefs] = useState({ subjects: [], languages: [], regions: [] });

  // redirect if not logged in
  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
    }
  }, [token, navigate]);

  // load lookup data and existing prefs
  useEffect(() => {
    async function loadData() {
      try {
        const [sRes, lRes, rRes, pRes] = await Promise.all([
          apiClient.get('/feed/preferences/subjects/'),
          apiClient.get('/feed/preferences/languages/'),
          apiClient.get('/feed/preferences/regions/'),
          apiClient.get('/feed/preferences/'),
        ]);
        setSubjects(sRes.data);
        setLanguages(lRes.data);
        setRegions(rRes.data);
        setPrefs(pRes.data);
      } catch (error) {
        console.error('Failed loading onboarding data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const toggle = (key, id) => {
    setPrefs(prev => ({
      ...prev,
      [key]: prev[key].includes(id)
        ? prev[key].filter(x => x !== id)
        : [...prev[key], id]
    }));
  };

  // save prefs and navigate to StudyDashboard
  const savePrefs = async () => {
    try {
      await apiClient.put('/feed/preferences/', prefs);
      navigate('/study/dashboard', { replace: true });
    } catch (error) {
      console.error('Failed saving preferences:', error);
    }
  };

  if (loading) {
    return <div className={styles.onboardingContainer}><p>Loading...</p></div>;
  }

  return (
    <div className={styles.onboardingContainer}>
      <h1>Select Your Preferences</h1>

      <div className={styles.group}>
        <h2>Subjects</h2>
        {subjects.map(s => (
          <label key={s.id}>
            <input
              type="checkbox"
              checked={prefs.subjects.includes(s.id)}
              onChange={() => toggle('subjects', s.id)}
            />
            {s.name}
          </label>
        ))}
      </div>

      <div className={styles.group}>
        <h2>Languages</h2>
        {languages.map(l => (
          <label key={l.id}>
            <input
              type="checkbox"
              checked={prefs.languages.includes(l.id)}
              onChange={() => toggle('languages', l.id)}
            />
            {l.name}
          </label>
        ))}
      </div>

      <div className={styles.group}>
        <h2>Regions</h2>
        {regions.map(r => (
          <label key={r.id}>
            <input
              type="checkbox"
              checked={prefs.regions.includes(r.id)}
              onChange={() => toggle('regions', r.id)}
            />
            {r.name}
          </label>
        ))}
      </div>

      <button onClick={savePrefs}>Save Preferences</button>
    </div>
  );
}
