import { useEffect, useRef, useState } from 'react';
import { Camera, X } from '@phosphor-icons/react';
import { createWorker } from 'tesseract.js';
import { Button } from './Button';
import { Modal } from './Modal';

export interface CedulaScanResult {
  nombres?: string;
  apellidos?: string;
  numero_documento?: string;
  fecha_nacimiento?: string;
  sexo?: string;
}

function parseCedulaText(text: string): CedulaScanResult {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const names = normalized.match(/(?:NOMBRES?|NOMBRE)\s*[:.-]?\s*([A-ZÁÉÍÓÚÑ ]{3,}?)(?=\s+(?:APELLIDOS?|DOCUMENTO|CÉDULA|CC)\b|$)/i)?.[1]?.trim();
  const surnames = normalized.match(/(?:APELLIDOS?|APELLIDO)\s*[:.-]?\s*([A-ZÁÉÍÓÚÑ ]{3,}?)(?=\s+(?:NOMBRES?|DOCUMENTO|CÉDULA|CC)\b|$)/i)?.[1]?.trim();
  const document = normalized.match(/(?:CC|C\.C\.?|DOCUMENTO|ID)\D{0,8}(\d{6,12})/i)?.[1] ?? normalized.match(/\b\d{8,12}\b/)?.[0];
  const birthRaw = normalized.match(/\b(\d{2}[/-]\d{2}[/-]\d{4}|\d{4}[/-]\d{2}[/-]\d{2})\b/)?.[1];
  const birth = birthRaw?.match(/^\d{4}/) ? birthRaw.replaceAll('/', '-') : birthRaw?.split(/[/-]/).reverse().join('-');
  const sex = normalized.match(/\b([MF])\b/i)?.[1]?.toUpperCase();
  return { nombres: names, apellidos: surnames, numero_documento: document, fecha_nacimiento: birth, sexo: sex };
}

export function CedulaScanner({ onResult }: { onResult: (result: CedulaScanResult) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [open, setOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  const start = async () => {
    setError(''); setOpen(true);
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (videoRef.current) videoRef.current.srcObject = streamRef.current;
    } catch { setError('No se pudo acceder a la cámara. Puedes diligenciar los datos manualmente.'); }
  };

  const close = () => { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setOpen(false); };

  const scan = async () => {
    if (!videoRef.current) return;
    setProcessing(true); setError('');
    try {
      const canvas = document.createElement('canvas'); canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
      const worker = await createWorker('spa');
      const { data } = await worker.recognize(canvas);
      await worker.terminate();
      onResult(parseCedulaText(data.text)); close();
    } catch { setError('No se pudieron leer los datos. Revisa la imagen e inténtalo nuevamente.'); } finally { setProcessing(false); }
  };

  return <>
    <Button type="button" variant="secondary" onClick={() => void start()}><Camera size={18} /> Escanear cédula</Button>
    <Modal open={open} onClose={close} title="Escanear cédula">
      <div className="flex flex-col gap-4"><video ref={videoRef} autoPlay playsInline className="aspect-video w-full rounded-lg bg-black object-cover" /><p className="text-caption text-muted">Alinea la cédula, asegúrate de que tenga buena luz y captura una imagen nítida.</p>{error && <p className="rounded-lg bg-danger-50 p-3 text-caption text-danger-700">{error}</p>}<div className="flex justify-end gap-2"><Button variant="ghost" onClick={close}><X size={18} /> Cancelar</Button><Button onClick={() => void scan()} disabled={processing}>{processing ? 'Leyendo...' : 'Capturar y leer'}</Button></div></div>
    </Modal>
  </>;
}
