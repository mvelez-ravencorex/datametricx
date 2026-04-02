# DataMetricX

**Plataforma SaaS de Analítica Unificada para E-commerce y Performance Marketing**

DataMetricX es una solución completa de Business Intelligence que unifica datos de múltiples fuentes (Meta Ads, TikTok Ads, Google Ads, Shopify, Tiendanube, MercadoLibre, Amazon) en dashboards de alto rendimiento con capacidades de IA y recomendaciones inteligentes.

---

## 🚀 Estado del Proyecto

**Versión**: 0.1.0 (Foundation Phase)
**Stack**: React + Firebase (Firestore + Cloud Functions) + Hostinger
**Estado**: 📝 Arquitectura completada, listo para implementación

---

## ✨ Características Principales

- **Dashboard Unificado**: visualiza métricas de ventas y marketing en un solo lugar
- **Multi-Platform**: integración con 7+ plataformas (ads + e-commerce)
- **Real-time Updates**: sincronización automática de datos
- **AI-Powered Insights**: recomendaciones inteligentes y detección de anomalías
- **Multi-tenant**: arquitectura escalable para múltiples empresas
- **Export & Alerts**: reportes automáticos y alertas configurables
- **Responsive**: funciona en desktop, tablet y mobile

---

## 🏗️ Arquitectura

```
┌─────────────────┐
│   HOSTINGER     │ ← React SPA (Frontend estático)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    FIREBASE     │
│  - Auth         │ ← Autenticación de usuarios
│  - Firestore    │ ← Base de datos NoSQL multi-tenant
│  - Functions    │ ← Serverless backend (Node.js)
│  - Storage      │ ← Almacenamiento de archivos
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   EXTERNAL APIS                     │
│  - Meta Ads, TikTok Ads, Google Ads │
│  - Shopify, Tiendanube, ML, Amazon  │
└─────────────────────────────────────┘
```

Para detalles completos, ver [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 📚 Documentación

### Documentación Técnica

| Documento | Descripción |
|-----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Arquitectura del sistema completo |
| [SETUP.md](./docs/SETUP.md) | Guía de configuración inicial del entorno |
| [DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) | Esquema de base de datos Firestore |
| [FRONTEND.md](./docs/FRONTEND.md) | Especificación del frontend (React) |
| [BACKEND.md](./docs/BACKEND.md) | Especificación del backend (Cloud Functions) |
| [INTEGRATIONS.md](./docs/INTEGRATIONS.md) | Guía de integraciones con APIs externas |
| [SECURITY.md](./docs/SECURITY.md) | Guidelines de seguridad |
| [DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Guía de despliegue a producción |

### Diseño y Producto

| Documento | Descripción |
|-----------|-------------|
| [UI_DESIGN.md](./docs/UI_DESIGN.md) | Especificaciones de diseño UI/UX |
| [ROADMAP.md](./docs/ROADMAP.md) | Hoja de ruta del producto |

---

## 🛠️ Stack Tecnológico

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS 3
- **Charts**: Recharts
- **State**: React Context + Custom Hooks
- **Forms**: React Hook Form + Zod
- **Routing**: React Router v6

### Backend
- **Platform**: Firebase
- **Functions**: Cloud Functions (Node.js 18+)
- **Database**: Firestore (NoSQL)
- **Auth**: Firebase Authentication
- **Storage**: Firebase Storage
- **Secrets**: Google Secret Manager

### Infrastructure
- **Frontend Hosting**: Hostinger (archivos estáticos)
- **Backend**: Firebase (serverless)
- **CDN**: Hostinger CDN + Firebase Hosting (opcional)
- **CI/CD**: GitHub Actions

---

## 🚦 Quick Start

### Requisitos Previos

- Node.js 18+
- npm 9+
- Firebase CLI (`npm install -g firebase-tools`)
- Cuenta de Firebase
- Cuenta de Hostinger (para deploy)

### Instalación

```bash
# 1. Clonar repositorio
git clone https://github.com/tu-org/datametricx.git
cd datametricx

# 2. Configurar Firebase
firebase login
firebase init

# 3. Instalar dependencias del frontend
cd frontend
npm install

# 4. Instalar dependencias de functions
cd ../functions
npm install

# 5. Configurar variables de entorno
cp frontend/.env.example frontend/.env.local
# Editar .env.local con tus credenciales de Firebase

# 6. Iniciar desarrollo
cd ../frontend
npm run dev
```

Para instrucciones detalladas, ver [SETUP.md](./docs/SETUP.md)

---

## 📖 Guías de Uso

### Desarrollo

```bash
# Frontend (React)
cd frontend
npm run dev          # Iniciar dev server
npm run build        # Build para producción
npm run preview      # Preview del build local

# Backend (Functions)
cd functions
npm run build        # Compilar TypeScript
npm run serve        # Servir functions localmente
npm run deploy       # Deploy a Firebase

# Firebase Emulators (recomendado para desarrollo)
firebase emulators:start
```

### Testing

```bash
# Frontend
cd frontend
npm run test         # Unit tests
npm run test:e2e     # E2E tests (si configurado)

# Backend
cd functions
npm run test         # Unit tests
```

### Deploy

```bash
# Deploy completo (Functions + Firestore rules + Frontend)
# Ver guía completa en DEPLOYMENT.md

# Backend
firebase deploy

# Frontend
cd frontend
npm run build
# Subir dist/ a Hostinger via FTP/SFTP
```

---

## 🎨 Diseño

DataMetricX sigue un sistema de diseño profesional con:

- **Paleta de colores**: Azul profundo tech (#0A2E50) + azul acento (#3B82F6)
- **Tipografía**: Sora (headings) + Inter (body)
- **Componentes**: KPI Cards, Charts interactivos, Tablas responsivas
- **Layout**: Grid responsive con breakpoints mobile/tablet/desktop

Ver especificaciones completas en [UI_DESIGN.md](./docs/UI_DESIGN.md)

---

## 🔐 Seguridad

DataMetricX implementa múltiples capas de seguridad:

- ✅ Firebase Auth con password requirements
- ✅ Firestore Security Rules (multi-tenant isolation)
- ✅ Secrets en Google Secret Manager (no en código)
- ✅ HTTPS everywhere (SSL/TLS en Hostinger)
- ✅ Input validation (Zod) frontend + backend
- ✅ Rate limiting en Cloud Functions
- ✅ CORS configurado correctamente
- ✅ Logging y auditoría completa

Ver guía completa en [SECURITY.md](./docs/SECURITY.md)

---

## 🗺️ Roadmap

### Fase 1: MVP Core (Semanas 1-6)
- [x] Arquitectura y documentación
- [ ] Autenticación (Login/Signup)
- [ ] Dashboard base con KPIs y gráficos
- [ ] Primera integración (Shopify)
- [ ] Deploy inicial

### Fase 2: Más Integraciones (Semanas 7-10)
- [ ] Meta Ads integration
- [ ] Google Ads integration
- [ ] TikTok Ads integration
- [ ] Página de Marketing Analytics

### Fase 3: E-commerce Completo (Semanas 11-14)
- [ ] Tiendanube, MercadoLibre, Amazon
- [ ] Página de Sales Analytics
- [ ] Sales Forecast con ML

Ver roadmap completo en [ROADMAP.md](./docs/ROADMAP.md)

---

## 🤝 Contribuir

Este proyecto sigue el modelo de desarrollo [Gitflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow).

```bash
# Crear branch para nueva feature
git checkout -b feature/nombre-de-feature

# Hacer commits
git commit -m "feat: descripción del cambio"

# Push y crear Pull Request
git push origin feature/nombre-de-feature
```

### Commit Messages Convention

Seguimos [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` nueva funcionalidad
- `fix:` corrección de bug
- `docs:` cambios en documentación
- `style:` formateo, missing semicolons, etc.
- `refactor:` refactorización de código
- `test:` agregar tests
- `chore:` actualización de dependencias, etc.

---

## 📞 Soporte

- **Documentación**: Ver carpeta `/docs`
- **Issues**: [GitHub Issues](https://github.com/tu-org/datametricx/issues)
- **Email**: soporte@datametricx.com

---

## 📄 Licencia

Copyright © 2025 DataMetricX. Todos los derechos reservados.

Este proyecto es privado y propietario. No está permitido copiar, modificar o distribuir sin autorización expresa.

---

## 👥 Equipo

**Arquitecto & Lead Developer**: [Tu Nombre]

---

## 🙏 Agradecimientos

- Firebase por la plataforma serverless
- Vercel (Recharts) por los gráficos
- Tailwind Labs por el framework CSS
- Anthropic Claude por asistencia en arquitectura

---

**Última actualización**: 2025-11-18
**Versión de documentación**: 1.0
