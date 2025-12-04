# Backend Migration Guide - Role Restriction System

## What Changed

### New Features

1. **Guide Application System** - Students must apply to become teachers
2. **Role Restrictions** - Only approved guides can create content
3. **Enhanced Teacher Profiles** - More fields for teacher discovery

## Migration Commands (Run on Server)

```bash
cd ~/zporta_academy/zporta_academy_backend
python manage.py migrate users
```

This will create:

### Migration 0006: Teacher Profile Enhancement

- `teacher_tagline` (CharField 120)
- `teacher_about` (TextField)
- `teaching_specialties` (CharField 255)
- `showcase_image_1/2/3` (ImageField)
- `youtube_url`, `linkedin_url`, `twitter_url`, `website_url` (URLField)
- `intro_video_url` (URLField)

### Migration 0007: Guide Application System

- New table: `users_guideapplicationrequest`
  - `user` (ForeignKey)
  - `motivation` (TextField)
  - `experience` (TextField, nullable)
  - `subjects_to_teach` (CharField)
  - `referred_by` (ForeignKey, nullable)
  - `status` (CharField: pending/approved/rejected)
  - `reviewed_by` (ForeignKey, nullable)
  - `reviewed_at` (DateTime, nullable)
  - `admin_notes` (TextField, nullable)
  - Timestamps: `created_at`, `updated_at`

## What This Does

### For Students (Explorers)

- ✅ Everyone starts as "Explorer" role on registration
- ✅ Can browse, learn, take quizzes
- ❌ Cannot create courses/lessons/quizzes
- ❌ Floating menu (FAB) hidden from UI
- ✅ Can request to become a guide via API

### For Teachers (Guides)

- ✅ Must apply via guide application form
- ✅ Admin reviews and approves/rejects
- ✅ After approval: `active_guide=True` and can create content
- ✅ Floating menu visible for content creation
- ✅ Enhanced profile fields for marketing

### Admin Features

- View all guide applications in Django admin
- Bulk approve/reject actions
- Can invite users to become guides

## API Endpoints Added

```
POST   /api/users/guide-application/          # Submit application
GET    /api/users/guide-application/          # Check own status
GET    /api/users/guide-applications/         # Admin: list all
POST   /api/users/guide-applications/<id>/approve/
POST   /api/users/guide-applications/<id>/reject/
```

## No Breaking Changes

- Existing users keep their current roles
- Existing guides remain active
- Only new registrations start as "Explorer"
