import { STORE_AUDIO_BY_DEFAULT } from "@/lib/voice/voiceLimits";

export const VOICE_MODE_PRIVACY_COPY =
  "Voice Mode stores transcripts so PatternForge can give communication feedback. Audio storage is optional and disabled by default.";

export type VoicePrivacySettings = {
  storeAudio: boolean;
  storeTranscript: boolean;
  allowTranscriptDeletion: boolean;
};

export const DEFAULT_VOICE_PRIVACY_SETTINGS: VoicePrivacySettings = {
  storeAudio: STORE_AUDIO_BY_DEFAULT,
  storeTranscript: true,
  allowTranscriptDeletion: true,
};

export function getVoicePrivacySettings(
  overrides: Partial<VoicePrivacySettings> = {},
): VoicePrivacySettings {
  return {
    ...DEFAULT_VOICE_PRIVACY_SETTINGS,
    ...overrides,
  };
}

export function shouldStoreRawAudio(settings: VoicePrivacySettings): boolean {
  return settings.storeAudio === true;
}

export function shouldStoreTranscript(settings: VoicePrivacySettings): boolean {
  return settings.storeTranscript === true;
}

export function getAudioStorageConsentRequired(settings: VoicePrivacySettings): boolean {
  return shouldStoreRawAudio(settings);
}

export function getVoicePrivacyNotice(settings = DEFAULT_VOICE_PRIVACY_SETTINGS): string {
  if (shouldStoreRawAudio(settings)) {
    return "PatternForge can store transcripts and raw audio only when the user explicitly consents.";
  }

  return VOICE_MODE_PRIVACY_COPY;
}
