-- espera: BD-05
-- Un rol que no está en la lista de la aplicación recibe acceso.
create role intruso nologin;
grant select on prueba.cosa to intruso;
