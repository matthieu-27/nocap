// Reddit-style hot ranking: score grows the rank logarithmically, age decays
// it linearly. The constants are the two knobs — /12 means a 12-hour-old post
// needs ~10x the score of a fresh post to keep pace; revisit at demo time.
export function hotRank(score: number, createdAt: Date, now: Date): number {
  const ageHours = (now.getTime() - createdAt.getTime()) / 36e5;
  return Math.log10(Math.max(score + 1, 1)) - ageHours / 12;
}
