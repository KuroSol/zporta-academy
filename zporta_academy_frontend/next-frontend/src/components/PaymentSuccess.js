// next-frontend/src/components/PaymentSuccess.js
import React, { useEffect, useState, useContext } from 'react';
import { useRouter } from 'next/router';
import apiClient from '@/api';
import { AuthContext } from '@/context/AuthContext';

export default function PaymentSuccess() {
  const [loading, setLoading] = useState(true);
  const [enrollmentRecord, setEnrollmentRecord] = useState(null);
  const [fallbackTried, setFallbackTried] = useState(false);
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

  // fetch enrollment list first
  useEffect(() => {
    if (!router.isReady) return;
    if (!token) { router.replace('/login'); return; }
    if (!storedCourseId) { router.replace('/enrolled-courses'); return; }

    const run = async () => {
      setLoading(true);
      try {
        const resp = await apiClient.get('/enrollments/');
        if (Array.isArray(resp.data)) {
          const found = resp.data.find(
            e => e.enrollment_type === 'course' &&
                 String(e.object_id) === String(storedCourseId)
          );
          if (found) setEnrollmentRecord(found);
        }
      } catch (err) {
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
  }, [router.isReady, token, storedCourseId, logout, router, sessionId]);

  // fallback: create enrollment if webhook not finished yet
  useEffect(() => {
    if (loading || enrollmentRecord || fallbackTried || !storedCourseId || !token) return;

    const run = async () => {
      setFallbackTried(true);
      try {
        const payload = {
          object_id: parseInt(storedCourseId, 10),
          enrollment_type: 'course',
        };
        const resp = await apiClient.post('/enrollments/', payload);
        if (resp.data?.id) setEnrollmentRecord(resp.data);
      } catch (err) {
        if (err.response?.status === 401 || err.response?.status === 403) {
          logout();
          router.replace('/login');
        }
      }
    };
    run();
  }, [loading, enrollmentRecord, fallbackTried, storedCourseId, token, logout, router]);

  // redirect once we have the record
  useEffect(() => {
    if (loading || !enrollmentRecord) return;

    const permalink = enrollmentRecord?.course?.permalink;
    if (permalink) {
      router.replace(`/courses/${permalink}`);
    } else if (enrollmentRecord?.id) {
      router.replace(`/courses/enrolled/${enrollmentRecord.id}`);
    } else {
      router.replace('/enrolled-courses');
    }
  }, [loading, enrollmentRecord, router]);

  return (
    <div style={{ maxWidth: 720, margin: '24px auto', padding: 20 }}>
      <h2>Payment Successful</h2>
      {loading
        ? <p>Loading…</p>
        : enrollmentRecord
          ? <p>Enrollment found. Redirecting…</p>
          : <p>Processing enrollment…</p>}
      <button onClick={() => router.push('/enrolled-courses')}>Go to Enrolled Courses</button>
    </div>
  );
}
