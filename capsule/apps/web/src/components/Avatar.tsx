const GRADIENTS = [
  "avatar-gradient-1", "avatar-gradient-2", "avatar-gradient-3",
  "avatar-gradient-4", "avatar-gradient-5", "avatar-gradient-6",
];

function pickGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

export default function Avatar({ name, id, size = "md", online }: {
  name?: string; id?: string; size?: "xs" | "sm" | "md" | "lg"; online?: boolean | null;
}) {
  const sizes = { xs: "w-6 h-6 text-[10px]", sm: "w-8 h-8 text-xs", md: "w-9 h-9 text-sm", lg: "w-12 h-12 text-base" };
  const dotSizes = { xs: "w-2 h-2", sm: "w-2.5 h-2.5", md: "w-3 h-3", lg: "w-3.5 h-3.5" };
  const letter = name?.charAt(0)?.toUpperCase() || "?";
  const grad = pickGradient(id || name || "x");

  return (
    <div className="relative shrink-0">
      <div className={`${sizes[size]} ${grad} rounded-full flex items-center justify-center text-white font-bold select-none`}>
        {letter}
      </div>
      {online != null && (
        <div className={`absolute -bottom-0.5 -right-0.5 ${dotSizes[size]} rounded-full border-2 ${online ? "bg-green-500" : "bg-gray-400"}`}
          style={{ borderColor: "var(--bg-primary)" }} />
      )}
    </div>
  );
}
