-- espera: BD-02
-- La clave de una tabla común es su id, y nada más.
alter table comunidad.prueba_charla drop constraint prueba_charla_pkey;
alter table comunidad.prueba_charla add primary key (id, tema);
