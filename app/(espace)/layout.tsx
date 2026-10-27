import { Garde } from "@/components/garde";
import { Navigation } from "@/components/navigation";

export default function LayoutEspace({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Navigation />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <Garde>{children}</Garde>
      </main>
    </div>
  );
}
