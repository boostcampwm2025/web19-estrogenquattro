interface StatCardProps {
  title: string;
  value: string | number;
  onClick?: () => void;
  isSelected?: boolean;
}

export default function StatCard({
  title,
  value,
  onClick,
  isSelected = false,
}: StatCardProps) {
  const isClickable = !!onClick;

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-none border-2 p-1 transition-all ${
        isClickable
          ? "cursor-pointer hover:border-amber-600 hover:bg-amber-100"
          : ""
      } ${
        isSelected
          ? "border-amber-600 bg-amber-100"
          : "border-amber-800/20 bg-amber-50"
      }`}
      onClick={onClick}
    >
      <h3 className="mb-1 text-xs font-bold">{title}</h3>
      <p className="text-sm text-amber-700">{value}</p>
    </div>
  );
}
