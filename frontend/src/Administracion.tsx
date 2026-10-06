import { useState } from 'react';
import type { FormEvent } from 'react';

export default function Administracion() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [matricula, setMatricula] = useState('');
  const [especialidad, setEspecialidad] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  async function crear(event: FormEvent) {
    event.preventDefault(); setOcupado(true); setError(''); setExito('');
    try {
      const response = await fetch('/api/admin/veterinarios', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'veterinaria' },
        body: JSON.stringify({ nombre, email, password, matricula, especialidad }),
      });
      if (response.status === 401) {
        window.dispatchEvent(new Event('sesion-vencida')); return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo crear el veterinario');
      setExito(`Veterinario ${data.email} creado. Ya puede iniciar sesión.`);
      setNombre(''); setEmail(''); setPassword(''); setMatricula(''); setEspecialidad('');
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo conectar con el servidor'); }
    finally { setOcupado(false); }
  }
  return <main className="login">
    <header><p>Administración</p><h1>Crear veterinario</h1><p>Registrá una cuenta con rol veterinario.</p></header>
    {error && <p className="error" role="alert">{error}</p>}
    {exito && <p className="success" role="status">{exito}</p>}
    <section><form onSubmit={crear}><fieldset disabled={ocupado}>
      <label>Nombre<input required maxLength={150} autoComplete="name" value={nombre} onChange={e => setNombre(e.target.value)} /></label>
      <label>Email<input type="email" required maxLength={254} autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Contraseña<input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
      <p>Usá entre 8 y 128 caracteres.</p>
      <label>Número de matrícula<input required maxLength={80} value={matricula} onChange={e => setMatricula(e.target.value)} /></label>
      <label>Especialidad<input required maxLength={150} value={especialidad} onChange={e => setEspecialidad(e.target.value)} /></label>
      <button type="submit">{ocupado ? 'Creando…' : 'Crear veterinario'}</button>
    </fieldset></form></section>
  </main>;
}
