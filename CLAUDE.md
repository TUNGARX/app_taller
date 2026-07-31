# Contexto del Proyecto: Sistema de Gestión de Taller Automotriz ("Automotivo")

Este proyecto es una plataforma digital personalizada para automatizar el flujo de trabajo de un taller mecánico pequeño en Costa Rica (3 usuarios internos).

## 🛠️ Comandos del Proyecto
- Instalar dependencias: `npm install`
- Correr en desarrollo: `npm run dev`
- Compilar para producción: `npm run build`
- Ejecutar formateo/linter: `npm run lint`

## 🏗️ Arquitectura Técnica y Estructura
- **Framework:** Next.js (App Router exclusivo bajo `src/app/`).
- **Rutas:** Estructurado con Grupos de Rutas (`(dashboard)`, `(portal)`), `layout.tsx`, `page.tsx` y Route Handlers en `src/app/api/*/route.ts`. No existe directorio `pages/`.
- **Base de Datos:** SQLite (`better-sqlite3`) como base de datos real y definitiva — no un mock temporal. Toda la data de negocio vive en `src/lib/db/negocio.ts` (clientes, vehículos, citas, órdenes, cotizaciones) y las cuentas de usuario en `src/lib/db/users.ts`, ambas en el mismo archivo `data/taller.db`. Se descartó la integración con Google Sheets/Drive como base de datos (Sheets carece de transacciones, integridad relacional, y es editable a mano — riesgo de corrupción). El Dueño puede descargar un respaldo CSV/ZIP desde `/staff`, y existe un script (`scripts/restaurar-respaldo.ts`) para restaurarlo en caso de corrupción. Google Drive queda como posible integración futura solo para almacenar fotos de evidencia (actualmente guardadas como `data:` URLs en base64 directo en SQLite).
- **Autenticación:** Sistema "in-code" directo en la base de datos local.
- **Seguridad (Passwords):** Uso exclusivo de `bcryptjs` (pure-JS) mediante `bcrypt.hashSync()` y `bcrypt.compareSync()` centralizado en `src/lib/db/users.ts`.
- **Idiomas:** Toda la interfaz de usuario (UI) debe estar obligatoriamente en **Español**.

## 👥 Roles del Sistema
1. **Jefe de taller (Dueño):** Control global, reportes y finanzas.
2. **Administración (Secretaria):** Citas, cotizaciones, pagos y clientes desde PC.
3. **Mecánico:** Optimizado para móvil. Ve órdenes, mueve Kanban, añade notas. **No ve precios**, no aprueba cotizaciones.
4. **Clientes (Externo):** Consulta anónima ingresando únicamente el número de placa.

## 📋 Reglas de Negocio Clave (Para Revisiones de Código)
- **Documento Único Evolutivo:** Un mismo registro nace como "Orden N°" y al ser aprobado/pagado evoluciona a "Factura N°" manteniendo el mismo número.
- **Totales:** Deben desglosar obligatoriamente el 13% de IVA (Subtotal, IVA, Total) y separar "Total mano de obra" de "Total repuestos".
- **Historial por Placa:** El historial de reparaciones se amarra a la **Placa del Vehículo**, no al dueño. Si el carro cambia de dueño, se edita el propietario del vehículo, pero el historial no se borra ni se separa.
- **Reaperturas:** Si un auto regresa por garantía, **nunca** se regresa la tarjeta en el Kanban. Se crea una orden nueva marcada como "Garantía" o "Reparación" y se enlaza a la orden anterior.
- **Flujo Kanban Real:** `Ingresado` ➔ `En Revisión` ➔ `En Cotización` ➔ `Esperando Repuestos` ➔ `En Reparación` ➔ `Terminado` ➔ `En Pruebas` ➔ `Entregado`.

## ⚠️ Restricciones de Seguridad e Integraciones
- **Citas:** Las alertas van solo a Google Calendar (No WhatsApp).
- **Notificaciones Kanban:** Los cambios de estado clave (como `Entregado`) disparan alertas por la API de WhatsApp Business.
