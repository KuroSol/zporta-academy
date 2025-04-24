# users/views.py

# ... (keep other imports)
from django.http import Http404
from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK, HTTP_201_CREATED, HTTP_400_BAD_REQUEST
from rest_framework.authtoken.models import Token # <--- Make sure Token is imported
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from google.oauth2 import id_token
from google.auth.transport import requests
from django.db import IntegrityError # <--- ADD THIS IMPORT
from .models import Profile
from .serializers import ProfileSerializer # Import other serializers as needed
from rest_framework import status
# ... (other imports like PasswordResetSerializer etc.)
from django.utils.http import urlsafe_base64_decode
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from .serializers import PasswordResetConfirmSerializer
from .serializers import ChangePasswordSerializer
from .serializers import PublicProfileSerializer
from .serializers import PasswordResetSerializer
from datetime import date
import math
from subjects.models import Subject
from quizzes.models import Quiz
from django.contrib.contenttypes.models import ContentType



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
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(username=username, password=password)

        if user:
            token, created = Token.objects.get_or_create(user=user)
            # Ensure profile exists before accessing it
            profile, profile_created = Profile.objects.get_or_create(user=user)
            return Response({
                'token': token.key,
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': profile.role,
                'active_guide': profile.active_guide,
            }, status=HTTP_200_OK)

        return Response({'error': 'Invalid credentials'}, status=HTTP_400_BAD_REQUEST)


class GuideProfileListView(generics.ListAPIView):
    serializer_class = PublicProfileSerializer
    permission_classes = [AllowAny] # Allow public access
    queryset = Profile.objects.filter(role__in=['guide', 'both']).order_by('-created_at')




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
