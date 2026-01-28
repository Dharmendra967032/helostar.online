# Helostar Shorts - Quick Reference Guide

## Touch Controls (Shorts Mode)

### Swipe Gestures
- **Swipe UP** (100+ pixels) → Load next short + auto-play
- **Swipe DOWN** (100+ pixels) → Load previous short + auto-play

### Tap Zones
```
┌─────────────────────────┐
│  LEFT 1/3  │ CENTER 1/3 │ RIGHT 1/3 │
├─────────────────────────┤
│   MUTE/    │ FULLSCREEN │   LIKE    │
│  UNMUTE    │   TOGGLE   │   HEART   │
└─────────────────────────┘
```

- **LEFT ZONE**: Tap to mute/unmute video
- **CENTER ZONE**: Tap to enter/exit fullscreen
- **RIGHT ZONE**: Tap to like (turns dark red #8b0000)

---

## Fullscreen Controls

### In Fullscreen Mode
- **Swipe UP** → Next short in fullscreen
- **Swipe DOWN** → Previous short in fullscreen
- **CENTER TAP** → Exit fullscreen

### Audio Management
- Only one audio plays at a time
- Previous audio stops immediately
- New audio unmuted when visible

---

## Like System

### How It Works
- **One like per user per video** (enforced by DB)
- Heart turns **dark red (#8b0000)** when liked
- Like count increases by 1 (first like only)
- Subsequent clicks do nothing

### Database Tracking
- Stores: `video_id`, `user_email`
- Prevents duplicates via unique constraint

---

## Comments Feature

### Posting Comments
1. Click comment icon
2. Type comment
3. Press send (paper-plane icon)
4. Comment auto-hides after 800ms
5. Count updates in real-time

---

## Follow System

### Following Creators
- Click "Follow" button on video header
- Button text changes to "Following"
- Follower count updates
- Database tracks: `follower_email`, `following_email`

---

## Upload Feature

### How to Upload
1. Click upload button (📤 FAB in bottom-left)
2. Select video file
3. Select thumbnail/cover image
4. Enter description
5. Choose category
6. Click upload

### Supported Formats
- Video: MP4, WebM, OGG (standard HTML5 video)
- Thumbnail: JPG, PNG, WebP
- Max file size: Set by Supabase storage limits

### Categories
Select from: music, dance, comedy, education, lifestyle, etc.

---

## Audio Reuse Feature (Coming Soon)

### Concept
Like Instagram Reels - multiple creators can use the same audio

### Current Status
- **Framework installed** in code (ready to use)
- **Requires DB update**: Add `audio_url` column to videos table

### How to Enable
1. Add column to Supabase:
   ```sql
   ALTER TABLE videos ADD COLUMN audio_url TEXT;
   ```
2. Feature auto-activates

### Usage
During upload:
- Option to **use new audio** from your video
- Option to **reuse audio** from popular videos
- Tap "Use Audio" when prompted

---

## Troubleshooting

### Shorts Getting Stuck
**Solution**: Refresh page (F5)
**Why**: Rare race condition in event handlers
**Prevention**: Already fixed in this version

### Audio Playing Twice
**Solution**: Swipe to next short
**Why**: Previous video not pausing fast enough
**Prevention**: Already fixed in this version

### Like Not Counting
**Solution**: Refresh page after 2 seconds
**Why**: Network lag (DB eventual consistency)
**If Persistent**: Clear cookies, re-login

### Swipe Not Working
**Solution**: Make sure swipe distance > 100 pixels vertically
**Try**: Slower, longer swipes (not quick flicks)

---

## File Structure

```
helostar.online/
├── index.html           (Main page structure)
├── script.js            (All JavaScript logic)
├── style.css            (Styling for all features)
├── FIXES_AND_FEATURES.md (Detailed technical docs)
└── QUICK_REFERENCE.md   (This file)
```

---

## Performance Tips

- Keep videos under 10MB for fast loading
- Thumbnails should be 300x400px for best quality
- Descriptions under 150 characters for clean UI
- Use proper aspect ratio: 9:16 for vertical shorts

---

## Browser Support

✅ Chrome/Edge 90+
✅ Firefox 88+
✅ Safari 15+
⚠️ Safari iOS may have autoplay restrictions
⚠️ Android Chrome should work fine

---

## API Endpoints Used

- **Supabase Storage**: Videos, Thumbnails, Avatars
- **Supabase Realtime**: Likes, Comments (via INSERT triggers)
- **Firebase Auth**: Google OAuth login
- **Supabase RPC**: increment_views, get_feed

---

## Keyboard Shortcuts (Future Enhancement)

*Not yet implemented, but suggested:*
- `J` - Like current video
- `K` - Play/Pause
- `M` - Mute/Unmute
- `F` - Fullscreen
- `↑` - Previous short
- `↓` - Next short

---

**Last Updated**: Current Session
**Version**: 3.0 (With Swipe & Audio Fixes)
