"use client";

import Image from "next/image";
import { useState } from "react";

export function MemberAvatar({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (imageUrl && imageUrl !== failedUrl) {
    return <Image src={imageUrl} alt="" width={28} height={28} unoptimized
      onError={() => setFailedUrl(imageUrl)} className="h-7 w-7 shrink-0 rounded-full object-cover" />;
  }
  return <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800">{Array.from(name)[0] || "?"}</span>;
}
