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

// Helper function to get permissions safely
const getPermissionsFromStorage = () => {
  const stored = localStorage.getItem('permissions');
  return stored && stored !== 'undefined' ? stored.split(',') : [];
};

const App = () => {
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
    if (!token) return;

    if ('Notification' in window && navigator.serviceWorker) {
      navigator.serviceWorker.register('/firebase-messaging-sw.js')
        .then((registration) => {
          console.log('✅ Service worker registered:', registration);

          getToken(messaging, {
            vapidKey: 'BBopJEFP0-w6cVGLXByxRREZS-XqPDOhXXGd-HUeLRHLq9KsOxiBqFW51gd33RYb6gQQB_wJk9-BxlqwN4Qlq0M',
            serviceWorkerRegistration: registration
          })
            .then((currentToken) => {
              if (currentToken) {
                console.log('✅ FCM Token:', currentToken);
                fetch('/api/save-fcm-token/', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Token ${token}`,
                  },
                  body: JSON.stringify({ token: currentToken }),
                });
              } else {
                console.warn('⚠️ No FCM token retrieved');
              }
            })
            .catch((err) => {
              console.error('❌ Error retrieving FCM token:', err);
            });
        })
        .catch((err) => {
          console.error('❌ Service Worker registration failed:', err);
        });
    }
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

      {/* Bottom Menu */}
      {isLoggedIn && !isOnLessonDetailPage && <BottomMenu permissions={permissions} />}
    </div>
  );
};

export default App;