const GRADS = ["avatar-gradient-1", "avatar-gradient-2", "avatar-gradient-3", "avatar-gradient-4"];

export default function Avatar({ name, id, avatarUrl, size = "md", className = "", online }: {
  name?: string; id?: string; avatarUrl?: string | null; size?: "xs" | "sm" | "md" | "lg"; className?: string; online?: boolean | null;
}) {
  const dims = { xs: "w-5 h-5 text-[8px]", sm: "w-8 h-8 text-[10px]", md: "w-10 h-10 text-sm", lg: "w-16 h-16 text-xl" };
  const radii = { xs: "rounded-lg", sm: "rounded-xl", md: "rounded-xl", lg: "rounded-2xl" };
  const dot = { xs: "w-1.5 h-1.5", sm: "w-2.5 h-2.5", md: "w-3 h-3", lg: "w-4 h-4" };
  const grad = GRADS[(id?.charCodeAt(0) || 0) % GRADS.length];
  const letter = name?.charAt(0)?.toUpperCase() || "?";

  return (
    <div className={`relative shrink-0 ${className}`}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={name || ""}
          className={`${dims[size]} ${radii[size]} object-cover shrink-0`} />
      ) : (
        <div className={`${dims[size]} ${radii[size]} ${grad} flex items-center justify-center text-white font-bold shrink-0`}>
          {letter}
        </div>
      )}
      {online !== undefined && online !== null && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 ${dot[size]} rounded-full border-2`}
          style={{
            background: online ? 'var(--success)' : 'var(--text-muted)',
            borderColor: 'var(--bg-primary)',
          }}
        />
      )}
    </div>
  );
}
