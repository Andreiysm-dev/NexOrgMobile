# Component Cleanup Guide

## Problem
The `feed.tsx` and `index.tsx` files have duplicate code from the old inline PostCard component that needs to be removed.

## Solution

### Files to Clean:
1. `app/(tabs)/feed.tsx` - Has TWO `export default function FeedScreen()` definitions
2. `app/(tabs)/index.tsx` - Has leftover PostCard code

### For feed.tsx:
**Delete lines 168-411** (the entire first FeedScreen function)

The file should have:
- Lines 1-167: Imports, interfaces, and helper functions ✅
- Line 168 onwards: ONLY ONE `export default function FeedScreen()` ✅

The good FeedScreen (keep this one) already uses:
```tsx
<PostCard 
  key={`${item.type}-${item.id}`} 
  post={item}
  onLikeUpdate={(postId, liked, newCount) => {
    setFeedData(prev => prev.map(p => 
      p.id === postId ? { ...p, user_has_liked: liked, like_count: newCount, likes: newCount } : p
    ));
  }}
/>
```

### For index.tsx:
The file already uses the new components correctly:
```tsx
<PostCard 
  key={item.key}
  post={item}
  onLikeUpdate={(postId, liked, newCount) => {
    setPosts(prev => prev.map(p => 
      p.post_id === postId ? { ...p, user_has_liked: liked, like_count: newCount, likes: newCount } : p
    ));
  }}
/>
```

And:
```tsx
<AnnouncementCard 
  key={item.key}
  announcement={item}
/>
```

## What's Already Done ✅
1. Created `components/feed/PostCard.tsx` with image carousel
2. Created `components/feed/AnnouncementCard.tsx`
3. Both components are imported in feed.tsx and index.tsx
4. The rendering logic already uses the new components

## What Needs to be Done
1. Delete the duplicate FeedScreen function in feed.tsx (lines 168-411)
2. Verify no leftover code in index.tsx
3. Test the carousel functionality

## Expected Result
- Posts display with working image carousel (left/right arrows, dots, counter)
- Announcements display properly
- Like functionality works
- No duplicate code
