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
import { messaging } from './firebase'; // Assuming firebase.js exports messaging
import { getToken } from 'firebase/messaging';
import { v4 as uuidv4 } from 'uuid';

const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);

// 0) Hook into the PWA install prompt
function InstallGate({ isLoggedIn }) {
  // Call hooks unconditionally at the top
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    // Conditionally run effect logic
    if (isIOS) return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []); // Empty dependency array is correct here, effect runs once on mount

  // Conditional rendering after hooks
  if (isIOS) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    // const choice = await deferredPrompt.userChoice; // ESLint might warn if choice is unused
    await deferredPrompt.userChoice;
    // console.log('[PWA] userChoice:', choice); // Log if needed
    setShowInstall(false);
    setDeferredPrompt(null);
  };

  if (!isLoggedIn || !showInstall) return null;

  return (
    <div style={{
      padding: 12,
      background: '#e6f7ff',
      textAlign: 'center',
      borderBottom: '1px solid #91d5ff',
      fontSize: '14px'
    }}>
      📱 Install the Zporta Academy app?
      <button
        onClick={handleInstall}
        style={{
          marginLeft: 12,
          padding: '6px 12px',
          background: '#1890ff',
          border: 'none',
          borderRadius: 4,
          color: '#fff',
          cursor: 'pointer'
        }}
      >
        Install
      </button>
    </div>
  );
}

// 1) Banner component that asks the user for permission
function NotificationGate({ isLoggedIn, onGrant }) {
  const [asked, setAsked] = useState(
    () => Notification.permission !== 'default' // Initialize from current permission state
  );

  const handleClick = async () => {
    setAsked(true); // User has interacted
    const permission = await Notification.requestPermission();
    console.log('[FCM] Permission result:', permission);
    if (permission === 'granted') {
      onGrant(); // Callback to trigger FCM registration
    }
  };

  // Only show if logged in and permission hasn't been asked/granted/denied yet
  if (!isLoggedIn || asked || Notification.permission !== 'default') return null;

  return (
    <div style={{
      padding: 12,
      background: '#fffae6',
      textAlign: 'center',
      borderBottom: '1px solid #ffd54f',
      fontSize: '14px'
    }}>
      🔔 Would you like to enable push notifications?
      <button
        onClick={handleClick}
        style={{
          marginLeft: 12,
          padding: '6px 12px',
          background: '#ffa000',
          border: 'none',
          borderRadius: 4,
          color: '#fff',
          cursor: 'pointer'
        }}
      >
        Yes, enable
      </button>
    </div>
  );
}

// 2) Generate or retrieve a stable device ID
export function getDeviceId() {
  let id = localStorage.getItem('deviceId');
  if (!id) {
    id = uuidv4();
    localStorage.setItem('deviceId', id);
  }
  return id;
}

// 3) Your existing App component
const App = () => {
  // const [fcmTokenForDebug, setFcmTokenForDebug] = useState(''); // Commented out as it was unused
  const { token, logout } = useContext(AuthContext);
  const isLoggedIn = !!token;
  const [permissions] = useState(() => {
    const stored = localStorage.getItem('permissions');
    // Ensure stored is not 'undefined' string before splitting
    return stored && typeof stored === 'string' && stored !== 'undefined' ? stored.split(',') : [];
  });
  const [isExpanded, setIsExpanded] = useState(false);

  const handleLogout = () => {
    logout();
  };

  const location = useLocation();
  const isOnLessonDetailPage = location.pathname.startsWith('/lessons/');

  // 4) Define FCM setup function
  useEffect(() => {
    if (!token) {
      console.log('[FCM] ❌ No auth token—skipping registration until login.');
      return;
    }

    // Expose the registration flow to a button click or onGrant callback
    window.registerFCM = async () => {
      console.log('[FCM] Attempting to register FCM...');
      try {
        // a) Ask permission if needed (though NotificationGate should handle initial prompt)
        if (Notification.permission === 'default') {
          console.log('[FCM] Permission is default, requesting...');
          const permission = await Notification.requestPermission();
          console.log('[FCM] Permission result from registerFCM:', permission);
          if (permission !== 'granted') {
            console.warn('[FCM] Notifications not granted via registerFCM.');
            return;
          }
        } else if (Notification.permission === 'denied') {
          console.warn('[FCM] Notifications blocked by user.');
          return;
        }
        console.log('[FCM] Notification permission is:', Notification.permission);

        // b) Register service worker
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.register(
            '/firebase-messaging-sw.js' // Ensure this path is correct from public root
          );
          console.log('[FCM] ✅ SW registered at', registration.scope);

          // c) Get FCM token
          const currentToken = await getToken(messaging, {
            vapidKey: 'BDm-BOtLstlVLYXxuVIyNwFzghCGtiFD5oFd1qkrMrRG_sRTTmE-GE_tL5I8Qu355iun2xAmqukiQIRvU4ZJKcw', // Replace with your actual VAPID key
            serviceWorkerRegistration: registration,
          });

          if (!currentToken) {
            throw new Error('FCM getToken returned null or empty. Ensure VAPID key is correct and SW is active.');
          }
          console.log('[FCM] ✅ Got token:', currentToken);
          // setFcmTokenForDebug(currentToken); // Commented out

          // d) Send token to backend
          const deviceId = getDeviceId();
          console.log('[FCM] Sending token with deviceId:', deviceId);
          const resp = await fetch('/api/notifications/save-fcm-token/', { // Ensure this API endpoint is correct
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Token ${token}`, // Ensure token is the auth token
            },
            body: JSON.stringify({
              token: currentToken,
              device_id: deviceId
            }),
          });
          const data = await resp.json();
          if (!resp.ok) {
            throw new Error(`save-fcm-token ${resp.status}: ${data.detail || JSON.stringify(data)}`);
          }
          console.log('[FCM] ✅ Token saved:', data);
        } else {
          console.error('[FCM] Service workers are not supported in this browser.');
        }
      } catch (err) {
        console.error('[FCM] ❌ Error during FCM setup:', err);
        // More detailed error logging
        if (err.code) {
          console.error('[FCM] Error code:', err.code);
          console.error('[FCM] Error message:', err.message);
        }
      }
    };
    // Clean up the global function when the component unmounts or token changes
    return () => {
      delete window.registerFCM;
    };
  }, [token]); // Rerun this effect if the auth token changes


  return (
    <div className={`app-container ${isExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
      <SidebarMenu isExpanded={isExpanded} setIsExpanded={setIsExpanded} />
      <InstallGate isLoggedIn={isLoggedIn} />
      <NotificationGate
        isLoggedIn={isLoggedIn}
        onGrant={() => {
            if (window.registerFCM) {
                window.registerFCM();
            } else {
                console.error("[FCM] registerFCM function not available on window.")
            }
        }}
      />

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
        {fcmTokenForDebug && ( // If you bring back fcmTokenForDebug, ensure it's declared with useState
          <div style={{
            position: 'fixed',
            bottom: '70px',
            left: '10px',
            right: '10px',
            backgroundColor: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '10px',
            zIndex: 9999,
            fontSize: '11px',
            overflowWrap: 'break-word',
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