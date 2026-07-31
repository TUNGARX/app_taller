# Project Context: Automotive Workshop Management System

This document outlines the scope, architecture, and business model for a custom digital platform designed to automate the workflow of a small Costa Rican auto repair shop ("Automotivo").

## 👥 System Roles (Internal and External Users)
1. **Owner ("jefe de taller"):** Global business oversight, reporting, revenue tracking, and access to everything Secretary and Mechanic can see.
2. **Secretary ("administración"):** Appointment scheduling, quotation creation/approval/payment tracking, client management via PC.
3. **Mechanic:** Currently just **1 mechanic** has access (may grow later). Mobile-optimized access to: view assigned work orders, move Kanban cards, see the vehicle's full history, see the services/parts list on the current order **without prices**, add notes to the order, and see notes left by Owner/Secretary. Cannot create/approve/reject quotations or mark them paid.
4. **Workshop Clients:** Anonymous external lookup portal (no username/password required). Clients input their license plate number to view their vehicle's status and history in real-time.

## 🛠️ System Requirements (All UI Elements must be in Spanish)
- **Hybrid Platform (Web & Mobile):** Responsive design for desktops (Secretary PC) and smartphones (Mechanics and Clients).
- **Appointments Module:** Track date, time, customer, vehicle, and reason for visit. Must support scheduling an appointment for a brand-new vehicle/client in the same flow (i.e., register the client + vehicle inline while booking the Cita, rather than requiring a separate registration step first). Appointment reminders go through **Google Calendar only** — no WhatsApp/email reminder for appointments specifically (WhatsApp notifications on Kanban status changes, see below, are a separate feature and still planned).
- **Quotations / Orden / Factura Module:** One evolving document per job, not three separate ones:
  - Created → reads **"Orden N°"**.
  - Client approves it AND it's marked paid → the same document (same number) becomes **"Factura N°"**.
  - A client can also **reject** a quote. Rejection isn't necessarily final — staff can flag it for a **3-day follow-up reminder** (a checkbox at rejection time) so the shop remembers to reach back out. Not every rejection needs follow-up, it's optional per-quote.
  - Quote totals show a 13% IVA breakdown (Subtotal/IVA/Total) and split into "Total mano de obra" (labor) vs. "Total repuestos" (parts) subtotals, matching the shop's existing paper quote format.
- **Visual Kanban Board:** The shop's real intake-to-delivery flow (not a guessed one):
  `Ingresado` ➔ `En Revisión` ➔ `En Cotización` ➔ `Esperando Repuestos` ➔ `En Reparación` ➔ `Terminado` ➔ `En Pruebas` ➔ `Entregado`.
- **Reopening a finished job:** If a car comes back after being delivered because the issue wasn't resolved, the board does **not** rewind the old card — a **brand-new order** is opened for the same vehicle, classified as either "Reparación" (paid redo) or "Garantía" (warranty redo), linked back to the original order for traceability.
- **Centralized Vehicle History:** Chronological log of previous visits, diagnoses, and repairs — **keyed by license plate, not by owner**. If a car is resold, the existing vehicle record's owner is updated (ownership transfer) rather than starting a new, disconnected history under the new owner.
- **Order intake fields:** in addition to diagnosis, an order captures kilometraje (mileage), nivel de combustible (fuel level), and hora de entrada/salida (check-in/check-out time) — all shown on the printed Orden/Factura.
- **Evidence photos:** taken/uploaded by mechanics, intended to be stored in Google Drive (public preview links) once that integration exists.
- **Printed Orden/Factura header must include:** shop logo + name, order/factura number, entry/exit date+time, client name + phone, vehicle make/model/year/plate, kilometraje, fuel level, whether it's a repair or warranty job, and free-text comments/observations. (Currently the "logo" is just the shop's wordmark in text — an actual logo image file is needed from the client to replace it.)
- **WhatsApp Notifications:** Automated messages sent via WhatsApp Business Cloud API triggered by Kanban state updates (e.g., notifying the customer when the car is `Entregado`). This is separate from appointment reminders (which use Google Calendar only, see above).
- **Historical data migration:** the shop wants to import as much historical service/invoice data as possible from their previous system ("Dirup") — blocked until an actual data export from Dirup is available.

## 🏗️ Technical Architecture & Hosting
- **Initial Phase:** Local execution and testing on the developer's machine.
- **Production Phase:** Hosted on **DigitalOcean App Platform** (Managed PaaS).
- **Database & Image Storage:** Hybrid architecture connecting directly via API to the client's **Google Drive and Google Sheets** environment.
  - Data tables reside in sheets (`Clientes`, `Vehiculos`, `Citas`, `Ordenes_Trabajo`, `Cotizaciones`).
  - Evidence photos taken by mechanics are compressed on the frontend and stored in a specific Google Drive folder. File permissions are programmatically altered to generate direct public preview links inside the application (`https://googleusercontent.com`).
  - Appointment reminders sync to **Google Calendar** (separate from Sheets/Drive, needs its own API scope/credentials).

## 💰 Business Model (Monthly SaaS)
The software operates under a subscription model managed by the developer.
- **Trial:** One month free trial; cost of continuing is discussed after the trial, not before.
- **Must-have for the trial month:** PDF export of the Orden/Factura, and Google Drive linkage for file storage + photo upload. (Confirmed by the client — everything else, including the Kanban board itself, was explicitly called out as something that could wait for a later phase, though it's already built.)
- **Setup Fee:** One-time initial deployment payment.
- **Monthly Subscription:** Fixed fee covering DigitalOcean infrastructure, server maintenance, and remote technical support.
- **Lock-in Clause:** Minimum contract term of 6 months to offset initial development hours and server staging costs.
- **Intellectual Property:** Source code belongs entirely to the developer. The workshop purchases the right to use the platform as a service.
