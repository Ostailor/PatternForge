export const MAX_RECORDING_DURATION_MS = 3 * 60 * 1000;
export const MAX_TRANSCRIPT_LENGTH = 5_000;
export const MAX_VOICE_TURNS_PER_INTERVIEW = 80;

export const STORE_AUDIO_BY_DEFAULT = false;

export function isRecordingDurationAllowed(durationMs: number | undefined): boolean {
  return (
    durationMs === undefined ||
    (Number.isFinite(durationMs) &&
      durationMs >= 0 &&
      durationMs <= MAX_RECORDING_DURATION_MS)
  );
}

export function isTranscriptLengthAllowed(transcript: string): boolean {
  return transcript.trim().length <= MAX_TRANSCRIPT_LENGTH;
}
