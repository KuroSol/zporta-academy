import React, { useState, useContext, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'; // Changed from BrowserRouter to HashRouter
import { AuthContext } from "./context/AuthContext";
// --- Firebase Messaging imports (for fetching the token) ---
import { requestPermissionAndGetToken as fetchFcmToken } from './firebase'; // This is from firebase.js
import { v4 as uuidv4 } from 'uuid';

// --- Component Imports ---
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

// --- Platform Detection ---
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
const isAndroid = /Android/.test(navigator.userAgent);
const isIosChrome = isIOS && /CriOS/.test(navigator.userAgent); // Chrome on iOS

const isStandalonePWA = () => {
    if (isIOS) return !!navigator.standalone; // For iOS
    return window.matchMedia('(display-mode: standalone)').matches; // For other browsers
};

const getIOSVersion = () => {
    if (isIOS) {
        const match = navigator.userAgent.match(/OS (\d+)_(\d+)/);
        if (match && match.length >= 3) {
            return parseFloat(match[1] + '.' + match[2]);
        }
    }
    return 0;
};
const iosSupportsWebPush = getIOSVersion() >= 16.4;

// --- Device ID Utility ---
const getDeviceId = () => {
  let id = localStorage.getItem('app_deviceId');
  if (!id) { id = uuidv4(); localStorage.setItem('app_deviceId', id); }
  return id;
};

// --- Toast Notification ---
// Define ToastContext so it can be used by useContext in this file
export const ToastContext = React.createContext();

// This ToastProvider should wrap your entire application in index.js or your app's entry point.
export function ToastProvider({ children }) {
  // Basic showToast function. In a real app, this would trigger UI changes.
  // For example, by updating state that a ToastDisplayComponent listens to.
  const showToast = (message, type = 'info', duration = 3000) => {
    console.log(`TOAST: [${type}] ${message} (duration: ${duration}ms)`);
    // TODO: Implement actual toast display logic here.
    // This might involve setting state that causes a toast message UI to render.
    // For example:
    // setToastMessages(prevMessages => [...prevMessages, { id: uuidv4(), message, type, duration }]);
  };

  return (
    <ToastContext.Provider value={showToast}>
      {children} {/* This was the missing piece! It ensures your app components are rendered. */}
      {/* You might also want a component here that is responsible for rendering the actual toast UI elements */}
      {/* e.g., <ToastDisplayComponent /> */}
    </ToastContext.Provider>
  );
}


function useFCM(isLoggedIn, authToken) {
    // ALL HOOKS AT THE TOP!
    const showToast = useContext(ToastContext); // Consumes the showToast function from ToastProvider
    const [isFcmSubscribed, setIsFcmSubscribed] = useState(false);
    const [lastTokenSent, setLastTokenSent] = useState(localStorage.getItem('lastFCMTokenSent')); // Initialize from localStorage
    const [fcmError, setFcmError] = useState('');
    const [attemptedRegistration, setAttemptedRegistration] = useState(false);

    // HARD GUARD: Prevent notification logic if NOT PWA
    const notPWA = !isStandalonePWA();

    const updateSubscriptionStatus = useCallback(() => {
        if (notPWA || typeof Notification === 'undefined') return;
        const permission = Notification.permission;
        const tokenStored = localStorage.getItem('lastFCMTokenSent');
        setLastTokenSent(tokenStored); // Update state with current localStorage
        if (permission === 'granted' && tokenStored) {
            setIsFcmSubscribed(true);
        } else {
            setIsFcmSubscribed(false);
            if (permission !== 'granted' && tokenStored) {
                localStorage.removeItem('lastFCMTokenSent');
                setLastTokenSent(null);
            }
        }
    }, [notPWA]);

    useEffect(() => {
        if (notPWA) return;
        updateSubscriptionStatus(); // Initial check
        if (navigator.permissions && typeof navigator.permissions.query === 'function') {
            navigator.permissions.query({ name: 'notifications' }).then((status) => {
                status.onchange = () => {
                    console.log('[FCM] Notification permission changed externally.');
                    updateSubscriptionStatus(); // Re-check status on external change
                };
            }).catch(err => console.warn("[FCM] Error querying notification permissions:", err));
        }
    }, [updateSubscriptionStatus, notPWA]);

    const sendTokenToServer = useCallback(async (currentToken) => {
        if (notPWA) return false;
        if (!authToken) {
            setFcmError('Authentication required to save FCM token.');
            console.warn('[FCM] Auth token not available for sending FCM token.');
            return false;
        }
        const deviceId = getDeviceId();
        setFcmError(''); 
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
            setFcmError(`Failed to save token: ${error.message}`);
            return false;
        }
    }, [authToken, notPWA]);

    const requestPermissionAndGetToken = useCallback(async (isProactive = false) => {
        if (notPWA) return null;
        if (isIosChrome) {
            console.warn('[FCM] Skipping push on Chrome iOS (not supported).');
            if (!isProactive && showToast) showToast('Notifications not supported on Chrome for iOS.', 'info');
            return null;
        }
        
        setAttemptedRegistration(true); 

        if (!isLoggedIn || typeof Notification === 'undefined' || !('serviceWorker' in navigator)) {
            const msg = 'Notifications not supported or user not logged in.';
            setFcmError(msg);
            if (!isProactive && showToast) showToast(msg, 'error');
            console.warn('[FCM]', msg);
            return null;
        }

        if (isIOS && (!isStandalonePWA() || !iosSupportsWebPush)) {
            const message = iosSupportsWebPush 
                ? 'For notifications, please add Zporta Academy to your Home Screen first.' 
                : 'Push notifications on iOS require iOS 16.4+ and adding the app to your Home Screen.';
            if ((!isProactive || (isIOS && !isStandalonePWA() && iosSupportsWebPush)) && showToast) { 
                 showToast(message, 'info', 6000);
            }
            console.warn('[FCM] iOS PWA conditions not met for push notifications.');
            return null;
        }

        setFcmError(''); 

        try {
            let currentPermission = Notification.permission;
            if (currentPermission === 'default') {
                console.log('[FCM] Permission is default, requesting...');
                currentPermission = await Notification.requestPermission(); 
            }

            if (currentPermission === 'denied') {
                if (!isProactive && showToast) showToast('Notifications are disabled. Please check your browser or OS settings.', 'info');
                setIsFcmSubscribed(false);
                localStorage.removeItem('lastFCMTokenSent'); setLastTokenSent(null);
                console.warn('[FCM] Notification permission denied.');
                return null;
            }

            if (currentPermission === 'granted') {
                console.log('[FCM] Notification permission granted. Fetching token...');
                const fcmToken = await fetchFcmToken(); 

                if (fcmToken) {
                    console.log('[FCM] Token received:', fcmToken);
                    if (fcmToken !== lastTokenSent) {
                        const success = await sendTokenToServer(fcmToken);
                        if(success && !isProactive && showToast) showToast('Notifications enabled successfully!', 'success');
                    } else {
                        setIsFcmSubscribed(true); 
                        if(!isProactive && showToast) showToast('Notifications are already active.', 'info');
                        console.log('[FCM] Token is current, no server update needed.');
                    }
                    return fcmToken;
                } else {
                    setIsFcmSubscribed(false); 
                    const msg = 'Could not get notification token. Ensure permissions are granted and service worker is active.';
                    setFcmError(msg);
                    if (!isProactive && showToast) showToast('Failed to get notification token. Check settings.', 'error');
                    console.error('[FCM]', msg);
                    return null;
                }
            }
        } catch (error) {
            console.error('[FCM] Error in requestPermissionAndGetToken:', error);
            const errorMsg = error.message.includes('Notification permission not granted') 
                ? 'Notification permission was not granted.'
                : `Notification error: ${error.message}`;
            setFcmError(errorMsg);
            if (!isProactive && showToast) showToast(errorMsg, 'error');
            setIsFcmSubscribed(false); 
            return null;
        }
        return null; 
    }, [isLoggedIn, sendTokenToServer, showToast, lastTokenSent, notPWA]);

    useEffect(() => {
        if (notPWA) return;
        if (isLoggedIn && authToken && !isFcmSubscribed && typeof Notification !== 'undefined' && Notification.permission === 'default' && !attemptedRegistration) {
            if (isIOS && (!isStandalonePWA() || !iosSupportsWebPush)) {
                console.log('[FCM] iOS PWA conditions not met for proactive registration.');
                return; 
            }
            console.log('[FCM] Proactively attempting notification registration after login...');
            requestPermissionAndGetToken(true); 
        }
    }, [isLoggedIn, authToken, isFcmSubscribed, requestPermissionAndGetToken, attemptedRegistration, notPWA]);

    if (notPWA) {
        return {
            requestPermissionAndGetToken: () => Promise.resolve(null),
            isFcmSubscribed: false,
            setIsFcmSubscribed: () => {},
            fcmError: '',
            setAttemptedRegistration: () => {}
        };
    }

    return { requestPermissionAndGetToken, isFcmSubscribed, setIsFcmSubscribed, fcmError, setAttemptedRegistration };
}


// --- PWA Install Prompt Gate ---
function InstallGate({ isLoggedIn }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const showToast = useContext(ToastContext); // Consumes showToast
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isIOS || (isAndroid && isStandalonePWA()) || !isLoggedIn) {
        setDeferredPrompt(null); setIsVisible(false); return;
    }
    const handler = (e) => { 
        e.preventDefault(); 
        setDeferredPrompt(e); 
        setIsVisible(true); 
        console.log('[InstallGate] beforeinstallprompt event fired.');
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isLoggedIn]); 

  if (!isVisible || !deferredPrompt) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
        if(showToast) showToast('Zporta Academy installed successfully!', 'success');
        console.log('[InstallGate] PWA installation accepted.');
    } else {
        console.log('[InstallGate] PWA installation dismissed.');
    }
    setDeferredPrompt(null); 
    setIsVisible(false);
  };
  const handleDismiss = () => {
    setIsVisible(false);
    console.log('[InstallGate] Install prompt dismissed by user.');
  };

  return (
    <div style={{ padding: '10px', background: '#e0f7fa', textAlign: 'center', borderBottom: '1px solid #b2ebf2', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
      <span>Install Zporta Academy for the best experience!</span>
      <button onClick={handleInstall} style={{ padding: '5px 10px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Install</button>
      <button onClick={handleDismiss} style={{ fontSize: '12px', padding: '3px 8px', background: '#bbb', border: 'none', borderRadius: '3px', color: 'white', cursor: 'pointer' }}>Dismiss</button>
    </div>
  );
}

// --- Notification Controls Component ---
export function NotificationControls({ isLoggedIn }) {
  const showToast = useContext(ToastContext); // Consumes showToast
  const { token: authToken } = useContext(AuthContext); 
  const {
    requestPermissionAndGetToken,
    isFcmSubscribed,
    setIsFcmSubscribed, 
    fcmError,
    setAttemptedRegistration 
  } = useFCM(isLoggedIn, authToken); 
  const [showA2HSGuidance, setShowA2HSGuidance] = useState(false);

  useEffect(() => {
    if (
      isIOS &&
      iosSupportsWebPush &&
      !isStandalonePWA() && 
      typeof Notification !== 'undefined' && Notification.permission === 'default' && 
      !isFcmSubscribed 
    ) {
      setShowA2HSGuidance(true);
    } else {
      setShowA2HSGuidance(false);
    }
  }, [isFcmSubscribed]); 

  if (!isStandalonePWA()) return null; 
  if (isIosChrome) return null;        
  if (!isLoggedIn) return null;        
  if (typeof Notification === 'undefined') return null; 
  if (isIOS && !iosSupportsWebPush) { 
      return (
          <div style={{ padding: 12, background: '#fffde7', textAlign: 'center', borderBottom: '1px solid #fff59d' }}>
              Push notifications on iOS require iOS 16.4 or later.
          </div>
      );
  }
  
  const handleEnableNotifications = async () => {
    if (setAttemptedRegistration) setAttemptedRegistration(false); 
    if (requestPermissionAndGetToken) await requestPermissionAndGetToken(false); 
  };

  const handleDisableNotifications = () => {
    localStorage.removeItem('lastFCMTokenSent');
    if (setIsFcmSubscribed) setIsFcmSubscribed(false);
    if (showToast) showToast('Notifications disabled on this device.', 'info');
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && isIOS && iosSupportsWebPush && showToast) {
      showToast(
        'To fully stop notifications, also check iPhone Settings → Notifications → Zporta Academy.',
        'info',
        6000 
      );
    }
  };

  if (showA2HSGuidance) {
    return (
      <div style={{ padding: 12, background: '#fffde7', textAlign: 'center', borderBottom: '1px solid #fff59d', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
        <span>To enable notifications on your iPhone, please add Zporta Academy to your Home Screen first.</span>
        <button onClick={() => setShowA2HSGuidance(false)} style={{ padding: '3px 8px', fontSize: '12px', background: '#bbb', border: 'none', borderRadius: '3px', color: 'white' }}>Dismiss</button>
      </div>
    );
  }

  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
    return (
      <div style={{ padding: 12, background: '#ffebee', textAlign: 'center', borderBottom: '1px solid #ffcdd2' }}>
        Notifications are blocked. Please enable them in your browser/OS settings to receive updates.
      </div>
    );
  }

  if (isFcmSubscribed) {
    return (
      <div style={{ padding: 12, background: '#e8f5e9', textAlign: 'center', borderBottom: '1px solid #a5d6a7', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
        <span>Push notifications are ON for this device.</span>
        <button onClick={handleDisableNotifications} style={{ padding: '5px 10px', background: '#ffc107', color: 'black', border: 'none', borderRadius: '4px' }}>Disable</button>
      </div>
    );
  }

  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    return (
      <div style={{ padding: 12, background: '#e3f2fd', textAlign: 'center', borderBottom: '1px solid #90caf9', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <div>
            <span>Enable push notifications to stay updated?</span>
            <button onClick={handleEnableNotifications} style={{ marginLeft: 10, padding: '5px 10px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px' }}>Enable</button>
        </div>
        {fcmError && <p style={{ color: '#c62828', marginTop: 0, fontSize: '12px' }}>Error: {fcmError}</p>}
      </div>
    );
  }

  return null; 
}

// --- Main App Component ---
// NOTE: ToastProvider should be moved to wrap this App component in your index.js or main entry file.
const App = () => {
  const { token, logout, isAuthLoading } = useContext(AuthContext);
  const isLoggedIn = !!token;
  const [isExpanded, setIsExpanded] = useState(false); 
  const location = useLocation();
  const isOnLessonDetailPage = location.pathname.startsWith('/lessons/');

  const handleLogout = () => { 
    logout(); 
  };

  useEffect(() => {
    console.log('[App] Status Update. LoggedIn:', isLoggedIn, 'PWA:', isStandalonePWA(), 'iOS:', isIOS, 'iOS Push Support:', iosSupportsWebPush, 'Notification Perm:', typeof Notification !== 'undefined' ? Notification.permission : 'N/A');
  }, [isLoggedIn, location.pathname]); 

  if (isAuthLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f0f0', color: '#333', fontSize: '18px' }}>Loading Zporta Academy...</div>;
  }

  const showInstallGate = isLoggedIn && !isIOS && (!isAndroid || (isAndroid && !isStandalonePWA()));
  const showNotificationControls = isLoggedIn;

  // The <ToastProvider> wrapper has been REMOVED from here.
  // It should be placed in your application's entry point file (e.g., index.js)
  // to wrap the <App /> component.
  try {
    return (
      // <ToastProvider>  <-- REMOVED FROM HERE
          <div className={`app-container ${isExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
            {isLoggedIn && <SidebarMenu isExpanded={isExpanded} setIsExpanded={setIsExpanded} />}
            
            <div className="main-content"> 
              {showInstallGate && <InstallGate isLoggedIn={isLoggedIn} />}
              {showNotificationControls && <NotificationControls isLoggedIn={isLoggedIn} />}

              <div className="content-wrapper"> 
                <Routes>
                  <Route path="/login" element={!isLoggedIn ? <Login /> : <Navigate to="/home" replace />} />
                  <Route path="/register" element={!isLoggedIn ? <Register /> : <Navigate to="/home" replace />} />
                  <Route path="/password-reset" element={<PasswordReset />} />
                  <Route path="/reset-password-confirm/:uid/:token" element={<PasswordResetConfirm />} />
                  
                  <Route path="/home" element={isLoggedIn ? <HomePage /> : <Navigate to="/login" replace />} />
                  <Route path="/profile" element={isLoggedIn ? <Profile onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
                  <Route path="/change-password" element={isLoggedIn ? <ChangePassword token={token} /> : <Navigate to="/login" replace />} />
                  <Route path="/notifications" element={isLoggedIn ? <Notifications /> : <Navigate to="/login" replace />} />
                  <Route path="/alerts" element={isLoggedIn ? <Notifications /> : <Navigate to="/login" replace />} /> 
                  <Route path="/guide-requests" element={isLoggedIn ? <GuideRequestsPage /> : <Navigate to="/login" replace />} />
                  
                  <Route path="/learn" element={<Explorer />} /> 
                  <Route path="/explore" element={<UserPosts />} /> 
                  <Route path="/guides" element={<GuideList />} /> 
                  <Route path="/guide/:username" element={<PublicGuideProfile />} />
                  <Route path="/posts/*" element={<PostDetail />} /> 
                  
                  <Route path="/courses/:username/:date/:subject/:courseTitle" element={<CourseDetail />} />
                  <Route path="/lessons/:username/:subject/:date/:lessonSlug" element={<LessonDetail />} />
                  
                  <Route path="/payment-success" element={<PaymentSuccess />} />
                  <Route path="/payment-cancel" element={<PaymentCancel />} />
                  
                  <Route path="/quizzes/my" element={isLoggedIn ? <QuizListPage /> : <Navigate to="/login" replace />} />
                  <Route path="/quizzes/Attempts" element={isLoggedIn ? <QuizAttempts /> : <Navigate to="/login" replace />} />
                  <Route path="/quizzes/:username/:subject/:date/:quizSlug" element={isLoggedIn ? <QuizPage /> : <Navigate to="/login" replace />} />
                  
                  <Route path="/admin/create-course" element={isLoggedIn ? <CreateCourse /> : <Navigate to="/login" replace />} />
                  <Route path="/admin/courses/edit/:username/:date/:subject/:courseTitle" element={isLoggedIn ? <CreateCourse /> : <Navigate to="/login" replace />} /> 
                  <Route path="/admin/create-lesson" element={isLoggedIn ? <CreateLesson /> : <Navigate to="/login" replace />} />
                  <Route path="/admin/create-quiz" element={isLoggedIn ? <CreateQuiz /> : <Navigate to="/login" replace />} />
                  <Route path="/admin/create-quiz/:quizId" element={isLoggedIn ? <CreateQuiz /> : <Navigate to="/login" replace />} /> 
                  <Route path="/admin/create-post" element={isLoggedIn ? <CreatePost /> : <Navigate to="/login" replace />} />
                  
                  <Route path="/my-courses" element={isLoggedIn ? <MyCourses /> : <Navigate to="/login" replace />} />
                  <Route path="/enrolled-courses" element={isLoggedIn ? <EnrolledCourses /> : <Navigate to="/login" replace />} />
                  <Route path="/courses/enrolled/:enrollmentId" element={isLoggedIn ? <EnrolledCourseDetail />: <Navigate to="/login" replace />} />
                  <Route path="/diary" element={isLoggedIn ? <DiaryManagement /> : <Navigate to="/login" replace />} />
                  <Route path="/study/dashboard" element={isLoggedIn ? <StudyDashboard /> : <Navigate to="/login" replace />} />
                  
                  <Route path="*" element={<Navigate to={isLoggedIn ? "/home" : "/login"} replace />} />
                </Routes>
              </div>
            </div>
            {isLoggedIn && !isOnLessonDetailPage && <BottomMenu permissions={localStorage.getItem('permissions')?.split(',') || []} />}
          </div>
      // </ToastProvider> // <-- REMOVED FROM HERE
    );}
    catch (err) {
      console.error("App render error:", err);
      return (
        <div style={{ padding: 20, color: "red" }}>
          <h1>Rendering Error</h1>
          <pre>{err.message}</pre>
        </div>
      );
    }
};
export default App;
