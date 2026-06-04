import PageSkeleton from "@/components/PageSkeleton";

export default function VoiceTranscriptLoading() {
  return <PageSkeleton eyebrow="Voice Transcript History" title="Loading transcript" rows={5} />;
}
