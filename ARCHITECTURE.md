# VOYO Music Architecture

## Vision

**VOYO** = YouTube Music/Video Player that:
1. User searches for a song
2. We query YouTube, find the video
3. Extract the stream URL (audio or video)
4. Play audio in music mode OR video in video mode
5. Optional: Download for offline

## The Problem with Piped API

**Piped** was a YouTube frontend proxy that provided:
- Direct audio/video stream URLs without YouTube API key
- Search functionality
- No rate limits

**Why it's dead**: Most public Piped instances are:
- Offline (502, 522 errors)
- API locked down
- Unreliable

## The Solution: yt-dlp Backend

**yt-dlp** is the gold standard for extracting YouTube streams:
- Actively maintained
- Works with YouTube's latest changes
- Extracts direct audio AND video URLs
- Supports search
- No API key needed

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│                     (React + Vite)                           │
│                   localhost:5173                             │
├─────────────────────────────────────────────────────────────┤
│  User Action          │  Component      │  API Call          │
│  ─────────────────────┼─────────────────┼────────────────────│
│  Search "Davido"      │  SearchOverlay  │  GET /search?q=... │
│  Play Track           │  AudioPlayer    │  GET /stream?v=... │
│  Switch to Video      │  VideoMode      │  (same stream URL) │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        BACKEND                               │
│                   (Node.js + yt-dlp)                         │
│                   localhost:3001                             │
├─────────────────────────────────────────────────────────────┤
│  Endpoint             │  Action                              │
│  ─────────────────────┼──────────────────────────────────────│
│  GET /search?q=...    │  yt-dlp ytsearch10:query --flat -j   │
│  GET /stream?v=ID     │  yt-dlp -f bestaudio -g URL          │
│  GET /health          │  Returns {status: "ok"}              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        yt-dlp                                │
│                (Python CLI tool)                             │
├─────────────────────────────────────────────────────────────┤
│  - Extracts direct stream URLs from YouTube                  │
│  - Handles YouTube's signature encryption                    │
│  - Returns temporary URLs (valid ~6 hours)                   │
│  - Requires: deno runtime for JS challenge solving           │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Search Flow
```
User types "Calm Down Rema"
    │
    ▼
Frontend: fetch('http://localhost:3001/search?q=Calm+Down+Rema')
    │
    ▼
Backend: spawn yt-dlp ytsearch10:"Calm Down Rema" --flat-playlist -j
    │
    ▼
yt-dlp returns JSON per result: {id, title, uploader, duration, thumbnails}
    │
    ▼
Backend formats and returns: [{id, title, artist, duration, thumbnail}]
    │
    ▼
Frontend displays results in SearchOverlay
```

### Play Flow
```
User clicks track (videoId: "CQLsdm1ZYAw")
    │
    ▼
Frontend: fetch('http://localhost:3001/stream?v=CQLsdm1ZYAw')
    │
    ▼
Backend: spawn yt-dlp -f bestaudio -g https://youtube.com/watch?v=CQLsdm1ZYAw
    │
    ▼
yt-dlp returns direct googlevideo.com URL
    │
    ▼
Backend caches URL, returns to frontend
    │
    ▼
Frontend: <audio src="https://rr3---sn-xxx.googlevideo.com/videoplayback?...">
    │
    ▼
Audio plays directly in browser!
```

## File Structure

```
voyo-music/
├── server/
│   └── index.js          # Backend server (yt-dlp wrapper)
├── src/
│   ├── App.tsx           # Main app with mode switching
│   ├── components/
│   │   ├── AudioPlayer.tsx      # Global audio element
│   │   ├── classic/             # Spotify-style UI
│   │   ├── search/              # Search overlay
│   │   └── voyo/                # Main VOYO experience
│   ├── services/
│   │   └── api.ts               # Backend API calls (NEW)
│   ├── store/
│   │   └── playerStore.ts       # Zustand state
│   └── types/
│       └── index.ts             # TypeScript types
└── package.json
```

## Why This Approach?

| Approach | Pros | Cons |
|----------|------|------|
| YouTube iframe API | Official, easy | Can't extract audio only, ads |
| Piped API | No API key, direct streams | Unreliable, most instances dead |
| **yt-dlp backend** | Reliable, full control, audio+video | Requires local server |
| YouTube Data API | Official | Needs API key, no streams |

## Future Enhancements

1. **Download**: yt-dlp can download files directly
2. **Video Mode**: Same yt-dlp, just `-f bestvideo+bestaudio`
3. **Playlists**: yt-dlp supports playlist extraction
4. **Caching**: Cache stream URLs (valid ~6 hours)
5. **Deployment**: Dockerize backend for VPS hosting
