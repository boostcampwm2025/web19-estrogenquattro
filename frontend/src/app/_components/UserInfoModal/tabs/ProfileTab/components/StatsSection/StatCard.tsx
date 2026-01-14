interface StatCardProps {
  title: string;
  value: string | number;
}

export default function StatCard({ title, value }: StatCardProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-none border-2 border-amber-800/20 bg-amber-50 p-1">
      <h3 className="mb-1 text-xs font-bold">{title}</h3>
      <p className="text-sm text-amber-700">{value}</p>
    </div>
  );
}
