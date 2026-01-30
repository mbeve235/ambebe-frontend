"use client";

import { useMemo } from "react";
import { useBranding } from "@/components/branding-provider";
import { resolveAssetUrl } from "@/lib/format";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  size?: number;
};

export function BrandLogo({ className, size = 40 }: BrandLogoProps) {
  const branding = useBranding();
  const logoUrl = useMemo(() => resolveAssetUrl(branding.data?.logoUrl ?? ""), [branding.data?.logoUrl]);

  if (!logoUrl) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-white shadow-glow",
          className
        )}
        style={{ width: size, height: size }}
      >
        AM
      </div>
    );
  }

  return (
    <div
      className={cn("flex items-center justify-center overflow-hidden rounded-2xl bg-surface/80", className)}
      style={{ width: size, height: size }}
    >
      <img src={logoUrl} alt="AMBEBE" className="h-full w-full object-contain" />
    </div>
  );
}

