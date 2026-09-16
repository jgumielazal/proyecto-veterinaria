import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

type Mascota = { id: number; nombre: string; especie: string; edad: number };
const vacio = { nombre: '', especie: '', edad: '' };

async function consultar(path = '', options?: RequestInit) {
  const response = await fetch(`/api/mascotas${path}`, { ...options, headers: { ...options?.headers, "X-Requested-With": "veterinaria" } });
  if (response.status === 401) window.dispatchEvent(new Event("sesion-vencida"));
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || 'No se pudo completar la operación. Verificá que el backend esté funcionando.');
  }
  return response;
}

export default function Mascotas() {
  const [mascotas, setMascotas] = useState<Mascota[]>([]);
  const [form, setForm] = useState(vacio);
  const [editando, setEditando] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const nombreInput = useRef<HTMLInputElement>(null);

  async function cargar() {
    setCargando(true);
    setError('');
    try {
      setMascotas(await (await consultar()).json());
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo cargar el listado.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { void cargar(); }, []);

  function cancelar() {
    setEditando(null);
    setForm(vacio);
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMensaje('');
    const edad = Number(form.edad);
    if (!form.nombre.trim() || !form.especie.trim() || form.edad.trim() === '' || !Number.isInteger(edad) || edad < 0 || edad > 2147483647) {
      setError('Completá nombre y especie. La edad debe ser un número entero no negativo.');
      return;
    }
    setOcupado(true);
    try {
      const response = await consultar(editando === null ? '' : `/${editando}`, {
        method: editando === null ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: form.nombre.trim(), especie: form.especie.trim(), edad }),
      });
      const mascota: Mascota = await response.json();
      setMascotas(actuales => editando === null ? [...actuales, mascota] : actuales.map(item => item.id === mascota.id ? mascota : item));
      setMensaje(editando === null ? 'Mascota agregada.' : 'Cambios guardados.');
      cancelar();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo guardar.');
    } finally {
      setOcupado(false);
    }
  }

  async function darDeBaja(mascota: Mascota) {
    if (!window.confirm(`¿Dar de baja a ${mascota.nombre}? Dejará de aparecer en el listado.`)) return;
    setOcupado(true);
    setError('');
    setMensaje('');
    try {
      await consultar(`/${mascota.id}`, { method: 'DELETE' });
      setMascotas(actuales => actuales.filter(item => item.id !== mascota.id));
      if (editando === mascota.id) cancelar();
      setMensaje('Mascota dada de baja.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo dar de baja.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <main>
      <header><p>Veterinaria</p><h1>Mascotas</h1><p>Administrá las mascotas registradas.</p></header>
      {error && <p className="error" role="alert">{error}</p>}
      {mensaje && <p className="success" role="status">{mensaje}</p>}
      <section aria-labelledby="form-title">
        <h2 id="form-title">{editando === null ? 'Agregar mascota' : 'Editar mascota'}</h2>
        <form onSubmit={guardar}>
          <fieldset disabled={ocupado || cargando}>
            <div className="fields">
              <label>Nombre<input ref={nombreInput} required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></label>
              <label>Especie<input required placeholder="Ej.: perro, gato" value={form.especie} onChange={e => setForm({ ...form, especie: e.target.value })} /></label>
              <label>Edad (años)<input required type="number" min="0" max="2147483647" step="1" value={form.edad} onChange={e => setForm({ ...form, edad: e.target.value })} /></label>
            </div>
            <div className="actions">
              <button type="submit">{ocupado ? 'Procesando…' : editando === null ? 'Agregar mascota' : 'Guardar cambios'}</button>
              {editando !== null && <button type="button" className="secondary" onClick={cancelar}>Cancelar edición</button>}
            </div>
          </fieldset>
        </form>
      </section>
      <section aria-labelledby="list-title" aria-busy={cargando}>
        <div className="section-header"><h2 id="list-title">Mascotas activas</h2><button className="secondary" disabled={ocupado || cargando} onClick={() => void cargar()}>Actualizar listado</button></div>
        {cargando ? <p role="status">Cargando mascotas…</p> : mascotas.length === 0 ? <p>No hay mascotas para mostrar.</p> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Nombre</th><th>Especie</th><th>Edad (años)</th><th>Acciones</th></tr></thead>
            <tbody>{mascotas.map(mascota => <tr key={mascota.id}>
              <td>{mascota.nombre}</td><td>{mascota.especie}</td><td>{mascota.edad}</td>
              <td><div className="actions">
                <button className="secondary" disabled={ocupado} aria-label={`Editar ${mascota.nombre}`} onClick={() => {
                  setEditando(mascota.id);
                  setForm({ nombre: mascota.nombre, especie: mascota.especie, edad: String(mascota.edad) });
                  setError(''); setMensaje(''); nombreInput.current?.focus();
                }}>Editar</button>
                <button className="danger" disabled={ocupado} aria-label={`Dar de baja a ${mascota.nombre}`} onClick={() => void darDeBaja(mascota)}>Dar de baja</button>
              </div></td>
            </tr>)}</tbody>
          </table></div>
        )}
      </section>
    </main>
  );
}
