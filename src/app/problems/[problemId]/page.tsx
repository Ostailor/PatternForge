import { notFound } from "next/navigation";

import { patterns } from "@/data/patterns";
import { getProblemById, problems } from "@/data/problems";
import ProblemPracticeClient from "./practice-client";

type ProblemDetailPageProps = {
  params: Promise<{ problemId: string }>;
};

export function generateStaticParams() {
  return problems.map((problem) => ({
    problemId: problem.id,
  }));
}

export default async function ProblemDetailPage({
  params,
}: ProblemDetailPageProps) {
  const { problemId } = await params;
  const problem = getProblemById(problemId);

  if (!problem) {
    notFound();
  }

  return <ProblemPracticeClient problem={problem} patterns={patterns} />;
}
