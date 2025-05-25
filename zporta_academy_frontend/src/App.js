import React, { useState, useContext, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from "./context/AuthContext";
import { messaging, requestPermissionAndGetToken as fetchFcmToken } from './firebase';
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

const isStandalonePWA = () => {
    if (isIOS) return !!navigator.standalone;
    return window.matchMedia('(display-mode: standalone)').matches;
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
const ToastContext = React.createContext();
function ToastProvider({ children }) {
    const [toast, setToast] = useState(null);
    const showToast = (message, type = 'info', duration = 4000) => {
        setToast({ message, type });
        const timer = setTimeout(() => setToast(null), duration);
        return () => clearTimeout(timer);
    };
    return (
        <ToastContext.Provider value={showToast}>
            {children}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '70px', left: '50%', transform: 'translateX(-50%)',
                    padding: '12px 25px', background: toast.type === 'error' ? '#d32f2f' : (toast.type === 'success' ? '#388e3c' : '#1976d2'),
                    color: 'white', borderRadius: '4px', zIndex: 10000, boxShadow: '0 3px 5px -1px rgba(0,0,0,0.2), 0 6px 10px 0 rgba(0,0,0,0.14), 0 1px 18px 0 rgba(0,0,0,0.12)',
                    textAlign: 'center', fontSize: '14px', fontWeight: 500, minWidth: '288px', maxWidth: 'calc(100% - 40px)'
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
    const [isFcmSubscribed, setIsFcmSubscribed] = useState(false);
    const [lastTokenSent, setLastTokenSent] = useState(null);
    const [fcmError, setFcmError] = useState('');
    const [attemptedRegistration, setAttemptedRegistration] = useState(false);


    const updateSubscriptionStatus = useCallback(() => {
        if (typeof Notification === 'undefined') return;
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
    }, []);

    useEffect(() => {
        updateSubscriptionStatus(); // Initial check
        if (navigator.permissions) {
            navigator.permissions.query({ name: 'notifications' }).then((status) => {
                status.onchange = () => {
                    console.log('[FCM] Notification permission changed externally.');
                    updateSubscriptionStatus();
                };
            });
        }
    }, [updateSubscriptionStatus]);


    const sendTokenToServer = useCallback(async (currentToken) => {
        if (!authToken) {
            setFcmError('Authentication required.');
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
            setLastTokenSent(currentToken); // Update state
            setIsFcmSubscribed(true);
            console.log('[FCM] Token saved on server:', data);
            return true;
        } catch (error) {
            console.error('[FCM] Error sending token to server:', error);
            setFcmError(`Failed to save token: ${error.message}`);
            return false;
        }
    }, [authToken]);

    const requestPermissionAndGetToken = useCallback(async (isProactive = false) => {
        setAttemptedRegistration(true); // Mark that an attempt has been made
        if (!isLoggedIn || typeof Notification === 'undefined' || !('serviceWorker' in navigator) || !messaging) {
            setFcmError('Notifications not supported or user not logged in.');
            if (!isProactive) showToast('Notifications are not supported on this browser or you are not logged in.', 'error');
            return null;
        }
        if (isIOS && (!isStandalonePWA() || !iosSupportsWebPush)) {
            if (!isProactive || (isIOS && !isStandalonePWA() && iosSupportsWebPush) ) { // Show A2HS only if interactive or iOS needs A2HS
                 showToast(iosSupportsWebPush ? 'For notifications, add to Home Screen first.' : 'Push notifications on iOS require iOS 16.4+ and adding to Home Screen.', 'info');
            }
            return null;
        }
        setFcmError('');

        try {
            let currentPermission = Notification.permission;
            if (currentPermission === 'default') {
                // For proactive, we might not want to pop the dialog immediately without context,
                // but for a button click, it's fine.
                // However, some browsers block requestPermission if not user-initiated.
                // Let's assume if isProactive is true, we are okay with it possibly not showing a prompt
                // and relying on a later button click if needed.
                // For now, we always request if default.
                console.log('[FCM] Permission is default, requesting...');
                currentPermission = await Notification.requestPermission();
            }

            if (currentPermission === 'denied') {
                if (!isProactive) showToast('Notifications are disabled. Check browser/OS settings.', 'info');
                setIsFcmSubscribed(false);
                localStorage.removeItem('lastFCMTokenSent'); setLastTokenSent(null);
                return null;
            }

            if (currentPermission === 'granted') {
                // permission granted → fetch token via our firebase.js wrapper
                const fcmToken = await fetchFcmToken();

                if (fcmToken) {
                    console.log('[FCM] Token received:', fcmToken);
                    if (fcmToken !== lastTokenSent) { // Check against state `lastTokenSent`
                        const success = await sendTokenToServer(fcmToken);
                        if(success && !isProactive) showToast('Notifications enabled!', 'success');
                    } else {
                        setIsFcmSubscribed(true);
                        if(!isProactive) showToast('Notifications already active.', 'info');
                    }
                    return fcmToken;
                } else {
                    setIsFcmSubscribed(false);
                    setFcmError('Could not get notification token. Ensure permissions are granted.');
                    if (!isProactive) showToast('Failed to get token. Check settings.', 'error');
                    return null;
                }
            }
        } catch (error) {
            console.error('[FCM] Error in requestPermissionAndGetToken:', error);
            setFcmError(`Notification error: ${error.message}`);
            if (!isProactive) showToast(`Notification error: ${error.message}`, 'error');
            setIsFcmSubscribed(false);
            return null;
        }
        return null;
    }, [isLoggedIn, sendTokenToServer, showToast, lastTokenSent]); // Added lastTokenSent

    // Proactive attempt to register after login
    useEffect(() => {
        if (isLoggedIn && authToken && !isFcmSubscribed && Notification.permission === 'default' && !attemptedRegistration) {
            // Only attempt proactively if permission is default and we haven't tried yet this session
            // And for iOS, only if it's A2HS and supports push
            if (isIOS && (!isStandalonePWA() || !iosSupportsWebPush)) {
                return; // Don't proactively try on iOS if not A2HS or not supported
            }
            console.log('[FCM] Proactively attempting notification registration after login...');
            requestPermissionAndGetToken(true); // true for proactive, less verbose
        }
    }, [isLoggedIn, authToken, isFcmSubscribed, requestPermissionAndGetToken, attemptedRegistration]);

    return { requestPermissionAndGetToken, isFcmSubscribed, setIsFcmSubscribed, fcmError, setAttemptedRegistration };
}

// --- PWA Install Prompt Gate ---
function InstallGate({ isLoggedIn }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const showToast = useContext(ToastContext);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isIOS || (isAndroid && isStandalonePWA()) || !isLoggedIn) {
        setDeferredPrompt(null); setIsVisible(false); return;
    }
    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); setIsVisible(true); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isLoggedIn]);

  if (!isVisible || !deferredPrompt) return null;
  const handleInstall = async () => {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') showToast('App installed successfully!', 'success');
    setDeferredPrompt(null); setIsVisible(false);
  };
  const handleDismiss = () => setIsVisible(false);
  return (
    <div style={{ padding: '10px', background: '#e0f7fa', textAlign: 'center', borderBottom: '1px solid #b2ebf2', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span>Install Zporta Academy!</span>
      <button onClick={handleInstall} style={{ marginLeft: 10, padding: '5px 10px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Install</button>
      <button onClick={handleDismiss} style={{ marginLeft: 10, fontSize: '12px', padding: '3px 8px', background: '#bbb', border: 'none', borderRadius: '3px', color: 'white', cursor: 'pointer' }}>Dismiss</button>
    </div>
  );
}

// --- Notification Controls Component ---
function NotificationControls({ isLoggedIn }) {
    const { requestPermissionAndGetToken, isFcmSubscribed, setIsFcmSubscribed, fcmError, setAttemptedRegistration } = useFCM(isLoggedIn, useContext(AuthContext).token);
    const showToast = useContext(ToastContext);
    const [showA2HSGuidance, setShowA2HSGuidance] = useState(false);

    useEffect(() => {
        if (isIOS && iosSupportsWebPush && isLoggedIn && !isStandalonePWA() && Notification.permission === 'default' && !isFcmSubscribed) {
            setShowA2HSGuidance(true);
        } else {
            setShowA2HSGuidance(false);
        }
    }, [isLoggedIn, isFcmSubscribed]);

    const handleEnableNotifications = async () => {
        setAttemptedRegistration(false); // Allow retry via button
        await requestPermissionAndGetToken(false); // false for interactive, more verbose
    };
    const handleDisableNotifications = async () => {
        localStorage.removeItem('lastFCMTokenSent');
        setIsFcmSubscribed(false); 
        showToast('Notifications disabled on this device.', 'info');
        if (Notification.permission === 'granted' && isIOS && iosSupportsWebPush) {
             showToast('To fully stop notifications, also check iPhone Settings > Notifications > Zporta Academy.', 'info', 5000);
        }
    };

    if (!isLoggedIn || typeof Notification === 'undefined') return null;
    // Do not show any controls if on iOS and web push is not supported by the OS version
    if (isIOS && !iosSupportsWebPush) return null;


    if (showA2HSGuidance) {
        return (
            <div style={{ padding: '12px', background: '#fffde7', textAlign: 'center', borderBottom: '1px solid #fff59d', fontSize: '14px', color: '#5f4300' }}>
                To enable notifications on your iPhone, please add Zporta Academy to your Home Screen first.
                (Tap Share, then 'Add to Home Screen').
                <button onClick={() => setShowA2HSGuidance(false)} style={{ marginLeft: 10, fontSize: '13px', padding: '4px 10px', background: '#9e9e9e', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', marginTop: '5px' }}>Dismiss</button>
            </div>
        );
    }
    if (Notification.permission === 'denied') {
        return (
            <div style={{ padding: '12px', background: '#ffebee', textAlign: 'center', borderBottom: '1px solid #ffcdd2', fontSize: '14px', color: '#c62828' }}>
                Notifications are blocked. Please enable them in your browser/OS settings.
            </div>
        );
    }
    if (isFcmSubscribed) {
        return (
            <div style={{ padding: '12px', background: '#e8f5e9', textAlign: 'center', borderBottom: '1px solid #a5d6a7', fontSize: '14px', color: '#2e7d32' }}>
                <span>Push notifications are ON.</span>
                <button onClick={handleDisableNotifications} style={{ marginLeft: 10, padding: '6px 12px', background: '#fb8c00', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', fontWeight: 500 }}>
                    Disable
                </button>
            </div>
        );
    }
    if (Notification.permission === 'default') {
        // For iOS, only show enable button if it's A2HS
        if (isIOS && !isStandalonePWA()) return null; 
        return (
            <div style={{ padding: '12px', background: '#e3f2fd', textAlign: 'center', borderBottom: '1px solid #90caf9', fontSize: '14px', color: '#1565c0' }}>
                <span>Enable push notifications?</span>
                <button onClick={handleEnableNotifications} style={{ marginLeft: 10, padding: '6px 12px', background: '#43a047', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', fontWeight: 500 }}>
                    Enable
                </button>
                {fcmError && <p style={{color: '#c62828', fontSize: '13px', marginTop: '8px', fontWeight: 'normal'}}>{fcmError}</p>}
            </div>
        );
    }
    return null;
}

// --- Main App Component ---
const App = () => {
  const { token, logout, isAuthLoading } = useContext(AuthContext);
  const isLoggedIn = !!token;
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

  const showInstallGate = isLoggedIn && !isIOS && (!isAndroid || (isAndroid && !isStandalonePWA()));
  const showNotificationControls = isLoggedIn;

  return (
    <ToastProvider>
        <div className={`app-container ${isExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
          <SidebarMenu isExpanded={isExpanded} setIsExpanded={setIsExpanded} />
          
          {showInstallGate && <InstallGate isLoggedIn={isLoggedIn} />}
          {showNotificationControls && <NotificationControls isLoggedIn={isLoggedIn} />}

          <div className="content-wrapper">
            <Routes>
              {/* ... (routes are unchanged) ... */}
              <Route path="/login" element={!isLoggedIn ? <Login /> : <Navigate to="/profile" replace />} />
              <Route path="/password-reset" element={<PasswordReset />} />
              <Route path="/reset-password-confirm/:uid/:token" element={<PasswordResetConfirm />} />
              <Route path="/change-password" element={isLoggedIn ? <ChangePassword token={token} /> : <Navigate to="/login" replace />} />
              <Route path="/notifications" element={isLoggedIn ? <Notifications /> : <Navigate to="/login" replace />} />
              <Route path="/alerts" element={isLoggedIn ? <Notifications /> : <Navigate to="/login" replace />} />
              <Route path="/guide-requests" element={isLoggedIn ? <GuideRequestsPage /> : <Navigate to="/login" replace />} />
              <Route path="/register" element={<Register />} />
              <Route path="/home" element={isLoggedIn ? <HomePage /> : <Navigate to="/login" replace />} />
              <Route path="/profile" element={isLoggedIn ? <Profile onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
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
              <Route path="/admin/courses/edit/:username/:date/:subject/:courseTitle" element={isLoggedIn ? <CourseDetail /> : <Navigate to="/login" replace />} />
              <Route path="/admin/create-lesson" element={isLoggedIn ? <CreateLesson /> : <Navigate to="/login" replace />} />
              <Route path="/admin/create-quiz" element={isLoggedIn ? <CreateQuiz /> : <Navigate to="/login" replace />} />
              <Route path="/admin/create-quiz/:quizId" element={isLoggedIn ? <CreateQuiz />: <Navigate to="/login" replace />} />
              <Route path="/admin/create-post" element={isLoggedIn ? <CreatePost /> : <Navigate to="/login" replace />} />
              <Route path="/my-courses" element={isLoggedIn ? <MyCourses /> : <Navigate to="/login" replace />} />
              <Route path="/enrolled-courses" element={isLoggedIn ? <EnrolledCourses /> : <Navigate to="/login" replace />} />
              <Route path="/courses/enrolled/:enrollmentId" element={isLoggedIn ? <EnrolledCourseDetail />: <Navigate to="/login" replace />} />
              <Route path="/diary" element={isLoggedIn ? <DiaryManagement /> : <Navigate to="/login" replace />} />
              <Route path="/study/dashboard" element={isLoggedIn ? <StudyDashboard /> : <Navigate to="/login" replace />} />
              <Route path="*" element={<Navigate to={isLoggedIn ? "/home" : "/login"} replace />} />
            </Routes>
          </div>
          {isLoggedIn && !isOnLessonDetailPage && <BottomMenu permissions={localStorage.getItem('permissions')?.split(',') || []} />}
        </div>
    </ToastProvider>
  );
};
export default App;