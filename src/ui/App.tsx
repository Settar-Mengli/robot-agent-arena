import { BuilderForm } from "./builder/BuilderForm";

export function App() {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <header className="border-b border-stone-800 px-6 py-8">
        <p className="text-sm tracking-[0.2em] text-stone-400 uppercase">
          Agent evaluation framework
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">AGENT ARENA</h1>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <BuilderForm />
      </main>
    </div>
  );
}
