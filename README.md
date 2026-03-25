# PuertaUCI — Control de Acceso al Campus

Sistema web para la gestión del control de acceso a la Universidad de las Ciencias Informáticas (UCI). Permite a los guardias escanear carnets de identidad, verificar la autorización de personas mediante el directorio UCI y registrar entradas/denegaciones con trazabilidad completa.

---

## Tabla de contenidos

1. [Características](#características)
2. [Arquitectura](#arquitectura)
3. [Requerimientos](#requerimientos)
4. [Instalación y configuración](#instalación-y-configuración)
5. [Migraciones de base de datos](#migraciones-de-base-de-datos)
6. [Crear usuario administrador inicial](#crear-usuario-administrador-inicial)
7. [Variables de entorno](#variables-de-entorno)
8. [Ejecución en desarrollo](#ejecución-en-desarrollo)
9. [Compilación y despliegue en producción](#compilación-y-despliegue-en-producción)
10. [Proxy para la API UCI](#proxy-para-la-api-uci)
11. [Estructura del proyecto](#estructura-del-proyecto)
12. [Roles y permisos](#roles-y-permisos)
13. [Solución de problemas](#solución-de-problemas)

---

## Características

- **Escaneo de carnets**: detección automática de 11 dígitos numéricos (escáner de código de barras o entrada manual).
- **Verificación en tiempo real**: consulta al directorio UCI (ElasticSearch) para validar si la persona está activa.
- **Fallback local**: si la API no está disponible, muestra datos de visitas anteriores almacenados localmente.
- **Registro de accesos**: cada entrada o denegación queda registrada con fecha, puerta, guardia, motivo y observaciones.
- **Gestión de motivos**: motivos predefinidos (Banco Metropolitano, Policlínico, Secretaría General, etc.) para personas no autorizadas.
- **Registro de personas desconocidas**: solicita nombre y apellidos cuando la persona no existe en ninguna fuente de datos.
- **Panel de administración**: dashboard con estadísticas, gestión de puertas, guardias, administradores, registros y logs.
- **Exportación a Excel**: exportar registros filtrados a archivos `.xlsx`.
- **Autenticación**: login con Supabase Auth, roles de admin y guardia.
- **Logs de auditoría**: todas las acciones quedan registradas para trazabilidad.

---

## Arquitectura

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  Navegador  │────▶│  Vite Dev Server │────▶│  API UCI (Elastic) │
│  (React)    │     │  (proxy /api/uci)│     │  elasticintranet    │
└──────┬──────┘     └──────────────────┘     └─────────────────────┘
       │
       │ HTTPS
       ▼
┌──────────────┐
│   Supabase   │
│  (Auth + DB) │
│  PostgreSQL  │
└──────────────┘
```

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend/Base de datos**: Supabase (PostgreSQL con Row Level Security)
- **API externa**: Directorio UCI vía ElasticSearch (intranet)

---

## Requerimientos

### Hardware mínimo

| Componente | Mínimo | Recomendado |
|---|---|---|
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4 GB |
| Almacenamiento | 1 GB libre | 5 GB libre |
| Red | Acceso a internet y a la intranet UCI | — |

> **Nota**: Estos son los requerimientos del servidor/máquina donde se ejecuta o compila la aplicación. Supabase se ejecuta en la nube.

### Software

| Software | Versión mínima | Propósito |
|---|---|---|
| **Node.js** | 18.x o superior | Entorno de ejecución |
| **npm** | 9.x o superior | Gestor de paquetes |
| **Navegador web** | Chrome 90+, Firefox 90+, Edge 90+ | Cliente |
| **Cuenta Supabase** | — | Base de datos y autenticación |

### Acceso de red

- **Supabase**: el servidor/cliente debe poder conectar a `*.supabase.co` (HTTPS, puerto 443).
- **API UCI**: el servidor debe poder conectar a `elasticintranet.uci.cu` (HTTPS, puerto 443). Solo accesible desde la intranet UCI.

---

## Instalación y configuración

### 1. Clonar el repositorio

```bash
git clone https://github.com/dioneldaf/puerta-uci.git
cd "Puerta UCI"
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto (o edita el existente):

```env
VITE_SUPABASE_URL=TU_URL_SUPABASE_AQUI
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY_AQUI
VITE_UCI_API_URL=TU_URL_API_AQUI
VITE_UCI_API_AUTH=Basic TU_AUTH_KEY_AQUI
```

---

## Migraciones de base de datos

Ejecuta las migraciones **en orden** desde el **SQL Editor** de Supabase (Dashboard → SQL Editor):

| Orden | Archivo | Descripción |
|---|---|---|
| 1 | `supabase/migrations/001_initial_schema.sql` | Tablas, índices, triggers, políticas RLS |
| 2 | `supabase/migrations/002_create_admin.sql` | Instrucciones para crear el admin inicial |
| 3 | `supabase/migrations/003_fix_rls_recursion.sql` | Funciones `SECURITY DEFINER` para evitar recursión RLS |
| 4 | `supabase/migrations/004_cuba_timezone.sql` | Zona horaria America/Havana |
| 5 | `supabase/migrations/005_remove_puerta_asignada.sql` | Eliminar columna `puerta_asignada` de usuarios |
| 6 | `supabase/migrations/006_vehiculos.sql` | Módulo de vehículos autorizados + registros de entradas/salidas |
| 7 | `supabase/migrations/007_vehiculos_chapa_opcional.sql` | Chapa opcional para moto/triciclo (`chapa o color`) |

### Pasos:

1. Abre el **SQL Editor** en el Dashboard de Supabase.
2. Copia y pega el contenido de `001_initial_schema.sql` y ejecútalo.
3. Repite para cada archivo en orden numérico (002, 003, 004, 005).

---

## Crear usuario administrador inicial

1. En el Dashboard de Supabase, ve a **Authentication → Users**.
2. Haz clic en **Add user → Create new user**.
3. Ingresa email y contraseña para el administrador. Marca **Auto Confirm User**.
4. Copia el **UUID** del usuario creado.
5. En el **SQL Editor**, ejecuta:

```sql
INSERT INTO usuarios (id, nombre, email, rol, activo)
VALUES (
  'PEGAR_UUID_AQUI',
  'Nombre del Administrador',
  'email@uci.cu',
  'admin',
  true
);
```

6. Ahora puedes iniciar sesión con ese email y contraseña.

---

## Variables de entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `VITE_SUPABASE_URL` | Sí | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Sí | Clave pública (anon) de Supabase |
| `VITE_UCI_API_URL` | Sí | Ruta de la API del directorio UCI |
| `VITE_UCI_API_AUTH` | Sí | Credenciales de autenticación para la API UCI |

---

## Ejecución en desarrollo

```bash
npm run dev
```

Esto inicia el servidor de desarrollo en `http://localhost:5173` con:
- Hot Module Replacement (HMR)
- Proxy automático para la API UCI (`/api/uci` → `elasticintranet.uci.cu`)

---

## Compilación y despliegue en producción

### Compilar

```bash
npm run build
```

Genera los archivos estáticos en la carpeta `dist/`.

### Previsualizar localmente

```bash
npm run preview
```

### Desplegar

La carpeta `dist/` contiene archivos estáticos (HTML, CSS, JS) que pueden servirse desde cualquier servidor web:

#### Opción A: Nginx

```nginx
server {
    listen 80;
    server_name puertauci.uci.cu;
    root /var/www/puertauci/dist;
    index index.html;

    # SPA: redirigir todas las rutas a index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy para la API UCI
    location /api/uci/ {
        proxy_pass https://elasticintranet.uci.cu/;
        proxy_set_header Host elasticintranet.uci.cu;
        proxy_ssl_verify off;
    }
}
```

#### Opción B: Apache

```apache
<VirtualHost *:80>
    ServerName puertauci.uci.cu
    DocumentRoot /var/www/puertauci/dist

    <Directory /var/www/puertauci/dist>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted

        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>

    # Proxy para la API UCI
    ProxyPass /api/uci/ https://elasticintranet.uci.cu/
    ProxyPassReverse /api/uci/ https://elasticintranet.uci.cu/
    SSLProxyEngine on
    SSLProxyVerify none
</VirtualHost>
```

#### Opción C: Vercel / Netlify

1. Conecta el repositorio.
2. Configura el build command: `npm run build`

---

## Despliegue con Docker

Este proyecto ya incluye:

- `Dockerfile` (multi-stage: build con Node + runtime con Nginx)
- `docker-compose.yml`
- `.dockerignore`
- `docker/nginx/default.conf` (SPA + proxy `/api/uci`)

### 1. Requisitos en el servidor

- Docker 24+
- Docker Compose plugin (`docker compose`)
- Conectividad HTTPS hacia:
    - Supabase (`*.supabase.co`)
    - `elasticintranet.uci.cu`

### 2. Variables necesarias para construir

Estas variables se inyectan en build (Vite):

```env
VITE_SUPABASE_URL=TU_URL_SUPABASE
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY
VITE_UCI_API_URL=/api/uci/sgu-directorio/_search
VITE_UCI_API_AUTH=Basic TU_TOKEN
```

### 3. Levantar con Docker Compose

```bash
docker compose build
docker compose up -d
```

La app quedará expuesta en `http://IP_DEL_SERVIDOR:8080`.

### 4. Ver logs y estado

```bash
docker compose ps
docker compose logs -f puertauci
```

### 5. Actualizar versión

```bash
git pull
docker compose build --no-cache
docker compose up -d
```

### 6. Qué información pasar al equipo de infraestructura

Comparte estos puntos:

1. **Puerto publicado**: `8080` (o el que decidan mapear).
2. **Dominio final**: por ejemplo `puertauci.uci.cu`.
3. **TLS/SSL**: si terminan HTTPS en reverse proxy externo (Nginx/Traefik).
4. **Variables de build**:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
     - `VITE_UCI_API_AUTH`
5. **Conectividad de red** a `elasticintranet.uci.cu` y Supabase.
6. **Política de restart**: actualmente `unless-stopped`.
7. **Estrategia de backups** de la BD (en Supabase).

### 7. Comando alternativo sin compose

```bash
docker build \
    --build-arg VITE_SUPABASE_URL="..." \
    --build-arg VITE_SUPABASE_ANON_KEY="..." \
    --build-arg VITE_UCI_API_URL="/api/uci/sgu-directorio/_search" \
    --build-arg VITE_UCI_API_AUTH="Basic ..." \
    -t puertauci:latest .

docker run -d --name puertauci-web -p 8080:80 --restart unless-stopped puertauci:latest
```
3. Directorio de salida: `dist`
4. Agrega las variables de entorno (`VITE_SUPABASE_URL`, etc.)

> **Importante**: en producción se necesita un proxy reverso (Nginx/Apache) o reescrituras para la API UCI, ya que el proxy de Vite solo funciona en desarrollo.

---

## Proxy para la API UCI

La API del directorio UCI (`elasticintranet.uci.cu`) solo es accesible desde la intranet y requiere un proxy para evitar problemas de CORS.

- **En desarrollo**: Vite lo maneja automáticamente (configurado en `vite.config.ts`).
- **En producción**: debe configurarse en el servidor web (ver ejemplos de Nginx/Apache arriba).

---

## Estructura del proyecto

```
Control UCI/
├── public/
│   └── logo-uci.png              # Logo de la aplicación
├── src/
│   ├── components/
│   │   ├── common/                # Button, DataTable, Modal, StatusBadge
│   │   └── Layout/                # Header, Sidebar, Layout
│   ├── contexts/
│   │   └── AuthContext.tsx        # Contexto de autenticación
│   ├── hooks/
│   │   └── useAccessControl.ts   # Lógica de búsqueda y registro de acceso
│   ├── lib/
│   │   ├── supabase.ts           # Clientes Supabase (anon, admin, signUp)
│   │   ├── uciApi.ts             # Consultas al directorio UCI
│   │   └── logger.ts             # Sistema de logs
│   ├── pages/
│   │   ├── LoginPage.tsx          # Inicio de sesión
│   │   ├── DashboardPage.tsx      # Panel resumen con estadísticas
│   │   ├── AccessControlPage.tsx  # Control de acceso (escaneo de carnets)
│   │   ├── RecordsPage.tsx        # Historial de registros
│   │   ├── GatesPage.tsx          # Gestión de puertas
│   │   ├── UserManagementPage.tsx # Gestión de guardias y admins
│   │   ├── ExportPage.tsx         # Exportación a Excel
│   │   └── LogsPage.tsx           # Logs del sistema
│   ├── types/
│   │   └── index.ts              # Tipos TypeScript
│   ├── App.tsx                    # Rutas y protección de rutas
│   ├── main.tsx                   # Punto de entrada
│   └── index.css                  # Estilos Tailwind
├── supabase/
│   └── migrations/                # Migraciones SQL
├── .env                           # Variables de entorno
├── vite.config.ts                 # Configuración de Vite + proxy
├── tailwind.config.js             # Configuración de Tailwind CSS
├── tsconfig.json                  # Configuración de TypeScript
└── package.json                   # Dependencias y scripts
```

---

## Roles y permisos

| Funcionalidad | Guardia | Administrador |
|---|:---:|:---:|
| Control de acceso (escaneo) | ✅ | ✅ |
| Ver registros de acceso | ✅ | ✅ |
| Dashboard resumen | ❌ | ✅ |
| Gestión de puertas | ❌ | ✅ |
| Gestión de guardias | ❌ | ✅ |
| Gestión de administradores | ❌ | ✅ |
| Exportar a Excel | ❌ | ✅ |
| Ver logs del sistema | ❌ | ✅ |

---

## Solución de problemas

### Error 42P17 (infinite recursion in RLS policy)

Ejecuta la migración `003_fix_rls_recursion.sql`. Este error ocurre cuando las políticas RLS de la tabla `usuarios` intentan consultar la misma tabla.

### Pantalla en blanco al cambiar de pestaña

Este problema fue corregido en el código. El `AuthContext` ignora eventos de `onAuthStateChange` cuando el perfil del usuario ya está cargado y la sesión pertenece al mismo usuario.

### El guardia creado no puede iniciar sesión

- Verifica que la `VITE_SUPABASE_SERVICE_ROLE_KEY` esté configurada en `.env`. Sin ella, se usa `signUp` normal y Supabase puede requerir confirmación de email.
- Verifica que el usuario aparezca tanto en **Authentication → Users** como en la tabla `usuarios`.

### La API UCI no responde

- Asegúrate de estar conectado a la **intranet UCI**.
- Verifica que el proxy esté configurado (en desarrollo: `vite.config.ts`; en producción: Nginx/Apache).
- El sistema seguirá funcionando con datos locales de visitas anteriores.

### Zona horaria incorrecta

Ejecuta la migración `004_cuba_timezone.sql` para establecer `America/Havana` como zona horaria por defecto en la base de datos.

---

## Tecnologías utilizadas

- [React 18](https://react.dev/) — Interfaz de usuario
- [TypeScript 5](https://www.typescriptlang.org/) — Tipado estático
- [Vite 6](https://vite.dev/) — Bundler y servidor de desarrollo
- [Tailwind CSS 3](https://tailwindcss.com/) — Estilos utilitarios
- [Supabase](https://supabase.com/) — Base de datos, autenticación y RLS
- [React Router 6](https://reactrouter.com/) — Enrutamiento SPA
- [Lucide React](https://lucide.dev/) — Iconografía
- [SheetJS (xlsx)](https://sheetjs.com/) — Exportación a Excel
- [date-fns](https://date-fns.org/) — Manejo de fechas

---

## Licencia

Uso interno — Universidad de las Ciencias Informáticas (UCI).
