# Usuarios y mascotas (MVP local)

La migración `migrations/003_usuarios_sesiones.sql` agrega usuarios, sesiones y el dueño de cada mascota. Ya fue aplicada a la base local. Para otra instalación, ejecutar las migraciones en orden desde la raíz:

```sh
docker compose up -d
docker compose exec -T postgres psql -U veterinaria -d veterinaria -v ON_ERROR_STOP=1 < backend/migrations/001_crear_mascotas.sql
docker compose exec -T postgres psql -U veterinaria -d veterinaria -v ON_ERROR_STOP=1 < backend/migrations/002_baja_logica_mascotas.sql
docker compose exec -T postgres psql -U veterinaria -d veterinaria -v ON_ERROR_STOP=1 < backend/migrations/003_usuarios_sesiones.sql
docker compose exec -T postgres psql -U veterinaria -d veterinaria -v ON_ERROR_STOP=1 < backend/migrations/004_tipos_usuario.sql
```

Arrancar backend con `cd backend && npm start` y frontend en otra terminal con `cd frontend && npm run dev`. Abrir http://localhost:5173. No hacen falta secretos ni dependencias nuevas para uso local.

- POST `/auth/registro` y `/auth/login`: JSON `{ "email": "persona@example.com", "password": "contraseña de al menos 8 caracteres" }`. El registro también inicia sesión.
- GET `/auth/me`: usuario actual.
- POST `/auth/logout`: revoca la sesión.
- Las escrituras requieren el encabezado `X-Requested-With: veterinaria`; el frontend lo envía automáticamente. Desde el frontend las rutas llevan `/api` por el proxy de Vite.
- Cookies HttpOnly y SameSite=Strict; sesiones en PostgreSQL que vencen a los 7 días. Contraseñas con scrypt y sal aleatoria. Registro y login no tienen límite de intentos ni período de espera.
- Todas las operaciones de mascotas requieren sesión. El dueño lo determina el backend, nunca el cuerpo enviado por el cliente.
- Las mascotas anteriores se conservan sin dueño y no son accesibles por las cuentas nuevas. No se asignan automáticamente.

Con los tres servicios activos, ejecutar desde la raíz `node backend/tests/auth.cjs`. La prueba usa dos cuentas temporales, comprueba aislamiento y limpia únicamente sus propios datos. No automatiza la interfaz visual.

Esto está configurado para desarrollo local. Para publicarlo se necesita HTTPS, `NODE_ENV=production` (activa la cookie Secure), y un proxy que sirva `/api` hacia el backend; el proxy de Vite es de desarrollo.

## Tipos de usuario

La migración `004_tipos_usuario.sql` agrega `usuarios.tipo`, obligatorio y limitado a
`cliente` (dueño de la mascota), `veterinario` o `admin`. Las cuentas existentes
y los registros públicos nuevos quedan como `cliente` (dueño). El registro público
asigna ese tipo explícitamente en el servidor, ignorando cualquier `tipo`, `rol`
o `role` enviado en la solicitud. La pantalla informa que la cuenta es para dueños
y no ofrece selección de roles. El DAO permite indicar
un tipo al crear cuentas desde código interno; el registro público sigue recibiendo
solo email y contraseña y no permite elegir el tipo. Para reclasificar una cuenta
existente se actualiza `usuarios.tipo` directamente en la base de datos.

Esta clasificación no modifica permisos: todos los tipos conservan acceso solo
a sus propias mascotas. Las respuestas de autenticación incluyen `id`, `email` y `tipo`.
El administrador ve un menú principal con Veterinarios, Dueños y Administración al iniciar sesión. Dentro de Veterinarios están Crear veterinario y Listado de veterinarios; el listado incluye activos e inactivos y permite abrir el perfil de solo lectura, editar sus datos o darlo de baja lógica. El botón Ir al menú principal sigue disponible; las otras dos secciones indican que sus funciones aún no están disponibles.


## Alta de veterinarios por administradores

La migración `005_datos_veterinarios.sql` agrega nombre y matrícula a los usuarios.
La migración `006_especialidad_veterinarios.sql` agrega especialidad.
Aplicar ambas antes de usar esta función. Los campos son opcionales en las cuentas
anteriores; el alta de veterinarios exige nombre, email, contraseña, matrícula y
especialidad, sin valores vacíos.

POST `/admin/veterinarios` recibe `{ "nombre": "Ana Pérez", "email": "ana@example.com", "password": "contraseña segura", "matricula": "MP-123", "especialidad": "Clínica general" }`.
Requiere sesión de administrador y el encabezado de escritura habitual. El servidor
consulta el rol vigente en la base y fija `veterinario` al crear la cuenta; no inicia
una sesión a nombre del veterinario ni cambia la sesión del administrador.
Devuelve 201 al crear, 400 por datos inválidos, 409 por email duplicado,
401 sin sesión y 403 si el usuario no es administrador.
La matrícula se guarda como texto (hasta 80 caracteres), sin imponer unicidad
porque puede depender de la jurisdicción. Las contraseñas se guardan con scrypt.

Prueba de integración: desde backend, `node --require tsx/cjs tests/admin.cjs`.
Usa un servidor temporal y limpia únicamente las cuentas creadas por la prueba.

## Gestión de veterinarios

Requiere aplicar `007_estado_usuarios.sql` mediante el ejecutor de migraciones.

- GET `/admin/veterinarios`: lista profesionales activos e inactivos.
- GET `/admin/veterinarios/:id`: perfil con nombre, email, matrícula, especialidad y activo.
- PUT `/admin/veterinarios/:id`: modifica nombre, email, matrícula y especialidad; conserva contraseña, rol y estado.
- DELETE `/admin/veterinarios/:id`: establece `activo = false`, sin eliminar el usuario. Repetir la baja es seguro.

Todas las rutas requieren sesión de administrador; las escrituras requieren el encabezado habitual. Devuelven 404 si no existe un veterinario con ese identificador. Los usuarios inactivos no pueden iniciar sesión y sus sesiones existentes dejan de autenticar. No se exponen hashes de contraseñas.

## DNI de usuarios

La migración `008_dni_usuarios.sql` agrega `dni` como texto obligatorio, único y de exactamente ocho dígitos ASCII. Conserva ceros iniciales. El índice único permite búsquedas por DNI; el listado de dueños incluye un filtro por DNI completo o parcial.

Asigna DNI ficticios `11111111`, `22222222`, etc. por posición en `ORDER BY id`, sin usar el valor del ID como número de orden. Si hay más de nueve usuarios, detiene la migración sin cambios para evitar valores inválidos o repetidos; se debe definir otra secuencia para ese caso.

El registro público y el alta/edición de veterinarios requieren `dni` como cadena de ocho dígitos sin puntos ni espacios. Un DNI inválido devuelve 400 y un duplicado devuelve 409. El login sigue usando email y contraseña. Las bajas lógicas conservan su DNI reservado.

Prueba de migración: `node --require tsx/cjs tests/dni.cjs` desde backend; utiliza tablas temporales y revierte todo al terminar.

## Alta de dueños desde administración

POST `/admin/duenos` requiere sesión de admin y recibe `nombre` (nombre y apellido obligatorios, hasta 150 caracteres), `dni` y `email`. Siempre crea un cliente, no establece cookies ni inicia sesión como el dueño. Guarda el hash de un secreto aleatorio descartado para conservar el esquema existente sin asignar una contraseña conocida. Estos dueños no tienen acceso por contraseña hasta implementar un flujo para definirla. El registro público conserva su contraseña obligatoria.

GET `/admin/duenos` devuelve únicamente `id`, `nombre`, `dni` y `email` de usuarios de tipo cliente, con acceso exclusivo de administrador. En Dueños → Listado de dueños, la tabla filtra por DNI completo o parcial. Los nombres no registrados y los resultados vacíos se muestran con `-`.

GET `/admin/duenos/:id` muestra los datos del dueño y sus mascotas activas. Es exclusivo de administradores, filtra por el ID del dueño y no cambia la sesión. El botón Detalle del listado abre esta vista de lectura; conserva el acceso al menú principal y permite volver al listado.
