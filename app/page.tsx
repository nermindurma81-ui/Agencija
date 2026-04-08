import { getAgents } from '@/lib/github';
import Dashboard from '@/components/Dashboard';

export default async function Home() {
  let agentsByDept = null;
  let error = null;

  try {
    agentsByDept = await getAgents();
  } catch (err) {
    console.error('Failed to load agents:', err);
    error = err;
  }

  if (error || !agentsByDept) {
    return (
      <main className="min-h-screen bg-[#050505] flex items-center justify-center text-red-500">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Ups! Nešto je pošlo po zlu.</h1>
          <p>Greška pri učitavanju agenata. Pokušajte osvježiti stranicu.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505]">
      <Dashboard agentsByDept={agentsByDept} />
    </main>
  );
}
