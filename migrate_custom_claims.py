#!/usr/bin/env python3
"""
Script de migración: Configura custom claims para usuarios existentes
que tienen tenantId en Firestore pero no tienen tenant_id en custom claims.

Ejecutar UNA VEZ después de desplegar la nueva versión del backend.

Uso:
  # Dry run (solo muestra qué haría, sin hacer cambios)
  python3 migrate_custom_claims.py

  # Ejecutar migración real
  python3 migrate_custom_claims.py --execute
"""

import os
import sys
import logging
from datetime import datetime

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

try:
    import firebase_admin
    from firebase_admin import credentials, auth, firestore
except ImportError:
    logger.error("❌ Firebase Admin SDK no está instalado")
    logger.error("   Ejecuta: pip3 install --user firebase-admin google-cloud-firestore")
    sys.exit(1)


def initialize_firebase():
    """
    Inicializa Firebase Admin SDK.
    Usa Application Default Credentials de Google Cloud.
    """
    try:
        # Verificar que estemos en Google Cloud (Cloud Shell, Cloud Run, etc.)
        project_id = os.environ.get('PROJECT_ID') or os.environ.get('GOOGLE_CLOUD_PROJECT')

        if not project_id:
            logger.error("❌ Variable de entorno PROJECT_ID no está configurada")
            logger.error("   Ejecuta: export PROJECT_ID=datametricx-prod")
            sys.exit(1)

        # Inicializar con Application Default Credentials
        if not firebase_admin._apps:
            firebase_admin.initialize_app(options={
                'projectId': project_id
            })

        logger.info(f"✅ Firebase Admin SDK inicializado (project={project_id})")
        return firestore.client()

    except Exception as e:
        logger.error(f"❌ Error inicializando Firebase: {e}")
        sys.exit(1)


def migrate_user_custom_claims(db, dry_run=True):
    """
    Migra custom claims para usuarios existentes.

    Args:
        db: Cliente de Firestore
        dry_run: Si True, solo muestra qué haría sin hacer cambios reales

    Returns:
        dict: Estadísticas de la migración
    """
    users_ref = db.collection('users')
    users = users_ref.stream()

    migrated = 0
    skipped = 0
    errors = 0
    users_processed = []

    logger.info(f"🔄 Iniciando migración de custom claims...")
    logger.info(f"   Modo: {'DRY RUN (sin cambios)' if dry_run else 'EJECUCIÓN REAL'}")
    logger.info("")

    for user_doc in users:
        user_data = user_doc.to_dict()
        user_uid = user_doc.id
        tenant_id = user_data.get('tenantId')
        role = user_data.get('role', 'user')

        # Skip si no tiene tenantId
        if not tenant_id:
            logger.warning(f"⚠️  Skip: Usuario {user_uid} no tiene tenantId en Firestore")
            skipped += 1
            continue

        try:
            # Verificar custom claims actuales
            user = auth.get_user(user_uid)
            current_claims = user.custom_claims or {}
            current_tenant = current_claims.get('tenant_id')
            current_role = current_claims.get('role')

            # Skip si ya tiene los custom claims correctos
            if current_tenant == tenant_id and current_role == role:
                logger.info(f"⏭️  Skip: {user_uid[:20]}... ya tiene custom claims correctos")
                skipped += 1
                continue

            # Mostrar qué se va a hacer
            if current_tenant and current_tenant != tenant_id:
                logger.warning(f"⚠️  Usuario {user_uid[:20]}... tiene tenant_id={current_tenant} pero Firestore dice {tenant_id}")

            # Configurar custom claims
            if dry_run:
                logger.info(f"🔍 [DRY RUN] Configuraría: user={user_uid[:20]}..., tenant={tenant_id}, role={role}")
            else:
                new_claims = current_claims.copy()
                new_claims['tenant_id'] = tenant_id
                new_claims['role'] = role

                auth.set_custom_user_claims(user_uid, new_claims)
                logger.info(f"✅ Migrado: {user_uid[:20]}... → tenant={tenant_id}, role={role}")

            users_processed.append({
                'uid': user_uid,
                'tenant_id': tenant_id,
                'role': role,
                'previous_claims': current_claims
            })
            migrated += 1

        except auth.UserNotFoundError:
            logger.error(f"❌ Usuario {user_uid[:20]}... existe en Firestore pero NO en Firebase Auth")
            errors += 1

        except Exception as e:
            logger.error(f"❌ Error migrando {user_uid[:20]}...: {e}")
            errors += 1

    # Resumen
    logger.info("")
    logger.info("=" * 60)
    logger.info(f"📊 RESUMEN DE LA MIGRACIÓN")
    logger.info("=" * 60)
    logger.info(f"   ✅ Usuarios migrados: {migrated}")
    logger.info(f"   ⏭️  Usuarios omitidos: {skipped}")
    logger.info(f"   ❌ Errores: {errors}")
    logger.info(f"   📈 Total procesados: {migrated + skipped + errors}")
    logger.info("=" * 60)

    if not dry_run and migrated > 0:
        logger.info("")
        logger.info("⚠️  IMPORTANTE:")
        logger.info("   Los usuarios migrados deben REFRESCAR su token o")
        logger.info("   CERRAR SESIÓN y volver a iniciar sesión para que")
        logger.info("   los custom claims surtan efecto.")
        logger.info("")

    return {
        'migrated': migrated,
        'skipped': skipped,
        'errors': errors,
        'users_processed': users_processed
    }


def verify_migration(db):
    """
    Verifica que los custom claims se hayan configurado correctamente.
    """
    logger.info("")
    logger.info("🔍 Verificando migración...")

    users_ref = db.collection('users')
    users = users_ref.stream()

    verified = 0
    mismatches = 0

    for user_doc in users:
        user_data = user_doc.to_dict()
        user_uid = user_doc.id
        tenant_id = user_data.get('tenantId')

        if not tenant_id:
            continue

        try:
            user = auth.get_user(user_uid)
            current_claims = user.custom_claims or {}
            claim_tenant = current_claims.get('tenant_id')

            if claim_tenant == tenant_id:
                verified += 1
            else:
                logger.warning(f"⚠️  Mismatch: {user_uid[:20]}... - Firestore={tenant_id}, Claim={claim_tenant}")
                mismatches += 1

        except Exception as e:
            logger.error(f"❌ Error verificando {user_uid[:20]}...: {e}")

    logger.info(f"✅ Verificados correctamente: {verified}")
    logger.info(f"⚠️  Discrepancias encontradas: {mismatches}")

    return verified, mismatches


def main():
    """
    Función principal
    """
    # Banner
    print("\n" + "=" * 60)
    print("  🔥 MIGRACIÓN DE CUSTOM CLAIMS - DataMetricX")
    print("=" * 60)
    print(f"  Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60 + "\n")

    # Determinar modo
    dry_run = '--execute' not in sys.argv
    verify_only = '--verify' in sys.argv

    # Inicializar Firebase
    db = initialize_firebase()

    if verify_only:
        # Solo verificar
        verify_migration(db)
        return

    # Confirmación si es ejecución real
    if dry_run:
        logger.info("⚠️  MODO DRY RUN: No se harán cambios reales")
        logger.info("   Para ejecutar la migración real, usa: python3 migrate_custom_claims.py --execute")
        logger.info("")
    else:
        logger.warning("🔥 MODO EJECUCIÓN: Se harán cambios REALES en Firebase Auth")
        logger.warning("")

        confirm = input("¿Estás seguro de continuar? Escribe 'SI' para confirmar: ")
        if confirm != 'SI':
            logger.info("❌ Migración cancelada por el usuario")
            sys.exit(0)

        logger.info("✅ Confirmación recibida. Iniciando migración...")
        logger.info("")

    # Ejecutar migración
    result = migrate_user_custom_claims(db, dry_run=dry_run)

    # Verificar si se ejecutó la migración real
    if not dry_run and result['migrated'] > 0:
        logger.info("")
        input("Presiona ENTER para verificar los cambios...")
        verify_migration(db)

    logger.info("")
    logger.info("✅ Proceso completado")
    logger.info("")


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        logger.info("\n\n❌ Proceso interrumpido por el usuario")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n\n❌ Error fatal: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
