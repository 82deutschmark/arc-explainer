# 2025-11-02 Saturn audio streaming plan

## Goal
Enable Saturn Visual Solver streaming reasoning text to be rendered as real-time audio using the ElevenLabs text-to-speech streaming API, without exposing the API key client-side.

## Scope & files
- `server/services/audio/elevenLabsService.ts` (new): wrap ElevenLabs streaming API with server-side helpers.
- `server/controllers/audioController.ts` (new): expose SSE/WebSocket-compatible proxy endpoint for ElevenLabs audio stream.
- `server/routes.ts`: register the new endpoint.
- `client/src/hooks/useSaturnProgress.ts`: emit reasoning chunks to audio pipeline.
- `client/src/hooks/useAudioStream.ts` (new): manage browser audio streaming for ElevenLabs responses.
- `client/src/pages/SaturnVisualSolver.tsx` and/or related Saturn UI components: add opt-in toggle and audio playback controls.
- `shared/config/audio.ts` (new): share feature flags/env toggles for audio streaming.
- `CHANGELOG.md`: record change summary.

## Tasks
1. **Server-side audio proxy**
   - Read `ELEVENLABS_API_KEY` and optional `ELEVENLABS_VOICE_ID` from environment.
   - Validate key presence; respond with 503 when missing.
   - Implement `ElevenLabsService.streamText` to accept async iterator of text chunks and return Node Readable stream producing MPEG audio via ElevenLabs streaming endpoint (`/v1/text-to-speech/{voice_id}/stream`).
   - Provide fallback voice (e.g., `Rachel`) when env voice not set.

2. **Streaming controller**
   - New endpoint `POST /api/audio/stream` accepting JSON body with `textChunks` (array) or enabling chunked reasoning bridging via SSE.
   - For Saturn integration, create lightweight `POST /api/audio/saturn` that relays reasoning text, streaming audio back as `audio/mpeg`.
   - Ensure error handling and logging follow existing patterns.

3. **Client audio hook**
   - Build hook to open `ReadableStreamDefaultReader` from `fetch` and feed into `AudioContext` via `MediaSource`/`SourceBuffer` or Web Audio streaming.
   - Manage playback state (playing, muted, volume slider) and expose controls to UI.

4. **Saturn UI integration**
   - Add toggle/button to enable "Speak reasoning" in Saturn Visual Solver UI (default off).
   - When enabled, send reasoning deltas to ElevenLabs endpoint incrementally (debounce for chunking) and play resulting audio stream.
   - Display playback status (e.g., "Narrating...", error message).

5. **Testing & docs**
   - Validate manual run using sample Saturn run (simulate reasoning chunk).
   - Document env variables in README or dedicated docs section if required.
   - Update CHANGELOG with feature entry.

