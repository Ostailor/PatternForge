import { notFound } from "next/navigation";

import { patterns } from "@/data/patterns";
import { buildContrastDrill } from "@/lib/drills/contrast";
import type { ContrastDrillData } from "@/lib/drills/contrast";
import ContrastDrillClient from "./contrast-client";

type ContrastDrillPageProps = {
  params: Promise<{
    selectedPatternId: string;
    correctPatternId: string;
  }>;
  searchParams: Promise<{
    recommendationId?: string;
  }>;
};

export function generateStaticParams() {
  return patterns.flatMap((selectedPattern) =>
    patterns
      .filter((correctPattern) => correctPattern.id !== selectedPattern.id)
      .map((correctPattern) => ({
        selectedPatternId: selectedPattern.id,
        correctPatternId: correctPattern.id,
      })),
  );
}

export default async function ContrastDrillPage({
  params,
  searchParams,
}: ContrastDrillPageProps) {
  const { selectedPatternId, correctPatternId } = await params;
  const { recommendationId } = await searchParams;
  const drill = buildContrastDrill(selectedPatternId, correctPatternId);

  if (!drill) {
    notFound();
  }

  const drillData: ContrastDrillData = {
    selectedPatternId: drill.selectedPatternId,
    correctPatternId: drill.correctPatternId,
    patternA: drill.patternA,
    patternB: drill.patternB,
    whyUsersConfuseThem: drill.whyUsersConfuseThem,
    keyDifferences: drill.keyDifferences,
    cards: drill.cards,
  };

  return (
    <ContrastDrillClient
      drill={drillData}
      recommendationId={recommendationId}
    />
  );
}
