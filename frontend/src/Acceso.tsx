import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Administracion from './Administracion';
import Dueno from './Dueno';

type Usuario = { id: number; email: string; tipo: 'cliente' | 'veterinario' | 'admin' };
export default function Acceso() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [iniciando, setIniciando] = useState(true);
  const [activando, setActivando] = useState(false);
  const [repetirPassword, setRepetirPassword] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    const vencida = () => { setUsuario(null); setPassword(''); setError('La sesión venció. Iniciá sesión nuevamente.'); };
    window.addEventListener('sesion-vencida', vencida);
    fetch('/api/auth/me').then(async response => {
      if (response.ok) setUsuario(await response.json());
      else if (response.status !== 401) setError('No se pudo verificar la sesión. Revisá que el backend esté funcionando.');
    }).catch(() => setError('No se pudo conectar con el backend.')).finally(() => setIniciando(false));
    return () => window.removeEventListener('sesion-vencida', vencida);
  }, []);

  async function enviar(event: FormEvent) {
    event.preventDefault(); setOcupado(true); setError('');
    try {
      if (activando && password !== repetirPassword) throw new Error('Las contraseñas no coinciden.');
      const response = await fetch(`/api/auth/${activando ? 'activar' : 'login'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'veterinaria' },
        body: JSON.stringify({ email, password, ...(activando ? { repetirPassword } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo ingresar');
      if (data.pendiente) { setEmail(data.email); setActivando(true); setPassword(''); setRepetirPassword(''); return; }
      setUsuario(data); setPassword(''); setRepetirPassword(''); setActivando(false);
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo ingresar'); }
    finally { setOcupado(false); }
  }
  async function salir() {
    setOcupado(true); setError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', headers: { 'X-Requested-With': 'veterinaria' } });
      if (!response.ok) throw new Error('No se pudo cerrar sesión. Intentá nuevamente.');
      setUsuario(null); setPassword(''); setRepetirPassword(''); setActivando(false);
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo cerrar sesión'); }
    finally { setOcupado(false); }
  }
  if (iniciando) return <main><p role="status">Verificando sesión…</p></main>;
  if (usuario) return <><div className="session-bar"><span>{usuario.email}</span><button disabled={ocupado} onClick={() => void salir()}>Cerrar sesión</button>{error && <p role="alert">{error}</p>}</div>{usuario.tipo === 'cliente' ? <Dueno key={usuario.id} /> : <Administracion key={usuario.id} tipo={usuario.tipo} />}</>;
  return <main className="login"><header><p>Veterinaria</p><h1>{activando ? 'Creá tu contraseña' : 'Iniciar sesión'}</h1><p>{activando ? 'Es tu primer ingreso. Elegí tu contraseña y repetila para confirmar.' : 'Ingresá para consultar tu cuenta.'}</p></header>
    {error && <p className="error" role="alert">{error}</p>}
    <section><form onSubmit={enviar}><fieldset disabled={ocupado}>
      <label>Email<input type="email" readOnly={activando} autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Contraseña<input type="password" autoComplete={activando ? 'new-password' : 'current-password'} required={activando} minLength={activando ? 8 : undefined} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></label>
      {activando && <label>Repetir contraseña<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={repetirPassword} onChange={e => setRepetirPassword(e.target.value)} /></label>}
      <p>{activando ? 'Usá entre 8 y 128 caracteres.' : 'Si es tu primer ingreso, podés dejar la contraseña vacía.'}</p>
      <div className="actions"><button type="submit">{ocupado ? 'Procesando…' : activando ? 'Guardar contraseña e ingresar' : 'Ingresar'}</button>
      {activando && <button type="button" className="secondary" onClick={() => { setActivando(false); setError(''); setPassword(''); setRepetirPassword(''); }}>Volver al inicio de sesión</button>}</div>
    </fieldset></form></section>
  </main>;
}
