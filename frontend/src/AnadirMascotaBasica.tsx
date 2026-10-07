import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { consultarJson } from './api';
import { fechaLocalHoy } from './fechas';

type Mascota = { id: number; nombre: string; especie: string; edad: number; fecha?: string | null };
export default function AnadirMascotaBasica({ dueno, onCancelar, onGuardado, mascota }: {
  dueno: { id: number; nombre: string | null; email: string };
  mascota?: Mascota;
  onCancelar: () => void;
  onGuardado: (mascota: Mascota) => void;
}) {
  const [form, setForm] = useState(() => ({ nombre: mascota?.nombre ?? '', especie: mascota?.especie ?? '', edad: mascota ? String(mascota.edad) : '', fecha: mascota ? mascota.fecha ?? '' : fechaLocalHoy() }));
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titulo.current?.focus(); }, []);
  async function guardar(event: FormEvent) {
    event.preventDefault(); setError('');
    if (form.edad.trim() === '') { setError('Ingresá la edad.'); return; }
    if (form.fecha > fechaLocalHoy()) { setError('La fecha de subida al sistema no puede ser posterior a hoy.'); return; }
    setOcupado(true);
    try {
      const guardada = await consultarJson(`/api/admin/duenos/${dueno.id}/mascotas${mascota ? `/${mascota.id}` : ''}`, { method: mascota ? 'PUT' : 'POST', body: JSON.stringify({ ...form, edad: Number(form.edad), fecha: mascota && !form.fecha ? null : form.fecha }) });
      onGuardado(guardada);
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo añadir la mascota'); }
    finally { setOcupado(false); }
  }
  return <section aria-labelledby="anadir-mascota-titulo">
    <h2 id="anadir-mascota-titulo" ref={titulo} tabIndex={-1}>{mascota ? 'Editar datos de la mascota' : 'Añadir mascota'}</h2>
    <p>Dueño: {dueno.nombre || dueno.email}</p>
    {error && <p className="error" role="alert">{error}</p>}
    <form onSubmit={guardar}><fieldset disabled={ocupado} className="mascota-form">
      <label>Nombre<input required maxLength={150} placeholder="-" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></label>
      <label>Especie<input required maxLength={100} placeholder="-" value={form.especie} onChange={e => setForm({ ...form, especie: e.target.value })} /></label>
      <label>Edad (años)<input required type="number" min="0" max="2147483647" step="1" value={form.edad} onChange={e => setForm({ ...form, edad: e.target.value })} /></label>
      <label>Fecha de subida al sistema<input required={!mascota} type="date" min="0001-01-01" max={fechaLocalHoy()} value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} /></label>
      <div className="actions dueno-form-actions"><button type="submit">{ocupado ? 'Guardando…' : mascota ? 'Guardar cambios' : 'Añadir mascota'}</button><button type="button" className="cancelar-dueno" onClick={onCancelar}>Cancelar</button></div>
    </fieldset></form>
  </section>;
}
