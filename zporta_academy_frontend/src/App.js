import React, { useState, useContext, useEffect} from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from "./context/AuthContext";
import Login from './Login';
import Profile from './components/Profile';
import Register from './Register';
import PasswordReset from './PasswordReset';
import PasswordResetConfirm from './PasswordResetConfirm';
import BottomMenu from './BottomMenu';
import CreateCourse from './components/Admin/CreateCourse';
import CreateLesson from './components/Admin/CreateLesson';
import CourseDetail from './components/CourseDetail';
import LessonDetail from './components/LessonDetail';
import MyCourses from './components/MyCourses';
import SidebarMenu from './SidebarMenu';
import CreateQuiz from './components/Admin/CreateQuiz';
import DiaryManagement from './DiaryManagement';
import Explorer from './components/Explorer';
import PaymentSuccess from './components/PaymentSuccess';
import PaymentCancel from './components/PaymentCancel';
import CreatePost from './components/Admin/CreatePost';
import './styles.css';
import UserPosts from './components/UserPosts';
import PostDetail from './components/PostDetail';
import ChangePassword from './ChangePassword';
import QuizPage from './components/QuizPage';
import QuizAttempts from './components/QuizAttempts';
import QuizListPage from './components/QuizListPage';
import HomePage from './components/HomePage';
import PublicGuideProfile from './components/PublicGuideProfile';
import GuideList from './components/GuideList';
import Notifications from './components/Notifications';
import GuideRequestsPage from './components/GuideRequestsPage';
import EnrolledCourses from './components/EnrolledCourses';
import EnrolledCourseDetail from './components/EnrolledCourseDetail';
import StudyDashboard from './components/StudyDashboard';
import { messaging } from './firebase';
import { getToken } from 'firebase/messaging'; 
import { v4 as uuidv4 } from 'uuid';


export function getDeviceId() {
  let id = localStorage.getItem('deviceId');
  if (!id) {
    id = uuidv4();
    localStorage.setItem('deviceId', id);
  }
  return id;
}


// Helper function to get permissions safely
const getPermissionsFromStorage = () => {
  const stored = localStorage.getItem('permissions');
  return stored && stored !== 'undefined' ? stored.split(',') : [];
};

const App = () => {
  const [fcmTokenForDebug, setFcmTokenForDebug] = useState('');
  const { token, logout } = useContext(AuthContext); 
  const isLoggedIn = !!token;
  const [permissions] = useState(getPermissionsFromStorage());
  const [isExpanded, setIsExpanded] = useState(false);

  const handleLogout = () => {
    logout();
  };

  const location = useLocation(); // Get current location object
  // Check if the current path starts with '/lessons/'
  const isOnLessonDetailPage = location.pathname.startsWith('/lessons/');

  useEffect(() => {
  if (!token) {
    console.log('[FCM] ❌ No auth token—skipping registration until login.');
    return;
  }

    const deviceId = getDeviceId();
      // wrap the whole flow in an async fn for clarity
    const registerFCM = async () => {
      try {
        // 1) Ask browser permission if needed
        if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission();
          console.log('[FCM] Permission result:', permission);
          if (permission !== 'granted') {
            console.warn('[FCM] Notifications not granted');
            return;
          }
        } else if (Notification.permission === 'denied') {
          console.warn('[FCM] Notifications have been blocked by user');
          return;
        }

        // 2) Register the service worker
        const registration = await navigator.serviceWorker.register(
          '/firebase-messaging-sw.js'
        );
        console.log('[FCM] ✅ SW registered at', registration.scope);

        // 3) Get the FCM token
        const currentToken = await getToken(messaging, {
          vapidKey: 'BDm-BOtLstlVLYXxuVIyNwFzghCGtiFD5oFd1qkrMrRG_sRTTmE-GE_tL5I8Qu355iun2xAmqukiQIRvU4ZJKcw',
          serviceWorkerRegistration: registration,
          // forceRefresh: true, // uncomment if you ever need a fresh token
        });
        if (!currentToken) {
          throw new Error('FCM getToken returned null');
        }
        console.log('[FCM] ✅ Got token:', currentToken);
        setFcmTokenForDebug(currentToken);

        // 4) Send it to your backend
        const resp = await fetch('/api/notifications/save-fcm-token/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Token ${token}`,
          },
                   body: JSON.stringify({
           token: currentToken,
           device_id: deviceId
         }),
        });
        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(`save-fcm-token ${resp.status}: ${data.detail||JSON.stringify(data)}`);
        }
        console.log('[FCM] ✅ Token saved:', data);
      } catch (err) {
        console.error('[FCM] ❌ Error during FCM setup:', err);
      }
    };

    registerFCM();
  }, [token]);




  return (
    <div className={`app-container ${isExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
      <SidebarMenu isExpanded={isExpanded} setIsExpanded={setIsExpanded} />

      <div className="content-wrapper">
        <Routes>
          {/* Authentication Routes */}
          <Route path="/login" element={!isLoggedIn ? <Login /> : <Navigate to="/profile" replace />} />
          <Route path="/password-reset" element={<PasswordReset />} />
          <Route path="/reset-password-confirm/:uid/:token" element={<PasswordResetConfirm />} />
          <Route path="/change-password" element={isLoggedIn ? <ChangePassword token={token} /> : <Navigate to="/login" replace />} />
          <Route path="/notifications" element={isLoggedIn ? <Notifications /> : <Navigate to="/login" replace />} />
          <Route path="/alerts" element={isLoggedIn ? <Notifications /> : <Navigate to="/login" replace />} />
          <Route path="/guide-requests" element={isLoggedIn ? <GuideRequestsPage /> : <Navigate to="/login" replace />} />
          <Route path="/register" element={<Register />} />

          {/* Home Page (Protected) */}
          <Route
            path="/home"
            element={isLoggedIn ? <HomePage /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/profile"
            element={isLoggedIn ? <Profile onLogout={handleLogout} /> : <Navigate to="/login" replace />}
          />

          {/* Public Learning & Explorer */}
          <Route path="/learn" element={<Explorer />} />
          <Route path="/explore" element={<UserPosts />} />

          {/* Public Guide Profile Route */}
          <Route path="/guides" element={<GuideList />} />
          <Route path="/guide/:username" element={<PublicGuideProfile />} />

          {/* Updated Post Detail Route */}
          <Route path="/posts/*" element={<PostDetail />} />


          {/* Dynamic Course Detail Route for creators/admins */}
          <Route path="/courses/:username/:date/:subject/:courseTitle" element={<CourseDetail />} />

          {/* Dynamic lesson Detail Route for creators/admins */}
          <Route path="/lessons/:username/:subject/:date/:lessonSlug" element={<LessonDetail />} />

          {/* Payment Outcome Routes */}
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/payment-cancel" element={<PaymentCancel />} />

          {/* Quizes list */}
          <Route path="/quizzes/my" element={<QuizListPage />} />
          <Route path="/quizzes/Attempts" element={<QuizAttempts />} />
          {/*see the specific quize*/}
          <Route
            path="/quizzes/:username/:subject/:date/:quizSlug" element={<QuizPage />}
          />

          {/* Admin Routes */}
          <Route
            path="/admin/create-course"
            element={isLoggedIn ? <CreateCourse /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/admin/courses/edit/:username/:date/:subject/:courseTitle"
            element={
              isLoggedIn
                ? <CourseDetail />
                : <Navigate to="/login" replace />
            }
          />
          <Route
            path="/admin/create-lesson"
            element={isLoggedIn ? <CreateLesson /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/admin/create-quiz"
            element={isLoggedIn ? <CreateQuiz /> : <Navigate to="/login" replace />}
          />
          <Route path="/admin/create-quiz/:quizId" element={isLoggedIn ? <CreateQuiz />: <Navigate to="/login" replace />}
/>
           <Route
             path="/admin/create-post"
             element={isLoggedIn ? <CreatePost /> : <Navigate to="/login" replace />}
           />

          {/* My Courses Route */}
          <Route
            path="/my-courses"
            element={isLoggedIn ? <MyCourses /> : <Navigate to="/login" replace />}
          />

          {/* Explorer users Activity */}
          <Route
            path="/enrolled-courses"
            element={isLoggedIn ? <EnrolledCourses /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/courses/enrolled/:enrollmentId"
            element={isLoggedIn ? <EnrolledCourseDetail />: <Navigate to="/login" replace />}
          />
          {/* Diary Page */}
          <Route
            path="/diary"
            element={isLoggedIn ? <DiaryManagement /> : <Navigate to="/login" replace />}
          />

          {/* Study Dashboard */}
          <Route
            path="/study/dashboard"
            element={
              isLoggedIn
                ? <StudyDashboard />
                : <Navigate to="/login" replace />
            }
          />

          {/* Default Route (Redirect to Home, which redirects to Login if needed) */}
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </div>

       {/* TEMPORARY: Display FCM Token for Debugging 
        {fcmTokenForDebug && (
          <div style={{
            position: 'fixed',
            bottom: '70px', // Adjusted to be above a typical bottom menu
            left: '10px',
            right: '10px', // Allow it to take more width if needed
            backgroundColor: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '10px',
            zIndex: 9999,
            fontSize: '11px', // Slightly larger for readability
            overflowWrap: 'break-word', // Ensure long token wraps
            textAlign: 'left',
            borderRadius: '5px',
            boxShadow: '0 0 10px rgba(0,0,0,0.5)'
          }}>
            <strong style={{display: 'block', marginBottom: '5px'}}>FCM Token (for testing):</strong>
            {fcmTokenForDebug}
          </div>
        )}
      */}
      {/* Bottom Menu */}
      {isLoggedIn && !isOnLessonDetailPage && <BottomMenu permissions={permissions} />}
    </div>
  );
};

export default App;