import { useCallback, useEffect, useRef, useState } from 'react';
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

function cleanName(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[^A-ZÁÉÍÓÚÑa-záéíóúñ ]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.length >= 2 ? cleaned : undefined;
}

function cleanDocNum(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 6 ? digits : undefined;
}

function normalizeDate(raw: string): string | undefined {
  if (!raw) return undefined;
  const dmy = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const ymd = raw.match(/^(\d{4})[/-](\d{2})[/-](\d{2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  return undefined;
}

function parseCedulaText(text: string): CedulaScanResult {
  const normalized = text.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();

  const SEP = '\\s*[:\\-=.]?\\s*';
  const BOUND = '(?=\\s+(?:APELLIDOS?|NOMBRES?|DOCUMENTO|CEDULA|CÉDULA|C\\.?C\\.?|FECHA|SEXO|LUGAR|DE|EDAD|NO\\.?|N°)\\b|$)';

  const names = normalized
    .match(new RegExp(`(?:NOMBRES?|NOMBRE)${SEP}([A-ZÁÉÍÓÚÑa-záéíóúñ ]{2,}?)${BOUND}`, 'i'))?.[1]
    ?? normalized
    .match(new RegExp(`(?:NOMBRES?|NOMBRE)${SEP}\\n?\\s*([A-ZÁÉÍÓÚÑa-záéíóúñ ]{2,}?)${BOUND}`, 'i'))?.[1];

  const surnames = normalized
    .match(new RegExp(`(?:APELLIDOS?|APELLIDO)${SEP}([A-ZÁÉÍÓÚÑa-záéíóúñ ]{2,}?)${BOUND}`, 'i'))?.[1]
    ?? normalized
    .match(new RegExp(`(?:APELLIDOS?|APELLIDO)${SEP}\\n?\\s*([A-ZÁÉÍÓÚÑa-záéíóúñ ]{2,}?)${BOUND}`, 'i'))?.[1];

  const docMatch = normalized.match(/(?:CC|C\.C\.?|CEDULA|CÉDULA|DOCUMENTO|ID|NO\.?|N°\.?)\s*[:\-=.]?\s*(\d[\d.-]{5,14}\d)/i)
    ?? normalized.match(/\b(\d[\d.-]{5,14}\d)\b/);
  const document = cleanDocNum(docMatch?.[1]);

  const birthRaw = normalized.match(/(?:FECHA\s+DE\s+NACIMIENTO|NACIMIENTO|FNAC|FN)\s*[:\-=.]?\s*(\d{2}[/-]\d{2}[/-]\d{4}|\d{4}[/-]\d{2}[/-]\d{2})/i)?.[1]
    ?? normalized.match(/\b(\d{2}[/-]\d{2}[/-]\d{4}|\d{4}[/-]\d{2}[/-]\d{2})\b/)?.[1];
  const birth = normalizeDate(birthRaw ?? '');

  const sex = normalized.match(/(?:SEXO|SEX| genero|género)\s*[:\-=.]?\s*([MF])/i)?.[1]?.toUpperCase()
    ?? normalized.match(/\b([MF])\b/i)?.[1]?.toUpperCase();

  return {
    nombres: cleanName(names),
    apellidos: cleanName(surnames),
    numero_documento: document,
    fecha_nacimiento: birth,
    sexo: sex,
  };
}

export function CedulaScanner({ onResult }: { onResult: (result: CedulaScanResult) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [open, setOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  const close = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setVideoReady(false);
    setOpen(false);
  }, []);

  const start = async () => {
    setError(''); setVideoReady(false); setOpen(true);
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.onloadedmetadata = () => setVideoReady(true);
      }
    } catch { setError('No se pudo acceder a la cámara. Puedes diligenciar los datos manualmente.'); }
  };

  const scan = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || !v.videoHeight) return;
    setProcessing(true); setError('');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      canvas.getContext('2d')?.drawImage(v, 0, 0);
      const worker = await createWorker('spa');
      const { data } = await worker.recognize(canvas);
      await worker.terminate();
      const result = parseCedulaText(data.text);
      onResult(result);
      close();
    } catch { setError('No se pudieron leer los datos. Revisa la imagen e inténtalo nuevamente.'); } finally { setProcessing(false); }
  };

  return <>
    <Button type="button" variant="secondary" onClick={() => void start()}><Camera size={18} /> Escanear cédula</Button>
    <Modal open={open} onClose={close} title="Escanear cédula">
      <div className="flex flex-col gap-4">
        <video ref={videoRef} autoPlay playsInline className="aspect-video w-full rounded-lg bg-black object-cover" />
        <p className="text-caption text-muted">Alinea la cédula, asegúrate de que tenga buena luz y captura una imagen nítida.</p>
        {error && <p className="rounded-lg bg-danger-50 p-3 text-caption text-danger-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close}><X size={18} /> Cancelar</Button>
          <Button onClick={() => void scan()} disabled={processing || !videoReady}>{processing ? 'Leyendo...' : 'Capturar y leer'}</Button>
        </div>
      </div>
    </Modal>
  </>;
}
