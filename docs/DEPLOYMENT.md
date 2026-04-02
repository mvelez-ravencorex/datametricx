# DataMetricX - Guía de Despliegue

## Visión General

DataMetricX se despliega en dos partes:
1. **Frontend**: Archivos estáticos en Hostinger
2. **Backend**: Cloud Functions, Firestore, y servicios en Firebase

---

## Requisitos Previos

- [ ] Cuenta de Firebase configurada (ver SETUP.md)
- [ ] Cuenta de Hostinger con dominio configurado
- [ ] Firebase CLI instalado (`npm install -g firebase-tools`)
- [ ] Git configurado con acceso al repositorio
- [ ] Node.js 18+ instalado

---

## Parte 1: Deploy del Backend (Firebase)

### 1.1 Preparación

**Verificar proyecto activo**:

```bash
firebase use --list
firebase use production  # o el nombre de tu proyecto
```

**Verificar configuración**:

```bash
firebase projects:list
firebase functions:config:get
```

### 1.2 Build de Functions

```bash
cd functions
npm install
npm run build
```

Verificar que `functions/lib/` se creó sin errores.

### 1.3 Deploy de Firestore Rules

```bash
# Desde la raíz del proyecto
firebase deploy --only firestore:rules
```

**Verificar reglas**:
- Ir a Firebase Console > Firestore Database > Rules
- Confirmar que las reglas están actualizadas

### 1.4 Deploy de Firestore Indexes

```bash
firebase deploy --only firestore:indexes
```

**Nota**: Los índices pueden tardar varios minutos en crearse. Monitorear en Firebase Console.

### 1.5 Deploy de Cloud Functions

**Deploy todas las functions**:

```bash
firebase deploy --only functions
```

**Deploy selectivo** (solo una función):

```bash
firebase deploy --only functions:metaAdsSync
```

**Deploy con región específica**:

Las funciones ya están configuradas con región en el código:
```typescript
export const metaAdsSync = onRequest(
  { region: 'us-central1' },
  async (req, res) => { /* ... */ }
);
```

**Verificar deploy**:

```bash
firebase functions:list
```

Deberías ver algo como:
```
✔ functions: Loaded functions definitions from source.
┌──────────────────┬────────────────────────────────────────┐
│ Function         │ URL                                     │
├──────────────────┼────────────────────────────────────────┤
│ metaAdsSync      │ https://us-central1-...cloudfunctions...│
│ shopifySync      │ https://us-central1-...cloudfunctions...│
│ ...              │ ...                                     │
└──────────────────┴────────────────────────────────────────┘
```

**Copiar URLs de Functions**: las necesitarás en el frontend.

### 1.6 Deploy de Storage Rules

```bash
firebase deploy --only storage
```

### 1.7 Configurar Secrets (si aún no lo hiciste)

```bash
# Habilitar Secret Manager API
gcloud services enable secretmanager.googleapis.com

# Dar permisos a Cloud Functions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_PROJECT_ID@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 1.8 Verificar Deploy de Firebase

**Check Functions logs**:

```bash
firebase functions:log
```

**Trigger test** (si tienes una función de prueba):

```bash
curl -X POST https://us-central1-YOUR_PROJECT.cloudfunctions.net/helloWorld
```

---

## Parte 2: Deploy del Frontend (Hostinger)

### 2.1 Configurar Variables de Entorno

Crear `frontend/.env.production`:

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=datametricx-prod.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=datametricx-prod
VITE_FIREBASE_STORAGE_BUCKET=datametricx-prod.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FUNCTIONS_URL=https://us-central1-datametricx-prod.cloudfunctions.net
```

**IMPORTANTE**: No incluir `.env.production` en Git. Usar variables de entorno en CI/CD.

### 2.2 Build del Frontend

```bash
cd frontend
npm install
npm run build
```

Esto genera `frontend/dist/` con:
```
dist/
├── index.html
├── assets/
│   ├── index-abc123.js
│   ├── index-def456.css
│   └── logo-xyz789.svg
└── favicon.ico
```

**Verificar build localmente**:

```bash
npm run preview
# Abre http://localhost:4173
```

### 2.3 Configurar Dominio en Hostinger

1. Ir a Hostinger Panel > Domains
2. Si ya tienes dominio (ej: `datametricx.com`):
   - Configurar DNS A record apuntando a IP de Hostinger
   - Esperar propagación DNS (puede tardar hasta 24h)
3. Si no tienes dominio:
   - Comprar dominio en Hostinger o transferir
   - Configurar DNS automáticamente

### 2.4 Habilitar SSL/TLS en Hostinger

1. Hostinger Panel > SSL
2. Seleccionar dominio `datametricx.com`
3. Instalar certificado gratuito Let's Encrypt
4. Habilitar "Force HTTPS"

### 2.5 Upload del Build a Hostinger

**Método 1: File Manager (manual)**

1. Ir a Hostinger Panel > File Manager
2. Navegar a `public_html/` (o carpeta del dominio)
3. Eliminar archivos existentes (index.html, etc.)
4. Upload todos los archivos de `frontend/dist/`
   - Arrastrar carpeta `assets/`
   - Arrastrar `index.html`
   - Arrastrar `favicon.ico`

**Método 2: FTP/SFTP (recomendado)**

1. Obtener credenciales FTP:
   - Hostinger Panel > FTP Accounts
   - Crear cuenta FTP si no existe

2. Usar FileZilla o CLI:

```bash
# Con lftp
lftp -u username,password ftp.datametricx.com
cd public_html
mirror -R frontend/dist/ ./
quit

# Con rsync (si Hostinger soporta SSH)
rsync -avz --delete frontend/dist/ username@datametricx.com:~/public_html/
```

**Método 3: GitHub Actions (CI/CD - recomendado para producción)**

Crear `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Hostinger

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: |
          cd frontend
          npm ci

      - name: Build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
          VITE_FUNCTIONS_URL: ${{ secrets.VITE_FUNCTIONS_URL }}
        run: |
          cd frontend
          npm run build

      - name: Deploy to Hostinger via FTP
        uses: SamKirkland/FTP-Deploy-Action@4.3.0
        with:
          server: ftp.datametricx.com
          username: ${{ secrets.FTP_USERNAME }}
          password: ${{ secrets.FTP_PASSWORD }}
          local-dir: ./frontend/dist/
          server-dir: /public_html/
```

**Configurar Secrets en GitHub**:
- Settings > Secrets and variables > Actions > New repository secret
- Agregar todos los `VITE_*` y `FTP_*` secrets

### 2.6 Configurar Routing en Hostinger (SPA)

Para que React Router funcione en Hostinger (URLs como `/dashboard`, `/sales`), necesitamos configurar rewrites.

**Crear `.htaccess` en `public_html/`**:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Redirect HTTP to HTTPS
  RewriteCond %{HTTPS} off
  RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

  # Handle React Router (SPA)
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^ index.html [L]
</IfModule>

# Security headers
<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
  Header set X-Frame-Options "DENY"
  Header set X-XSS-Protection "1; mode=block"
  Header set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>

# Caching
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/jpg "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/gif "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType application/javascript "access plus 1 month"
  ExpiresByType text/html "access plus 0 seconds"
</IfModule>
```

**Incluir en build**:

Mover `.htaccess` a `frontend/public/.htaccess` para que Vite lo incluya en el build.

### 2.7 Verificar Deploy del Frontend

1. Abrir https://datametricx.com
2. Verificar que carga sin errores 404
3. Navegar a https://datametricx.com/dashboard (no debería dar 404)
4. Abrir DevTools Console, verificar sin errores
5. Probar login con Firebase Auth

---

## Parte 3: Configurar CORS

### 3.1 Configurar CORS en Cloud Functions

Ya configurado en el código de functions:

```typescript
export const metaAdsSync = onRequest(
  {
    cors: ['https://datametricx.com', 'https://www.datametricx.com']
  },
  async (req, res) => { /* ... */ }
);
```

**Redeploy functions** si cambiaste CORS:

```bash
firebase deploy --only functions
```

### 3.2 Configurar CORS en Firestore y Storage

No es necesario, Firebase SDK maneja CORS automáticamente.

---

## Parte 4: Post-Deploy

### 4.1 Smoke Tests

**Checklist**:

- [ ] Frontend carga en https://datametricx.com
- [ ] Login funciona (crear cuenta de prueba)
- [ ] Dashboard muestra (aunque sin datos aún)
- [ ] Navegación funciona (/sales, /marketing, etc.)
- [ ] Cloud Functions responden (test con Postman)
- [ ] Firestore rules bloquean acceso no autorizado

**Probar Firestore Rules**:

Intentar leer datos sin autenticación:
```javascript
// En DevTools Console
firebase.firestore().collection('tenants').get()
  .then(console.log)
  .catch(console.error);
// Debería dar error "Missing or insufficient permissions"
```

### 4.2 Configurar Monitoring

**Firebase Console**:
- Performance Monitoring: habilitar en Firebase Console
- Analytics: ya habilitado si lo configuraste en SETUP.md

**Google Cloud Console**:
- Crear alertas para:
  - Function errors > 10/min
  - Function latency p99 > 2s
  - Firestore read/write exceeding quota

### 4.3 Backup Configuration

**Firestore**:
```bash
# Exportar manualmente
gcloud firestore export gs://datametricx-backups/$(date +%Y-%m-%d)

# O crear Cloud Scheduler job para backups automáticos
```

**Storage**:
- Habilitar versioning en Firebase Console > Storage

---

## Parte 5: CI/CD Completo (Opcional)

### GitHub Actions para deploy completo

`.github/workflows/deploy.yml`:

```yaml
name: Deploy DataMetricX

on:
  push:
    branches:
      - main

jobs:
  deploy-firebase:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install Functions dependencies
        run: |
          cd functions
          npm ci

      - name: Build Functions
        run: |
          cd functions
          npm run build

      - name: Deploy to Firebase
        uses: w9jds/firebase-action@master
        with:
          args: deploy --only functions,firestore:rules,firestore:indexes,storage
        env:
          FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}

  deploy-frontend:
    runs-on: ubuntu-latest
    needs: deploy-firebase
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install Frontend dependencies
        run: |
          cd frontend
          npm ci

      - name: Build Frontend
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          # ... other env vars
        run: |
          cd frontend
          npm run build

      - name: Deploy to Hostinger
        uses: SamKirkland/FTP-Deploy-Action@4.3.0
        with:
          server: ftp.datametricx.com
          username: ${{ secrets.FTP_USERNAME }}
          password: ${{ secrets.FTP_PASSWORD }}
          local-dir: ./frontend/dist/
          server-dir: /public_html/
```

**Obtener FIREBASE_TOKEN**:

```bash
firebase login:ci
# Copiar el token y agregarlo a GitHub Secrets
```

---

## Parte 6: Rollback

### Rollback de Functions

```bash
# Ver versiones anteriores
firebase functions:list

# No hay rollback directo, redeploy versión anterior desde Git
git checkout <previous-commit>
firebase deploy --only functions
git checkout main
```

### Rollback de Frontend

**Método 1: Git**

```bash
git checkout <previous-commit>
cd frontend
npm run build
# Upload a Hostinger
```

**Método 2: Backup manual**

Antes de cada deploy, hacer backup de `public_html/`:

```bash
# En Hostinger
cp -r public_html public_html_backup_$(date +%Y%m%d)
```

---

## Troubleshooting

### Frontend no carga después de deploy

**Verificar**:
- [ ] Todos los archivos de `dist/` fueron subidos
- [ ] `.htaccess` está configurado correctamente
- [ ] SSL está habilitado y funcionando
- [ ] No hay errores en DevTools Console

**Solución**:
- Limpiar cache del navegador
- Verificar que `index.html` está en raíz de `public_html/`
- Verificar permisos de archivos en Hostinger (644 para archivos, 755 para carpetas)

### Functions retornan 403 CORS error

**Verificar**:
- [ ] CORS está configurado en la function
- [ ] Dominio correcto en lista de CORS
- [ ] No hay `www.` vs sin `www.` mismatch

**Solución**:
```typescript
export const myFunction = onRequest(
  {
    cors: true  // Permite todos los orígenes (solo para testing)
  },
  async (req, res) => { /* ... */ }
);
```

Redeploy y probar. Luego restringir a dominio específico.

### Firestore rules bloquean acceso legítimo

**Verificar**:
- [ ] Usuario está autenticado
- [ ] Usuario tiene `tenantId` en Firestore
- [ ] Usuario está intentando acceder a su propio tenant

**Debug**:
- Ir a Firebase Console > Firestore > Rules Playground
- Simular operación con usuario específico

---

## Checklist Final de Deploy

### Backend (Firebase)
- [ ] Firestore rules deployed
- [ ] Firestore indexes created
- [ ] Cloud Functions deployed
- [ ] Storage rules deployed
- [ ] Secrets configured in Secret Manager
- [ ] Monitoring y alertas configuradas

### Frontend (Hostinger)
- [ ] Build generado sin errores
- [ ] Variables de entorno configuradas
- [ ] Archivos subidos a Hostinger
- [ ] `.htaccess` configurado para SPA
- [ ] SSL/TLS habilitado
- [ ] Dominio apuntando correctamente

### Testing
- [ ] Smoke tests pasados
- [ ] Login/logout funciona
- [ ] Navegación funciona
- [ ] Cloud Functions responden
- [ ] Firestore rules funcionan correctamente

---

## Próximos Pasos

1. Deploy inicial a producción
2. Configurar monitoring y alertas
3. Crear documentación de runbook para incidentes
4. Configurar backups automáticos
5. Planear estrategia de blue-green deployment (futuro)

---

**Documento creado**: 2025-11-18
**Última actualización**: 2025-11-18
**Versión**: 1.0
