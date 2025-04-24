from django.http import Http404
from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK, HTTP_201_CREATED, HTTP_400_BAD_REQUEST
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from google.oauth2 import id_token
from google.auth.transport import requests
from .models import Profile
from .serializers import ProfileSerializer
from rest_framework import status
from .serializers import PasswordResetSerializer
from django.utils.http import urlsafe_base64_decode
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from .serializers import PasswordResetConfirmSerializer
from .serializers import ChangePasswordSerializer
from .serializers import PublicProfileSerializer
from datetime import date
import math
from subjects.models import Subject
from quizzes.models import Quiz
from django.contrib.contenttypes.models import ContentType

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
            profile = user.profile
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
    permission_classes = [AllowAny]  # Allow public access
    queryset = Profile.objects.filter(role__in=['guide', 'both']).order_by('-created_at')




class PublicGuideProfileView(generics.RetrieveAPIView):
    serializer_class = PublicProfileSerializer

    def get_object(self):
        username = self.kwargs.get("username")
        try:
            return Profile.objects.get(user__username=username)
        except Profile.DoesNotExist:
            raise Http404("Guide profile not found")
        
# Profile View
class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        profile = user.profile  # Fetch profile linked to the user
        serializer = ProfileSerializer(profile, context={"request": request})

        # Return both profile and user details
        return Response(serializer.data, status=HTTP_200_OK)

    def put(self, request):
        profile = request.user.profile
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
        role = request.data.get("role", "explorer")  # Default role
        bio = request.data.get("bio", "")

        # Validation
        if not username or not email or not password:
            return Response({"error": "All fields are required."}, status=HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=username).exists():
            return Response({"error": "Username already taken."}, status=HTTP_400_BAD_REQUEST)

        if User.objects.filter(email=email).exists():
            return Response({"error": "Email already registered."}, status=HTTP_400_BAD_REQUEST)

        # Create user and profile
        user = User.objects.create_user(username=username, email=email, password=password)
        Profile.objects.filter(user=user).update(role=role, bio=bio)

        return Response({"message": "User registered successfully."}, status=HTTP_201_CREATED)


# Google Login View
class GoogleLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get("token")

        if not token:
            return Response({"error": "Token is required."}, status=HTTP_400_BAD_REQUEST)

        try:
            idinfo = id_token.verify_oauth2_token(
                token,
                requests.Request(),
                "805972576303-q8o7etck8qjrjiapfre4df9j7oocl37s.apps.googleusercontent.com"
            )

            email = idinfo.get("email")
            username = idinfo.get("name").replace(" ", "_")

            # Check if user exists
            user, created = User.objects.get_or_create(email=email, defaults={"username": username})

            # Ensure a Profile exists for the user
            profile, profile_created = Profile.objects.get_or_create(user=user, defaults={"role": "explorer"})

            return Response({
                "message": "Login successful.",
                "username": user.username,
                "email": user.email,
                "profile_created": profile_created,
                "new_user": created,
            }, status=HTTP_200_OK)

        except ValueError:
            return Response({"error": "Invalid token."}, status=HTTP_400_BAD_REQUEST)


class PasswordResetView(APIView):
    def post(self, request):
        serializer = PasswordResetSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Password reset link has been sent to your email."}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Password has been reset successfully."}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)  
    
