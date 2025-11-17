// next-frontend/src/components/PaymentSuccess.js
import React, { useEffect, useState, useContext } from 'react';
import { useRouter } from 'next/router';
import apiClient from '@/api';
import { AuthContext } from '@/context/AuthContext';

export default function PaymentSuccess() {
  const [loading, setLoading] = useState(true);
  const [enrollmentRecord, setEnrollmentRecord] = useState(null);
  const [confirmCalled, setConfirmCalled] = useState(false);
  const [error, setError] = useState('');
  const [storedCourseId, setStoredCourseId] = useState(null);

  const router = useRouter();
  const { token, logout } = useContext(AuthContext);

  // read once on client
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setStoredCourseId(localStorage.getItem('courseId'));
    }
  }, []);

  // optional session id from query
  const sessionId = router.query?.session_id;

  // Call confirm endpoint first to ensure enrollment is created
  useEffect(() => {
  if (!router.isReady || confirmCalled) return;
    if (!token) { router.replace('/login'); return; }
    if (!sessionId) {
      setError('No session ID provided');
      setLoading(false);
      return;
    }

    const run = async () => {
      setLoading(true);
  setConfirmCalled(true);
      try {
        // Call confirm endpoint to create enrollment server-side
        const confirmResp = await apiClient.post('/payments/confirm/', {
          session_id: sessionId
        });
        
        if (confirmResp.data?.ok) {
          // Now fetch the enrollment record
          const enrollResp = await apiClient.get('/enrollments/');
          if (Array.isArray(enrollResp.data)) {
            const courseId = confirmResp.data.course_id;
            const found = enrollResp.data.find(
              e => e.enrollment_type === 'course' && String(e.object_id) === String(courseId)
            );
            if (found) {
              setEnrollmentRecord(found);
              // Clear the stored courseId
              if (typeof window !== 'undefined') {
                localStorage.removeItem('courseId');
              }
            }
          }
        }
      } catch (err) {
  setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to confirm enrollment');
        if (err.response?.status === 401 || err.response?.status === 403) {
          logout();
          router.replace('/login');
          return;
        }
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [router.isReady, token, sessionId, logout, router, confirmCalled]);

  // redirect once we have the record
  useEffect(() => {
    if (loading || !enrollmentRecord) return;

    // Redirect to enrolled course page - highest priority
    if (enrollmentRecord?.id) {
      router.replace(`/courses/enrolled/${enrollmentRecord.id}`);
    } else if (enrollmentRecord?.course?.permalink) {
      // Fallback to course detail page
      router.replace(`/courses/${enrollmentRecord.course.permalink}`);
    } else {
      // Last resort: enrolled courses list
      router.replace('/enrolled-courses');
    }
  }, [loading, enrollmentRecord, router]);

  return (
    <div style={{ maxWidth: 720, margin: '24px auto', padding: 20 }}>
      <h2>Payment Successful</h2>
  {error && <p style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>}
      {loading
        ? <p>Loading…</p>
        : enrollmentRecord
          ? <p>Enrollment found. Redirecting…</p>
          : <p>Unable to find enrollment. Please contact support.</p>}
      <button onClick={() => router.push('/enrolled-courses')}>Go to Enrolled Courses</button>
    </div>
  );
}
