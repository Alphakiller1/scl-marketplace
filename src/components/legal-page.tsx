export function LegalPage({
  title,
  children,
  showPlaceholderFooter = false,
}: {
  title: string;
  children: React.ReactNode;
  showPlaceholderFooter?: boolean;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <div className="text-muted-foreground mt-6 space-y-4 text-sm leading-relaxed">
        {children}
      </div>
      {showPlaceholderFooter ? (
        <p className="text-muted-foreground mt-8 text-xs">
          Placeholder content — final legal copy to be supplied before launch.
        </p>
      ) : null}
    </div>
  );
}
