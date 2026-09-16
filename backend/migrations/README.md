# Ejecutar migraciones

Desde `backend`, después de instalar dependencias:

```sh
npm run build
npm run migrate
```

`DATABASE_URL` debe estar definida en el entorno y apuntar a la base deseada.
En Railway, referenciar la variable del servicio PostgreSQL desde el backend.
En desarrollo, definirla con la conexión a PostgreSQL local. El ejecutor no carga
archivos `.env` automáticamente ni contiene credenciales. El servidor conserva
su configuración local actual; este comando es independiente de su inicio.

El comando usa `pg` y los archivos SQL de esta carpeta en orden numérico.
Registra cada nombre en `schema_migrations` y omite los ya registrados.
Cada archivo y su registro se confirman en una misma transacción; si falla,
se revierten ambos y el comando termina con código de error. Las migraciones
anteriores que ya se confirmaron se conservan. Un bloqueo de PostgreSQL evita
que dos ejecutores apliquen migraciones simultáneamente.

Las migraciones existentes ejecutadas manualmente no tienen historial. En la
primera ejecución se procesan y registran: sus cláusulas `IF NOT EXISTS`
permiten reutilizar la base local existente sin borrar datos. Esto no verifica
que un esquema modificado manualmente coincida con los archivos SQL.

Para cambios futuros, crear un nuevo archivo numerado; no editar uno aplicado.
Escribir SQL sin control de transacciones: el ejecutor lo administra. Por
compatibilidad, también acepta la envoltura exterior `BEGIN; ... COMMIT;`
que ya utiliza la migración 003. No usar commits internos ni instrucciones
que no puedan ejecutarse en una transacción.

No requiere Docker, `psql`, `tsx` ni nuevas dependencias en tiempo de ejecución.
El despliegue debe conservar tanto `dist` como esta carpeta de migraciones.
No se ejecuta automáticamente con `npm start`.
