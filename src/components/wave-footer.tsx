import Image from 'next/image';

export default function WaveFooter() {
  return (
    <footer className="relative w-full h-48 mt-auto">
      <Image
        src="/wave.gif"
        alt="Wave animation"
        fill
        className="object-cover object-center"
        priority
        unoptimized
      />
    </footer>
  );
}
