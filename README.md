# Stratos IA - CRM & Dashboard

Stratos IA es un entorno avanzado en tiempo real para inteligencia analítica, escrutinio conductual de clientes, y monitoreo general para administradores de alta demanda.

## Stack Tecnológico 💻
Este proyecto está desarrollado bajo la filosofía **Vite + React (JavaScript)** apoyándose de Recharts, Lucide Icons y utilidades de renderizado custom para alcanzar puros 60 FPS en interfaces complejas.
Toda la data en vivo para el módulo del **CRM** se respalda en **Supabase**.

## Requisitos de Variables de Entorno (.env) 🔑

Para que el proyecto se ejecute de manera perfecta y obtenga datos en vivo de Supabase, debes crear un archivo llamado `.env` en la raíz de tu proyecto e introducir tus variables:

```env
# Variables críticas para la recolección en vivo del Pipeline de Leads (Módulo CRM)
VITE_SUPABASE_URL=https://[TU_URL_DE_PROYECTO].supabase.co
VITE_SUPABASE_ANON_KEY=[TU_ANON_KEY]
```

### Tabla de Base de Datos Necesaria
Las credenciales de arriba deberán apuntar a un proyecto de Supabase que contenga una base de datos con una tabla nombrada **`LEADS`** con la siguiente estructura y columnas:
- `FECHA INGRESO` (string / timestamptz)
- `ASESOR` (string)
- `NOMBRE DEL CLIENTE` (string)
- `TELEFONO` (string)
- `ESTATUS` (string - ej: 'ZOOM AGENDADO', 'SEGUIMIENTO')
- `PRESUPUESTO` (numeric)
- `PROYECTO DE INTERES` (string)
- `CAMPAÑA` (string)
- `NOTAS` (jsonb - un arreglo de objetos tipo `[{"fecha": "...", "asesor": "...", "nota": "..."}]`)

## Scripts de Desarrollo 🚀

Para correr el proyecto usa los comandos estándar de Node:
```sh
npm install
npm run dev
```
