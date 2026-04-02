#!/usr/bin/env python3
"""
Script para configurar el rol SysOwner para un usuario en Firebase Auth.
Este rol otorga acceso completo para editar modelos semánticos.

Uso:
    python set_sysowner.py <email>

Ejemplo:
    python set_sysowner.py martin.velez@ravencorex.com
"""
import sys
import firebase_admin
from firebase_admin import credentials, auth

# Inicializar Firebase Admin SDK
# Usa Application Default Credentials (gcloud auth application-default login)
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(options={
        'projectId': 'datametricx-prod'
    })


def set_sysowner(email: str):
    """Configura el rol SysOwner para un usuario dado su email."""
    try:
        # Buscar usuario por email
        user = auth.get_user_by_email(email)
        print(f"✅ Usuario encontrado: {user.uid}")
        print(f"   Email: {user.email}")
        print(f"   Claims actuales: {user.custom_claims}")

        # Obtener claims actuales
        current_claims = user.custom_claims or {}

        # Agregar rol SysOwner
        current_claims['role'] = 'SysOwner'
        current_claims['sys_owner'] = True

        # Actualizar claims
        auth.set_custom_user_claims(user.uid, current_claims)

        # Verificar
        updated_user = auth.get_user(user.uid)
        print(f"\n✅ SysOwner configurado exitosamente!")
        print(f"   Nuevos claims: {updated_user.custom_claims}")
        print(f"\n⚠️  IMPORTANTE: El usuario debe cerrar sesión y volver a iniciar")
        print(f"   sesión para que los nuevos permisos tomen efecto.")

    except auth.UserNotFoundError:
        print(f"❌ Error: No se encontró usuario con email {email}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Uso: python set_sysowner.py <email>")
        print("Ejemplo: python set_sysowner.py martin.velez@ravencorex.com")
        sys.exit(1)

    email = sys.argv[1]
    print(f"🔐 Configurando SysOwner para: {email}\n")
    set_sysowner(email)
