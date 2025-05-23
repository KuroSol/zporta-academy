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

// Detect if the user is on an iOS device
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
console.log('[App] Detected OS - isIOS:', isIOS); // Initial OS detection log

// 0) Hook into the PWA install prompt
function InstallGate({ isLoggedIn }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    // Completely skip effect for iOS
    if (isIOS) {
      console.log('[InstallGate] Skipping PWA install prompt setup for iOS.');
      return;
    }

    console.log('[InstallGate] Setting up beforeinstallprompt listener for non-iOS.');
    const handler = (e) => {
      console.log('[InstallGate] beforeinstallprompt event fired.');
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => {
      console.log('[InstallGate] Cleaning up beforeinstallprompt listener.');
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []); // Empty dependency array means this effect runs once on mount

  // Conditional rendering: Do not render for iOS, or if not logged in, or if not ready to show
  if (isIOS || !isLoggedIn || !showInstall) {
    return null;
  }

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    console.log('[InstallGate] Prompting PWA install.');
    deferredPrompt.prompt();
    await deferredPrompt.userChoice; // Wait for user interaction
    // console.log('[PWA] userChoice:', choice); // Log if needed
    setShowInstall(false);
    setDeferredPrompt(null);
  };

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
  // Initialize 'asked' state. For iOS, we assume it's not applicable or handled differently,
  // so we effectively treat it as 'asked' to prevent the gate from showing.
  const [asked, setAsked] = useState(() => {
    if (isIOS) return true;
    return Notification.permission !== 'default';
  });

  // This useEffect is mainly for any logic that might need to run based on permission state
  // for non-iOS devices. For iOS, it will be skipped.
  useEffect(() => {
    if (isIOS || Notification.permission !== 'default') {
        console.log('[NotificationGate] Skipping effect logic for iOS or if permission not default.');
        return;
    }
    // Additional logic for non-iOS if needed (e.g., re-checking permission state)
  }, []);


  const handleClick = async () => {
    if (isIOS) {
        console.log('[NotificationGate] Notification prompt skipped for iOS via button click.');
        // Inform the user about iOS specific PWA notification handling.
        // Replace alert with a more integrated UI message if possible.
        alert("For notifications on iOS, add this app to your Home Screen. You can then manage notification permissions in your iPhone's Settings for this site.");
        setAsked(true); // Mark as interacted to hide the gate
        return;
    }

    setAsked(true); // User has interacted with the prompt
    console.log('[NotificationGate] Requesting notification permission for non-iOS.');
    try {
        const permission = await Notification.requestPermission();
        console.log('[FCM] Permission result:', permission);
        if (permission === 'granted') {
          onGrant(); // Callback to trigger FCM registration
        }
    } catch (error) {
        console.error('[NotificationGate] Error requesting notification permission:', error);
    }
  };

  // Do not show gate on iOS, or if not logged in, or if permission is not 'default' (already granted/denied), or if 'asked'
  if (isIOS || !isLoggedIn || Notification.permission !== 'default' || asked) {
    return null;
  }

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

// 3) Main App component
const App = () => {
  const { token, logout, isAuthLoading } = useContext(AuthContext); // Assuming AuthContext provides isAuthLoading
  const isLoggedIn = !!token;
  const [permissions] = useState(() => {
    const stored = localStorage.getItem('permissions');
    return stored && typeof stored === 'string' && stored !== 'undefined' ? stored.split(',') : [];
  });
  const [isExpanded, setIsExpanded] = useState(false);

  const handleLogout = () => {
    logout();
  };

  const location = useLocation();
  const isOnLessonDetailPage = location.pathname.startsWith('/lessons/');

  // 4) Define FCM setup function, skip for iOS
  useEffect(() => {
    console.log('[App] useEffect for FCM registration. isIOS:', isIOS, 'Auth Token Present:', !!token);

    if (isIOS) {
      console.log('[FCM] Skipping FCM registration setup for iOS devices.');
      if (window.registerFCM) delete window.registerFCM; // Ensure it's not lingering
      return;
    }

    if (!token) {
      console.log('[FCM] No auth token—skipping FCM registration until login.');
      if (window.registerFCM) delete window.registerFCM;
      return;
    }

    // Define registerFCM only for non-iOS and when logged in
    console.log('[FCM] Defining window.registerFCM for non-iOS.');
    window.registerFCM = async () => {
      console.log('[FCM] Attempting to register FCM (non-iOS)...');
      try {
        if (Notification.permission === 'default') {
          console.log('[FCM] Permission is default, requesting via registerFCM...');
          const permission = await Notification.requestPermission(); // Should ideally be handled by NotificationGate first
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

        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.register(
            '/firebase-messaging-sw.js'
          );
          console.log('[FCM] ✅ SW registered at', registration.scope);

          const currentToken = await getToken(messaging, {
            vapidKey: 'BDm-BOtLstlVLYXxuVIyNwFzghCGtiFD5oFd1qkrMrRG_sRTTmE-GE_tL5I8Qu355iun2xAmqukiQIRvU4ZJKcw',
            serviceWorkerRegistration: registration,
          });

          if (!currentToken) {
            throw new Error('FCM getToken returned null or empty. Check VAPID key and SW.');
          }
          console.log('[FCM] ✅ Got token:', currentToken);

          const deviceId = getDeviceId();
          console.log('[FCM] Sending token with deviceId:', deviceId);
          const resp = await fetch('/api/notifications/save-fcm-token/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Token ${token}`,
            },
            body: JSON.stringify({ token: currentToken, device_id: deviceId }),
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
        console.error('[FCM] ❌ Error during FCM setup (non-iOS):', err);
        if (err.code) console.error('[FCM] Error code:', err.code, 'Message:', err.message);
      }
    };

    // Cleanup function for the useEffect
    return () => {
      console.log('[App] Cleaning up registerFCM from window (if defined).');
      if (window.registerFCM) delete window.registerFCM;
    };
  }, [token]); // Rerun this effect if the auth token changes (isIOS is constant after initial load)

  // Handle loading state from AuthContext to prevent rendering before auth state is known
  if (isAuthLoading) {
    console.log("[App] Auth context is loading. Rendering loading indicator.");
    // You can return a proper loading spinner component here
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }
  
  console.log('[App] Rendering main App structure. isLoggedIn:', isLoggedIn);

  return (
    <div className={`app-container ${isExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
      <SidebarMenu isExpanded={isExpanded} setIsExpanded={setIsExpanded} />
      {/* InstallGate and NotificationGate will now correctly not render or run effects on iOS */}
      <InstallGate isLoggedIn={isLoggedIn} />
      <NotificationGate
        isLoggedIn={isLoggedIn}
        onGrant={() => {
            // window.registerFCM should only exist and be called for non-iOS
            if (window.registerFCM) {
                window.registerFCM();
            } else {
                console.log("[App] window.registerFCM not called (expected on iOS or if not logged in/FCM setup skipped).")
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
          <Route path="/home" element={isLoggedIn ? <HomePage /> : <Navigate to="/login" replace />} />
          <Route path="/profile" element={isLoggedIn ? <Profile onLogout={handleLogout} /> : <Navigate to="/login" replace />} />

          {/* Public Learning & Explorer */}
          <Route path="/learn" element={<Explorer />} />
          <Route path="/explore" element={<UserPosts />} />

          {/* Public Guide Profile Route */}
          <Route path="/guides" element={<GuideList />} />
          <Route path="/guide/:username" element={<PublicGuideProfile />} />
          <Route path="/posts/*" element={<PostDetail />} />
          <Route path="/courses/:username/:date/:subject/:courseTitle" element={<CourseDetail />} />
          <Route path="/lessons/:username/:subject/:date/:lessonSlug" element={<LessonDetail />} />

          {/* Payment Outcome Routes */}
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/payment-cancel" element={<PaymentCancel />} />

          {/* Quizes list */}
          <Route path="/quizzes/my" element={<QuizListPage />} />
          <Route path="/quizzes/Attempts" element={<QuizAttempts />} />
          <Route path="/quizzes/:username/:subject/:date/:quizSlug" element={<QuizPage />} />

          {/* Admin Routes */}
          <Route path="/admin/create-course" element={isLoggedIn ? <CreateCourse /> : <Navigate to="/login" replace />} />
          <Route path="/admin/courses/edit/:username/:date/:subject/:courseTitle" element={isLoggedIn ? <CourseDetail /> : <Navigate to="/login" replace />} />
          <Route path="/admin/create-lesson" element={isLoggedIn ? <CreateLesson /> : <Navigate to="/login" replace />} />
          <Route path="/admin/create-quiz" element={isLoggedIn ? <CreateQuiz /> : <Navigate to="/login" replace />} />
          <Route path="/admin/create-quiz/:quizId" element={isLoggedIn ? <CreateQuiz />: <Navigate to="/login" replace />} />
          <Route path="/admin/create-post" element={isLoggedIn ? <CreatePost /> : <Navigate to="/login" replace />} />

          {/* My Courses Route */}
          <Route path="/my-courses" element={isLoggedIn ? <MyCourses /> : <Navigate to="/login" replace />} />

          {/* Explorer users Activity */}
          <Route path="/enrolled-courses" element={isLoggedIn ? <EnrolledCourses /> : <Navigate to="/login" replace />} />
          <Route path="/courses/enrolled/:enrollmentId" element={isLoggedIn ? <EnrolledCourseDetail />: <Navigate to="/login" replace />} />
          <Route path="/diary" element={isLoggedIn ? <DiaryManagement /> : <Navigate to="/login" replace />} />
          <Route path="/study/dashboard" element={isLoggedIn ? <StudyDashboard /> : <Navigate to="/login" replace />} />

          {/* Default Route (Redirect to Home, which redirects to Login if needed) */}
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </div>

      {isLoggedIn && !isOnLessonDetailPage && <BottomMenu permissions={permissions} />}
    </div>
  );
};

export default App;
