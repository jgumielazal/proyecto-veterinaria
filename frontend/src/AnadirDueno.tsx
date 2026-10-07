import { useState } from 'react';
import type { FormEvent } from 'react';
import { consultarJson } from './api';

export type DatosDueno = { id: number; nombre: string | null; dni: string; email: string };
export default function AnadirDueno({ onCancelar, dueno, onGuardado }: {
  onCancelar: () => void;
  dueno?: DatosDueno;
  onGuardado?: (actualizado: DatosDueno) => void;
}) {
  const [nombre, setNombre] = useState(dueno?.nombre ?? '');
  const [dni, setDni] = useState(dueno?.dni ?? '');
  const [email, setEmail] = useState(dueno?.email ?? '');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  async function crear(event: FormEvent) {
    event.preventDefault(); setOcupado(true); setError(''); setExito('');
    try {
      const usuario = await consultarJson(dueno ? `/api/admin/duenos/${dueno.id}` : '/api/admin/duenos', {
        method: dueno ? 'PUT' : 'POST', body: JSON.stringify({ nombre, dni, email }),
      });
      if (dueno) { onGuardado?.(usuario); return; }
      setExito(`Dueño ${usuario.email} añadido.`);
      setNombre(''); setDni(''); setEmail('');
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudieron guardar los datos del dueño'); }
    finally { setOcupado(false); }
  }
  return <section className="veterinarios-form" aria-label={dueno ? "Editar dueño" : "Añadir dueño"}>
    <p>{dueno ? 'Editá los datos del dueño.' : 'Registrá una cuenta con rol cliente / dueño.'}</p>
    {error && <p className="error" role="alert">{error}</p>}
    {exito && <p className="success" role="status">{exito}</p>}
    <form onSubmit={crear}><fieldset disabled={ocupado}>
      <label>Nombre y apellido<input required maxLength={150} autoComplete="name" value={nombre} onChange={e => setNombre(e.target.value)} /></label>
      <label>DNI<input required inputMode="numeric" pattern="[0-9]{8}" minLength={8} maxLength={8} title="Exactamente 8 dígitos, sin puntos" value={dni} onChange={e => setDni(e.target.value)} /></label>
      <label>Email<input type="email" required maxLength={254} autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} /></label>
      <div className="actions dueno-form-actions">
        <button type="submit">{ocupado ? 'Guardando…' : dueno ? 'Guardar cambios' : 'Añadir dueño'}</button>
        <button type="button" className="cancelar-dueno" onClick={onCancelar}>Cancelar</button>
      </div>
    </fieldset></form>
  </section>;
}
