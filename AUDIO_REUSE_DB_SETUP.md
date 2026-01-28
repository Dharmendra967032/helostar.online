# Audio Reuse Feature - Database Setup

## Prerequisite

The audio reuse feature framework is already installed in the code. To fully enable it, you need to add one column to your Supabase `videos` table.

---

## Option 1: SQL Query (Recommended)

Run this in your Supabase SQL Editor:

```sql
-- Add audio_url column to store separate audio tracks
ALTER TABLE videos ADD COLUMN audio_url TEXT;

-- Optional: Add a helpful comment
COMMENT ON COLUMN videos.audio_url IS 'URL of audio track that can be reused across videos (Instagram-style)';

-- Optional: Add index for better query performance
CREATE INDEX idx_videos_audio_url ON videos(audio_url) WHERE audio_url IS NOT NULL;
```

**Time to execute**: < 1 second

---

## Option 2: Supabase UI

1. Go to Supabase Dashboard → Click your project
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Paste the SQL above
5. Click **Run**

---

## Option 3: Migrations (For Production)

If you use migrations, create a new migration file:

```sql
-- migrations/add_audio_url_to_videos.sql

BEGIN;

ALTER TABLE videos ADD COLUMN audio_url TEXT;

CREATE INDEX idx_videos_audio_url ON videos(audio_url) WHERE audio_url IS NOT NULL;

COMMIT;
```

---

## Verification

After adding the column, verify it exists:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'videos';
```

You should see `audio_url` with type `text`.

---

## How It Works After Setup

### During Upload
1. User uploads video with audio
2. App offers: **"New Audio"** or **"Reuse Audio"**
3. If **"Reuse Audio"**: Show list of popular videos
4. User selects a video's audio
5. Save: `audio_url` = selected audio URL

### During Playback
1. Video plays with its own URL (as before)
2. App checks if `audio_url` exists
3. If exists: Use separate audio element (future enhancement)
4. If not: Use video's built-in audio (current behavior)

### Benefits
- Multiple creators can share same audio
- Audio can be updated independently
- Tracks usage of popular audios
- Enables "Trending Audio" feature (future)

---

## Code That Uses This

These functions activate once the schema is updated:

```javascript
// Get available audios
async function getAvailableAudios() {
    // Will fetch all videos with audio_url set
    // Once column exists, this returns real data
}

// Show audio picker UI
async function showAudioSelector() {
    // Displays list of reusable audios
    // User selects one to use for their upload
}

// Save selected audio
function selectAudio(audioId, audioUrl) {
    window.selectedAudioUrl = audioUrl;
    window.selectedAudioId = audioId;
}
```

---

## Rollback (If Needed)

If you need to remove the column:

```sql
ALTER TABLE videos DROP COLUMN audio_url;
DROP INDEX IF EXISTS idx_videos_audio_url;
```

---

## FAQ

**Q: Will this break existing videos?**
A: No, the column is optional (nullable). Existing videos continue to work normally.

**Q: Do I need to migrate data?**
A: No, existing videos will have `audio_url = NULL` and use their built-in audio.

**Q: How is audio_url different from video url?**
A: 
- `url`: Video file (MP4 with audio+video)
- `audio_url`: Separate audio track (can be shared)

**Q: Can I update audio_url later?**
A: Yes, you can update it anytime without affecting the video file.

**Q: How much data does this use?**
A: Only adds one TEXT column (just URLs, no audio data). Negligible storage.

**Q: Is this required?**
A: No, the app works fine without it. It's an optional enhancement.

---

## After Setup

Once the column is added:

1. Restart your app (reload page)
2. Try uploading a new video
3. You should see "Use Existing Audio" option
4. Click it to see available audios
5. Select one and upload

---

## Storage Considerations

### Current Setup (Before Audio Reuse)
- Each video: Video file + Thumbnail
- No audio sharing
- Total storage: ~50MB per video average

### After Audio Reuse Enabled
- New video can reference existing audio
- Saves storage if reusing popular audios
- Total storage: Can be optimized if many reuse

### Example
- 100 videos with same audio normally: 5GB
- 100 videos reusing 1 audio: 50MB + 50MB audio = 100MB
- **Savings**: 4.9GB

---

## Next Steps

1. **Add the column** using Option 1 SQL
2. **Reload your app**
3. **Test**: Upload a new video and check for audio options
4. **Celebrate**: Audio reuse feature is live! 🎉

---

**Database Version Requirement**: Supabase (PostgreSQL 13+)
**Backward Compatible**: Yes, fully backward compatible
**Data Migration Required**: No
**Downtime Required**: None
