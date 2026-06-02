export type AchievementDefinition = {
  key: string;
  name: string;
  description: string;
  icon: string;
  xpReward: number;
};

export const achievementDefinitions: AchievementDefinition[] = [
  {
    key: "first-forge",
    name: "First Forge",
    description: "Complete your first attempt.",
    icon: "FF",
    xpReward: 50,
  },
  {
    key: "pattern-scout",
    name: "Pattern Scout",
    description: "Correctly recognize 10 patterns.",
    icon: "PS",
    xpReward: 75,
  },
  {
    key: "mistake-forger",
    name: "Mistake Forger",
    description: "Create 10 mistake cards.",
    icon: "MF",
    xpReward: 75,
  },
  {
    key: "memory-smith",
    name: "Memory Smith",
    description: "Complete 25 reviews.",
    icon: "MS",
    xpReward: 100,
  },
  {
    key: "boss-slayer",
    name: "Boss Slayer",
    description: "Win your first Boss Battle.",
    icon: "BS",
    xpReward: 100,
  },
  {
    key: "streak-spark",
    name: "Streak Spark",
    description: "Maintain a 3-day streak.",
    icon: "SS",
    xpReward: 75,
  },
  {
    key: "sliding-window-sharp",
    name: "Sliding Window Sharp",
    description: "Reach 80% mastery in Sliding Window.",
    icon: "SW",
    xpReward: 100,
  },
  {
    key: "review-gauntlet-survivor",
    name: "Review Gauntlet Survivor",
    description: "Complete a Review Gauntlet.",
    icon: "RG",
    xpReward: 100,
  },
  {
    key: "first-mock",
    name: "First Mock",
    description: "Complete your first interview.",
    icon: "FM",
    xpReward: 100,
  },
  {
    key: "clear-communicator",
    name: "Clear Communicator",
    description: "Score 85 or higher in interview communication.",
    icon: "CC",
    xpReward: 100,
  },
  {
    key: "complexity-clean",
    name: "Complexity Clean",
    description: "Score 90 or higher in interview complexity.",
    icon: "CX",
    xpReward: 100,
  },
  {
    key: "edge-case-hunter",
    name: "Edge Case Hunter",
    description: "Score 85 or higher in interview testing.",
    icon: "EH",
    xpReward: 100,
  },
  {
    key: "interview-ready",
    name: "Interview Ready",
    description: "Score 85 or higher overall in a mock interview.",
    icon: "IR",
    xpReward: 150,
  },
  {
    key: "comeback-candidate",
    name: "Comeback Candidate",
    description: "Improve your interview score by 20 or more points.",
    icon: "CB",
    xpReward: 150,
  },
];
