import { useEffect, useRef, useState } from 'react';
import { consultarJson, consultarListado } from './api';

type Dueno = { id: number; nombre: string | null; dni: string; email: string };
type DetalleDueno = Dueno & { mascotas: { id: number; nombre: string; especie: string; edad: number }[] };
export function filtrarDuenos(duenos: Dueno[], dni: string) {
  return duenos.filter(dueno => dueno.dni.includes(dni.trim()));
}

export default function ListadoDuenos() {
  const [duenos, setDuenos] = useState<Dueno[]>([]);
  const [detalle, setDetalle] = useState<DetalleDueno | null>(null);
  const [abriendo, setAbriendo] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titulo.current?.focus(); }, [detalle]);
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
    try { setDetalle(await consultarJson(`/api/admin/duenos/${id}`)); }
    catch (error) { setError(error instanceof Error ? error.message : 'No se pudo cargar el detalle'); }
    finally { setAbriendo(false); }
  }
  if (detalle) return <div>
    <button className="secondary admin-back" onClick={() => setDetalle(null)}>Volver al listado de dueños</button>
    <section aria-labelledby="detalle-dueno">
      <h2 id="detalle-dueno" ref={titulo} tabIndex={-1}>Datos del dueño</h2>
      <dl className="veterinario-perfil">
        <dt>Nombre y apellido</dt><dd>{detalle.nombre?.trim() || '-'}</dd>
        <dt>DNI</dt><dd>{detalle.dni}</dd>
        <dt>Email</dt><dd>{detalle.email}</dd>
      </dl>
    </section>
    <section aria-labelledby="mascotas-dueno">
      <h2 id="mascotas-dueno">Mascotas registradas</h2>
      {detalle.mascotas.length === 0 ? <p>-</p> : <div className="table-wrap"><table>
        <thead><tr><th scope="col">Nombre</th><th scope="col">Especie</th><th scope="col">Edad (años)</th></tr></thead>
        <tbody>{detalle.mascotas.map(mascota => <tr key={mascota.id}><td>{mascota.nombre}</td><td>{mascota.especie}</td><td>{mascota.edad}</td></tr>)}</tbody>
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
