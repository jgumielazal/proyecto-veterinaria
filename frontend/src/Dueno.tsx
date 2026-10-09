import { useEffect, useState } from 'react';
import { consultarJson } from './api';
import DetalleMascota from './DetalleMascota';
import type { DatosMascota } from './DetalleMascota';

type Perfil = { nombre: string | null; dni: string; email: string; mascotas: { id: number; nombre: string; especie: string; edad: number }[] };
export default function Dueno() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [mascota, setMascota] = useState<DatosMascota | null>(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    consultarJson('/api/dueno').then(setPerfil).catch(error => setError(error.message));
  }, []);
  async function verMascota(id: number) {
    setOcupado(true); setError('');
    try { setMascota(await consultarJson(`/api/dueno/mascotas/${id}`)); }
    catch (error) { setError(error instanceof Error ? error.message : 'No se pudo cargar la mascota.'); }
    finally { setOcupado(false); }
  }
  return <main>
    <header><p>Veterinaria</p><h1>Mi cuenta</h1><p>Consultá tus datos, mascotas y reportes.</p></header>
    {error && <p className="error" role="alert">{error}</p>}
    {mascota ? <DetalleMascota mascota={mascota} onVolver={() => setMascota(null)} /> : !perfil ? (error ? null : <p role="status">Cargando tus datos…</p>) : <>
      <section><h2>Mis datos</h2><dl className="veterinario-perfil"><dt>Nombre y apellido</dt><dd>{perfil.nombre || '-'}</dd><dt>DNI</dt><dd>{perfil.dni}</dd><dt>Email</dt><dd>{perfil.email}</dd></dl></section>
      <section><h2>Mis mascotas</h2>{perfil.mascotas.length === 0 ? <p>No hay mascotas para mostrar.</p> : <div className="table-wrap"><table>
        <thead><tr><th>Nombre</th><th>Especie</th><th>Edad (años)</th><th>Detalle</th></tr></thead>
        <tbody>{perfil.mascotas.map(item => <tr key={item.id}><td>{item.nombre}</td><td>{item.especie}</td><td>{item.edad}</td><td><button className="secondary" disabled={ocupado} onClick={() => void verMascota(item.id)} aria-label={`Ver ${item.nombre}`}>Ver</button></td></tr>)}</tbody>
      </table></div>}</section>
    </>}
  </main>;
}
