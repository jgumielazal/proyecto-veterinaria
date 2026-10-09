-- Primera etapa: preparar el esquema sin cambiar el acceso existente.
-- Los hashes actuales no permiten identificar el origen de la contraseña.
ALTER TABLE usuarios
  ADD COLUMN estado_activacion TEXT NOT NULL DEFAULT 'activada',
  ALTER COLUMN password_hash DROP NOT NULL,
  ADD CONSTRAINT usuarios_estado_activacion_check
    CHECK (estado_activacion IN ('pendiente', 'activada')),
  ADD CONSTRAINT usuarios_activacion_password_check CHECK (
    (estado_activacion = 'pendiente' AND password_hash IS NULL)
    OR (estado_activacion = 'activada' AND password_hash IS NOT NULL AND btrim(password_hash) <> '')
  );
