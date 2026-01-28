# Helostar Shorts - Visual Guide

## Touch Controls Diagram

### Tap Zones on Vertical Short
```
╔════════════════════════════════════╗
║         WATCH AREA                 ║
║  (Video plays here)                ║
║                                    ║
║  ┌──────┬────────┬──────────────┐ ║
║  │      │        │              │ ║
║  │ MUTE │ FULL   │    LIKE      │ ║
║  │      │SCREEN  │    ❤️        │ ║
║  │      │        │              │ ║
║  └──────┴────────┴──────────────┘ ║
║                                    ║
║  LEFT 1/3  CENTER 1/3  RIGHT 1/3  ║
╚════════════════════════════════════╝

Swipe UP   ↑ (Next Video)
Swipe DOWN ↓ (Previous Video)
```

---

## User Journey Flow

### Scrolling Feed
```
┌─────────────────────────┐
│   Video 1 (Scrolled)    │  ← Auto-play starts when 50% visible
│   ▶️ PLAYING            │
│   (auto-pauses at end)  │
└─────────────────────────┘
           ↓ scroll
┌─────────────────────────┐
│   Video 2 (Current)     │  ← Becomes visible
│   ▶️ PLAYING            │  ← All others pause
│   (Audio clear)         │
└─────────────────────────┘
           ↓ scroll
┌─────────────────────────┐
│   Video 3 (Next)        │
│   ⏸️  PAUSED            │
│   (waiting)             │
└─────────────────────────┘
```

### Swipe in Normal Mode
```
┌──────────────────┐     Swipe UP      ┌──────────────────┐
│  Current Short   │    ──────────→    │   Next Short     │
│  ▶️ PLAYING      │                   │   ▶️ PLAYING     │
│                  │                   │   (auto-start)   │
└──────────────────┘                   └──────────────────┘
```

### Swipe in Fullscreen Mode
```
╔════════════════════════════════════╗     ╔════════════════════════════════════╗
║  Current Short (FULLSCREEN)        ║     ║  Next Short (FULLSCREEN)           ║
║  ▶️ PLAYING                        ║ UP  ║  ▶️ PLAYING                        ║
║  (Center tap to exit)              ║────→ (Audio transitions instantly)      ║
║                                    ║     ║                                    ║
║                                    ║     ║                                    ║
╚════════════════════════════════════╝     ╚════════════════════════════════════╝
```

---

## Like System Flow

### First Like
```
User Taps                Heart is Gray
RIGHT ZONE    ──────────→  Then DARK RED
                          ❤️ (Size 8b0000)
                          Like Count +1
                          Stored in DB
```

### Second Like (Same User)
```
User Taps                No Change
RIGHT ZONE    ──────────→  Already Liked
  Again                  ❤️ (Still dark red)
                         Like Count: SAME
                         DB rejects duplicate
```

### Like Count on DB
```
┌──────────────────────────────┐
│ Videos Table                 │
├──────────────────────────────┤
│ id: video_001                │
│ likes: 47                    │  ← Count
│ owner: user@gmail.com        │
│ url: ...video.mp4            │
└──────────────────────────────┘
          ↑
┌──────────────────────────────┐
│ Likes Table (Lookup)         │
├──────────────────────────────┤
│ video_id │ user_email        │
├──────────────────────────────┤
│ 001      │ alice@gmail.com   │  ← Only 1 per user
│ 001      │ bob@gmail.com     │
│ 001      │ carol@gmail.com   │
└──────────────────────────────┘
```

---

## Audio Sync Timeline

### Before Fix (Audio Overlap)
```
Video A: ♫ Audio Playing
         [====A====]
Video B starts, audio not stopped
         ♫ [====B====] (Both audios play = BAD)
```

### After Fix (Clean Transitions)
```
Video A: ♫ Audio Playing
         [====A====]
         ↓ (PAUSED & MUTED)
Video B: ♫ [====B====] (Only one audio at a time = GOOD)
```

---

## Fullscreen Transition

### Entering Fullscreen
```
┌─────────────────────────┐
│   Vertical Short        │     Center Tap
│   ▶️ PLAYING            │   ────────────→
│   (Small window)        │
└─────────────────────────┘

              ↓

╔════════════════════════════════════╗
║  FULLSCREEN MODE                   ║
║  (Same video, full screen)         ║
║  ▶️ PLAYING                        ║
║  (Center tap to exit)              ║
║                                    ║
║                                    ║
╚════════════════════════════════════╝
```

### State During Fullscreen
```
IN FULLSCREEN MODE:
├─ Swipe UP → Load next video in fullscreen
├─ Swipe DOWN → Load previous in fullscreen
├─ Center Tap → Exit fullscreen
├─ Audio: Continuous (no restart)
└─ Resolution: Full device resolution
```

---

## Comment System Flow

### Posting Comment
```
User Types          User Taps Send
     ↓                    ↓
┌──────────────────┐   │
│"Great video! 🔥" │ → │ SEND
└──────────────────┘   │
                       ↓
            Comment appears below video
            (Auto-hide after 800ms)
                       ↓
            Count updates in real-time
            (in bottom action row)
```

---

## Video States

### Video Lifecycle
```
START
  │
  ├─→ LOADING (buffering)
  │     ├─→ PLAYING
  │     │   ├─→ User scrolls away
  │     │   │   └─→ PAUSED (auto)
  │     │   │
  │     │   ├─→ Video ends naturally
  │     │   │   └─→ ENDED
  │     │   │       └─→ Auto-play next
  │     │   │
  │     │   └─→ User swipes away
  │     │       └─→ PAUSED & RESET (currentTime=0)
  │     │           └─→ Next video PLAYING
  │     │
  │     └─→ User taps center (fullscreen)
  │         └─→ FULLSCREEN MODE
  │
  └─→ ERROR (network issue)
      └─→ Show placeholder
```

---

## Performance Timeline

### Before Fixes
```
User Swipe        Auto-play delay        Next video plays
     │                  │                      │
     0ms              300ms               1500ms (~1.2s delay)
     └──────────────────────────────────────────┘
                   Feels sluggish
```

### After Fixes
```
User Swipe        Auto-play starts        Next video plays
     │                  │                      │
     0ms              50ms (observer)      300ms (responsive)
     └──────────────────┴──────────────────────┘
              Feels snappy!
```

---

## Database Schema (With Audio Reuse)

### Videos Table
```
┌────────────────────────────────────┐
│ videos                             │
├────────────────────────────────────┤
│ id (PK)                            │
│ url ─ Video file URL               │
│ thumbnail_url ─ Cover image        │
│ audio_url ─ Separate audio track   │ ← NEW
│ description ─ Text caption         │
│ owner ─ Creator email              │
│ category ─ Shorts/Music/Dance/etc  │
│ likes ─ Like count                 │
│ views ─ View count                 │
│ created_at ─ Timestamp             │
└────────────────────────────────────┘
```

### Likes Table
```
┌────────────────────────────────────┐
│ likes (Prevents duplicates)        │
├────────────────────────────────────┤
│ video_id (FK) ──→ videos.id        │
│ user_email ─ Who liked             │
│ created_at ─ When                  │
│ UNIQUE(video_id, user_email)       │
└────────────────────────────────────┘
```

---

## Feature Support Matrix

| Feature | Mobile | Desktop | Tablet | Notes |
|---------|--------|---------|--------|-------|
| Swipe | ✅ | ✅ | ✅ | Touch or mouse |
| Tap Zones | ✅ | ✅ | ✅ | Work on all devices |
| Fullscreen | ✅ | ✅ | ✅ | Native fullscreen API |
| Auto-play | ✅ | ⚠️ | ✅ | Desktop may need click |
| Comments | ✅ | ✅ | ✅ | Full keyboard support |
| Like System | ✅ | ✅ | ✅ | One-time per user |
| Audio Reuse | 🔄 | 🔄 | 🔄 | Pending DB setup |

**Legend**: ✅ Full Support | ⚠️ Limited | 🔄 Pending Setup

---

## Network Timeline

### Like Action
```
User Taps Like
     │
     ├─→ UI updates immediately (dark red ❤️)
     │   └─→ User sees feedback instantly
     │
     └─→ Background: Send to DB
         └─→ After 50-200ms: Like persists
```

### Comment Posting
```
User Submits Comment
     │
     ├─→ Comment appears in feed instantly
     │   └─→ Count updates
     │
     └─→ Background: Save to DB
         └─→ After 50-200ms: Persists
```

---

**Last Updated**: Current Session
**Visual Guide Version**: 1.0
