# DataMetricX - Guía de Configuración Inicial

Esta guía te llevará paso a paso en la configuración del entorno de desarrollo para DataMetricX.

---

## Requisitos Previos

### Software Requerido

- **Node.js**: v18.x o superior ([descargar](https://nodejs.org/))
- **npm**: v9.x o superior (incluido con Node.js)
- **Git**: última versión
- **Editor**: VS Code (recomendado) con extensiones:
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - Firebase

### Cuentas Necesarias

1. **Google Account**: para Firebase
2. **Hostinger Account**: para deploy del frontend
3. **Cuentas de Integración** (para testing):
   - Meta Developer Account
   - Shopify Partner Account
   - Google Ads Developer Account
   - TikTok Ads Developer Account

---

## Paso 1: Clonar el Repositorio

```bash
git clone https://github.com/tu-org/datametricx.git
cd datametricx
```

---

## Paso 2: Configurar Firebase

### 2.1 Crear Proyecto en Firebase Console

1. Ir a [Firebase Console](https://console.firebase.google.com/)
2. Clic en "Agregar proyecto"
3. Nombre: `datametricx-prod` (o el que prefieras)
4. Habilitar Google Analytics (opcional pero recomendado)
5. Crear proyecto

### 2.2 Habilitar Servicios

En la consola de Firebase:

1. **Authentication**:
   - Ir a Authentication > Sign-in method
   - Habilitar "Email/Password"
   - Habilitar "Google"

2. **Firestore Database**:
   - Ir a Firestore Database
   - Clic en "Crear base de datos"
   - Seleccionar modo "Producción"
   - Elegir ubicación (recomendado: `us-central1` o más cercana a tus usuarios)

3. **Cloud Functions**:
   - Ir a Functions
   - Clic en "Comenzar" (se habilitará automáticamente al desplegar)

4. **Storage**:
   - Ir a Storage
   - Clic en "Comenzar"
   - Usar reglas de seguridad por defecto (las actualizaremos después)

### 2.3 Instalar Firebase CLI

```bash
npm install -g firebase-tools
```

Autenticarse:

```bash
firebase login
```

### 2.4 Inicializar Firebase en el Proyecto

```bash
# En la raíz del proyecto
firebase init

# Seleccionar:
# - Firestore
# - Functions
# - Storage
# - Emulators (opcional, recomendado para desarrollo)

# Configuración:
# - Project: seleccionar el que creaste (datametricx-prod)
# - Firestore rules: firestore.rules
# - Firestore indexes: firestore.indexes.json
# - Functions language: TypeScript
# - ESLint: Yes
# - Install dependencies: Yes
# - Storage rules: storage.rules
# - Emulators: Firestore, Functions, Auth (opcional)
```

### 2.5 Configurar Firebase Config para Frontend

1. En Firebase Console, ir a Project Settings (ícono de engranaje)
2. En "Tus apps", clic en el ícono web `</>`
3. Registrar app: nombre `DataMetricX Web`
4. Copiar el config object:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "datametricx-prod.firebaseapp.com",
  projectId: "datametricx-prod",
  storageBucket: "datametricx-prod.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

5. Guardar este config (lo usaremos en el frontend)

---

## Paso 3: Configurar Frontend (React)

### 3.1 Crear Proyecto React con Vite

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

### 3.2 Instalar Dependencias

```bash
# Core dependencies
npm install react-router-dom firebase

# UI & Styling
npm install tailwindcss postcss autoprefixer
npm install @headlessui/react @heroicons/react
npm install clsx

# Charts
npm install recharts

# HTTP client
npm install axios

# Form handling
npm install react-hook-form zod @hookform/resolvers

# Date handling
npm install date-fns

# Dev dependencies
npm install -D @types/node
```

### 3.3 Configurar Tailwind CSS

```bash
npx tailwindcss init -p
```

Editar `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0A2E50',
          blue: '#0A2E50',
        },
        secondary: {
          DEFAULT: '#3B82F6',
          blue: '#3B82F6',
        },
        accent: {
          red: '#FF6B6B',
        },
        neutral: {
          dark: '#333333',
        },
        data: {
          teal: '#5EEAD2',
          purple: '#A78BFA',
          yellow: '#FDE047',
          green: '#4ADE80',
          lightBlue: '#93C5FD',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Sora', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
```

Editar `src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply font-sans bg-gray-50 text-neutral-dark;
  }

  h1, h2, h3, h4, h5, h6 {
    @apply font-heading;
  }
}
```

### 3.4 Configurar Firebase en Frontend

Crear `src/config/firebase.ts`:

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
```

### 3.5 Crear `.env.local`

En `frontend/.env.local`:

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=datametricx-prod.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=datametricx-prod
VITE_FIREBASE_STORAGE_BUCKET=datametricx-prod.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FUNCTIONS_URL=http://localhost:5001/datametricx-prod/us-central1
```

**IMPORTANTE**: Agregar `.env.local` a `.gitignore`

```bash
# En frontend/.gitignore
.env.local
.env.*.local
```

### 3.6 Verificar Instalación

```bash
npm run dev
```

Debería abrir en `http://localhost:5173`

---

## Paso 4: Configurar Backend (Firebase Functions)

### 4.1 Navegar a Directorio de Functions

```bash
cd functions
```

### 4.2 Instalar Dependencias Adicionales

```bash
# Firebase admin
npm install firebase-admin

# HTTP client
npm install axios

# Secrets
npm install @google-cloud/secret-manager

# Validation
npm install zod

# Utilities
npm install date-fns lodash
npm install -D @types/lodash

# Testing
npm install -D jest @types/jest ts-jest
```

### 4.3 Configurar TypeScript

Editar `functions/tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "outDir": "lib",
    "sourceMap": true,
    "strict": true,
    "target": "es2017",
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "compileOnSave": true,
  "include": [
    "src"
  ]
}
```

### 4.4 Configurar Variables de Entorno para Functions

```bash
# Configurar región de Functions
firebase functions:config:set runtime.region=us-central1

# Configurar URLs base de APIs (ejemplo)
firebase functions:config:set \
  apis.meta_ads="https://graph.facebook.com/v18.0" \
  apis.shopify="https://YOUR_STORE.myshopify.com/admin/api/2024-01"
```

Ver config actual:

```bash
firebase functions:config:get
```

### 4.5 Configurar Secret Manager (para API keys)

1. En Google Cloud Console, ir a [Secret Manager](https://console.cloud.google.com/security/secret-manager)
2. Habilitar la API si está deshabilitada
3. Crear secrets para cada integración:
   - `meta-ads-access-token`
   - `shopify-access-token`
   - `google-ads-developer-token`
   - etc.

Dar permisos a la cuenta de servicio de Functions:

```bash
# Obtener email de service account
firebase functions:config:get service_account_email

# Dar permisos (ejecutar en Cloud Console)
gcloud projects add-iam-policy-binding datametricx-prod \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 4.6 Verificar Instalación de Functions

```bash
cd functions
npm run build
```

---

## Paso 5: Configurar Reglas de Seguridad

### 5.1 Firestore Rules

Editar `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    function getTenantId() {
      return getUserData().tenantId;
    }

    function isTenantMember(tenantId) {
      return isAuthenticated() && getTenantId() == tenantId;
    }

    function isOwnerOrAdmin(tenantId) {
      let userData = getUserData();
      return userData.tenantId == tenantId &&
             (userData.role == 'owner' || userData.role == 'admin');
    }

    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated() && request.auth.uid == userId;
      allow write: if isAuthenticated() && request.auth.uid == userId;
    }

    // Tenants collection
    match /tenants/{tenantId} {
      allow read: if isTenantMember(tenantId);
      allow write: if isOwnerOrAdmin(tenantId);

      // Users subcollection
      match /users/{userId} {
        allow read: if isTenantMember(tenantId);
        allow write: if isOwnerOrAdmin(tenantId);
      }

      // Integrations subcollection
      match /integrations/{integrationId} {
        allow read: if isTenantMember(tenantId);
        allow write: if isOwnerOrAdmin(tenantId);
      }

      // Metrics subcollection
      match /metrics_daily/{date} {
        allow read: if isTenantMember(tenantId);
        allow write: if false; // Solo Functions pueden escribir
      }

      // Products subcollection
      match /products/{productId} {
        allow read: if isTenantMember(tenantId);
        allow write: if false; // Solo Functions pueden escribir
      }

      // Campaigns subcollection
      match /campaigns/{campaignId} {
        allow read: if isTenantMember(tenantId);
        allow write: if false; // Solo Functions pueden escribir
      }
    }
  }
}
```

Desplegar reglas:

```bash
firebase deploy --only firestore:rules
```

### 5.2 Storage Rules

Editar `storage.rules`:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    function isAuthenticated() {
      return request.auth != null;
    }

    function getUserData() {
      return firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data;
    }

    function getTenantId() {
      return getUserData().tenantId;
    }

    // Tenant files
    match /tenants/{tenantId}/{allPaths=**} {
      allow read: if isAuthenticated() && getTenantId() == tenantId;
      allow write: if isAuthenticated() && getTenantId() == tenantId;
    }
  }
}
```

Desplegar reglas:

```bash
firebase deploy --only storage
```

---

## Paso 6: Configurar Índices de Firestore

Editar `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "metrics_daily",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "products",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "revenue", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "campaigns",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "platform", "order": "ASCENDING" },
        { "fieldPath": "spend", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Desplegar índices:

```bash
firebase deploy --only firestore:indexes
```

---

## Paso 7: Configurar Git

### 7.1 Crear `.gitignore` Principal

En la raíz del proyecto:

```gitignore
# Dependencies
node_modules/
frontend/node_modules/
functions/node_modules/

# Environment variables
.env
.env.local
.env.*.local
frontend/.env.local
functions/.runtimeconfig.json

# Build outputs
frontend/dist/
frontend/build/
functions/lib/

# Firebase
.firebase/
firebase-debug.log
firestore-debug.log
ui-debug.log

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Testing
coverage/

# Secrets
*.pem
*.key
secrets/
```

### 7.2 Commit Inicial

```bash
git add .
git commit -m "Initial setup: Firebase + React + Tailwind"
git branch -M main
git push -u origin main
```

---

## Paso 8: Verificar Configuración Completa

### 8.1 Test Frontend

```bash
cd frontend
npm run dev
```

Abrir http://localhost:5173 y verificar que carga sin errores en consola.

### 8.2 Test Functions (con Emulators)

```bash
# En la raíz del proyecto
firebase emulators:start
```

Debería iniciar:
- Firestore Emulator: http://localhost:8080
- Functions Emulator: http://localhost:5001
- Auth Emulator: http://localhost:9099

### 8.3 Test Build Frontend

```bash
cd frontend
npm run build
```

Verificar que se genera `frontend/dist/` sin errores.

### 8.4 Test Deploy Functions (opcional, usa recursos de Firebase)

```bash
cd functions
npm run build

# Deploy solo una función de test
firebase deploy --only functions:helloWorld
```

---

## Paso 9: Configuración Adicional (Opcional)

### 9.1 Pre-commit Hooks (Husky + Lint-Staged)

```bash
npm install -D husky lint-staged

# Inicializar husky
npx husky install

# Agregar pre-commit hook
npx husky add .husky/pre-commit "npx lint-staged"
```

Editar `package.json`:

```json
{
  "lint-staged": {
    "frontend/src/**/*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "functions/src/**/*.ts": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

### 9.2 GitHub Actions (CI/CD)

Crear `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - name: Install dependencies
        run: |
          cd frontend
          npm ci
      - name: Run tests
        run: |
          cd frontend
          npm run test
      - name: Build
        run: |
          cd frontend
          npm run build

  test-functions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - name: Install dependencies
        run: |
          cd functions
          npm ci
      - name: Run tests
        run: |
          cd functions
          npm run test
      - name: Build
        run: |
          cd functions
          npm run build
```

---

## Troubleshooting

### Error: "Firebase command not found"

```bash
npm install -g firebase-tools
```

### Error: "Permission denied" al instalar global packages

```bash
# macOS/Linux
sudo npm install -g firebase-tools

# O configurar npm para no usar sudo
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Error: "Port 5173 already in use"

```bash
# Cambiar puerto en vite.config.ts
export default defineConfig({
  server: {
    port: 3000
  }
})
```

### Error: "Firebase emulators not starting"

```bash
# Verificar Java está instalado (requerido para Firestore emulator)
java -version

# Si no está instalado
# macOS
brew install openjdk@11

# Ubuntu/Debian
sudo apt-get install openjdk-11-jdk
```

---

## Próximos Pasos

Ahora que tienes el entorno configurado:

1. Lee [FRONTEND.md](./FRONTEND.md) para comenzar a desarrollar la UI
2. Lee [BACKEND.md](./BACKEND.md) para crear las Cloud Functions
3. Lee [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) para entender la estructura de datos
4. Lee [INTEGRATIONS.md](./INTEGRATIONS.md) para conectar APIs externas

---

## Comandos Útiles de Referencia

```bash
# Frontend
cd frontend
npm run dev          # Desarrollo
npm run build        # Build producción
npm run preview      # Preview build local

# Functions
cd functions
npm run build        # Compilar TypeScript
npm run serve        # Emular functions localmente
npm run deploy       # Deploy a Firebase

# Firebase
firebase login                          # Login
firebase projects:list                  # Listar proyectos
firebase use <project-id>               # Cambiar proyecto activo
firebase emulators:start                # Iniciar emuladores
firebase deploy                         # Deploy todo
firebase deploy --only hosting          # Deploy solo hosting
firebase deploy --only functions        # Deploy solo functions
firebase deploy --only firestore:rules  # Deploy solo reglas
```

---

**Documento creado**: 2025-11-18
**Última actualización**: 2025-11-18
**Versión**: 1.0
