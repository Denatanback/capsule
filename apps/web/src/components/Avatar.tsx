const GRADS = ["avatar-gradient-1", "avatar-gradient-2", "avatar-gradient-3", "avatar-gradient-4"];

export default function Avatar({ name, id, avatarUrl, size = "md", className = "" }: {
  name?: string; id?: string; avatarUrl?: string | null; size?: "xs" | "sm" | "md" | "lg"; className?: string;
}) {
  const dims = { xs: "w-5 h-5 text-[8px]", sm: "w-8 h-8 text-[10px]", md: "w-10 h-10 text-sm", lg: "w-16 h-16 text-xl" };
  const radii = { xs: "rounded-lg", sm: "rounded-xl", md: "rounded-xl", lg: "rounded-2xl" };
  const grad = GRADS[(id?.charCodeAt(0) || 0) % GRADS.length];
  const letter = name?.charAt(0)?.toUpperCase() || "?";

  if (avatarUrl) {
    return (
      <img src={avatarUrl} alt={name || ""}
        className={`${dims[size]} ${radii[size]} object-cover shrink-0 ${className}`} />
    );
  }

  return (
    <div className={`${dims[size]} ${radii[size]} ${grad} flex items-center justify-center text-white font-bold shrink-0 ${className}`}>
      {letter}
    </div>
  );
}
