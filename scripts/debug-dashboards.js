/**
 * Script de diagnóstico para ver la estructura de los dashboards
 */

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

// Configuración
const SOURCE_TENANT_ID = '0m24GMjHwY1XYGlTVYDb';
const PROJECT_ID = 'datametricx-prod';

// Inicializar Firebase Admin
initializeApp({
  credential: applicationDefault(),
  projectId: PROJECT_ID
});

const db = getFirestore();

async function debugDashboards() {
  console.log('🔍 Analizando estructura de dashboards...\n');

  try {
    // 1. Obtener dashboards del tenant
    const sourcePath = `tenants/${SOURCE_TENANT_ID}/dashboards`;
    const dashboardsSnapshot = await db.collection(sourcePath).get();

    console.log(`📊 Dashboards en tenant (${SOURCE_TENANT_ID}):\n`);

    const fullData = {};

    for (const doc of dashboardsSnapshot.docs) {
      const data = doc.data();
      fullData[doc.id] = data;

      console.log(`\n${'='.repeat(60)}`);
      console.log(`📋 ${data.name}`);
      console.log(`${'='.repeat(60)}`);
      console.log(`ID: ${doc.id}`);
      console.log(`\nCampos del documento:`);

      for (const [key, value] of Object.entries(data)) {
        if (key === 'config') {
          console.log(`  config:`);
          console.log(`    - layout: ${JSON.stringify(value.layout || {})}`);
          console.log(`    - theme: ${JSON.stringify(value.theme || {})}`);
          console.log(`    - elements: ${(value.elements || []).length} elementos`);
          console.log(`    - globalFilters: ${(value.globalFilters || []).length} filtros`);
          console.log(`    - variables: ${(value.variables || []).length} variables`);

          if (value.elements && value.elements.length > 0) {
            console.log(`\n    Elementos del dashboard:`);
            value.elements.forEach((el, i) => {
              console.log(`      [${i}] tipo: ${el.type}, id: ${el.id}`);
              if (el.embeddedConfig) {
                console.log(`          embeddedConfig: ${Object.keys(el.embeddedConfig).join(', ')}`);
                console.log(`          datasetId: ${el.embeddedConfig.datasetId || 'N/A'}`);
                console.log(`          vizType: ${el.embeddedConfig.vizType || 'N/A'}`);
              }
              if (el.vizId) {
                console.log(`          vizId: ${el.vizId}`);
              }
            });
          }
        } else if (typeof value === 'object' && value !== null) {
          if (value.toDate) {
            console.log(`  ${key}: ${value.toDate()}`);
          } else {
            console.log(`  ${key}: [Object] ${JSON.stringify(value).substring(0, 100)}...`);
          }
        } else {
          console.log(`  ${key}: ${value}`);
        }
      }
    }

    // 2. También revisar las vizs del tenant
    console.log(`\n\n${'='.repeat(60)}`);
    console.log(`📈 Vizs en tenant:`);
    console.log(`${'='.repeat(60)}\n`);

    const vizsPath = `tenants/${SOURCE_TENANT_ID}/vizs`;
    const vizsSnapshot = await db.collection(vizsPath).get();

    console.log(`Total vizs: ${vizsSnapshot.size}\n`);

    for (const doc of vizsSnapshot.docs) {
      const data = doc.data();
      console.log(`  - ${data.name} (${doc.id})`);
      console.log(`    datasetId: ${data.config?.datasetId || 'N/A'}`);
      console.log(`    vizType: ${data.config?.vizType || 'N/A'}`);
    }

    // 3. Guardar dump completo a archivo para análisis
    const outputFile = 'scripts/dashboard-dump.json';
    fs.writeFileSync(outputFile, JSON.stringify(fullData, null, 2));
    console.log(`\n\n📁 Dump completo guardado en: ${outputFile}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugDashboards();
