import React, { useState, useContext, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from "./context/AuthContext";
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
export const ToastContext = React.createContext();

export function ToastProvider({ children }) {
  const showToast = (message, type = 'info', duration = 3000) => {
    console.log(`TOAST: [${type}] ${message} (duration: ${duration}ms)`);
    // TODO: Implement actual toast display logic here.
  };

  return (
    <ToastContext.Provider value={showToast}>
      {children}
    </ToastContext.Provider>
  );
}

// --- FCM Hook with Detailed Logging ---
function useFCM(isLoggedIn, authToken) {
    const showToast = useContext(ToastContext);
    const [isFcmSubscribed, setIsFcmSubscribed] = useState(false);
    const [lastTokenSent, setLastTokenSent] = useState(localStorage.getItem('lastFCMTokenSent'));
    const [fcmError, setFcmError] = useState('');
    const [attemptedRegistration, setAttemptedRegistration] = useState(false);

    const notPWA = !isStandalonePWA();
    console.log('[useFCM Hook] Initializing. notPWA:', notPWA, 'isLoggedIn:', isLoggedIn, 'authToken:', !!authToken);


    const updateSubscriptionStatus = useCallback(() => {
        console.log('[useFCM updateSubscriptionStatus] Called. notPWA:', notPWA, 'Notification:', typeof Notification);
        if (notPWA || typeof Notification === 'undefined') return;
        const permission = Notification.permission;
        const tokenStored = localStorage.getItem('lastFCMTokenSent');
        console.log('[useFCM updateSubscriptionStatus] Permission:', permission, 'Token Stored:', !!tokenStored);
        setLastTokenSent(tokenStored);
        if (permission === 'granted' && tokenStored) {
            setIsFcmSubscribed(true);
            console.log('[useFCM updateSubscriptionStatus] Set isFcmSubscribed to true');
        } else {
            setIsFcmSubscribed(false);
            console.log('[useFCM updateSubscriptionStatus] Set isFcmSubscribed to false');
            if (permission !== 'granted' && tokenStored) {
                localStorage.removeItem('lastFCMTokenSent');
                setLastTokenSent(null);
                console.log('[useFCM updateSubscriptionStatus] Removed lastFCMTokenSent from localStorage');
            }
        }
    }, [notPWA]);

    useEffect(() => {
        console.log('[useFCM useEffect for updateSubscriptionStatus] Running. notPWA:', notPWA);
        if (notPWA) {
            console.log('[useFCM useEffect for updateSubscriptionStatus] Bailing out: notPWA is true.');
            return;
        }
        updateSubscriptionStatus();
        if (navigator.permissions && typeof navigator.permissions.query === 'function') {
            navigator.permissions.query({ name: 'notifications' }).then((status) => {
                status.onchange = () => {
                    console.log('[FCM App.js] Notification permission changed externally.');
                    updateSubscriptionStatus();
                };
            }).catch(err => console.warn("[FCM App.js] Error querying notification permissions:", err));
        }
    }, [updateSubscriptionStatus, notPWA]);

    const sendTokenToServer = useCallback(async (currentToken) => {
        console.log('[useFCM sendTokenToServer] Called. notPWA:', notPWA, 'authToken:', !!authToken);
        if (notPWA) {
             console.log('[useFCM sendTokenToServer] Bailing out: notPWA is true.');
            return false;
        }
        if (!authToken) {
            setFcmError('Authentication required to save FCM token.');
            console.warn('[FCM App.js] Auth token not available for sending FCM token.');
            return false;
        }
        const deviceId = getDeviceId();
        setFcmError('');
        try {
            console.log('[useFCM sendTokenToServer] Attempting to send token to server:', currentToken);
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
            console.log('[FCM App.js] Token saved on server:', data);
            return true;
        } catch (error) {
            console.error('[FCM App.js] Error sending token to server:', error);
            setFcmError(`Failed to save token: ${error.message}`);
            return false;
        }
    }, [authToken, notPWA]);

    const requestPermissionAndGetToken = useCallback(async (isProactive = false) => {
        console.log('[useFCM requestPermissionAndGetToken] Called. isProactive:', isProactive, 'notPWA:', notPWA, 'isIosChrome:', isIosChrome);

        if (notPWA) {
            console.log('[useFCM requestPermissionAndGetToken] Exiting: notPWA is true.');
            return null;
        }
        if (isIosChrome) {
            console.warn('[useFCM requestPermissionAndGetToken] Exiting: Skipping push on Chrome iOS (not supported).');
            if (!isProactive && showToast) showToast('Notifications not supported on Chrome for iOS.', 'info');
            return null;
        }

        setAttemptedRegistration(true);
        console.log('[useFCM requestPermissionAndGetToken] setAttemptedRegistration to true. isLoggedIn:', isLoggedIn, 'Notification:', typeof Notification, 'serviceWorker in navigator:', ('serviceWorker' in navigator));

        if (!isLoggedIn || typeof Notification === 'undefined' || !('serviceWorker' in navigator)) {
            const msg = 'Notifications not supported or user not logged in.';
            setFcmError(msg);
            if (!isProactive && showToast) showToast(msg, 'error');
            console.warn('[useFCM requestPermissionAndGetToken] Exiting:', msg);
            return null;
        }
        
        console.log('[useFCM requestPermissionAndGetToken] iOS checks: isIOS:', isIOS, 'isStandalonePWA():', isStandalonePWA(), 'iosSupportsWebPush:', iosSupportsWebPush);
        if (isIOS && (!isStandalonePWA() || !iosSupportsWebPush)) {
            const message = iosSupportsWebPush
                ? 'For notifications, please add Zporta Academy to your Home Screen first.'
                : 'Push notifications on iOS require iOS 16.4+ and adding the app to your Home Screen.';
            if ((!isProactive || (isIOS && !isStandalonePWA() && iosSupportsWebPush)) && showToast) {
                showToast(message, 'info', 6000);
            }
            console.warn('[useFCM requestPermissionAndGetToken] Exiting: iOS PWA conditions not met for push notifications.');
            return null;
        }

        setFcmError('');

        try {
            let currentPermission = Notification.permission;
            console.log('[useFCM requestPermissionAndGetToken] Current Notification.permission:', currentPermission);
            if (currentPermission === 'default') {
                console.log('[useFCM requestPermissionAndGetToken] Permission is default, requesting...');
                currentPermission = await Notification.requestPermission();
                console.log('[useFCM requestPermissionAndGetToken] Permission after request:', currentPermission);
            }

            if (currentPermission === 'denied') {
                if (!isProactive && showToast) showToast('Notifications are disabled. Please check your browser or OS settings.', 'info');
                setIsFcmSubscribed(false);
                localStorage.removeItem('lastFCMTokenSent'); setLastTokenSent(null);
                console.warn('[useFCM requestPermissionAndGetToken] Exiting: Notification permission denied.');
                return null;
            }

            if (currentPermission === 'granted') {
                console.log('[FCM App.js] Notification permission granted. Attempting to call fetchFcmToken from firebase.js...'); // <<< KEY LOG BEFORE CALLING FIREBASE.JS
                const fcmToken = await fetchFcmToken(); // This is the call to firebase.js

                if (fcmToken) {
                    console.log('[FCM App.js] Token received from firebase.js:', fcmToken);
                    if (fcmToken !== lastTokenSent) {
                        const success = await sendTokenToServer(fcmToken);
                        if (success && !isProactive && showToast) showToast('Notifications enabled successfully!', 'success');
                    } else {
                        setIsFcmSubscribed(true);
                        if (!isProactive && showToast) showToast('Notifications are already active.', 'info');
                        console.log('[FCM App.js] Token is current, no server update needed.');
                    }
                    return fcmToken;
                } else {
                    setIsFcmSubscribed(false);
                    const msg = 'Could not get notification token. Ensure permissions are granted and service worker is active. (fetchFcmToken from firebase.js returned null/falsy)';
                    setFcmError(msg);
                    if (!isProactive && showToast) showToast('Failed to get notification token. Check settings.', 'error');
                    console.error('[FCM App.js]', msg);
                    return null;
                }
            }
             console.log('[useFCM requestPermissionAndGetToken] Exiting: Did not enter "granted" block or no token from granted block.');
        } catch (error) {
            console.error('[FCM App.js] Error in requestPermissionAndGetToken (App.js):', error);
            const errorMsg = error.message && error.message.includes('Notification permission not granted')
                ? 'Notification permission was not granted.'
                : `Notification error: ${error.message}`;
            setFcmError(errorMsg);
            if (!isProactive && showToast) showToast(errorMsg, 'error');
            setIsFcmSubscribed(false);
            return null;
        }
        console.log('[useFCM requestPermissionAndGetToken] Reached end of function unexpectedly.');
        return null;
    }, [isLoggedIn, sendTokenToServer, showToast, lastTokenSent, notPWA]);

    useEffect(() => {
        console.log('[useFCM useEffect for proactive registration] Running. Conditions: notPWA:', notPWA, 'isLoggedIn:', isLoggedIn, 'authToken:', !!authToken, '!isFcmSubscribed:', !isFcmSubscribed, 'Notification.permission:', (typeof Notification !== 'undefined' ? Notification.permission : 'N/A'), '!attemptedRegistration:', !attemptedRegistration);

        if (notPWA) {
            console.log('[useFCM useEffect for proactive registration] Exiting: notPWA is true.');
            return;
        }
        if (isLoggedIn && authToken && !isFcmSubscribed && typeof Notification !== 'undefined' && Notification.permission === 'default' && !attemptedRegistration) {
            if (isIOS && (!isStandalonePWA() || !iosSupportsWebPush)) {
                console.log('[FCM useFCM useEffect for proactive registration] iOS PWA conditions not met for proactive registration. Exiting.');
                return;
            }
            console.log('[FCM useFCM useEffect for proactive registration] Conditions met. Proactively attempting notification registration after login... Calling requestPermissionAndGetToken(true)');
            requestPermissionAndGetToken(true);
        } else {
            console.log('[useFCM useEffect for proactive registration] Proactive registration conditions NOT MET. Reasons:');
            if (!isLoggedIn) console.log('  - Not LoggedIn');
            if (!authToken) console.log('  - No AuthToken');
            if (isFcmSubscribed) console.log('  - Already FcmSubscribed');
            if (typeof Notification === 'undefined' || Notification.permission !== 'default') console.log('  - Notification permission not default or Notification undefined. Current permission:', (typeof Notification !== 'undefined' ? Notification.permission : 'N/A'));
            if (attemptedRegistration) console.log('  - Already attempted registration');
        }
    }, [isLoggedIn, authToken, isFcmSubscribed, requestPermissionAndGetToken, attemptedRegistration, notPWA]);

    if (notPWA) {
        console.log('[useFCM Hook] Bailing out at the end because notPWA is true. Returning stubs.');
        return {
            requestPermissionAndGetToken: () => { console.log('[FCM Stub] requestPermissionAndGetToken called'); return Promise.resolve(null); },
            isFcmSubscribed: false,
            setIsFcmSubscribed: () => { console.log('[FCM Stub] setIsFcmSubscribed called'); },
            fcmError: '',
            setAttemptedRegistration: () => { console.log('[FCM Stub] setAttemptedRegistration called'); }
        };
    }

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
  const showToast = useContext(ToastContext);
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
  }, [isFcmSubscribed]); // Removed isIOS, iosSupportsWebPush, isStandalonePWA from deps as they don't change

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
    if (setAttemptedRegistration) setAttemptedRegistration(false); // Allow re-attempt
    if (requestPermissionAndGetToken) await requestPermissionAndGetToken(false); // Not proactive here, user initiated
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
const App = () => {
  const { token, logout, isAuthLoading } = useContext(AuthContext);
  const isLoggedIn = !!token;

  // requestPermissionAndGetToken from useFCM will be used.
  // isFcmSubscribed from useFCM will be used.
  const { requestPermissionAndGetToken, isFcmSubscribed } = useFCM(isLoggedIn, token);

  useEffect(() => {
    console.log('[App Component useEffect for proactive FCM] Running. Conditions: !isFcmSubscribed:', !isFcmSubscribed, 'isLoggedIn:', isLoggedIn, 'isStandalonePWA():', isStandalonePWA());
    if (!isFcmSubscribed && isLoggedIn && isStandalonePWA()) {
      console.log('[App Component useEffect for proactive FCM] Conditions MET. Calling requestPermissionAndGetToken(true)');
      requestPermissionAndGetToken(true); // This calls the function within useFCM
    } else {
      console.log('[App Component useEffect for proactive FCM] Conditions NOT MET. Reasons:');
      if (isFcmSubscribed) console.log('  - Already FcmSubscribed');
      if (!isLoggedIn) console.log('  - Not LoggedIn');
      if (!isStandalonePWA()) console.log('  - Not StandalonePWA');
    }
  }, [isLoggedIn, isFcmSubscribed, requestPermissionAndGetToken]); // requestPermissionAndGetToken is stable due to useCallback

  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();
  const isOnLessonDetailPage = location.pathname.startsWith('/lessons/');

  const handleLogout = () => {
    logout();
  };

  useEffect(() => {
    console.log('[App Component Status Update] LoggedIn:', isLoggedIn, 'PWA:', isStandalonePWA(), 'iOS:', isIOS, 'iOS Push Support:', iosSupportsWebPush, 'Notification Perm:', typeof Notification !== 'undefined' ? Notification.permission : 'N/A', 'Path:', location.pathname);
  }, [isLoggedIn, location.pathname]);

  if (isAuthLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f0f0', color: '#333', fontSize: '18px' }}>Loading Zporta Academy...</div>;
  }

  const showInstallGate = isLoggedIn && !isIOS && (!isAndroid || (isAndroid && !isStandalonePWA()));
  const showNotificationControls = isLoggedIn;

  try {
    return (
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
