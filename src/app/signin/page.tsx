import WelcomeCard from './welcome-card';
import WaveFooter from '@/components/wave-footer';

export default function Page() {
  return (
    <main className="flex flex-col min-h-screen">
      <div className="flex-1 flex items-center justify-center">
        <WelcomeCard />
      </div>
      <WaveFooter />
    </main>
  );
}
