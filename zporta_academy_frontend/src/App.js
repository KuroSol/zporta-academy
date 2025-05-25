import React, { useState, useContext, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from "./context/AuthContext";
import { messaging } from './firebase'; // Assuming firebase.js exports messaging
import { getToken } from 'firebase/messaging';
import { v4 as uuidv4 } from 'uuid';

// --- Component Imports (Assuming these exist and are correct) ---
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
import Notifications from './components/Notifications'; // Component to display in-app notifications
import GuideRequestsPage from './components/GuideRequestsPage';
import EnrolledCourses from './components/EnrolledCourses';
import EnrolledCourseDetail from './components/EnrolledCourseDetail';
import StudyDashboard from './components/StudyDashboard';

// --- Platform Detection ---
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
const isAndroid = /Android/.test(navigator.userAgent);
const isStandalonePWA = () => {
    if (isIOS) return !!navigator.standalone; // Reliable for iOS
    return window.matchMedia('(display-mode: standalone)').matches;
};

// --- Device ID Utility ---
const getDeviceId = () => {
  let id = localStorage.getItem('app_deviceId');
  if (!id) {
    id = uuidv4();
    localStorage.setItem('app_deviceId', id);
  }
  return id;
};

// --- Simple Toast Notification ---
const ToastContext = React.createContext();

function ToastProvider({ children }) {
    const [toast, setToast] = useState(null);
    const showToast = (message, type = 'info', duration = 3000) => {
        setToast({ message, type });
        const timer = setTimeout(() => {
            setToast(null);
        }, duration);
        return () => clearTimeout(timer);
    };
    return (
        <ToastContext.Provider value={showToast}>
            {children}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
                    padding: '10px 20px', background: toast.type === 'error' ? '#f44336' : '#4CAF50',
                    color: 'white', borderRadius: '5px', zIndex: 10000, boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
                }}>
                    {toast.message}
                </div>
            )}
        </ToastContext.Provider>
    );
}

// --- FCM Service Hook ---
function useFCM(isLoggedIn, authToken) {
    const showToast = useContext(ToastContext);
    const [isFcmSubscribed, setIsFcmSubscribed] = useState(() => {
        // Initialize based on known permission and if a token was previously sent
        return Notification.permission === 'granted' && !!localStorage.getItem('lastFCMTokenSent');
    });
    const [lastTokenSent, setLastTokenSent] = useState(localStorage.getItem('lastFCMTokenSent'));

    const sendTokenToServer = useCallback(async (currentToken) => {
        if (!authToken) return false;
        const deviceId = getDeviceId();
        try {
            const response = await fetch('/api/notifications/save-fcm-token/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${authToken}` },
                body: JSON.stringify({ token: currentToken, device_id: deviceId }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || `Server error: ${response.status}`);
            localStorage.setItem('lastFCMTokenSent', currentToken);
            setLastTokenSent(currentToken);
            setIsFcmSubscribed(true);
            console.log('[FCM] Token saved on server:', data);
            return true;
        } catch (error) {
            console.error('[FCM] Error sending token to server:', error);
            showToast(`Error saving notification preferences: ${error.message}`, 'error');
            setIsFcmSubscribed(false);
            return false;
        }
    }, [authToken, showToast]);

    const requestPermissionAndToken = useCallback(async () => {
        if (!isLoggedIn || !('Notification' in window) || !('serviceWorker' in navigator) || !messaging) {
            console.warn('[FCM] Prerequisites not met.');
            return null;
        }
        // On iOS, only proceed if it's a Home Screen PWA for push notifications
        if (isIOS && !isStandalonePWA()) {
            showToast('For notifications, please add this app to your Home Screen first.', 'info');
            return null;
        }

        try {
            let currentPermission = Notification.permission;
            if (currentPermission === 'default') {
                currentPermission = await Notification.requestPermission();
            }

            if (currentPermission === 'denied') {
                showToast('Notifications are disabled. Enable them in browser/OS settings.', 'info');
                setIsFcmSubscribed(false);
                return null;
            }

            if (currentPermission === 'granted') {
                const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                const fcmToken = await getToken(messaging, {
                    vapidKey: 'BDm-BOtLstlVLYXxuVIyNwFzghCGtiFD5oFd1qkrMrRG_sRTTmE-GE_tL5I8Qu355iun2xAmqukiQIRvU4ZJKcw',
                    serviceWorkerRegistration: swRegistration,
                });

                if (fcmToken) {
                    if (fcmToken !== lastTokenSent) {
                        await sendTokenToServer(fcmToken);
                    } else {
                        setIsFcmSubscribed(true); // Already subscribed with this token
                    }
                    return fcmToken;
                } else {
                    setIsFcmSubscribed(false);
                    showToast('Could not get notification token. Try again or check settings.', 'error');
                    return null;
                }
            }
        } catch (error) {
            console.error('[FCM] Error in requestPermissionAndToken:', error);
            showToast(`Notification setup failed: ${error.message}`, 'error');
            setIsFcmSubscribed(false);
            return null;
        }
        return null;
    }, [isLoggedIn, sendTokenToServer, showToast, lastTokenSent]);
    
    // Effect to update subscription status if permission changes externally
    useEffect(() => {
        const updateSubscriptionStatus = () => {
            if (Notification.permission === 'granted' && localStorage.getItem('lastFCMTokenSent')) {
                setIsFcmSubscribed(true);
            } else {
                setIsFcmSubscribed(false);
            }
        };
        // Check on mount
        updateSubscriptionStatus();
        // Optional: Listen for permission changes (more complex, might not be needed if UI drives re-check)
        // navigator.permissions?.query({name:'notifications'}).then(status => {
        // status.onchange = () => updateSubscriptionStatus();
        // });
    }, []);


    return { requestPermissionAndToken, isFcmSubscribed, setIsFcmSubscribed };
}

// --- PWA Install Prompt Gate (for non-iOS) ---
function InstallGate({ isLoggedIn }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const showToast = useContext(ToastContext);

  useEffect(() => {
    // This entire component is for non-iOS PWA install prompts.
    // It will be conditionally rendered in App.
    if (isIOS) return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!isLoggedIn || !deferredPrompt) return null; // Only show if logged in and prompt is available

  const handleInstall = async () => {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      showToast('App installed successfully!', 'success');
    }
    setDeferredPrompt(null);
  };

  return (
    <div style={{ padding: '10px', background: '#e0f7fa', textAlign: 'center', borderBottom: '1px solid #b2ebf2', fontSize: '14px' }}>
      Install Zporta Academy for a better experience!
      <button onClick={handleInstall} style={{ marginLeft: 10, padding: '5px 10px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
        Install
      </button>
    </div>
  );
}

// --- Notification Controls Component ---
function NotificationControls({ isLoggedIn }) {
    if (!isLoggedIn || !isAndroid) return null;
    const { token: authToken } = useContext(AuthContext);
    const { requestPermissionAndToken, isFcmSubscribed, setIsFcmSubscribed } = useFCM(isLoggedIn, authToken);
    const showToast = useContext(ToastContext);
    const [showA2HSGuidance, setShowA2HSGuidance] = useState(false);

    // Determine if any notification UI should be shown
    const shouldShowControls = isLoggedIn && ('Notification' in window);

    useEffect(() => {
        if (isIOS && isLoggedIn && !isStandalonePWA() && Notification.permission === 'default' && !isFcmSubscribed) {
            setShowA2HSGuidance(true);
        } else {
            setShowA2HSGuidance(false);
        }
    }, [isLoggedIn, isFcmSubscribed]);


    const handleEnableNotifications = async () => {
        if (isIOS && !isStandalonePWA()) {
            setShowA2HSGuidance(true); // Re-emphasize A2HS if they click enable in Safari
            showToast('Please add to Home Screen first to enable notifications.', 'info');
            return;
        }
        const token = await requestPermissionAndToken();
        if (token) {
            showToast('Notifications enabled!', 'success');
            // isFcmSubscribed is updated by useFCM
        }
    };

    const handleDisableNotifications = async () => {
        // Client-side disable: update UI, clear local token.
        // For full server-side removal, an API call to delete the token would be needed.
        localStorage.removeItem('lastFCMTokenSent');
        setIsFcmSubscribed(false);
        showToast('Notifications disabled on this device.', 'info');
        // Potentially: Tell user they might need to disable in OS settings too for full effect.
        if (Notification.permission === 'granted' && isIOS) {
             showToast('To fully stop notifications, also check iPhone Settings > Notifications > Zporta Academy.', 'info', 5000);
        }
    };

    if (!shouldShowControls) return null;

    // If on iOS and not yet A2HS, show A2HS guidance and nothing else from this component.
    if (showA2HSGuidance) {
        return (
            <div style={{ padding: '10px', background: '#fff9c4', textAlign: 'center', borderBottom: '1px solid #fff176', fontSize: '14px' }}>
                To enable notifications on iOS, first add this app to your Home Screen (Tap Share icon, then 'Add to Home Screen').
                <button onClick={() => setShowA2HSGuidance(false)} style={{ marginLeft: 10, fontSize: '12px', padding: '3px 8px', background: '#bbb', border: 'none', borderRadius: '3px', color: 'white', cursor: 'pointer' }}>Dismiss</button>
            </div>
        );
    }

    // If permission is denied, show message and hide controls.
    if (Notification.permission === 'denied') {
        return (
            <div style={{ padding: '10px', background: '#ffebee', textAlign: 'center', borderBottom: '1px solid #ffcdd2', fontSize: '14px' }}>
                Notifications are blocked. Please enable them in your browser or OS settings.
            </div>
        );
    }

    // If already subscribed (or permission granted and token sent), don't show enable prompt.
    // Show "Disable" option or nothing.
    if (isFcmSubscribed) {
         // You can choose to show nothing, or only the disable button if desired.
         // For now, let's show the disable button if subscribed.
        return (
            <div style={{ padding: '10px', background: '#e8f5e9', textAlign: 'center', borderBottom: '1px solid #c8e6c9', fontSize: '14px' }}>
                <span>Push notifications are ON for this device.</span>
                <button onClick={handleDisableNotifications} style={{ marginLeft: 10, padding: '5px 10px', background: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    Disable
                </button>
            </div>
        );
    }
    
    // If permission is 'default' (and not iOS non-A2HS), show "Enable" prompt.
    if (Notification.permission === 'default') {
        return (
            <div style={{ padding: '10px', background: '#e8f5e9', textAlign: 'center', borderBottom: '1px solid #c8e6c9', fontSize: '14px' }}>
                <span>Enable push notifications for updates?</span>
                <button onClick={handleEnableNotifications} style={{ marginLeft: 10, padding: '5px 10px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    Enable
                </button>
            </div>
        );
    }
    
    return null; // Fallback, should not be reached if logic is correct
}


// --- Main App Component ---
const App = () => {
  const { token, logout, isAuthLoading } = useContext(AuthContext);
  const isLoggedIn = !!token;
  const [permissions] = useState(() => {
    const stored = localStorage.getItem('permissions');
    return stored && typeof stored === 'string' && stored !== 'undefined' ? stored.split(',') : [];
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();
  const isOnLessonDetailPage = location.pathname.startsWith('/lessons/');

  const handleLogout = () => { logout(); };

  useEffect(() => {
    console.log('[App] Mount/Update. isIOS:', isIOS, 'isStandalonePWA:', isStandalonePWA(), 'isLoggedIn:', isLoggedIn);
  }, [isLoggedIn]);

  if (isAuthLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f0f0' }}>Loading App...</div>;
  }

  return (
    <ToastProvider>
        <div className={`app-container ${isExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
          <SidebarMenu isExpanded={isExpanded} setIsExpanded={setIsExpanded} />
          
            {/* only show on Android mobile, hide completely on iOS and desktop */}
            {isAndroid && (
            <>
                <InstallGate isLoggedIn={isLoggedIn} />
                <NotificationControls isLoggedIn={isLoggedIn} />
            </>
            )}

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
              <Route path="/guides" element={<GuideList />} />
              <Route path="/guide/:username" element={<PublicGuideProfile />} />
              <Route path="/posts/*" element={<PostDetail />} />
              <Route path="/courses/:username/:date/:subject/:courseTitle" element={<CourseDetail />} />
              <Route path="/lessons/:username/:subject/:date/:lessonSlug" element={<LessonDetail />} />

              {/* Payment Outcome Routes */}
              <Route path="/payment-success" element={<PaymentSuccess />} />
              <Route path="/payment-cancel" element={<PaymentCancel />} />

              {/* Quizzes */}
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

              {/* User Specific Content */}
              <Route path="/my-courses" element={isLoggedIn ? <MyCourses /> : <Navigate to="/login" replace />} />
              <Route path="/enrolled-courses" element={isLoggedIn ? <EnrolledCourses /> : <Navigate to="/login" replace />} />
              <Route path="/courses/enrolled/:enrollmentId" element={isLoggedIn ? <EnrolledCourseDetail />: <Navigate to="/login" replace />} />
              <Route path="/diary" element={isLoggedIn ? <DiaryManagement /> : <Navigate to="/login" replace />} />
              <Route path="/study/dashboard" element={isLoggedIn ? <StudyDashboard /> : <Navigate to="/login" replace />} />
              
              {/* Default Route */}
              <Route path="*" element={<Navigate to={isLoggedIn ? "/home" : "/login"} replace />} />
            </Routes>
          </div>

          {isLoggedIn && !isOnLessonDetailPage && <BottomMenu permissions={permissions} />}
        </div>
    </ToastProvider>
  );
};

export default App;