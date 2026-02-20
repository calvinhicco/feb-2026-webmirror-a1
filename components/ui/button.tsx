"use client"

import * as React from "react"
import clsx from "clsx"

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline"
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", type = "button", ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:opacity-50 disabled:pointer-events-none h-10 px-4 py-2"

    const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
      default: "bg-purple-600 text-white hover:bg-purple-700",
      outline: "border border-gray-300 bg-white text-gray-900 hover:bg-gray-50",
    }

    return (
      <button ref={ref} type={type} className={clsx(base, variants[variant], className)} {...props} />
    )
  },
)

Button.displayName = "Button"
