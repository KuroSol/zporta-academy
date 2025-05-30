from django.urls import path
from .views import RegisterView, GoogleLoginView, LoginView, ProfileView,  PasswordResetView, PasswordResetConfirmView, ChangePasswordView, PublicGuideProfileView, GuideProfileListView, UserLearningScoreView, MyScoreView 

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("google-login/", GoogleLoginView.as_view(), name="google-login"),
    path("login/", LoginView.as_view(), name="login"),
    path("profile/", ProfileView.as_view(), name="profile"),
    path('password-reset/', PasswordResetView.as_view(), name='password_reset_api'),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password_reset_confirm"),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('guides/<str:username>/', PublicGuideProfileView.as_view(), name='public-guide-profile'),
    path('guides/', GuideProfileListView.as_view(), name='guide-profile-list'),
    path("learning-score/", UserLearningScoreView.as_view(), name="user-learning-score"),
    path('score/', MyScoreView.as_view(), name='user-my-score'),
]

