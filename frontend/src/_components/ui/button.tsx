import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
}

export function Button({ className = "", children, ...props }: ButtonProps) {
  return (
    <button className={className} {...props}>
      {children}
    </button>
  );
}
