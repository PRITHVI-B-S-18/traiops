# Deployment Guide - Schedule Data Migration

## Current Situation
- ✅ Local migration completed - data split into month-based documents
- ❌ Production still has old structure (`schedules/main` document)
- ✅ Code is backward compatible (reads from both old and new structures)

## Deployment Steps

### Step 1: Deploy New Code (Backward Compatible)
The new code will work with both old and new data structures, so it's safe to deploy first.

```bash
# 1. Build the production version
npm run build

# 2. Deploy to Firebase Hosting
firebase deploy --only hosting

# 3. Deploy Firestore Security Rules (if updated)
firebase deploy --only firestore:rules
```

### Step 2: Verify Deployment
1. Visit your production URL
2. Log in as admin
3. Check that schedules are still visible (reading from old `schedules/main` document)

### Step 3: Run Migration on Production
1. Log in to production as admin
2. Navigate to Schedule Management page
3. Click the **"Migrate Data"** button in the top action bar
4. Review the migration information
5. Click **"Start Migration"**
6. Wait for completion
7. Verify the results show which months were migrated

### Step 4: Verify Migration Success
1. Check that all schedule data is still visible
2. Verify new schedule entries are being saved correctly
3. Test creating a new schedule entry to ensure it saves to month-based documents

### Step 5: Clean Up (Optional - After Verification)
Once you've verified everything works correctly for a few days:
1. Go to Firebase Console → Firestore Database
2. Navigate to `schedules` collection
3. Delete the old `main` document (it's no longer needed)

## Important Notes

⚠️ **Before Migration:**
- The new code is backward compatible, so it's safe to deploy
- Production will continue reading from `schedules/main` until migration is run
- No data will be lost

✅ **After Migration:**
- All new schedule entries will automatically save to month-based documents
- Old data will be accessible from month-based documents
- The old `main` document can be deleted after verification

## Troubleshooting

If schedules don't appear after deployment:
1. Check browser console for errors
2. Verify Firestore rules are deployed correctly
3. Check that user has proper permissions
4. Verify Firebase project is connected correctly

If migration fails:
1. Check browser console for error messages
2. Verify you have admin permissions
3. Check Firestore quota/limits
4. Try migrating in smaller batches (if needed)

## Rollback Plan

If something goes wrong:
1. The old `schedules/main` document is still intact
2. You can temporarily revert to old code if needed
3. Data is not lost - migration creates new documents, doesn't delete old ones

