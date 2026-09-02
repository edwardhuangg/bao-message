import type { Profile } from "@/lib/supabase/types";

const SIZES = {
  sm: "h-7 w-7 text-xs",
  md: "h-11 w-11 text-base",
  lg: "h-24 w-24 text-4xl",
} as const;

export function Avatar({
  profile,
  size = "md",
}: {
  profile: Pick<Profile, "display_name" | "avatar_color" | "avatar_emoji">;
  size?: keyof typeof SIZES;
}) {
  return (
    <span
      aria-hidden
      className={`${SIZES[size]} flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-bao-ink/80`}
      style={{ backgroundColor: profile.avatar_color }}
    >
      {profile.avatar_emoji || profile.display_name.charAt(0).toUpperCase()}
    </span>
  );
}
