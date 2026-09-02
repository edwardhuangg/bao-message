import { BaoLogo } from "@/components/BaoLogo";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <BaoLogo size={120} />
      <h1 className="text-3xl font-bold">Hello Bao</h1>
      <p className="max-w-xs text-bao-mute">
        A cozy little chat for friends. Fresh out of the steamer — the app is
        coming soon.
      </p>
    </main>
  );
}
