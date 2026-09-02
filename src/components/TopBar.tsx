export function TopBar({
  left,
  center,
  right,
}: {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-bao-steam bg-bao-cream/95 px-3 backdrop-blur">
      <div className="flex min-w-11 items-center">{left}</div>
      <div className="min-w-0 flex-1">{center}</div>
      <div className="flex min-w-11 items-center justify-end">{right}</div>
    </header>
  );
}
