interface LoadingProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  className?: string;
}

const sizeClasses = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-2",
  lg: "h-12 w-12 border-4",
};

export function Loading({ size = "md", text, className = "" }: LoadingProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
    >
      <div
        className={`animate-spin rounded-full border-amber-300 border-t-amber-700 ${sizeClasses[size]}`}
      />
      {text && <span className="text-sm text-amber-800">{text}</span>}
    </div>
  );
}
