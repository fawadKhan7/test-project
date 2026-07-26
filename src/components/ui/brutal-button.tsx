"use client";

/**
 * BrutalButton — from 21st.dev (@radiumcoders/brutal-button).
 * Kept faithful to the original API. Local additions: cursor-pointer,
 * explicit disabled styling, and a default type="button" so it can't
 * accidentally submit a form.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface BrutalButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  color?: string;
  textColor?: string;
  hasBorder?: boolean;
  borderColor?: string;
  hasShadow?: boolean;
  shadowColor?: string;
  radius?: number;
}

export const BrutalButton = React.forwardRef<
  HTMLButtonElement,
  BrutalButtonProps
>(
  (
    {
      className,
      color,
      textColor,
      hasBorder = true,
      borderColor,
      hasShadow = true,
      shadowColor,
      radius = 0,
      children,
      style,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const customStyles = {
      "--btn-bg": color || "var(--background)",
      "--btn-text": textColor || "var(--foreground)",
      "--btn-border": hasBorder ? borderColor || "var(--foreground)" : "transparent",
      "--btn-shadow": shadowColor || "var(--foreground)",
      "--btn-radius": `${radius}px`,
      ...style,
    } as React.CSSProperties;

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex cursor-pointer items-center justify-center gap-2 px-6 py-3 font-bold transition-all duration-200 ease-in-out",
          "min-h-[48px]",
          hasBorder ? "border-2" : "border-0",
          hasShadow
            ? "shadow-[4px_4px_0px_var(--btn-shadow)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_var(--btn-shadow)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
            : "active:scale-95",
          "disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none",
          className,
        )}
        style={{
          backgroundColor: "var(--btn-bg)",
          color: "var(--btn-text)",
          borderColor: "var(--btn-border)",
          borderRadius: "var(--btn-radius)",
          ...customStyles,
        }}
        {...props}
      >
        {children}
      </button>
    );
  },
);

BrutalButton.displayName = "BrutalButton";

export default BrutalButton;
