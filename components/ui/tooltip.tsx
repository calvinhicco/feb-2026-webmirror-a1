"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

export const TooltipProvider = ({
  children,
  delayDuration = 300,
}: {
  children: React.ReactNode
  delayDuration?: number
}) => {
  return <TooltipPrimitive.Provider delayDuration={delayDuration}>{children}</TooltipPrimitive.Provider>
}
