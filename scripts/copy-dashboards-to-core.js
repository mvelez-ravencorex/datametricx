/**
 * Script para copiar dashboards de un tenant a la colección core_dashboards
 *
 * Uso:
 *   node scripts/copy-dashboards-to-core.js
 *
 * Requisitos:
 *   - Tener configurado GOOGLE_APPLICATION_CREDENTIALS con la service account
 *   - O estar autenticado con gcloud: gcloud auth application-default login
 */

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// Configuración
const SOURCE_TENANT_ID = '0m24GMjHwY1XYGlTVYDb';
const PROJECT_ID = 'datametricx-prod';

// Inicializar Firebase Admin
try {
  initializeApp({
    credential: applicationDefault(),
    projectId: PROJECT_ID
  });
} catch (e) {
  console.error('Error inicializando Firebase Admin. Asegúrate de estar autenticado con gcloud.');
  console.error('Ejecuta: gcloud auth application-default login');
  process.exit(1);
}

const db = getFirestore();

async function copyDashboardsToCore() {
  console.log('🚀 Iniciando copia de dashboards a core_dashboards...\n');

  try {
    // 1. Primero eliminar los documentos existentes en core_dashboards (los vacíos)
    console.log('🗑️  Limpiando core_dashboards existentes...\n');
    const existingCore = await db.collection('core_dashboards').get();
    if (!existingCore.empty) {
      const deleteBatch = db.batch();
      existingCore.docs.forEach(doc => {
        deleteBatch.delete(doc.ref);
      });
      await deleteBatch.commit();
      console.log(`   Eliminados ${existingCore.size} documentos vacíos\n`);
    }

    // 2. Obtener todos los dashboards del tenant origen
    const sourcePath = `tenants/${SOURCE_TENANT_ID}/dashboards`;
    const dashboardsSnapshot = await db.collection(sourcePath).get();

    if (dashboardsSnapshot.empty) {
      console.log('❌ No se encontraron dashboards en el tenant origen');
      return;
    }

    console.log(`📊 Encontrados ${dashboardsSnapshot.size} dashboards:\n`);

    // 3. Copiar cada dashboard COMPLETO a core_dashboards
    const copiedDashboards = [];

    for (const doc of dashboardsSnapshot.docs) {
      // Obtener TODOS los datos del documento original
      const originalData = doc.data();

      // Crear nuevo documento con nuevo ID
      const newDocRef = db.collection('core_dashboards').doc();

      // Copiar TODO el documento, solo modificando campos necesarios
      const coreData = {
        ...originalData,           // Copiar TODO incluyendo config con elements
        id: newDocRef.id,          // Nuevo ID
        folderId: null,            // En root de core (no en carpeta de tenant)
        updatedAt: FieldValue.serverTimestamp(),
      };

      // Remover campos que no aplican a core
      delete coreData.tenantId;
      delete coreData.isPublic;
      delete coreData.publicToken;

      // Log para debug
      const elementsCount = originalData.config?.elements?.length || 0;
      console.log(`  ✓ ${originalData.name}`);
      console.log(`    Original ID: ${doc.id}`);
      console.log(`    Nuevo ID: ${newDocRef.id}`);
      console.log(`    Elementos: ${elementsCount}`);
      console.log(`    Config keys: ${Object.keys(originalData.config || {}).join(', ')}\n`);

      // Guardar documento
      await newDocRef.set(coreData);

      copiedDashboards.push({
        originalId: doc.id,
        newId: newDocRef.id,
        name: originalData.name,
        elementsCount
      });
    }

    console.log('✅ Copia completada exitosamente!\n');
    console.log('Dashboards copiados a core_dashboards:');
    copiedDashboards.forEach(d => {
      console.log(`  - ${d.name} (${d.newId}) - ${d.elementsCount} elementos`);
    });

  } catch (error) {
    console.error('❌ Error durante la copia:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar
copyDashboardsToCore();
