"use client";

import { FloatingDock } from "@/components/ui/floating-dock";
import {
  IconBrandGithub,
  IconBrandTiktok,
  IconBrandX,
  IconHeadphones,
} from "@tabler/icons-react";

const SOCIAL_LINKS = [
  {
    title: "X (Twitter)",
    icon: (
      <IconBrandX className="h-full w-full text-white/90 transition group-hover:text-white" />
    ),
    href: "https://x.com/solataproject",
  },
  {
    title: "GitHub",
    icon: (
      <IconBrandGithub className="h-full w-full text-white/90 transition group-hover:text-white" />
    ),
    href: "https://github.com/younes-bkb/ata-protocol",
  },
  {
    title: "TikTok",
    icon: (
      <IconBrandTiktok className="h-full w-full text-white/90 transition group-hover:text-white" />
    ),
    href: "#",
  },
  {
    title: "VoiceChain",
    icon: (
      <IconHeadphones className="h-full w-full text-white/90 transition group-hover:text-white" />
    ),
    href: "/voice",
  },
];

export function SocialDock() {
  return (
    <FloatingDock
      items={SOCIAL_LINKS}
      orientation="vertical"
      desktopClassName="fixed left-8 top-1/2 z-30 -translate-y-1/2 border border-white/10 bg-white/5 px-3 py-4 backdrop-blur"
      mobileClassName="!fixed left-1/2 bottom-6 z-30 !-translate-x-1/2"
    />
  );
}
