interface InlineAlertProps {
  message?: string | null;
}

export function InlineAlert({ message }: InlineAlertProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="border-retro-border-darkest bg-retro-border-light text-retro-delete-hover shadow-retro-sm mb-3 rounded-none border-2 px-3 py-2 text-xs"
    >
      {message}
    </div>
  );
}
