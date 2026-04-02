# Firebase Setup - DataMetricX

## Configuración completada

Se ha integrado Firebase completamente en la aplicación DataMetricX con las siguientes funcionalidades:

## Archivos creados

### 1. Configuración
- `src/config/firebase.ts` - Configuración e inicialización de Firebase
- `src/vite-env.d.ts` - Tipos TypeScript para variables de entorno
- `.env` - Variables de entorno de producción (ya configuradas)

### 2. Autenticación
- `src/contexts/AuthContext.tsx` - Contexto de autenticación con React Context API
- `src/components/auth/ProtectedRoute.tsx` - Componente para proteger rutas
- `src/pages/auth/Login.tsx` - Página de inicio de sesión
- `src/pages/auth/Register.tsx` - Página de registro

### 3. Base de datos
- `src/types/models.ts` - Tipos TypeScript para los modelos de datos
- `src/services/firestore.ts` - Servicio genérico para operaciones CRUD en Firestore

### 4. Actualizaciones
- `App.tsx` - Actualizado con AuthProvider y rutas protegidas
- `.env.example` - Actualizado con nuevas variables de Firebase

## Servicios de Firebase configurados

### Authentication
- Login con email/password
- Registro de usuarios
- Login con Google
- Recuperación de contraseña
- Actualización de perfil

### Firestore Database
Servicios predefinidos para:
- `userProfileService` - Gestión de perfiles de usuario
- `dataSourceService` - Gestión de fuentes de datos
- `metricService` - Gestión de métricas
- `widgetConfigService` - Configuración de widgets del dashboard
- `salesDataService` - Datos de ventas

### Analytics
Configurado para rastrear eventos (solo en producción)

### Storage
Inicializado para almacenamiento de archivos

## Cómo usar

### 1. Configurar Authentication en Firebase Console

Debes habilitar los métodos de autenticación en la consola de Firebase:

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona el proyecto `datametricx-prod`
3. Ve a **Authentication** > **Sign-in method**
4. Habilita:
   - **Email/Password**
   - **Google** (opcional)

### 2. Configurar Firestore Database

1. Ve a **Firestore Database**
2. Crea la base de datos (si aún no existe)
3. Selecciona modo de producción o prueba

#### Colecciones recomendadas:
```
/users/{userId}
  - uid: string
  - email: string
  - displayName: string
  - role: 'admin' | 'user' | 'viewer'
  - createdAt: timestamp
  - updatedAt: timestamp

/dataSources/{sourceId}
  - name: string
  - type: string
  - status: string
  - userId: string
  - createdAt: timestamp

/metrics/{metricId}
  - name: string
  - value: number
  - userId: string
  - timestamp: timestamp

/widgetConfigs/{widgetId}
  - type: string
  - title: string
  - layout: object
  - userId: string
```

### 3. Usar el contexto de autenticación

```tsx
import { useAuth } from '@/contexts/AuthContext'

function MyComponent() {
  const { currentUser, signIn, signOut } = useAuth()

  return (
    <div>
      {currentUser ? (
        <>
          <p>Hola, {currentUser.displayName}</p>
          <button onClick={signOut}>Cerrar sesión</button>
        </>
      ) : (
        <p>No hay sesión activa</p>
      )}
    </div>
  )
}
```

### 4. Usar los servicios de Firestore

```tsx
import { metricService } from '@/services/firestore'
import { Metric } from '@/types/models'

// Crear una métrica
const createMetric = async () => {
  const metricId = await metricService.create({
    name: 'Revenue',
    value: 1200000,
    userId: currentUser.uid,
    dataSourceId: 'source-123'
  })
}

// Obtener métricas del usuario
const getUserMetrics = async () => {
  const metrics = await metricService.getByUserId(currentUser.uid)
  console.log(metrics)
}

// Actualizar una métrica
const updateMetric = async (id: string) => {
  await metricService.update(id, {
    value: 1500000
  })
}

// Eliminar una métrica
const deleteMetric = async (id: string) => {
  await metricService.delete(id)
}
```

### 5. Rutas de la aplicación

- `/login` - Inicio de sesión (pública)
- `/register` - Registro de usuarios (pública)
- `/dashboard` - Dashboard principal (protegida)
- `/sales` - Ventas (protegida)
- `/marketing` - Marketing (protegida)
- `/operations` - Operaciones (protegida)
- `/settings` - Configuración (protegida)

## Variables de entorno

Todas las variables de entorno están en el archivo `.env`:

```env
VITE_FIREBASE_API_KEY=AIzaSyBYYYOxVJf2dRkvMkFO7k3or6UjQCeWyR4
VITE_FIREBASE_AUTH_DOMAIN=datametricx-prod.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=datametricx-prod
VITE_FIREBASE_STORAGE_BUCKET=datametricx-prod.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=737169614020
VITE_FIREBASE_APP_ID=1:737169614020:web:b957b37341f728f9d99591
VITE_FIREBASE_MEASUREMENT_ID=G-PTYELVNXD7
```

## Seguridad

⚠️ **IMPORTANTE**: El archivo `.env` contiene credenciales reales. Asegúrate de:

1. Agregar `.env` al `.gitignore` (ya está agregado)
2. Nunca compartir las credenciales públicamente
3. Configurar reglas de seguridad en Firestore

### Reglas de seguridad recomendadas para Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /dataSources/{sourceId} {
      allow read, write: if request.auth != null &&
        resource.data.userId == request.auth.uid;
    }

    match /metrics/{metricId} {
      allow read, write: if request.auth != null &&
        resource.data.userId == request.auth.uid;
    }

    match /widgetConfigs/{widgetId} {
      allow read, write: if request.auth != null &&
        resource.data.userId == request.auth.uid;
    }
  }
}
```

## Próximos pasos

1. Configurar reglas de seguridad en Firestore
2. Crear índices compuestos si es necesario
3. Implementar Cloud Functions para lógica del servidor
4. Configurar límites de uso en Firebase Console
5. Agregar más métodos de autenticación si es necesario

## Recursos

- [Documentación de Firebase](https://firebase.google.com/docs)
- [Firebase Console](https://console.firebase.google.com/)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
