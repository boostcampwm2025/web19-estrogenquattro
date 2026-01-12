export default function ProfileTab() {
  return (
    <div className="space-y-4 text-amber-900">
      <div className="h-[150px] border-2 border-amber-800/20 bg-amber-50 p-3">
        잔디 section
      </div>
      <div className="flex h-40 gap-4">
        <div className="size-40 shrink-0 border-2 border-amber-800 bg-green-700"></div>
        <div className="grid h-full flex-1 grid-cols-3 grid-rows-2 gap-2">
          <div className="flex flex-col items-center justify-center border-2 border-amber-800/20 bg-amber-50 p-1">
            <h3 className="text-lg font-bold">집중시간</h3>
          </div>
          <div className="flex flex-col items-center justify-center border-2 border-amber-800/20 bg-amber-50 p-1">
            <h3 className="text-lg font-bold">달성률</h3>
          </div>
          <div className="flex flex-col items-center justify-center border-2 border-amber-800/20 bg-amber-50 p-1">
            <h3 className="text-lg font-bold">PUSH</h3>
          </div>
          <div className="flex flex-col items-center justify-center border-2 border-amber-800/20 bg-amber-50 p-1">
            <h3 className="text-lg font-bold">ISSUE</h3>
          </div>
          <div className="flex flex-col items-center justify-center border-2 border-amber-800/20 bg-amber-50 p-1">
            <h3 className="text-lg font-bold">PR 생성</h3>
          </div>
          <div className="flex flex-col items-center justify-center border-2 border-amber-800/20 bg-amber-50 p-1">
            <h3 className="text-lg font-bold">PR 리뷰</h3>
          </div>
        </div>
      </div>
      <div className="border-2 border-amber-800/20 bg-amber-50 p-3">
        <p className="mb-1 text-sm font-bold">TASK</p>
      </div>
    </div>
  );
}
