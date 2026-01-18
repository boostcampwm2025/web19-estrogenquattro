import React from "react";

interface CheckboxProps {
  checked?: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
}

export function Checkbox({
  checked = false,
  disabled = false,
  onCheckedChange,
  className = "",
}: CheckboxProps) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      className={className}
    />
  );
}
