# Fix RLS Policy Error on Follows Table

## Problem
The application is getting the error:
```
Error following: new row violates row-level security policy for table "follows"
```

This happens because Row-Level Security (RLS) is enabled on the `follows` table but the policies don't allow users to insert records.

## Solution

### Option 1: Disable RLS on Follows Table (Simplest)
If you don't need RLS on the follows table, disable it:

1. Go to Supabase Dashboard
2. Navigate to **Authentication** → **Policies**
3. Find the `follows` table
4. Click on it and disable **Enable RLS**
5. Confirm the action

### Option 2: Create Proper RLS Policies (Recommended)

If you want to keep RLS enabled, you need to create these policies:

#### 1. Allow users to insert their own follows
```sql
CREATE POLICY "Users can insert their own follows"
ON follows
FOR INSERT
WITH CHECK (auth.uid()::text = follower_email);
```

#### 2. Allow users to select follows
```sql
CREATE POLICY "Anyone can view follows"
ON follows
FOR SELECT
USING (true);
```

#### 3. Allow users to delete their own follows
```sql
CREATE POLICY "Users can delete their own follows"
ON follows
FOR DELETE
USING (auth.uid()::text = follower_email);
```

### Steps to Apply Policies in Supabase:

1. Go to **Supabase Dashboard** → Your Project
2. Click **SQL Editor** in the left sidebar
3. Create a new query
4. Paste each policy SQL statement above
5. Click **Run** for each policy
6. Test the follow functionality

## Testing the Fix

1. Go to the Helostar app
2. Login with a Google account
3. Find another user's video
4. Click the **Follow** button
5. You should now be able to follow without the RLS error

## Verification in Console

If the follow works, you should see console logs like:
```
RLS policy error on follows table INSERT resolved
```

If it still fails, check:
- That your Supabase project is on **PostgreSQL 13+**
- That `auth.uid()` function exists in your Supabase instance
- That the email column is properly set up

## Alternative: Use JWT Claims

If the above doesn't work, modify the policy to use email instead of uid:

```sql
CREATE POLICY "Users can insert follows with email"
ON follows
FOR INSERT
WITH CHECK (
  auth.jwt() ->> 'email' = follower_email
);
```

## Still Getting Errors?

1. Check the Supabase **Logs** tab for detailed error messages
2. Verify the `follows` table has these columns:
   - `follower_email` (text)
   - `following_email` (text)
3. Make sure RLS is **enabled** on the table if using policies
4. Test with a direct SQL insert to verify permissions:
   ```sql
   INSERT INTO follows (follower_email, following_email) 
   VALUES ('user@example.com', 'creator@example.com');
   ```

## Code Changes Made

The application now has improved error handling:
- Detects RLS policy errors specifically
- Shows a more helpful message to users
- Logs detailed error information for debugging
- Continues operation even if follow feature temporarily fails
