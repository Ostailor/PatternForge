import AuthProfileBootstrap from "./AuthProfileBootstrap";
import FeedbackWidget from "./FeedbackWidget";
import LocalProgressMigrationBanner from "./LocalProgressMigrationBanner";
import Navbar from "./Navbar";
import { getFeatureFlag } from "@/lib/feature-flags/getFeatureFlag";

type LayoutProps = {
  children: React.ReactNode;
};

export default function Layout({ children }: LayoutProps) {
  const betaFeedbackEnabled = getFeatureFlag("betaFeedback");

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-slate-950">
      <Navbar />
      <AuthProfileBootstrap />
      <LocalProgressMigrationBanner />
      <main>{children}</main>
      {betaFeedbackEnabled ? <FeedbackWidget /> : null}
    </div>
  );
}
