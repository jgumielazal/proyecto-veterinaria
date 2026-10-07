import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Mascotas from './App';
import Administracion from './Administracion';

type Usuario = { id: number; email: string; tipo: 'cliente' | 'veterinario' | 'admin' };
export default function Acceso() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [iniciando, setIniciando] = useState(true);
  const [registro, setRegistro] = useState(false);
  const [dni, setDni] = useState('');
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
      const response = await fetch(`/api/auth/${registro ? 'registro' : 'login'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'veterinaria' },
        body: JSON.stringify({ email, password, ...(registro ? { dni } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo ingresar');
      setUsuario(data); setPassword('');
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo ingresar'); }
    finally { setOcupado(false); }
  }
  async function salir() {
    setOcupado(true); setError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', headers: { 'X-Requested-With': 'veterinaria' } });
      if (!response.ok) throw new Error('No se pudo cerrar sesión. Intentá nuevamente.');
      setUsuario(null); setPassword(''); setRegistro(false);
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo cerrar sesión'); }
    finally { setOcupado(false); }
  }
  if (iniciando) return <main><p role="status">Verificando sesión…</p></main>;
  if (usuario) return <><div className="session-bar"><span>{usuario.email}</span><button disabled={ocupado} onClick={() => void salir()}>Cerrar sesión</button>{error && <p role="alert">{error}</p>}</div>{usuario.tipo === 'admin' ? <Administracion key={usuario.id} /> : <Mascotas key={usuario.id} />}</>;
  return <main className="login"><header><p>Veterinaria</p><h1>{registro ? 'Crear cuenta de dueño' : 'Iniciar sesión'}</h1><p>{registro ? 'El registro es exclusivo para dueños de mascotas. Tu cuenta se crea automáticamente con ese rol.' : 'Ingresá para administrar tus mascotas.'}</p></header>
    {error && <p className="error" role="alert">{error}</p>}
    <section><form onSubmit={enviar}><fieldset disabled={ocupado}>
      {registro && <label>DNI<input required inputMode="numeric" pattern="[0-9]{8}" minLength={8} maxLength={8} title="Exactamente 8 dígitos, sin puntos" value={dni} onChange={e => setDni(e.target.value)} /></label>}
      <label>Email<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Contraseña<input type="password" autoComplete={registro ? 'new-password' : 'current-password'} required minLength={8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></label>
      <p>Usá entre 8 y 128 caracteres.</p>
      <div className="actions"><button type="submit">{ocupado ? 'Procesando…' : registro ? 'Registrarme' : 'Ingresar'}</button>
      <button type="button" className="secondary" onClick={() => { setRegistro(!registro); setError(''); setPassword(''); }}>{registro ? 'Ya tengo cuenta' : 'Crear cuenta'}</button></div>
    </fieldset></form></section>
  </main>;
}
