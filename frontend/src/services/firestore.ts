import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  WhereFilterOp,
  DocumentData,
  QueryConstraint
} from 'firebase/firestore'
import { db } from '@/config/firebase'

// Generic Firestore Service
export class FirestoreService<T extends DocumentData> {
  constructor(private collectionName: string) {}

  // Get a single document by ID
  async getById(id: string): Promise<T | null> {
    const docRef = doc(db, this.collectionName, id)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as unknown as T
    }
    return null
  }

  // Get all documents
  async getAll(): Promise<T[]> {
    const querySnapshot = await getDocs(collection(db, this.collectionName))
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    })) as unknown as T[]
  }

  // Get documents with filters
  async query(filters: QueryConstraint[]): Promise<T[]> {
    const q = query(collection(db, this.collectionName), ...filters)
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    })) as unknown as T[]
  }

  // Get documents by user ID
  async getByUserId(userId: string): Promise<T[]> {
    return this.query([where('userId', '==', userId)])
  }

  // Get documents with pagination
  async getPaginated(pageSize: number, orderByField: string = 'createdAt'): Promise<T[]> {
    return this.query([orderBy(orderByField, 'desc'), limit(pageSize)])
  }

  // Create a new document
  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const timestamp = Timestamp.now()
    const docRef = await addDoc(collection(db, this.collectionName), {
      ...data,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    return docRef.id
  }

  // Update an existing document
  async update(id: string, data: Partial<T>): Promise<void> {
    const docRef = doc(db, this.collectionName, id)
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now()
    })
  }

  // Delete a document
  async delete(id: string): Promise<void> {
    const docRef = doc(db, this.collectionName, id)
    await deleteDoc(docRef)
  }

  // Custom query builder
  async customQuery(
    field: string,
    operator: WhereFilterOp,
    value: unknown,
    orderByField?: string,
    limitCount?: number
  ): Promise<T[]> {
    const constraints: QueryConstraint[] = [where(field, operator, value)]

    if (orderByField) {
      constraints.push(orderBy(orderByField, 'desc'))
    }

    if (limitCount) {
      constraints.push(limit(limitCount))
    }

    return this.query(constraints)
  }
}

// Specialized Services
export const userProfileService = new FirestoreService('users')
export const dataSourceService = new FirestoreService('dataSources')
export const metricService = new FirestoreService('metrics')
export const widgetConfigService = new FirestoreService('widgetConfigs')
export const salesDataService = new FirestoreService('salesData')
