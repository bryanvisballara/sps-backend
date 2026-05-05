# SPS Export Platform

Base inicial del software para una empresa que exporta frutas y verduras desde Colombia hacia Aruba.

## Roles iniciales

- Vendedor Aruba: visita tiendas, detecta faltantes y crea pedidos.
- Bodega Aruba: alista pedidos, despacha y monitorea existencias.
- Operaciones Colombia: recibe alertas de stock bajo y planifica reposicion para exportacion.
- Gerencia: consulta indicadores operativos, comerciales y de inventario.

## Estructura del proyecto

- `apps/api`: backend en Node.js, Express, TypeScript y MongoDB.
- `apps/web`: frontend inicial en React y Vite.
- `.env.local`: variables locales compartidas para arranque.

## Colecciones previstas en MongoDB

- `products`: catalogo de frutas y verduras.
- `warehouseStocks`: inventario por bodega.
- `orders`: pedidos capturados en tienda y procesados en Aruba.
- `exportRequests`: solicitudes de reposicion hacia Colombia.

## Variables configuradas

El archivo `.env.local` ya incluye:

- URI de MongoDB Atlas.
- URL del backend en Render.
- Deploy hook de Render para futuros despliegues del backend.

## Siguientes modulos recomendados

1. Autenticacion y permisos por rol.
2. CRUD de productos y tiendas.
3. Captura y seguimiento de pedidos.
4. Reglas de stock minimo y alertas automaticas.
5. Dashboard gerencial con indicadores.
