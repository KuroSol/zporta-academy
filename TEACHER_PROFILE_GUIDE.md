# Teacher Profile Enhancement Guide

## Overview
Enhanced teacher profiles to help teachers attract students from outside Zporta Academy and showcase their expertise professionally.

## New Teacher Profile Fields

### 1. **Teacher Tagline** (120 characters max)
Short, catchy description of what you offer.
- Example: "Helping students master JLPT N1 in 90 days"
- Example: "Business English expert with 15+ years experience"

### 2. **Teacher About** (Long text)
Detailed introduction covering:
- Teaching philosophy
- Experience and credentials
- What makes you unique
- Teaching style
- Success stories

### 3. **Teaching Specialties** (255 characters)
Comma-separated list of your areas of expertise.
- Example: "JLPT N1, Business Japanese, Conversation, Anime & Manga"
- Example: "IELTS, TOEFL, Business English, Academic Writing"

### 4. **Showcase Images** (3 images)
Visual portfolio to attract students:
- **Image 1**: Teaching materials or classroom setup
- **Image 2**: Student success/testimonials screenshot
- **Image 3**: Certification or achievements

### 5. **Video Introduction** (YouTube URL)
- Record a 1-3 minute introduction video
- Upload to YouTube
- Paste the YouTube URL
- Video will be embedded on your profile

### 6. **Social Links**
Connect with students on multiple platforms:
- **YouTube**: Your channel URL
- **LinkedIn**: Professional profile
- **Twitter/X**: Updates and teaching tips
- **Website**: Personal website or portfolio

## How It Helps

### For Finding Students
✅ **SEO Optimized**: Your profile appears in Google search results
✅ **Social Sharing**: Rich preview cards on Facebook, Twitter, LinkedIn
✅ **Video Introduction**: Build trust before first contact
✅ **Portfolio Showcase**: Visual proof of teaching quality
✅ **Multi-platform Presence**: Students can find you via social media

### For Selling Courses (Future)
✅ **Professional Credibility**: Detailed about section builds authority
✅ **Social Proof**: Showcase images display success
✅ **External Traffic**: Link to your YouTube, website, other courses
✅ **Standardized Format**: Easy for students to compare teachers

## Profile Setup (Coming Soon in UI)

Teachers will be able to edit these fields from:
1. Dashboard → Profile Settings
2. Fill in all sections (or leave blank if not needed)
3. Upload 3 showcase images
4. Add social links
5. Paste YouTube intro video URL
6. Save and publish

## Technical Details

### API Fields
All fields are optional (blank=True, null=True):
- `teacher_tagline`: CharField(120)
- `teacher_about`: TextField
- `teaching_specialties`: CharField(255)
- `showcase_image_1/2/3`: ImageField
- `youtube_url`, `linkedin_url`, `twitter_url`, `website_url`: URLField
- `intro_video_url`: URLField (YouTube embed)

### URL Pattern
Teacher profiles accessible at: `/guides/{username}/`

### SEO Features
- JSON-LD Person schema
- Open Graph tags
- Twitter Cards
- Canonical URLs
- Sitemap inclusion

## Migration
Run on production after pulling:
```bash
python manage.py migrate users
```

## Next Steps
1. ✅ Backend models and API ready
2. ⏳ Frontend profile edit UI (to be built)
3. ⏳ Profile display enhancements with video embed
4. ⏳ Featured courses section
