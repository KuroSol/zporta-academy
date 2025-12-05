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
from django.contrib.auth import authenticate, login as django_login, logout as django_logout
from google.oauth2 import id_token
from google.auth.transport import requests
from django.db import IntegrityError
from .models import Profile
from .guide_application_models import GuideApplicationRequest
from .invitation_models import TeacherInvitation
from .serializers import ProfileSerializer, GuideApplicationSerializer
from .serializers import TeacherInvitationSerializer
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
from users.models import UserLoginEvent
from django.utils import timezone


class UserPreferenceUpdateView(APIView):
    """Allow a user to update interested subjects, languages and location."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        pref, _ = UserPreference.objects.get_or_create(user=request.user)
        return Response({
            "interested_subjects": [s.id for s in pref.interested_subjects.all()],
            "languages_spoken":   pref.languages_spoken,
            "location":           pref.location or ""
        })

    def patch(self, request):
        pref, _ = UserPreference.objects.get_or_create(user=request.user)
        # update subjects
        subject_ids = request.data.get("interested_subjects")
        if subject_ids is not None:
            subjects = Subject.objects.filter(id__in=subject_ids)
            pref.interested_subjects.set(subjects)
        # update languages
        languages = request.data.get("languages_spoken")
        if languages is not None:
            pref.languages_spoken = languages
        # update location
        location = request.data.get("location")
        if location is not None:
            pref.location = location
        pref.save()
        return Response({
            "interested_subjects": [s.id for s in pref.interested_subjects.all()],
            "languages_spoken":   pref.languages_spoken,
            "location":           pref.location or ""
        }, status=status.HTTP_200_OK)

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
            authenticated_user = authenticate(
                username=user.username,
                password=password
            )

            if authenticated_user:
                django_login(request, authenticated_user)  # ensure user_logged_in signal fires
                # 1) Get token & bump preference
                token, _ = Token.objects.get_or_create(
                    user=authenticated_user
                )
                enrich_user_preference(authenticated_user, request)

                # 2) Load profile & preference
                profile, _ = Profile.objects.get_or_create(
                    user=authenticated_user
                )
                pref, _ = UserPreference.objects.get_or_create(
                    user=authenticated_user
                )

                # 3) Build preference payload
                pref_data = {
                    'languages_spoken': [
                        s.id for s in pref.interested_subjects.all()
                    ],
                    'location':         pref.location,
                    'bio':              pref.bio,
                    'interested_tags':  [
                        t.id for t in pref.interested_tags.all()
                    ],
                }

                return Response({
                    'token':       token.key,
                    'id':          authenticated_user.id,
                    'username':    authenticated_user.username,
                    'email':       authenticated_user.email,
                    'role':        profile.role,
                    'active_guide':profile.active_guide,
                    'preferences': pref_data,
                }, status=HTTP_200_OK)

        return Response({'error': 'Invalid credentials'},
                        status=HTTP_400_BAD_REQUEST)


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



class PublicGuideProfileView(APIView):
    """
    Public teacher/guide profile with full SEO metadata for Google discoverability.
    Includes: canonical URL, OG tags, JSON-LD Person schema, meta description.
    """
    permission_classes = [AllowAny]

    def get(self, request, username):
        try:
            profile = Profile.objects.select_related(
                'user',
                'user__profile'  # Optimize for accessing profile details
            ).get(user__username=username)
        except Profile.DoesNotExist:
            raise Http404("Guide profile not found")
        
        serializer = PublicProfileSerializer(profile, context={'request': request})
        
        # Build absolute URL for canonical and OG tags
        # Use /guide/{username} to match Next.js route
        profile_url = request.build_absolute_uri(f"/guide/{username}/")
        
        # SEO metadata
        display_name = profile.display_name or profile.user.username
        seo_title = f"{display_name} - Teacher Profile | Zporta Academy"
        seo_description = (profile.bio or f"Learn with {display_name} on Zporta Academy. Explore courses, lessons, and quizzes created by {display_name}.")[:160]
        
        # Profile image for OG tags
        profile_image_url = profile.profile_image.url if profile.profile_image else "/static/default_teacher_avatar.jpg"
        if not profile_image_url.startswith('http'):
            profile_image_url = request.build_absolute_uri(profile_image_url)
        
        # JSON-LD Person schema for rich results
        json_ld_schema = {
            "@context": "https://schema.org",
            "@type": "Person",
            "name": display_name,
            "description": seo_description,
            "url": profile_url,
            "image": profile_image_url,
            "jobTitle": "Teacher" if profile.role in ['guide', 'both'] else "Learner",
            "alumniOf": {
                "@type": "Organization",
                "name": "Zporta Academy"
            }
        }
        
        seo_data = {
            "title": seo_title,
            "description": seo_description,
            "canonical_url": profile_url,
            "og_title": seo_title,
            "og_description": seo_description,
            "og_image": profile_image_url,
            "og_type": "profile",
            "json_ld": json_ld_schema,
            "robots": "index,follow"  # Explicitly allow indexing
        }
        
        return Response({
            "profile": serializer.data,
            "seo": seo_data
        }, status=HTTP_200_OK)

# Profile View
class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user    = request.user
        profile, _ = Profile.objects.get_or_create(user=user)
        serializer = ProfileSerializer(profile,
                                       context={'request': request})

        # ← this block needs to be indented here
        pref, _ = UserPreference.objects.get_or_create(user=user)
        pref_payload = {
            'languages_spoken': [
                s.id for s in pref.interested_subjects.all()
            ],
            'location':         pref.location,
            'bio':              pref.bio,
            'interested_tags':  [
                t.id for t in pref.interested_tags.all()
            ],
        }

        data = serializer.data
        data['preferences'] = pref_payload

        return Response(data, status=HTTP_200_OK)
    
    def put(self, request):
        profile, _ = Profile.objects.get_or_create(user=request.user)
        serializer = ProfileSerializer(profile, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            # (Optional) reattach preferences block exactly like GET
            return Response(serializer.data, status=HTTP_200_OK)
        return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)

    patch = put

    def delete(self, request):
        """Permanently delete user account and all associated data"""
        user = request.user
        username = user.username
        
        try:
            # Delete the user (this will cascade delete the profile and related data)
            user.delete()
            return Response(
                {"message": f"Account {username} has been permanently deleted."},
                status=HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {"error": f"Failed to delete account: {str(e)}"},
                status=HTTP_400_BAD_REQUEST
            )


class DeactivateAccountView(APIView):
    """Deactivate user account (can be reactivated by logging in)"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        reason = request.data.get('reason', '')
        
        try:
            # Deactivate the account
            user.is_active = False
            user.save()
            
            # Optional: Log the deactivation reason
            if reason:
                print(f"User {user.username} deactivated. Reason: {reason}")
            
            return Response(
                {"message": "Account has been deactivated. You can reactivate it by logging in."},
                status=HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {"error": f"Failed to deactivate account: {str(e)}"},
                status=HTTP_400_BAD_REQUEST
            )

# Register View
class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        import logging
        logger = logging.getLogger(__name__)
        
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
            
            # Profile is auto-created by post_save signal.
            # Update it with the provided role and bio instead of using update_or_create()
            # to avoid race conditions in production (Gunicorn + multiple workers).
            if hasattr(user, 'profile') and user.profile:
                user.profile.role = role
                user.profile.bio = bio
                user.profile.save()
            else:
                # If profile wasn't created by signal, this is a critical error
                logger.error(f"Profile not found for newly created user {user.id}")
                user.delete()  # Clean up orphaned user
                return Response(
                    {"error": "An unexpected error occurred during profile creation."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            return Response({"message": "User registered successfully."}, status=HTTP_201_CREATED)
            
        except IntegrityError as e:
            # Catch potential integrity errors during user creation
            logger.warning(f"Registration IntegrityError: {e}")
            error_msg = "Registration failed due to a database constraint. The username or email might already exist."
            if 'username' in str(e).lower():
                error_msg = "Username already taken."
            elif 'email' in str(e).lower():
                error_msg = "Email already registered."
            return Response({"error": error_msg}, status=HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            logger.error(f"Unexpected Registration Error: {e}", exc_info=True)
            return Response(
                {"error": "An unexpected error occurred during registration."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        django_logout(request)  # fires user_logged_out signal
        return Response({"detail": "Logged out"}, status=HTTP_200_OK)

class HeartbeatView(APIView):
    """Client pings this endpoint periodically to update active session heartbeat."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Find most recent open login event (no logout)
        ev = UserLoginEvent.objects.filter(user=request.user, logout_at__isnull=True).order_by('-login_at').first()
        if not ev:
            return Response({"detail": "No active session"}, status=HTTP_200_OK)
        ev.last_heartbeat_at = timezone.now()
        ev.save(update_fields=['last_heartbeat_at'])
        return Response({"detail": "heartbeat", "last_heartbeat_at": ev.last_heartbeat_at.isoformat()}, status=HTTP_200_OK)

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
            enrich_user_preference(user, request)
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
        from .scoring_service import ScoringService
        # Get scores from UserActivity (all-time points)
        learning_score = ScoringService.get_learning_score(request.user)
        impact_score = ScoringService.get_impact_score(request.user)
        
        return Response({
            "learning_score": learning_score,  # Changed from growth_score
            "impact_score": impact_score
        }, status=HTTP_200_OK)


# ─── Guide Application Views ────────────────────────────────────────────────

class GuideApplicationView(APIView):
    """
    POST: Submit application to become a guide
    GET: Get user's own application status
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get user's latest guide application"""
        application = GuideApplicationRequest.objects.filter(user=request.user).order_by('-created_at').first()
        if not application:
            return Response({"detail": "No application found."}, status=HTTP_404)
        serializer = GuideApplicationSerializer(application)
        return Response(serializer.data, status=HTTP_200_OK)
    
    def post(self, request):
        """Submit guide application"""
        # Check if user already has pending/approved application
        existing = GuideApplicationRequest.objects.filter(
            user=request.user,
            status__in=['pending', 'approved']
        ).first()
        if existing:
            return Response({
                "detail": f"You already have a {existing.status} application."
            }, status=HTTP_400_BAD_REQUEST)
        
        serializer = GuideApplicationSerializer(data=request.data)
        if serializer.is_valid():
            application = serializer.save(user=request.user)
            
            # Send email notification to admin
            try:
                self._send_admin_notification(application, request)
            except Exception as e:
                print(f"Failed to send admin notification email: {e}")
                # Don't fail the request if email fails
            
            return Response({
                "detail": "Application submitted successfully! Administrators will review it soon.",
                "application": serializer.data
            }, status=HTTP_201_CREATED)
        return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)
    
    def _send_admin_notification(self, application, request):
        """Send email to admin when new teacher application is submitted"""
        admin_emails = User.objects.filter(is_staff=True, is_active=True).values_list('email', flat=True)
        admin_emails = [email for email in admin_emails if email]  # Filter out empty emails
        
        if not admin_emails:
            return
        
        admin_url = f"{request.scheme}://{request.get_host()}/administration-zporta-repersentiivie/users/guideapplicationrequest/{application.id}/change/"
        
        subject = f"🎓 New Teacher Application: {application.user.username}"
        message = f"""
A new teacher application has been submitted on Zporta Academy!

📋 Application Details:
- Username: {application.user.username}
- Email: {application.user.email}
- Subjects: {application.subjects_to_teach}

✍️ Motivation:
{application.motivation}

📚 Experience:
{application.experience if application.experience else 'Not provided'}

👉 Review and approve/reject this application:
{admin_url}

---
This is an automated notification from Zporta Academy.
"""
        
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            admin_emails,
            fail_silently=False,
        )


class GuideApplicationListView(generics.ListAPIView):
    """
    Admin-only: List all guide applications
    Filter by status: ?status=pending
    """
    permission_classes = [IsAuthenticated]
    serializer_class = GuideApplicationSerializer
    
    def get_queryset(self):
        if not self.request.user.is_staff:
            return GuideApplicationRequest.objects.none()
        
        qs = GuideApplicationRequest.objects.all()
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs.order_by('-created_at')


class GuideApplicationApproveView(APIView):
    """Admin-only: Approve guide application"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, application_id):
        if not request.user.is_staff:
            return Response({"detail": "Admin permission required."}, status=status.HTTP_403_FORBIDDEN)
        
        application = get_object_or_404(GuideApplicationRequest, id=application_id)
        application.approve(request.user)
        
        return Response({
            "detail": "Application approved. User is now an active guide.",
            "application": GuideApplicationSerializer(application).data
        }, status=HTTP_200_OK)


class GuideApplicationRejectView(APIView):
    """Admin-only: Reject guide application"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, application_id):
        if not request.user.is_staff:
            return Response({"detail": "Admin permission required."}, status=status.HTTP_403_FORBIDDEN)
        
        application = get_object_or_404(GuideApplicationRequest, id=application_id)
        admin_notes = request.data.get('admin_notes', '')
        application.reject(request.user, admin_notes)
        
        return Response({
            "detail": "Application rejected.",
            "application": GuideApplicationSerializer(application).data
        }, status=HTTP_200_OK)


# ═══════════════════════════════════════════════════════════════════════════════
# TEACHER INVITATION SYSTEM
# ═══════════════════════════════════════════════════════════════════════════════

class TeacherInvitationSendView(APIView):
    """Send teacher invitation (requires permission)"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        # Check if user can send invitations
        can_send, error_msg = TeacherInvitation.can_send_invitation(request.user)
        if not can_send:
            return Response({"detail": error_msg}, status=status.HTTP_403_FORBIDDEN)
        
        invitee_email = request.data.get('invitee_email', '').strip().lower()
        personal_message = request.data.get('personal_message', '').strip()
        
        if not invitee_email:
            return Response({"detail": "Email address is required."}, status=HTTP_400_BAD_REQUEST)
        
        # Check if email already has an account
        if User.objects.filter(email=invitee_email).exists():
            return Response({
                "detail": "This email already has an account on Zporta Academy."
            }, status=HTTP_400_BAD_REQUEST)
        
        # Check for existing pending invitation
        existing = TeacherInvitation.objects.filter(
            inviter=request.user,
            invitee_email=invitee_email,
            status='pending'
        ).first()
        
        if existing:
            return Response({
                "detail": "You already sent an invitation to this email."
            }, status=HTTP_400_BAD_REQUEST)
        
        # Create invitation
        invitation = TeacherInvitation.objects.create(
            inviter=request.user,
            invitee_email=invitee_email,
            personal_message=personal_message
        )
        
        # Send email
        try:
            self._send_invitation_email(invitation, request)
        except Exception as e:
            print(f"Failed to send invitation email: {e}")
            # Don't fail the request if email fails
        
        return Response({
            "detail": "Invitation sent successfully!",
            "invitation": TeacherInvitationSerializer(invitation, context={'request': request}).data,
            "remaining_invitations": 3 - TeacherInvitation.get_monthly_invitation_count(request.user)
        }, status=HTTP_201_CREATED)
    
    def _send_invitation_email(self, invitation, request):
        """Send invitation email to invitee"""
        invitation_url = f"{request.scheme}://{request.get_host()}/accept-invitation?token={invitation.token}"
        
        subject = f"{invitation.inviter.username} invited you to teach on Zporta Academy"
        message = f"""
Hello!

{invitation.inviter.profile.display_name or invitation.inviter.username} has invited you to become a teacher on Zporta Academy.

{invitation.personal_message if invitation.personal_message else 'Join our community of educators and share your knowledge with students worldwide.'}

Click the link below to accept this invitation:
{invitation_url}

This invitation expires on {invitation.expires_at.strftime('%B %d, %Y')}.

Welcome to Zporta Academy!
"""
        
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [invitation.invitee_email],
            fail_silently=False,
        )


class TeacherInvitationListView(APIView):
    """List user's sent invitations"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        invitations = TeacherInvitation.objects.filter(inviter=request.user)
        serializer = TeacherInvitationSerializer(invitations, many=True, context={'request': request})
        monthly_count = TeacherInvitation.get_monthly_invitation_count(request.user)
        
        return Response({
            "invitations": serializer.data,
            "monthly_count": monthly_count,
            "remaining_this_month": max(0, 3 - monthly_count),
            "can_invite": request.user.profile.can_invite_teachers
        }, status=HTTP_200_OK)


class TeacherInvitationAcceptView(APIView):
    """Accept teacher invitation (public - no auth required initially)"""
    permission_classes = [AllowAny]
    
    def get(self, request):
        """Get invitation details"""
        token = request.query_params.get('token')
        if not token:
            return Response({"detail": "Token is required."}, status=HTTP_400_BAD_REQUEST)
        
        invitation = get_object_or_404(TeacherInvitation, token=token)
        
        if invitation.status != 'pending':
            return Response({
                "detail": f"This invitation has already been {invitation.status}.",
                "status": invitation.status
            }, status=HTTP_400_BAD_REQUEST)
        
        if invitation.is_expired():
            invitation.status = 'expired'
            invitation.save()
            return Response({
                "detail": "This invitation has expired.",
                "status": "expired"
            }, status=HTTP_400_BAD_REQUEST)
        
        return Response({
            "invitation": TeacherInvitationSerializer(invitation, context={'request': request}).data,
            "inviter_name": invitation.inviter.profile.display_name or invitation.inviter.username
        }, status=HTTP_200_OK)
    
    def post(self, request):
        """Accept invitation after registration"""
        token = request.data.get('token')
        if not token:
            return Response({"detail": "Token is required."}, status=HTTP_400_BAD_REQUEST)
        
        invitation = get_object_or_404(TeacherInvitation, token=token)
        
        # User must be authenticated
        if not request.user.is_authenticated:
            return Response({"detail": "Please register or login first."}, status=status.HTTP_401_UNAUTHORIZED)
        
        # Check if user email matches invitation
        if request.user.email.lower() != invitation.invitee_email.lower():
            return Response({
                "detail": "This invitation was sent to a different email address."
            }, status=HTTP_400_BAD_REQUEST)
        
        # Accept invitation
        success = invitation.accept(request.user)
        
        if not success:
            return Response({
                "detail": "This invitation has expired or is no longer valid.",
                "status": invitation.status
            }, status=HTTP_400_BAD_REQUEST)
        
        return Response({
            "detail": "Welcome to Zporta Academy! You are now an approved teacher.",
            "invitation": TeacherInvitationSerializer(invitation, context={'request': request}).data
        }, status=HTTP_200_OK)


class TeacherInvitationCancelView(APIView):
    """Cancel sent invitation"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, invitation_id):
        invitation = get_object_or_404(TeacherInvitation, id=invitation_id, inviter=request.user)
        
        if invitation.status != 'pending':
            return Response({
                "detail": "Only pending invitations can be cancelled."
            }, status=HTTP_400_BAD_REQUEST)
        
        invitation.status = 'cancelled'
        invitation.save()
        
        return Response({
            "detail": "Invitation cancelled.",
            "invitation": TeacherInvitationSerializer(invitation, context={'request': request}).data
        }, status=HTTP_200_OK)
