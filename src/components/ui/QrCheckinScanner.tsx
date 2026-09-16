import { useEffect, useRef } from 'react';
import QrScanner from 'qr-scanner';

export function QrCheckinScanner({ onScan }: { onScan: (data: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    scannerRef.current = new QrScanner(
      videoRef.current,
      (result) => onScan(result.data.trim()),
      { highlightScanRegion: true, maxScansPerSecond: 3 },
    );
    scannerRef.current.start();
    return () => { scannerRef.current?.stop(); scannerRef.current?.destroy(); };
  }, [onScan]);

  return <video ref={videoRef} className="aspect-video w-full rounded-lg bg-black object-cover" />;
}
