import GrassCard from "./GrassCard";
import StatCard from "./StatCard";

export default function StatsSection() {
  // Mock data - TODO: 서버 연동 시 selectedDate 기반으로 데이터 조회
  const stats = {
    focusTime: "02:34:12",
    achievement: "85%",
    push: "12",
    issue: "3",
    prCreated: "2",
    prReview: "5",
  };

  return (
    <div className="flex h-40 gap-4">
      <GrassCard />
      <div className="grid h-full flex-1 grid-cols-3 grid-rows-2 gap-2">
        <StatCard title="집중시간" value={stats.focusTime} />
        <StatCard title="달성률" value={stats.achievement} />
        <StatCard title="PUSH" value={stats.push} />
        <StatCard title="ISSUE" value={stats.issue} />
        <StatCard title="PR 생성" value={stats.prCreated} />
        <StatCard title="PR 리뷰" value={stats.prReview} />
      </div>
    </div>
  );
}
