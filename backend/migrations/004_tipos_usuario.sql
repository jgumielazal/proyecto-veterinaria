ALTER TABLE usuarios
  ADD COLUMN tipo TEXT NOT NULL DEFAULT 'cliente'
  CONSTRAINT usuarios_tipo_check CHECK (tipo IN ('cliente', 'veterinario', 'admin'));
