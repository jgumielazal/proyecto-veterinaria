import { useEffect, useRef, useState } from 'react';
import AnadirMascotaBasica from './AnadirMascotaBasica';
import ActualizarMascota from './ActualizarMascota';
import DetalleMascota from './DetalleMascota';
import type { DatosMascota } from './DetalleMascota';
import AnadirDueno from './AnadirDueno';
import { consultarJson, consultarListado } from './api';

type Dueno = { id: number; nombre: string | null; dni: string; email: string };
type DetalleDueno = Dueno & { mascotas: { id: number; nombre: string; especie: string; edad: number }[] };
export function filtrarDuenos(duenos: Dueno[], dni: string) {
  return duenos.filter(dueno => dueno.dni.includes(dni.trim()));
}

export default function ListadoDuenos({ onSeleccion, onMascota }: { onSeleccion: (seleccionado: boolean) => void; onMascota: (seleccionada: boolean) => void }) {
  const [duenos, setDuenos] = useState<Dueno[]>([]);
  const [detalle, setDetalle] = useState<DetalleDueno | null>(null);
  const [mascotaSeleccionada, setMascotaSeleccionada] = useState<DatosMascota | null>(null);
  const [actualizandoMascota, setActualizandoMascota] = useState(false);
  const [anadiendoMascota, setAnadiendoMascota] = useState(false);
  const [editando, setEditando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [abriendo, setAbriendo] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titulo.current?.focus(); }, [detalle, editando, anadiendoMascota]);
  const [dni, setDni] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  async function cargar() {
    setCargando(true); setError('');
    try { setDuenos(await consultarListado<Dueno>('/api/admin/duenos')); }
    catch (error) { setDuenos([]); setError(error instanceof Error ? error.message : 'No se pudo cargar el listado de dueños'); }
    finally { setCargando(false); }
  }
  useEffect(() => { void cargar(); }, []);
  async function abrir(id: number) {
    setAbriendo(true); setError('');
    try { setDetalle(await consultarJson(`/api/admin/duenos/${id}`)); setMensaje(''); onSeleccion(true); }
    catch (error) { setError(error instanceof Error ? error.message : 'No se pudo cargar el detalle'); }
    finally { setAbriendo(false); }
  }
  async function abrirMascota(id: number) {
    if (!detalle) return;
    setAbriendo(true); setError('');
    try {
      setMascotaSeleccionada(await consultarJson(`/api/admin/duenos/${detalle.id}/mascotas/${id}`));
      onMascota(true);
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo cargar la mascota'); }
    finally { setAbriendo(false); }
  }
  if (mascotaSeleccionada && detalle && actualizandoMascota) return <ActualizarMascota mascota={mascotaSeleccionada} dueno={detalle} onVolver={() => setActualizandoMascota(false)} onCambio={actualizada => {
    setMascotaSeleccionada(actualizada);
    setDetalle({ ...detalle, mascotas: detalle.mascotas.map(item => item.id === actualizada.id ? actualizada : item) });
  }} />;
  if (mascotaSeleccionada) return <DetalleMascota key={mascotaSeleccionada.id} mascota={mascotaSeleccionada} onActualizar={() => setActualizandoMascota(true)} onVolver={() => { setMascotaSeleccionada(null); onMascota(false); }} />;
  if (detalle && anadiendoMascota) return <AnadirMascotaBasica dueno={detalle} onCancelar={() => setAnadiendoMascota(false)} onGuardado={mascota => {
    setDetalle({ ...detalle, mascotas: [...detalle.mascotas, mascota] });
    setAnadiendoMascota(false); setMensaje('Mascota añadida al dueño seleccionado.');
  }} />;
  if (detalle) return <div>
    <button className="secondary admin-back" onClick={() => { setDetalle(null); setEditando(false); setMensaje(''); onSeleccion(false); }}>Volver al listado de dueños</button>
    {error && <p className="error" role="alert">{error}</p>}
    {mensaje && <p className="success" role="status">{mensaje}</p>}
    {editando ? <AnadirDueno key={detalle.id} dueno={detalle} onCancelar={() => setEditando(false)} onGuardado={actualizado => {
      setDetalle({ ...detalle, ...actualizado });
      setDuenos(actuales => actuales.map(item => item.id === actualizado.id ? actualizado : item));
      setEditando(false); setMensaje('Datos del dueño actualizados.');
    }} /> : <section aria-labelledby="detalle-dueno">
      <h2 id="detalle-dueno" ref={titulo} tabIndex={-1}>Datos del dueño</h2>
      <dl className="veterinario-perfil">
        <dt>Nombre y apellido</dt><dd>{detalle.nombre?.trim() || '-'}</dd>
        <dt>DNI</dt><dd>{detalle.dni}</dd>
        <dt>Email</dt><dd>{detalle.email}</dd>
      </dl>
      <button onClick={() => { setEditando(true); setMensaje(''); }}>Editar</button>
    </section>}
    <section aria-labelledby="mascotas-dueno">
      <div className="section-header"><h2 id="mascotas-dueno">Mascotas registradas</h2><button type="button" aria-label="Añadir mascota" title="Añadir mascota" disabled={editando} onClick={() => { setAnadiendoMascota(true); setMensaje(''); }}><span aria-hidden="true">+</span></button></div>
      {detalle.mascotas.length === 0 ? <p>-</p> : <div className="table-wrap"><table>
        <thead><tr><th scope="col">Nombre</th><th scope="col">Especie</th><th scope="col">Edad (años)</th><th scope="col">Acciones</th></tr></thead>
        <tbody>{detalle.mascotas.map(mascota => <tr key={mascota.id}><td>{mascota.nombre}</td><td>{mascota.especie}</td><td>{mascota.edad}</td><td><button type="button" className="secondary" disabled={abriendo || editando} onClick={() => void abrirMascota(mascota.id)} aria-label={`Ver detalle de ${mascota.nombre}`}>Detalle</button></td></tr>)}</tbody>
      </table></div>}
    </section>
  </div>;
  const visibles = filtrarDuenos(duenos, dni);
  return <section aria-label="Listado de dueños" aria-busy={cargando || abriendo}>
    <label htmlFor="buscar-dueno-dni">Buscar por DNI</label>
    <div className="duenos-search">
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
      <input id="buscar-dueno-dni" type="search" inputMode="numeric" maxLength={8} placeholder="Ingresá el DNI o parte de él" value={dni} onChange={e => setDni(e.target.value)} />
    </div>
    <div className="section-header"><h2 ref={titulo} tabIndex={-1}>Clientes / dueños</h2><button className="secondary" disabled={cargando || abriendo} onClick={() => void cargar()}>Actualizar listado</button></div>
    {error && <p className="error" role="alert">{error}</p>}
    {cargando ? <p role="status">Cargando dueños…</p> : !error && <>
      <p role="status">{visibles.length === 0 ? '-' : `${visibles.length} ${visibles.length === 1 ? 'dueño encontrado' : 'dueños encontrados'}`}</p>
      {visibles.length > 0 && <div className="table-wrap"><table>
        <thead><tr><th scope="col">Nombre</th><th scope="col">DNI</th><th scope="col">Email</th><th scope="col">Acciones</th></tr></thead>
        <tbody>{visibles.map(dueno => <tr key={dueno.id}><td>{dueno.nombre?.trim() || '-'}</td><td>{dueno.dni}</td><td>{dueno.email}</td><td><button className="secondary" disabled={abriendo} aria-label={`Ver detalle de ${dueno.nombre || dueno.email}`} onClick={() => void abrir(dueno.id)}>Detalle</button></td></tr>)}</tbody>
      </table></div>}
    </>}
  </section>;
}
