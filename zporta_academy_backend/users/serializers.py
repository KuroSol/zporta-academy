from django.conf import settings
from rest_framework import serializers
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from .models import Profile
from .guide_application_models import GuideApplicationRequest
from .invitation_models import TeacherInvitation
from django.core.mail import send_mail
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from rest_framework.permissions import AllowAny


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)
    confirm_new_password = serializers.CharField(required=True, min_length=8)

    def validate(self, data):
        user = self.context['request'].user
        if not user.check_password(data.get("current_password")):
            raise serializers.ValidationError({"current_password": "Current password is incorrect."})
        if data.get("new_password") != data.get("confirm_new_password"):
            raise serializers.ValidationError({"new_password": "New passwords do not match."})
        return data

    def save(self, **kwargs):
        user = self.context['request'].user
        user.set_password(self.validated_data["new_password"])
        user.save()
        return user



# User Serializer
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']

# Updated Profile Serializer with image upload support
class ProfileSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    first_name = serializers.CharField(source="user.first_name", required=False, allow_blank=True)
    last_name = serializers.CharField(source="user.last_name", required=False, allow_blank=True)
    date_joined = serializers.DateTimeField(source="user.date_joined", read_only=True, format="%Y-%m-%d")
    profile_image_url = serializers.SerializerMethodField()
    showcase_image_1_url = serializers.SerializerMethodField()
    showcase_image_2_url = serializers.SerializerMethodField()
    showcase_image_3_url = serializers.SerializerMethodField()
    display_name = serializers.CharField(required=False, allow_blank=True, max_length=60)
    is_staff = serializers.BooleanField(source="user.is_staff", read_only=True)
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Import here to avoid circular imports
        from tags.models import Tag
        # Add tag fields dynamically
        self.fields['showcase_image_1_tags'] = serializers.PrimaryKeyRelatedField(
            many=True, queryset=Tag.objects.all(), required=False
        )
        self.fields['showcase_image_2_tags'] = serializers.PrimaryKeyRelatedField(
            many=True, queryset=Tag.objects.all(), required=False
        )
        self.fields['showcase_image_3_tags'] = serializers.PrimaryKeyRelatedField(
            many=True, queryset=Tag.objects.all(), required=False
        )

    class Meta:
        model = Profile
        fields = [
            "user_id", "username", "email", "first_name", "last_name", "date_joined",
            "display_name", "role", "bio", "active_guide", "profile_image", "profile_image_url",
            "is_staff",
            # Teacher fields
            "teacher_tagline", "teacher_about", "teaching_specialties",
            "showcase_image_1", "showcase_image_1_url", "showcase_image_1_caption", "showcase_image_1_tags",
            "showcase_image_2", "showcase_image_2_url", "showcase_image_2_caption", "showcase_image_2_tags",
            "showcase_image_3", "showcase_image_3_url", "showcase_image_3_caption", "showcase_image_3_tags",
            "youtube_url", "linkedin_url", "twitter_url", "website_url",
            "intro_video_url",
            # Email preferences and localization
            "email_notifications", "mail_magazine_enabled",
            "locale"
        ]
        extra_kwargs = {
            "profile_image": {"required": False, "allow_null": True},
            "showcase_image_1": {"required": False, "allow_null": True},
            "showcase_image_2": {"required": False, "allow_null": True},
            "showcase_image_3": {"required": False, "allow_null": True},
        }

    def get_profile_image_url(self, obj):
        request = self.context.get("request")
        if obj.profile_image:
            if request:
                return request.build_absolute_uri(obj.profile_image.url)
            return obj.profile_image.url
        return None
    
    def get_showcase_image_1_url(self, obj):
        request = self.context.get("request")
        if obj.showcase_image_1:
            if request:
                return request.build_absolute_uri(obj.showcase_image_1.url)
            return obj.showcase_image_1.url
        return None
    
    def get_showcase_image_2_url(self, obj):
        request = self.context.get("request")
        if obj.showcase_image_2:
            if request:
                return request.build_absolute_uri(obj.showcase_image_2.url)
            return obj.showcase_image_2.url
        return None
    
    def get_showcase_image_3_url(self, obj):
        request = self.context.get("request")
        if obj.showcase_image_3:
            if request:
                return request.build_absolute_uri(obj.showcase_image_3.url)
            return obj.showcase_image_3.url
        return None

# Registration Serializer
class RegistrationSerializer(serializers.ModelSerializer):
    role = serializers.ChoiceField(choices=Profile.ROLE_CHOICES, default='explorer')  # Add role field
    bio = serializers.CharField(required=False, allow_blank=True)  # Add optional bio

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'role', 'bio']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        role = validated_data.pop('role', 'explorer')  # Default to explorer
        bio = validated_data.pop('bio', '')
        user = User.objects.create_user(**validated_data)
        profile = Profile.objects.get(user=user)
        profile.role = role
        profile.bio = bio
        if role in ['guide', 'both']:
            profile.active_guide = True
        profile.save()
        return user

# Password Reset Serializer
class PasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        # Check if user with the email exists
        if not User.objects.filter(email=value).exists():
            # To avoid disclosing whether the email exists, always return the same message.
            raise serializers.ValidationError("If this email exists, a password reset link has been sent.")
        return value

    def save(self):
        email = self.validated_data['email']
        user = User.objects.get(email=email)

        # Generate password reset token
        token_generator = PasswordResetTokenGenerator()
        token = token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))

        # Build reset link pointing to the frontend
        frontend_url = settings.FRONTEND_URL_BASE
        reset_link = f"{frontend_url}/reset-password-confirm/{uid}/{token}/" # This line is likely already correct

        # Send email
        send_mail(
            "Password Reset Request",
            f"Hi {user.username},\n\nUse the link below to reset your password:\n{reset_link}\n\nIf you didn't request this, ignore this email.",
            'info@zportaacademy.com',
            [email],
            fail_silently=False,
        )

# Password Reset View
class PasswordResetView(APIView):
    permission_classes = [AllowAny]  # Allow unauthenticated users to access this endpoint

    def post(self, request):
        serializer = PasswordResetSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "If this email exists, a password reset link has been sent."}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# Password Reset Confirm Serializer
class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8)

    def validate(self, data):
        uid = data.get('uid')
        token = data.get('token')
        try:
            user_id = urlsafe_base64_decode(uid).decode()
            user = User.objects.get(pk=user_id)
        except (User.DoesNotExist, ValueError, TypeError):
            raise serializers.ValidationError("Invalid user identifier.")

        token_generator = PasswordResetTokenGenerator()
        if not token_generator.check_token(user, token):
            raise serializers.ValidationError("Invalid or expired token.")

        return data

    def save(self):
        uid = self.validated_data['uid']
        new_password = self.validated_data['new_password']
        user_id = urlsafe_base64_decode(uid).decode()
        user = User.objects.get(pk=user_id)
        user.set_password(new_password)
        user.save()

class PublicProfileSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="user.id", read_only=True)
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    first_name = serializers.CharField(source="user.first_name", required=False, allow_blank=True)
    last_name = serializers.CharField(source="user.last_name", required=False, allow_blank=True)
    date_joined = serializers.DateTimeField(source="user.date_joined", read_only=True, format="%Y-%m-%d")
    profile_image_url = serializers.SerializerMethodField()
    showcase_image_1_url = serializers.SerializerMethodField()
    showcase_image_2_url = serializers.SerializerMethodField()
    showcase_image_3_url = serializers.SerializerMethodField()
    showcase_image_1_tags_detail = serializers.SerializerMethodField()
    showcase_image_2_tags_detail = serializers.SerializerMethodField()
    showcase_image_3_tags_detail = serializers.SerializerMethodField()
    growth_score = serializers.IntegerField(read_only=True)
    impact_score = serializers.IntegerField(read_only=True)
    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = Profile
        fields = [
            "id", "user_id", "username", "email", "first_name", "last_name", "date_joined",
            "display_name",
            "role", "bio", "active_guide", "profile_image", "profile_image_url",
            "growth_score", "impact_score",
            # Teacher enhancement fields
            "teacher_tagline", "teacher_about", "teaching_specialties",
            "showcase_image_1", "showcase_image_1_url", "showcase_image_1_caption", "showcase_image_1_tags_detail",
            "showcase_image_2", "showcase_image_2_url", "showcase_image_2_caption", "showcase_image_2_tags_detail",
            "showcase_image_3", "showcase_image_3_url", "showcase_image_3_caption", "showcase_image_3_tags_detail",
            "youtube_url", "linkedin_url", "twitter_url", "website_url",
            "intro_video_url"
        ]
        extra_kwargs = {
            "profile_image": {"required": False, "allow_null": True},
            "showcase_image_1": {"required": False, "allow_null": True},
            "showcase_image_2": {"required": False, "allow_null": True},
            "showcase_image_3": {"required": False, "allow_null": True},
        }

    def get_profile_image_url(self, obj):
        request = self.context.get("request")
        if obj.profile_image:
            if request:
                return request.build_absolute_uri(obj.profile_image.url)
            return obj.profile_image.url
        return None
    
    def get_showcase_image_1_url(self, obj):
        request = self.context.get("request")
        if obj.showcase_image_1:
            if request:
                return request.build_absolute_uri(obj.showcase_image_1.url)
            return obj.showcase_image_1.url
        return None
    
    def get_showcase_image_2_url(self, obj):
        request = self.context.get("request")
        if obj.showcase_image_2:
            if request:
                return request.build_absolute_uri(obj.showcase_image_2.url)
            return obj.showcase_image_2.url
        return None
    
    def get_showcase_image_3_url(self, obj):
        request = self.context.get("request")
        if obj.showcase_image_3:
            if request:
                return request.build_absolute_uri(obj.showcase_image_3.url)
            return obj.showcase_image_3.url
        return None
    
    def get_showcase_image_1_tags_detail(self, obj):
        return [{"id": tag.id, "name": tag.name} for tag in obj.showcase_image_1_tags.all()]
    
    def get_showcase_image_2_tags_detail(self, obj):
        return [{"id": tag.id, "name": tag.name} for tag in obj.showcase_image_2_tags.all()]
    
    def get_showcase_image_3_tags_detail(self, obj):
        return [{"id": tag.id, "name": tag.name} for tag in obj.showcase_image_3_tags.all()]

class UserScoreSerializer(serializers.ModelSerializer):
    user_id  = serializers.IntegerField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model  = Profile
        fields = ['user_id', 'username', 'growth_score', 'impact_score']


class GuideApplicationSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    referred_by_username = serializers.CharField(source='referred_by.username', read_only=True, allow_null=True)
    reviewed_by_username = serializers.CharField(source='reviewed_by.username', read_only=True, allow_null=True)
    
    class Meta:
        model = GuideApplicationRequest
        fields = [
            'id', 'user_id', 'username',
            'motivation', 'experience', 'subjects_to_teach',
            'referred_by', 'referred_by_username',
            'status', 'created_at', 'updated_at',
            'reviewed_by', 'reviewed_by_username', 'reviewed_at', 'admin_notes'
        ]
        read_only_fields = ['user', 'status', 'reviewed_by', 'reviewed_at', 'admin_notes']


class TeacherInvitationSerializer(serializers.ModelSerializer):
    inviter_username = serializers.CharField(source='inviter.username', read_only=True)
    inviter_display_name = serializers.CharField(source='inviter.profile.display_name', read_only=True)
    invitee_username = serializers.CharField(source='invitee.username', read_only=True, allow_null=True)
    is_expired = serializers.SerializerMethodField()
    invitation_url = serializers.SerializerMethodField()
    
    class Meta:
        model = TeacherInvitation
        fields = [
            'id', 'inviter', 'inviter_username', 'inviter_display_name',
            'invitee_email', 'invitee', 'invitee_username',
            'token', 'personal_message', 'status',
            'created_at', 'accepted_at', 'expires_at',
            'is_expired', 'invitation_url'
        ]
        read_only_fields = ['inviter', 'invitee', 'token', 'status', 'accepted_at', 'is_expired', 'invitation_url']
    
    def get_is_expired(self, obj):
        return obj.is_expired()
    
    def get_invitation_url(self, obj):
        request = self.context.get('request')
        if request:
            # Frontend URL for invitation acceptance
            return f"{request.scheme}://{request.get_host()}/accept-invitation?token={obj.token}"
        return None

