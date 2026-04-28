import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function ProfilePic({
  url,
  name,
  size = "md",
  className,
}: {
  url?: string | null;
  name?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizes = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-base", xl: "h-20 w-20 text-xl" };
  const initials = (name ?? "?").trim().slice(0, 2).toUpperCase();
  return (
    <Avatar className={cn(sizes[size], "ring-2 ring-background shadow-soft", className)}>
      {url && <AvatarImage src={url} alt={name ?? "avatar"} />}
      <AvatarFallback className="bg-gradient-primary text-primary-foreground font-semibold">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}