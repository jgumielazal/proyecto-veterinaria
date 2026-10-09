import { useEffect, useRef, useState } from 'react';
import Veterinarios from './Veterinarios';
import AnadirDueno from './AnadirDueno';
import type { DatosDueno } from './AnadirDueno';
import ListadoDuenos from './ListadoDuenos';
import ListadoVeterinarios from './ListadoVeterinarios';

const secciones = [
  { nombre: 'Veterinarios', descripcion: 'Elegí una opción para gestionar veterinarios.' },
  { nombre: 'Dueños', descripcion: 'Sección de dueños de mascotas.' },
  { nombre: 'Administración', descripcion: 'Sección de administración general.' },
] as const;
type Seccion = typeof secciones[number]['nombre'];

export default function Administracion({ tipo }: { tipo: 'admin' | 'veterinario' }) {
  const esAdmin = tipo === 'admin';
  const seccionesVisibles = secciones.filter(item => esAdmin || item.nombre === 'Dueños');
  const [seccion, setSeccion] = useState<Seccion | null>(null);
  const [opcionVeterinarios, setOpcionVeterinarios] = useState<'Añadir veterinario' | 'Listado de veterinarios' | null>(null);
  const [opcionDuenos, setOpcionDuenos] = useState<'Añadir dueño' | 'Listado de dueños' | null>(null);
  const [mascotaSeleccionada, setMascotaSeleccionada] = useState(false);
  const [duenoSeleccionado, setDuenoSeleccionado] = useState(false);
  const [duenoCreado, setDuenoCreado] = useState<DatosDueno | null>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const primeraVista = useRef(true);

  useEffect(() => {
    if (primeraVista.current) primeraVista.current = false;
    else titulo.current?.focus();
  }, [seccion, opcionVeterinarios, opcionDuenos, mascotaSeleccionada]);

  return <main>
    {seccion && <div className="actions admin-back"><button className="secondary" onClick={() => {
      if (opcionVeterinarios) setOpcionVeterinarios(null);
      else if (opcionDuenos) { setOpcionDuenos(null); setDuenoCreado(null); setDuenoSeleccionado(false); setMascotaSeleccionada(false); }
      else setSeccion(null);
    }}>← {opcionVeterinarios ? 'Volver a Veterinarios' : opcionDuenos ? 'Volver a Dueños' : 'Volver al menú principal'}</button>
      {(opcionVeterinarios || opcionDuenos) && <button type="button" className="secondary" onClick={() => {
        setOpcionVeterinarios(null);
        setOpcionDuenos(null);
        setDuenoCreado(null);
        setDuenoSeleccionado(false); setMascotaSeleccionada(false);
        setSeccion(null);
      }}>Ir al menú principal</button>}
    </div>}
    <header>
      <p>{esAdmin ? 'Panel de administrador' : 'Panel de veterinario'}</p>
      <h1 ref={titulo} tabIndex={-1}>{mascotaSeleccionada ? <strong>Mascota seleccionada</strong> : duenoSeleccionado ? <strong>Dueño seleccionado</strong> : opcionVeterinarios ?? opcionDuenos ?? seccion ?? 'Menú principal'}</h1>
      <p>{opcionVeterinarios ? 'Veterinarios' : opcionDuenos ? 'Dueños' : seccion ? secciones.find(item => item.nombre === seccion)?.descripcion : 'Elegí una sección para continuar.'}</p>
    </header>
    {seccion === null ? <nav className="admin-menu" aria-label="Menú principal">
      {seccionesVisibles.map(item => <button key={item.nombre} className="admin-card" onClick={() => setSeccion(item.nombre)}>
        <span className="admin-card-title">{item.nombre}</span>
        <span className="admin-card-description">{item.descripcion}</span>
        <span className="admin-card-link">Ingresar →</span>
      </button>)}
    </nav> : seccion === 'Veterinarios' && esAdmin ? (
      opcionVeterinarios === null ? <nav className="admin-menu" aria-label="Opciones de veterinarios">
        <button className="admin-card" onClick={() => setOpcionVeterinarios('Añadir veterinario')}>
          <span className="admin-card-title">Añadir veterinario</span>
          <span className="admin-card-description">Creá una cuenta para un veterinario.</span>
          <span className="admin-card-link">Ingresar →</span>
        </button>
        <button className="admin-card" onClick={() => setOpcionVeterinarios('Listado de veterinarios')}>
          <span className="admin-card-title">Listado de veterinarios</span>
          <span className="admin-card-description">Consultá los profesionales registrados y accedé a sus perfiles.</span>
          <span className="admin-card-link">Ingresar →</span>
        </button>
      </nav> : opcionVeterinarios === 'Añadir veterinario' ? <Veterinarios /> : <ListadoVeterinarios />
    ) : seccion === 'Dueños' ? (
      opcionDuenos === null ? <nav className="admin-menu" aria-label="Opciones de dueños">
        {(['Añadir dueño', 'Listado de dueños'] as const).map(opcion => <button key={opcion} className="admin-card" onClick={() => { setDuenoCreado(null); setOpcionDuenos(opcion); }}>
          <span className="admin-card-title">{opcion}</span>
          <span className="admin-card-description">{opcion === 'Añadir dueño' ? 'Registrá una cuenta de dueño.' : 'Consultá los clientes y filtrá por DNI.'}</span>
          <span className="admin-card-link">Ingresar →</span>
        </button>)}
      </nav> : opcionDuenos === 'Añadir dueño' ? <AnadirDueno onCancelar={() => setOpcionDuenos(null)} onGuardado={creado => {
        setDuenoCreado(creado);
        setDuenoSeleccionado(true);
        setOpcionDuenos('Listado de dueños');
      }} /> : <ListadoDuenos duenoInicial={duenoCreado ?? undefined} onSeleccion={setDuenoSeleccionado} onMascota={setMascotaSeleccionada} />
    ) : esAdmin ? <section>
      <h2>Administración general</h2>
      <p>Las funciones de esta sección todavía no están disponibles.</p>
    </section> : null}
  </main>;
}
