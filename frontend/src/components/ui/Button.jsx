export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}) {
  const baseStyles =
    "relative inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group";
  const variants = {
    primary: "bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 text-white hover:brightness-110 shadow-lg hover:shadow-xl shadow-purple-200/50",
    secondary:
      "bg-white text-black border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50 shadow-sm",
    outline: "bg-transparent text-black border border-neutral-200 hover:bg-black/5",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  };
  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {variant === "primary" && (
        <span className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-100%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(100%)]">
          <span className="relative h-full w-8 bg-white/10" />
        </span>
      )}
      <span className="relative flex items-center gap-2">{children}</span>
    </button>
  );
}
