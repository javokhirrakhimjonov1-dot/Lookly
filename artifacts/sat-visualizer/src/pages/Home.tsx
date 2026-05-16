import { Visualizer } from "@/components/Visualizer";

export default function Home() {
  return (
    <div className="min-h-[100dvh] w-full bg-background selection:bg-primary/20 selection:text-primary">
      <main className="container mx-auto px-4 py-12 md:py-24">
        <Visualizer />
      </main>
    </div>
  );
}
