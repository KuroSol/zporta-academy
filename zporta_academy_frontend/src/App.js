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
const isAndroid = /Android/.test(navigator.userAgent); // For Android specific UI if needed

const isStandalonePWA = () => {
    if (isIOS) return !!navigator.standalone; // Reliable for iOS
    // For other browsers, this media query is a good indicator of PWA mode
    return window.matchMedia('(display-mode: standalone)').matches;
};

// Function to roughly check iOS version (for >= 16.4 push support)
const getIOSVersion = () => {
    if (isIOS) {
        const match = navigator.userAgent.match(/OS (\d+)_(\d+)/);
        if (match && match.length >= 3) {
            return parseFloat(match[1] + '.' + match[2]);
        }
    }
    return 0; // Return 0 if not iOS or version not found
};
const iosSupportsWebPush = getIOSVersion() >= 16.4;

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
    const showToast = (message, type = 'info', duration = 4000) => {
        setToast({ message, type });
        const timer = setTimeout(() => {
            setToast(null);
        }, duration);
        return () => clearTimeout(timer); // Cleanup timer on component unmount or if new toast appears
    };
    return (
        <ToastContext.Provider value={showToast}>
            {children}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '70px', /* Adjusted for bottom menu */
                    left: '50%', transform: 'translateX(-50%)',
                    padding: '12px 25px', 
                    background: toast.type === 'error' ? '#d32f2f' : (toast.type === 'success' ? '#388e3c' : '#1976d2'), // Standard Material Design colors
                    color: 'white', borderRadius: '4px', zIndex: 10000, boxShadow: '0 3px 5px -1px rgba(0,0,0,0.2), 0 6px 10px 0 rgba(0,0,0,0.14), 0 1px 18px 0 rgba(0,0,0,0.12)', // Material shadow
                    textAlign: 'center', fontSize: '14px', fontWeight: 500,
                    minWidth: '288px', maxWidth: 'calc(100% - 40px)' // Ensure it doesn't overflow screen
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
        if (typeof Notification === 'undefined') return false;
        return Notification.permission === 'granted' && !!localStorage.getItem('lastFCMTokenSent');
    });
    const [lastTokenSent, setLastTokenSent] = useState(localStorage.getItem('lastFCMTokenSent'));
    const [fcmError, setFcmError] = useState(''); // To store and potentially display FCM errors

    const sendTokenToServer = useCallback(async (currentToken) => {
        if (!authToken) {
            setFcmError('Authentication required to save notification settings.');
            return false;
        }
        const deviceId = getDeviceId();
        setFcmError(''); // Clear previous errors
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
            setFcmError(`Failed to save notification preferences: ${error.message}`);
            // Don't flip isFcmSubscribed here, let user retry if it was a network glitch
            return false;
        }
    }, [authToken]); // Removed showToast from deps as setFcmError covers feedback

    const requestPermissionAndToken = useCallback(async () => {
        if (!isLoggedIn || typeof Notification === 'undefined' || !('serviceWorker' in navigator) || !messaging) {
            setFcmError('Notifications not supported or user not logged in.');
            return null;
        }
        // For iOS, push notifications require A2HS and iOS 16.4+
        if (isIOS && (!isStandalonePWA() || !iosSupportsWebPush)) {
            if (!iosSupportsWebPush) {
                showToast('Push notifications on iOS require iOS 16.4 or later.', 'info');
            } else {
                showToast('For notifications, please add this app to your Home Screen first.', 'info');
            }
            return null;
        }
        setFcmError('');

        try {
            let currentPermission = Notification.permission;
            if (currentPermission === 'default') {
                currentPermission = await Notification.requestPermission();
            }

            if (currentPermission === 'denied') {
                showToast('Notifications are disabled. You can enable them in your browser/OS settings.', 'info');
                setIsFcmSubscribed(false); // Explicitly set to false if denied
                localStorage.removeItem('lastFCMTokenSent'); // Clear any old token
                setLastTokenSent(null);
                return null;
            }

            if (currentPermission === 'granted') {
                const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                console.log('[FCM] Service Worker registered:', swRegistration.scope);
                const fcmToken = await getToken(messaging, {
                    vapidKey: 'BDm-BOtLstlVLYXxuVIyNwFzghCGtiFD5oFd1qkrMrRG_sRTTmE-GE_tL5I8Qu355iun2xAmqukiQIRvU4ZJKcw',
                    serviceWorkerRegistration: swRegistration,
                });

                if (fcmToken) {
                    console.log('[FCM] Token received:', fcmToken);
                    if (fcmToken !== lastTokenSent) {
                        const success = await sendTokenToServer(fcmToken);
                        if(success) showToast('Notifications enabled successfully!', 'success');
                        // If sendTokenToServer failed, isFcmSubscribed remains as it was or becomes false
                    } else {
                        setIsFcmSubscribed(true); // Already subscribed with this token
                        // showToast('Notifications are already active with this token.', 'info'); // Optional feedback
                    }
                    return fcmToken;
                } else {
                    setIsFcmSubscribed(false); // Explicitly set if no token received
                    setFcmError('Could not get a notification token. Please ensure permissions are granted.');
                    showToast('Failed to get a notification token. Please try again or check browser/OS settings.', 'error');
                    return null;
                }
            }
        } catch (error) {
            console.error('[FCM] Error in requestPermissionAndToken:', error);
            setFcmError(`Notification setup error: ${error.message}`);
            showToast(`Notification setup error: ${error.message}`, 'error');
            setIsFcmSubscribed(false);
            return null;
        }
        return null; // Should not be reached if logic is complete
    }, [isLoggedIn, sendTokenToServer, showToast, lastTokenSent]);
    
    // Effect to update subscription status if Notification.permission changes externally
    useEffect(() => {
        const checkCurrentSubscription = () => {
            if (typeof Notification === 'undefined') return;
            const permission = Notification.permission;
            const tokenStored = !!localStorage.getItem('lastFCMTokenSent');
            if (permission === 'granted' && tokenStored) {
                setIsFcmSubscribed(true);
            } else {
                setIsFcmSubscribed(false);
                if(permission !== 'granted' && tokenStored) { // Clean up if permission revoked but token still stored
                    localStorage.removeItem('lastFCMTokenSent');
                    setLastTokenSent(null);
                }
            }
        };
        checkCurrentSubscription();
        if (navigator.permissions) {
            navigator.permissions.query({name: 'notifications'}).then((status) => {
                status.onchange = () => {
                    console.log('[FCM] Notification permission changed externally.');
                    checkCurrentSubscription();
                };
            });
        }
    }, []); // Runs once on mount and sets up listener

    return { requestPermissionAndToken, isFcmSubscribed, setIsFcmSubscribed, fcmError };
}

// --- PWA Install Prompt Gate (for non-iOS, non-Android PWA, or non-standalone Android) ---
function InstallGate({ isLoggedIn }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const showToast = useContext(ToastContext);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show for browsers that support beforeinstallprompt and are not iOS
    // and if not already running as a standalone PWA (for Android)
    if (isIOS || (isAndroid && isStandalonePWA()) || !isLoggedIn) {
        setDeferredPrompt(null);
        setIsVisible(false);
        return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isLoggedIn]);

  if (!isVisible || !deferredPrompt) return null;

  const handleInstall = async () => {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      showToast('App installed successfully!', 'success');
    }
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleDismiss = () => setIsVisible(false);

  return (
    <div style={{ padding: '10px', background: '#e0f7fa', textAlign: 'center', borderBottom: '1px solid #b2ebf2', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span>Install Zporta Academy for a better experience!</span>
      <button onClick={handleInstall} style={{ marginLeft: 10, padding: '5px 10px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
        Install
      </button>
      <button onClick={handleDismiss} style={{ marginLeft: 10, fontSize: '12px', padding: '3px 8px', background: '#bbb', border: 'none', borderRadius: '3px', color: 'white', cursor: 'pointer' }}>
        Dismiss
      </button>
    </div>
  );
}

// --- Notification Controls Component ---
function NotificationControls({ isLoggedIn }) {
    const { token: authToken } = useContext(AuthContext);
    const { requestPermissionAndToken, isFcmSubscribed, setIsFcmSubscribed, fcmError } = useFCM(isLoggedIn, authToken);
    const showToast = useContext(ToastContext);
    const [showA2HSGuidance, setShowA2HSGuidance] = useState(false);
    const [userInteractedThisSession, setUserInteractedThisSession] = useState(false); // To hide prompt after one interaction per session

    useEffect(() => {
        // Show A2HS guidance if on iOS, logged in, not standalone, permission is default, and not already subscribed.
        if (isIOS && iosSupportsWebPush && isLoggedIn && !isStandalonePWA() && Notification.permission === 'default' && !isFcmSubscribed) {
            setShowA2HSGuidance(true);
        } else {
            setShowA2HSGuidance(false);
        }
    }, [isLoggedIn, isFcmSubscribed]);

    const handleEnableNotifications = async () => {
        setUserInteractedThisSession(true); // User has interacted
        if (isIOS && !isStandalonePWA() && iosSupportsWebPush) {
            setShowA2HSGuidance(true); 
            showToast('Please add this app to your Home Screen first to enable notifications.', 'info');
            return;
        }
        await requestPermissionAndToken();
    };

    const handleDisableNotifications = async () => {
        setUserInteractedThisSession(true); // User has interacted
        localStorage.removeItem('lastFCMTokenSent');
        setIsFcmSubscribed(false); 
        showToast('Notifications disabled on this device.', 'info');
        if (Notification.permission === 'granted' && isIOS && iosSupportsWebPush) {
             showToast('To fully stop notifications, also check iPhone Settings > Notifications > Zporta Academy.', 'info', 5000);
        }
        // Note: This doesn't automatically revoke Notification.permission if it was 'granted'.
        // The user would need to do that in browser/OS settings.
    };

    // Don't show anything if not logged in or Notifications API not available
    if (!isLoggedIn || typeof Notification === 'undefined') return null;

    // Specific guidance for iOS users to Add to Home Screen
    if (showA2HSGuidance) {
        return (
            <div style={{ padding: '12px', background: '#fffde7', textAlign: 'center', borderBottom: '1px solid #fff59d', fontSize: '14px', color: '#5f4300' }}>
                To enable notifications on your iPhone (iOS 16.4+), please add Zporta Academy to your Home Screen first.
                <br /> (Tap <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{verticalAlign: 'middle', margin: '0 2px'}}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"></path></svg> Share icon in Safari, then 'Add to Home Screen').
                <button onClick={() => setShowA2HSGuidance(false)} style={{ marginLeft: 10, fontSize: '13px', padding: '4px 10px', background: '#9e9e9e', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', marginTop: '5px' }}>Dismiss</button>
            </div>
        );
    }

    // If permission is denied
    if (Notification.permission === 'denied') {
        return (
            <div style={{ padding: '12px', background: '#ffebee', textAlign: 'center', borderBottom: '1px solid #ffcdd2', fontSize: '14px', color: '#c62828' }}>
                Notifications are blocked by your browser/OS. To enable, please check your device settings for Zporta Academy.
            </div>
        );
    }

    // If subscribed, show "ON" state and disable button
    if (isFcmSubscribed) {
        return (
            <div style={{ padding: '12px', background: '#e8f5e9', textAlign: 'center', borderBottom: '1px solid #a5d6a7', fontSize: '14px', color: '#2e7d32' }}>
                <span>Push notifications are ON for this device.</span>
                <button onClick={handleDisableNotifications} style={{ marginLeft: 10, padding: '6px 12px', background: '#fb8c00', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', fontWeight: 500 }}>
                    Disable
                </button>
            </div>
        );
    }
    
    // If permission is default, and user hasn't interacted this session, or there was an error (allowing retry)
    // And, if it's iOS, it must be a standalone PWA and support web push.
    if (Notification.permission === 'default' && (!userInteractedThisSession || fcmError)) {
        if (isIOS && (!isStandalonePWA() || !iosSupportsWebPush)) {
            // This case should be covered by showA2HSGuidance or if iosSupportsWebPush is false, nothing is shown.
            // If iosSupportsWebPush is false, we don't offer the prompt.
            if (!iosSupportsWebPush && isIOS) return null; 
            // If it's iOS but not standalone, A2HS guidance handles it.
            if (isIOS && !isStandalonePWA()) return null; 
        }

        return (
            <div style={{ padding: '12px', background: '#e3f2fd', textAlign: 'center', borderBottom: '1px solid #90caf9', fontSize: '14px', color: '#1565c0' }}>
                <span>Enable push notifications for updates?</span>
                <button onClick={handleEnableNotifications} style={{ marginLeft: 10, padding: '6px 12px', background: '#43a047', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', fontWeight: 500 }}>
                    Enable
                </button>
                {fcmError && <p style={{color: '#c62828', fontSize: '13px', marginTop: '8px', fontWeight: 'normal'}}>{fcmError}</p>}
            </div>
        );
    }
    
    return null; // Default: show nothing if none of the above conditions are met
}


// --- Main App Component ---
const App = () => {
  const { token, logout, isAuthLoading } = useContext(AuthContext);
  const isLoggedIn = !!token;
  // const [permissions] = useState(() => { // Assuming permissions are used by BottomMenu
  //   const stored = localStorage.getItem('permissions');
  //   return stored && typeof stored === 'string' && stored !== 'undefined' ? stored.split(',') : [];
  // });
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();
  const isOnLessonDetailPage = location.pathname.startsWith('/lessons/');

  const handleLogout = () => { logout(); };

  useEffect(() => {
    console.log('[App] Mount/Update. isIOS:', isIOS, 'iosSupportsWebPush:', iosSupportsWebPush, 'isStandalonePWA:', isStandalonePWA(), 'isLoggedIn:', isLoggedIn, 'Notification.permission:', typeof Notification !== 'undefined' ? Notification.permission : 'N/A');
  }, [isLoggedIn]);

  if (isAuthLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f0f0', color: '#333' }}>Loading App...</div>;
  }

  // Determine if PWA-related UI should be shown
  // InstallGate for non-iOS, non-standalone Android.
  const showInstallGate = isLoggedIn && !isIOS && (!isAndroid || (isAndroid && !isStandalonePWA()));
  // NotificationControls are shown if logged in (internal logic handles platform specifics).
  const showNotificationControls = isLoggedIn;


  return (
    <ToastProvider>
        <div className={`app-container ${isExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
          <SidebarMenu isExpanded={isExpanded} setIsExpanded={setIsExpanded} />
          
          {showInstallGate && <InstallGate isLoggedIn={isLoggedIn} />}
          {showNotificationControls && <NotificationControls isLoggedIn={isLoggedIn} />}

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
              <Route path="/quizzes/my" element={isLoggedIn ? <QuizListPage /> : <Navigate to="/login" replace />} />
              <Route path="/quizzes/Attempts" element={isLoggedIn ? <QuizAttempts /> : <Navigate to="/login" replace />} />
              <Route path="/quizzes/:username/:subject/:date/:quizSlug" element={isLoggedIn ? <QuizPage /> : <Navigate to="/login" replace />} />

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

          {isLoggedIn && !isOnLessonDetailPage && <BottomMenu permissions={localStorage.getItem('permissions')?.split(',') || []} />}
        </div>
    </ToastProvider>
  );
};

export default App;