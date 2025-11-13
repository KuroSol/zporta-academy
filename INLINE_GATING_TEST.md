# How to Test Inline Premium Content Gating

## The Feature
You can mark specific paragraphs, images, or any block in a **free lesson** to only be visible to users who have enrolled in a **specific premium course**. Non-enrolled users see a stylish locked placeholder card instead.

## Why It Might Look Like It's Not Working
**The gating does NOT apply to:**
1. **Course/Lesson Owner** - The creator always sees everything
2. **Staff Users** - Admin/staff accounts bypass all gating
3. **Already Enrolled Users** - Users who bought the premium course see the content

## Correct Testing Steps

### Setup (Do Once)
1. **Create a Premium Course**
   - Go to Admin Dashboard → Create Course
   - Set Type: Premium
   - Set Price: e.g., $10
   - Set Status: **Published** (must be published!)
   - Add some lessons to it (optional)

2. **Create a Free Lesson with Gated Content**
   - Go to Admin Dashboard → Create Lesson
   - Type: **Free** (this is important!)
   - Status: Published
   - In the editor:
     - Add a paragraph: "This is visible to everyone"
     - Add another paragraph: "This premium content requires enrollment"
     - Click the second paragraph → Settings Panel
     - Under "Visibility", select your **premium course** from dropdown
     - Save the lesson

### Test as Non-Enrolled User
**IMPORTANT: You MUST test with a different account!**

#### Option A: Use a Different Browser/Incognito
1. Open an incognito window or different browser
2. Create a NEW account (or use an existing test account)
3. Navigate to your free lesson
4. **Expected Result:**
   - First paragraph is visible
   - Second paragraph is replaced with a locked card:
     - 🔒 Icon
     - "Premium content" title
     - "Enroll in [Course Name] to unlock this section"
     - "View course" button

#### Option B: Test Anonymous (Logged Out)
1. Log out of your account
2. Navigate to the free lesson URL directly
3. **Expected Result:**
   - First paragraph is visible
   - Second paragraph shows the locked card

### Test as Enrolled User
1. Using the test account from above
2. **Enroll in the premium course** (use test Stripe card: 4242 4242 4242 4242)
3. Go back to the free lesson
4. **Expected Result:**
   - BOTH paragraphs are now visible (no locked card)

## Common Issues

### "I still see all content"
- **Are you the course creator?** → Creators bypass all gating
- **Are you staff/admin?** → Staff bypass all gating
- **Have you enrolled already?** → Enrolled users see content

### "Everyone sees all content"
Check these:
1. Is the required course **Premium**? (Free courses don't gate)
2. Is the required course **Published**? (Draft courses don't gate)
3. Did you save the lesson after adding the gate?
4. Is the attribute in the HTML? (View page source and search for `data-required-course-permalink`)

### "No courses in dropdown"
The dropdown only shows:
- Premium courses
- Published courses (not drafts)
- Courses you created

## How to Verify It's Working (Backend)

If you want to confirm the server is masking correctly:

1. View page source of your free lesson (logged out or different account)
2. Search for your "premium" paragraph text
3. You should NOT find it - instead you'll see:
```html
<div class="gated-content">
  <div class="gc-card">
    <div class="gc-icon">🔒</div>
    <div class="gc-body">
      <div class="gc-title">Premium content</div>
      <div class="gc-text">Enroll in "Your Course Name" to unlock this section.</div>
      <a href="/courses/your-permalink" class="gc-btn">View course</a>
    </div>
  </div>
</div>
```

## Frontend Display

The locked card should appear as:
- **Modern card design** with subtle gradient background
- **Lock icon** (🔒) on the left
- **Clear message** about what's needed
- **Call-to-action button** linking to the course
- **Responsive** on mobile

---

## Still Having Issues?

If you've followed all steps and it's still not working:

1. Clear your browser cache
2. Make sure you're testing with a completely different user account
3. Check browser console for any JavaScript errors
4. Verify the lesson was saved after adding the gate
5. Check that your premium course is actually published (not draft)
