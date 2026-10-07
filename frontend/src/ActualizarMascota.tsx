import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { DatosAnimal } from './DetalleMascota';
import type { DatosMascota } from './DetalleMascota';
import AnadirMascotaBasica from './AnadirMascotaBasica';
import { consultarJson } from './api';
import { fechaLocalHoy } from './fechas';

export default function ActualizarMascota({ mascota, dueno, onCambio, onVolver }: {
  mascota: DatosMascota;
  dueno: { id: number; nombre: string | null; email: string };
  onCambio: (mascota: DatosMascota) => void;
  onVolver: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState('');
  const [fecha, setFecha] = useState(fechaLocalHoy);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titulo.current?.focus(); }, [editando]);
  async function guardarReporte(event: FormEvent) {
    event.preventDefault(); setError(''); setMensaje('');
    if (fecha > fechaLocalHoy()) { setError('La fecha del reporte no puede ser posterior a hoy.'); return; }
    setOcupado(true);
    try {
      const reporte: DatosMascota['reportes'][number] = await consultarJson(`/api/admin/duenos/${dueno.id}/mascotas/${mascota.id}/reportes`, {
        method: 'POST', body: JSON.stringify({ texto, fecha }),
      });
      const reportes = [...mascota.reportes, reporte].sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? '') || b.id - a.id);
      onCambio({ ...mascota, reportes });
      setTexto(''); setFecha(fechaLocalHoy()); setMensaje('Reporte guardado.');
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo guardar el reporte'); }
    finally { setOcupado(false); }
  }
  return <div>
    <button className="secondary admin-back" disabled={ocupado} onClick={onVolver}>Volver a mascota seleccionada</button>
    <h2 ref={titulo} tabIndex={-1}>Actualización y reportes</h2>
    {mensaje && <p className="success" role="status">{mensaje}</p>}
    {editando ? <AnadirMascotaBasica mascota={mascota} dueno={dueno} onCancelar={() => setEditando(false)} onGuardado={datos => {
      onCambio({ ...mascota, ...datos, fecha: datos.fecha ?? null });
      setEditando(false); setMensaje('Datos de la mascota actualizados.');
    }} /> : <section aria-labelledby="datos-animal-reporte">
      <div className="section-header"><h2 id="datos-animal-reporte">Datos del animal</h2><button disabled={ocupado} onClick={() => { setEditando(true); setMensaje(''); }}>Editar</button></div>
      <DatosAnimal mascota={mascota} />
    </section>}
    <section aria-labelledby="nuevo-reporte">
      <h2 id="nuevo-reporte">Nuevo reporte</h2>
      {error && <p className="error" role="alert">{error}</p>}
      <form onSubmit={guardarReporte}><fieldset disabled={ocupado || editando} className="mascota-form">
        <label>Reporte<textarea required rows={8} maxLength={10000} value={texto} onChange={e => setTexto(e.target.value)} /></label>
        <label>Fecha del reporte<input required type="date" min="0001-01-01" max={fechaLocalHoy()} value={fecha} onChange={e => setFecha(e.target.value)} /></label>
        <div className="actions dueno-form-actions"><button type="submit">{ocupado ? 'Guardando…' : 'Guardar reporte'}</button><button type="button" className="cancelar-dueno" onClick={onVolver}>Cancelar</button></div>
      </fieldset></form>
    </section>
  </div>;
}
