import express = require("express");
import pg = require("pg");
import crearAuthDao = require("./dao/auth.dao");
import authNegocio = require("./negocio/auth.negocio");
import configurarAuthRoutes = require("./routes/auth.routes");

export = function configurarAuth(app: express.Express, pool: pg.Pool) {
  const dao = crearAuthDao(pool);
  const negocio = authNegocio.crearAuthNegocio(dao);
  configurarAuthRoutes(app, negocio);
};
