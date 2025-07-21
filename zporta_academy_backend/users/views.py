# users/views.py
from django.shortcuts import get_object_or_404
from django.http import Http404, HttpResponseRedirect
from rest_framework import generics, permissions
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK, HTTP_201_CREATED, HTTP_400_BAD_REQUEST
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login as django_login
from google.oauth2 import id_token
from google.auth.transport import requests
from django.db import IntegrityError
from .models import Profile
from .serializers import ProfileSerializer
from rest_framework import status
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.contrib.auth.tokens import PasswordResetTokenGenerator, default_token_generator
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.conf import settings
from .serializers import PasswordResetConfirmSerializer
from .serializers import ChangePasswordSerializer
from .serializers import PublicProfileSerializer
from .serializers import PasswordResetSerializer
from .serializers import UserScoreSerializer
from datetime import date
import math
from subjects.models import Subject
from quizzes.models import Quiz
from django.contrib.contenttypes.models import ContentType
from django.db.models import Q
from users.models import UserPreference
import pytz
import geoip2.database
from django.utils import timezone

from users.utils import enrich_user_preference




# ... (Keep other views like UserLearningScoreView, ChangePasswordView, LoginView, etc.)
class UserLearningScoreView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        subject_scores = {}
        quiz_content_type = ContentType.objects.get_for_model(Quiz)

        subjects = Subject.objects.all()

        for subject in subjects:
            # First, fetch quizzes for the subject
            quizzes = Quiz.objects.filter(subject=subject)

            # Then, get attempts associated with these quizzes
            attempts = user.activity_events.filter(
                event_type='quiz_answer_submitted',
                content_type=quiz_content_type,
                object_id__in=quizzes.values_list('id', flat=True)
            )

            total_attempts = attempts.count()
            correct_attempts = attempts.filter(metadata__is_correct=True).count()

            # Accuracy calculation
            accuracy = correct_attempts / total_attempts if total_attempts else 0

            # Engagement calculation
            total_quizzes_attempted = attempts.values('object_id').distinct().count()
            engagement = math.log1p(total_quizzes_attempted) / math.log1p(100)

            # Recency calculation
            last_attempt = attempts.order_by('-timestamp').first()
            days_since_last_attempt = (date.today() - last_attempt.timestamp.date()).days if last_attempt else 365
            recency = math.exp(-(math.log(2)/30) * days_since_last_attempt)

            # Tenure calculation
            days_since_joined = (date.today() - user.date_joined.date()).days
            tenure = min(1, days_since_joined / 365)

            # Combined Score calculation
            weights = {'accuracy': 0.4, 'engagement': 0.2, 'recency': 0.2, 'tenure': 0.2}
            raw_score = (
                accuracy * weights['accuracy'] +
                engagement * weights['engagement'] +
                recency * weights['recency'] +
                tenure * weights['tenure']
            )

            final_score = round(raw_score * 100)

            subject_scores[subject.name] = {
                "score": final_score,
                "details": {
                    "accuracy": round(accuracy * 100),
                    "engagement": round(engagement * 100),
                    "recency": round(recency * 100),
                    "tenure": round(tenure * 100)
                }
            }

        return Response(subject_scores, status=HTTP_200_OK)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Password changed successfully."}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Login View
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        credential = request.data.get('username') # This field will contain either username or email
        password = request.data.get('password')

        if not credential or not password:
            return Response({'error': 'Username/Email and password are required.'}, status=HTTP_400_BAD_REQUEST)

        # Try to find a user with either a matching username or email (case-insensitive)
        user_q = User.objects.filter(Q(username__iexact=credential) | Q(email__iexact=credential))

        if user_q.exists():
            user = user_q.first()
            # If a user is found, we must use their actual username to authenticate
            authenticated_user = authenticate(username=user.username, password=password)
            
            if authenticated_user:
                token, created = Token.objects.get_or_create(user=authenticated_user)
                enrich_user_preference(authenticated_user, request)
                profile, profile_created = Profile.objects.get_or_create(user=authenticated_user)
                return Response({
                    'token': token.key,
                    'id': authenticated_user.id,
                    'username': authenticated_user.username,
                    'email': authenticated_user.email,
                    'role': profile.role,
                    'active_guide': profile.active_guide,
                }, status=HTTP_200_OK)

        # If no user is found, or if authentication fails, return a generic error
        return Response({'error': 'Invalid credentials'}, status=HTTP_400_BAD_REQUEST)




class GuideProfileListView(generics.ListAPIView):
    serializer_class = PublicProfileSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        # Start with the base queryset: profiles that are guides or both
        queryset = Profile.objects.filter(role__in=['guide', 'both'])

        # Get the search term from the query parameters
        search_term = self.request.query_params.get('search', None)

        if search_term:
            # If there's a search term, filter by username
            queryset = queryset.filter(
                Q(user__username__istartswith=search_term) |
                Q(user__username__icontains=search_term)
            ).distinct()
            # Order search results by username
            return queryset.order_by('user__username')
        else:
            # If no search term, it's for the general list of guides
            # Order by newest first (original behavior)
            return queryset.order_by('-created_at')



class PublicGuideProfileView(generics.RetrieveAPIView):
    serializer_class = PublicProfileSerializer

    def get_object(self):
        username = self.kwargs.get("username")
        try:
            # Ensure profile exists before accessing it
            profile = Profile.objects.get(user__username=username)
            return profile
        except Profile.DoesNotExist:
            raise Http404("Guide profile not found")

# Profile View
class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        # Ensure profile exists before accessing it
        profile, created = Profile.objects.get_or_create(user=user)
        serializer = ProfileSerializer(profile, context={"request": request})

        # Return both profile and user details
        return Response(serializer.data, status=HTTP_200_OK)

    def put(self, request):
        # Ensure profile exists before accessing it
        profile, created = Profile.objects.get_or_create(user=request.user)
        serializer = ProfileSerializer(profile, data=request.data, partial=True)

        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Profile updated successfully!", "profile": serializer.data}, status=HTTP_200_OK)
        return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)

# Register View
class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username")
        email = request.data.get("email")
        password = request.data.get("password")
        role = request.data.get("role", "explorer") # Default role
        bio = request.data.get("bio", "")

        # Validation
        if not username or not email or not password:
            return Response({"error": "Username, email, and password are required."}, status=HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=username).exists():
            return Response({"error": "Username already taken."}, status=HTTP_400_BAD_REQUEST)

        if User.objects.filter(email=email).exists():
            return Response({"error": "Email already registered."}, status=HTTP_400_BAD_REQUEST)

        # Create user and profile
        try:
            user = User.objects.create_user(username=username, email=email, password=password)
            # Create or update profile *after* user is created
            Profile.objects.update_or_create(user=user, defaults={'role': role, 'bio': bio})
            return Response({"message": "User registered successfully."}, status=HTTP_201_CREATED)
        except IntegrityError as e: # Catch potential integrity errors during user creation
             print(f"Registration Error: {e}")
             # Determine if it's username or email based on error message if possible, or provide generic
             error_msg = "Registration failed due to a database constraint. The username or email might already exist."
             if 'username' in str(e).lower():
                 error_msg = "Username already taken."
             elif 'email' in str(e).lower():
                 error_msg = "Email already registered."
             return Response({"error": error_msg}, status=HTTP_400_BAD_REQUEST)
        except Exception as e:
             print(f"Unexpected Registration Error: {e}")
             return Response({"error": "An unexpected error occurred during registration."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class MagicLinkRequestView(APIView):
    """
    Handles the request for a magic login link.
    A user provides their email, and if they exist, a one-time login link is sent.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        email = request.data.get("email")
        if not email:
            return Response({"error": "Email field is required."}, status=HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            # For security, don't reveal if the email exists or not.
            return Response({"detail": "If an account with that email exists, a login link has been sent."}, status=HTTP_200_OK)

        # We can reuse the default_token_generator for this. It's secure and temporary.
        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))

        # This link points to a special page on your frontend
        magic_link = f"https://zportaacademy.com/magic-login/{uid}/{token}"

        subject = "Your Zporta Academy Login Link"
        body = f"""
Hello,

You requested a special link to log in to your Zporta Academy account.

Click the link below to log in instantly:
{magic_link}

This link is for one-time use and will expire shortly. If you did not request this, please ignore this email.

Thanks,
The Zporta Academy Team
        """

        try:
            send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [user.email])
        except Exception as e:
            print(f"Error sending magic link email: {e}")
            return Response({"error": "There was a problem sending the email. Please try again."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"detail": "If an account with that email exists, a login link has been sent."}, status=HTTP_200_OK)

class MagicLinkLoginView(APIView):
    """
    Validates the magic link token and logs the user in.
    """
    permission_classes = [AllowAny]

    def get(self, request, uidb64, token, *args, **kwargs):
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            user = None

        if user is not None and default_token_generator.check_token(user, token):
            # Token is valid. Log the user in and create a new session token for the API.
            
            # Invalidate the token so it can't be used again
            user.save() # This updates the last_login field, which helps invalidate the token

            # Generate a new DRF token for the frontend to use
            drf_token, _ = Token.objects.get_or_create(user=user)

            # Redirect the user to their dashboard with the new token
            # The frontend will need to grab this token from the URL to use it.
            redirect_url = f"https://zportaacademy.com/login-success?token={drf_token.key}"
            return HttpResponseRedirect(redirect_url)
        else:
            # The link is invalid or expired
            # Redirect to a failure page on the frontend
            return HttpResponseRedirect("https://zportaacademy.com/login-failed")
        
# Google Login View (Corrected)
class GoogleLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        google_token = request.data.get("token") # Renamed for clarity

        if not google_token:
            return Response({"error": "Google token is required."}, status=HTTP_400_BAD_REQUEST)

        try:
            # Verify the token with Google using your Client ID
            idinfo = id_token.verify_oauth2_token(
                google_token,
                requests.Request(),
                "805972576303-q8o7etck8qjrjiapfre4df9j7oocl37s.apps.googleusercontent.com" # Ensure this matches your Google Cloud Console Client ID
            )

            # Extract user info from Google token
            email = idinfo.get("email")
            if not email:
                 return Response({"error": "Email not found in Google token."}, status=HTTP_400_BAD_REQUEST)

            # Use email as the primary identifier
            # Create a username if needed (e.g., from email prefix or name)
            # Be cautious about username uniqueness if using names directly
            # Generate a more robust unique username attempt
            base_username = idinfo.get("name", email.split('@')[0]).replace(" ", "_").lower()
            username_candidate = base_username
            counter = 1
            # Loop to find a unique username if the base one is taken
            while User.objects.filter(username=username_candidate).exists():
                username_candidate = f"{base_username}_{counter}"
                counter += 1
                if counter > 100: # Add a safety break
                     return Response({"error": "Failed to generate a unique username."}, status=HTTP_500_INTERNAL_SERVER_ERROR)


            # Get or create the user based on email
            # Use the generated unique username in defaults
            try:
                user, created = User.objects.get_or_create(
                    email=email,
                    defaults={"username": username_candidate} # Use the unique username
                )
                # If user existed, potentially update their username if it differs significantly? (Optional)
                # if not created and user.username != username_candidate:
                #     # Decide if you want to update existing usernames based on Google name changes
                #     pass # Or user.username = username_candidate; user.save()

            except IntegrityError:
                 # This might occur if email constraint fails (shouldn't happen with get_or_create on email)
                 # Or if somehow the username check above failed concurrently.
                 print(f"IntegrityError during get_or_create for email {email}")
                 return Response({"error": "Failed to create or retrieve user due to a database conflict."}, status=HTTP_400_BAD_REQUEST)


            # Ensure a Profile exists for the user
            profile, profile_created = Profile.objects.get_or_create(
                user=user,
                defaults={"role": "explorer"} # Set default role if profile is newly created
            )

            # --- Generate or Get Application Token ---
            app_token, token_created = Token.objects.get_or_create(user=user)

            # --- Prepare User Data for Response ---
            # You can customize what user info you send back
            user_data = {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                # Add other fields the frontend might need from the User model
                'first_name': user.first_name,
                'last_name': user.last_name,
                 # Include profile role if needed directly in user object or keep separate
                'role': profile.role,
                'active_guide': profile.active_guide,
            }

            # --- Return the Correct Structure ---
            return Response({
                "user": user_data,         # User object/dictionary
                "token": app_token.key,    # Application auth token
                "message": "Login successful via Google.", # Optional success message
                "new_user_created": created, # Optional flag
                "profile_created": profile_created, # Optional flag
            }, status=HTTP_200_OK)

        except ValueError as e:
            # Handle invalid Google tokens
            print(f"Google Token Verification Error: {e}") # Log the error
            return Response({"error": "Invalid Google token."}, status=HTTP_400_BAD_REQUEST)
        except Exception as e:
             # Catch other potential errors during the process
             print(f"Unexpected error during Google login: {e}") # Log the error
             return Response({"error": "An unexpected error occurred during Google login."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Password Reset Views (Keep as they are or update if needed)
class PasswordResetView(APIView):
    permission_classes = [AllowAny] # Allow anyone to request reset
    def post(self, request):
        serializer = PasswordResetSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            # Security: Always return success-like message to avoid confirming email existence
            return Response({"message": "If an account exists for this email, a password reset link has been sent."}, status=status.HTTP_200_OK)
        # Return specific errors only if safe (e.g., "Email field is required.")
        # Avoid returning "User with this email does not exist."
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Password has been reset successfully."}, status=status.HTTP_200_OK)
        # Provide generic error for invalid token/uid, specific for password format issues
        error_detail = serializer.errors.get('detail', None)
        if error_detail and 'Invalid token' in str(error_detail):
             return Response({"error": "Invalid or expired password reset link."}, status=status.HTTP_400_BAD_REQUEST)
        # Return other validation errors (e.g., password complexity)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class MyScoreView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # ensure profile exists
        profile, _ = Profile.objects.get_or_create(user=request.user)
        return Response({
            "growth_score": profile.growth_score,
            "impact_score": profile.impact_score
        }, status=HTTP_200_OK)