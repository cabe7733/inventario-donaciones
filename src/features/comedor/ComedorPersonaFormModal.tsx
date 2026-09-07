import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createComedorPerson, registerVisit, updateComedorPerson, type ComedorPerson } from '../../lib/comedorOps';
import { useAuth } from '../../components/auth/AuthProvider';
import { Field, inputWithError } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { CedulaScanner, type CedulaScanResult } from '../../components/ui/CedulaScanner';

const schema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  apellido: z.string().optional(),
  celular: z.string().optional(),
  numero_documento: z.string().optional(),
  fecha_nacimiento: z.string().optional(),
  sexo: z.string().optional(),
  fecha: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export function ComedorPersonaFormModal({ person, onClose }: { person: ComedorPerson | null; onClose: () => void }) {
  const { centerId } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string>();
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: person ? { nombre: person.nombre, apellido: person.apellido ?? '', celular: person.celular ?? '', numero_documento: person.numero_documento ?? '', fecha_nacimiento: person.fecha_nacimiento ?? '', sexo: person.sexo ?? '', fecha: '' } : { fecha_nacimiento: '', sexo: '', fecha: new Date().toISOString().slice(0, 10) },
  });

  const applyScan = (result: CedulaScanResult) => {
    if (result.nombres) setValue('nombre', result.nombres);
    if (result.apellidos) setValue('apellido', result.apellidos);
    if (result.numero_documento) setValue('numero_documento', result.numero_documento);
    if (result.fecha_nacimiento) setValue('fecha_nacimiento', result.fecha_nacimiento);
    if (result.sexo) setValue('sexo', result.sexo);
  };

  const submit = async (data: FormData) => {
    if (!centerId) throw new Error('No hay centro asignado');
    if (!person && !data.fecha) throw new Error('La fecha es obligatoria');
    if (person) {
      await updateComedorPerson(person.id, { nombre: data.nombre, apellido: data.apellido || null, celular: data.celular || null, numero_documento: data.numero_documento || null, fecha_nacimiento: data.fecha_nacimiento || null, sexo: data.sexo || null });
      if (data.fecha) await registerVisit(centerId, person.id, data.fecha);
    } else {
      const id = await createComedorPerson({ center_id: centerId, nombre: data.nombre, apellido: data.apellido || null, celular: data.celular || null, numero_documento: data.numero_documento || null, fecha_nacimiento: data.fecha_nacimiento || null, sexo: data.sexo || null });
      await registerVisit(centerId, id, data.fecha!);
    }
    await queryClient.invalidateQueries({ queryKey: ['comedor-people'] });
    onClose();
  };

  return <Modal open onClose={onClose} title={person ? 'Editar asistente' : 'Registrar asistente'}>
    <form onSubmit={handleSubmit((data) => { setError(undefined); void submit(data).catch((e) => setError(e instanceof Error ? e.message : 'Error al guardar')); })} className="flex flex-col gap-4 p-4">
      {error && <div className="rounded-lg bg-danger-50 p-3 text-caption text-danger-700">{error}</div>}
       <div className="flex justify-end"><CedulaScanner onResult={applyScan} /></div>
       <Field id="nombre" label="Nombre" required error={errors.nombre?.message}><input id="nombre" {...register('nombre')} className={inputWithError(errors.nombre)} /></Field>
      <Field id="apellido" label="Apellido" error={errors.apellido?.message}><input id="apellido" {...register('apellido')} className={inputWithError(errors.apellido)} /></Field>
       <div className="grid grid-cols-2 gap-4">
         <Field id="celular" label="Celular"><input id="celular" type="tel" {...register('celular')} className={inputWithError(errors.celular)} /></Field>
         <Field id="numero_documento" label="Documento"><input id="numero_documento" {...register('numero_documento')} className={inputWithError(errors.numero_documento)} /></Field>
         <Field id="fecha_nacimiento" label="Fecha de nacimiento"><input id="fecha_nacimiento" type="date" {...register('fecha_nacimiento')} className={inputWithError(errors.fecha_nacimiento)} /></Field>
         <Field id="sexo" label="Sexo"><select id="sexo" {...register('sexo')} className={inputWithError(errors.sexo)}><option value="">Seleccionar...</option><option value="F">Femenino</option><option value="M">Masculino</option><option value="O">Otro</option></select></Field>
       </div>
      <Field id="fecha" label={person ? 'Agregar visita (opcional)' : 'Fecha de visita'} required={!person} error={errors.fecha?.message}><input id="fecha" type="date" {...register('fecha')} className={inputWithError(errors.fecha)} /></Field>
      <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : 'Guardar'}</Button></div>
    </form>
  </Modal>;
}
