import type {
  InterviewPhase,
  VoiceSpeaker,
} from "@/generated/prisma/enums";

export type VoiceControlStatus =
  | "unavailable"
  | "permission-needed"
  | "recording"
  | "processing"
  | "ready"
  | "failed"
  | "saved";

export type VoiceTurnStatus = "draft" | "processing" | "saved" | "failed";

export type VoiceTurnView = {
  id: string;
  phase: InterviewPhase;
  speaker: VoiceSpeaker;
  transcript: string;
  status?: VoiceTurnStatus;
  durationMs?: number | null;
  createdAt?: string | Date | null;
  audioUrl?: string | null;
};
