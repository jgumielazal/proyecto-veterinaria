import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { consultarJson, consultarListado } from './api';

type Veterinario = { id: number; dni: string; nombre: string; email: string; matricula: string; especialidad: string; activo: boolean };
export async function consultar(path = '', options?: RequestInit) {
  const url = `/api/admin/veterinarios${path}`;
  return path === '' && !options ? consultarListado<Veterinario>(url) : consultarJson(url, options);
}

export default function ListadoVeterinarios() {
  const [lista, setLista] = useState<Veterinario[]>([]);
  const [seleccionado, setSeleccionado] = useState<Veterinario | null>(null);
  const [form, setForm] = useState<Veterinario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titulo.current?.focus(); }, [seleccionado?.id, !!form]);
  async function cargar() {
    setCargando(true); setError('');
    try { setLista(await consultar()); }
    catch (error) { setLista([]); setError(error instanceof Error ? error.message : 'No se pudo cargar el listado'); }
    finally { setCargando(false); }
  }
  useEffect(() => { void cargar(); }, []);
  async function abrir(id: number) {
    setOcupado(true); setError(''); setMensaje('');
    try { setSeleccionado(await consultar(`/${id}`)); }
    catch (error) { setError(error instanceof Error ? error.message : 'No se pudo cargar el perfil'); }
    finally { setOcupado(false); }
  }
  async function guardar(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    await actualizar('PUT', form);
  }
  async function actualizar(method: 'PUT' | 'DELETE', vet: Veterinario) {
    setOcupado(true); setError(''); setMensaje('');
    try {
      const actualizado: Veterinario = await consultar(`/${vet.id}`, { method, ...(method === 'PUT' ? { body: JSON.stringify(form) } : {}) });
      setSeleccionado(actualizado); setForm(null);
      setLista(actuales => actuales.map(item => item.id === actualizado.id ? actualizado : item));
      setMensaje(method === 'PUT' ? 'Datos guardados.' : 'Veterinario dado de baja. Su registro se conserva.');
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo completar la operación'); }
    finally { setOcupado(false); }
  }
  return <section aria-busy={cargando || ocupado}>
    <h2 ref={titulo} tabIndex={-1}>{form ? 'Editar datos de veterinario' : seleccionado ? 'Perfil del veterinario' : 'Profesionales registrados'}</h2>
    {error && <p className={error === '-' ? undefined : 'error'} role="alert">{error}</p>}
    {mensaje && <p className="success" role="status">{mensaje}</p>}
    {form ? <form onSubmit={guardar}><fieldset disabled={ocupado} className="veterinarios-form">
      <label>Nombre<input required maxLength={150} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></label>
      <label>DNI<input required inputMode="numeric" pattern="[0-9]{8}" minLength={8} maxLength={8} title="Exactamente 8 dígitos, sin puntos" value={form.dni} onChange={e => setForm({ ...form, dni: e.target.value })} /></label>
      <label>Email<input type="email" required maxLength={254} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
      <label>Matrícula<input required maxLength={80} value={form.matricula} onChange={e => setForm({ ...form, matricula: e.target.value })} /></label>
      <label>Especialidad<input required maxLength={150} value={form.especialidad} onChange={e => setForm({ ...form, especialidad: e.target.value })} /></label>
      <div className="actions"><button type="submit">{ocupado ? 'Guardando…' : 'Guardar cambios'}</button><button type="button" className="secondary" onClick={() => { setForm(null); setError(''); }}>Cancelar</button></div>
    </fieldset></form> : seleccionado ? <>
      <dl className="veterinario-perfil">
        <dt>Nombre</dt><dd>{seleccionado.nombre || 'Sin datos'}</dd>
        <dt>DNI</dt><dd>{seleccionado.dni}</dd>
        <dt>Email</dt><dd>{seleccionado.email}</dd>
        <dt>Matrícula</dt><dd>{seleccionado.matricula || 'Sin datos'}</dd>
        <dt>Especialidad</dt><dd>{seleccionado.especialidad || 'Sin datos'}</dd>
        <dt>Estado</dt><dd>{seleccionado.activo ? 'Activo' : 'Inactivo'}</dd>
      </dl>
      <div className="actions">
        <button disabled={ocupado} onClick={() => { setForm({ ...seleccionado, nombre: seleccionado.nombre ?? '', matricula: seleccionado.matricula ?? '', especialidad: seleccionado.especialidad ?? '' }); setError(''); setMensaje(''); }}>Editar datos</button>
        <button className="danger" disabled={ocupado || !seleccionado.activo} onClick={() => {
          if (window.confirm(`¿Dar de baja a ${seleccionado.nombre || seleccionado.email}? Quedará inactivo y no podrá iniciar sesión. Sus datos se conservarán.`)) void actualizar('DELETE', seleccionado);
        }}>Dar de baja</button>
        <button className="secondary" disabled={ocupado} onClick={() => { setSeleccionado(null); setError(''); setMensaje(''); }}>Volver al listado</button>
      </div>
    </> : <>
      <button className="secondary" disabled={cargando || ocupado} onClick={() => void cargar()}>Actualizar listado</button>
      {cargando ? <p role="status">Cargando veterinarios…</p> : lista.length === 0 ? (error ? null : <p>-</p>) : <div className="table-wrap"><table>
        <thead><tr><th>Nombre</th><th>Email</th><th>Matrícula</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>{lista.map(vet => <tr key={vet.id}><td>{vet.nombre || 'Sin datos'}</td><td>{vet.email}</td><td>{vet.matricula || 'Sin datos'}</td><td>{vet.activo ? 'Activo' : 'Inactivo'}</td><td><button className="secondary" disabled={ocupado} aria-label={`Ver perfil de ${vet.nombre || vet.email}`} onClick={() => void abrir(vet.id)}>Ver perfil</button></td></tr>)}</tbody>
      </table></div>}
    </>}
  </section>;
}
