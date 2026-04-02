/**
 * Custom hooks para Firestore
 * Proporciona hooks reutilizables para operaciones comunes de Firestore
 */

import { useState, useEffect, useCallback } from 'react'
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  QueryConstraint,
  DocumentData,
  Unsubscribe
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import logger from '@/utils/logger'
import { getUserFriendlyMessage } from '@/lib/errors'

interface FirestoreState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

interface FirestoreCollectionState<T> {
  data: T[]
  loading: boolean
  error: string | null
}

/**
 * Hook para obtener un documento en tiempo real
 *
 * @example
 * const { data, loading, error } = useDocument<UserProfile>('users', 'user123')
 */
export function useDocument<T extends DocumentData>(
  collectionName: string,
  documentId: string | null
): FirestoreState<T> {
  const [state, setState] = useState<FirestoreState<T>>({
    data: null,
    loading: true,
    error: null
  })

  useEffect(() => {
    if (!documentId) {
      setState({ data: null, loading: false, error: null })
      return
    }

    let unsubscribe: Unsubscribe

    try {
      const docRef = doc(db, collectionName, documentId)

      unsubscribe = onSnapshot(
        docRef,
        (snapshot) => {
          if (snapshot.exists()) {
            setState({
              data: { id: snapshot.id, ...snapshot.data() } as unknown as T,
              loading: false,
              error: null
            })
          } else {
            setState({
              data: null,
              loading: false,
              error: 'Documento no encontrado'
            })
          }
        },
        (error) => {
          logger.error('Error fetching document', error, {
            collection: collectionName,
            documentId
          })
          setState({
            data: null,
            loading: false,
            error: getUserFriendlyMessage(error)
          })
        }
      )
    } catch (error) {
      logger.error('Error setting up document listener', error as Error)
      setState({
        data: null,
        loading: false,
        error: getUserFriendlyMessage(error)
      })
    }

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [collectionName, documentId])

  return state
}

/**
 * Hook para obtener una colección con filtros en tiempo real
 *
 * @example
 * const { data, loading, error } = useCollection<Metric>(
 *   'metrics',
 *   [where('userId', '==', currentUser.uid)]
 * )
 */
export function useCollection<T extends DocumentData>(
  collectionName: string,
  constraints: QueryConstraint[] = []
): FirestoreCollectionState<T> {
  const [state, setState] = useState<FirestoreCollectionState<T>>({
    data: [],
    loading: true,
    error: null
  })

  useEffect(() => {
    let unsubscribe: Unsubscribe

    try {
      const q = query(collection(db, collectionName), ...constraints)

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
          })) as unknown as T[]

          setState({
            data,
            loading: false,
            error: null
          })
        },
        (error) => {
          logger.error('Error fetching collection', error, {
            collection: collectionName
          })
          setState({
            data: [],
            loading: false,
            error: getUserFriendlyMessage(error)
          })
        }
      )
    } catch (error) {
      logger.error('Error setting up collection listener', error as Error)
      setState({
        data: [],
        loading: false,
        error: getUserFriendlyMessage(error)
      })
    }

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [collectionName, JSON.stringify(constraints)])

  return state
}

/**
 * Hook para obtener documentos del usuario actual
 *
 * @example
 * const { data, loading, error, refetch } = useUserCollection<Metric>('metrics')
 */
export function useUserCollection<T extends DocumentData>(
  collectionName: string,
  userId: string | null
): FirestoreCollectionState<T> & { refetch: () => void } {
  const constraints = userId ? [where('userId', '==', userId)] : []

  const state = useCollection<T>(collectionName, constraints)

  const refetch = useCallback(() => {
    // Force re-fetch (implementation can be enhanced)
    logger.info('Refetching collection', { collection: collectionName })
  }, [collectionName])

  return { ...state, refetch }
}

/**
 * Hook para operaciones con caché
 *
 * @example
 * const { data, loading, invalidate } = useCachedDocument<UserProfile>(
 *   'users',
 *   'user123',
 *   { ttl: 60000 }
 * )
 */
export function useCachedDocument<T extends DocumentData>(
  collectionName: string,
  documentId: string | null,
  _options: { ttl?: number } = {}
): FirestoreState<T> & { invalidate: () => void } {
  // Implementation of caching can be enhanced in the future
  const state = useDocument<T>(collectionName, documentId)

  const invalidate = useCallback(() => {
    logger.info('Cache invalidated', { collection: collectionName, documentId })
  }, [collectionName, documentId])

  return { ...state, invalidate }
}
