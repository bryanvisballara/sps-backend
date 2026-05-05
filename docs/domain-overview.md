# Domain Overview

## Flujo operativo

1. El vendedor en Aruba visita una tienda.
2. Registra faltantes y crea un pedido.
3. La bodega de Aruba recibe el pedido y lo prepara.
4. El sistema actualiza stock disponible y stock reservado.
5. Si el stock cae por debajo del minimo, se genera una alerta.
6. Operaciones en Colombia revisa la necesidad de exportacion.
7. Gerencia supervisa el ciclo completo.

## Entidades base

### Product

- SKU
- nombre
- categoria
- unidad
- nivel minimo de reposicion
- estado activo

### WarehouseStock

- producto
- bodega
- unidades disponibles
- unidades reservadas
- minimo
- estado de inventario

### Order

- tienda
- vendedor
- zona de entrega
- estado del pedido
- items

### ExportRequest

- producto
- unidades requeridas
- estado de la solicitud
- rol que solicita

## Roles y permisos esperados

- `sales-rep-aruba`: crear pedidos y consultar tiendas.
- `warehouse-aruba`: gestionar picking, despacho e inventario local.
- `colombia-ops`: gestionar reposicion y exportaciones.
- `management`: visualizar indicadores y reportes.
