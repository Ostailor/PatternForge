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
];
