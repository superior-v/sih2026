import { db } from '../config/firebase';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  increment,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  getDoc,
  setDoc, // Add this
  startAfter,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';

// ============================================
// USER MANAGEMENT
// ============================================

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: Date;
  lastLogin?: Date;
  stats?: {
    ocrScans: number;
    complianceChecks: number;
    searches: number;
  };
}

export async function createUser(userData: Omit<User, 'id'>): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, 'users'), {
      ...userData,
      createdAt: Timestamp.fromDate(userData.createdAt),
      lastLogin: userData.lastLogin ? Timestamp.fromDate(userData.lastLogin) : null,
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

export async function getAllUsers(): Promise<User[]> {
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    return usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      lastLogin: doc.data().lastLogin?.toDate(),
    })) as User[];
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
}

export async function updateUserLastLogin(userId: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      lastLogin: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating last login:', error);
    throw error;
  }
}

// ============================================
// OCR SCAN LOGGING
// ============================================

export interface OCRScanLog {
  id?: string;
  userId: string;
  userName: string;
  extractedText: string;
  confidence: number;
  provider: string;
  timestamp: Date;
}

export async function logOCRScan(
  userId: string,
  userName: string,
  extractedText: string,
  confidence: number,
  provider: string
): Promise<void> {
  try {
    console.log('🔥 Firebase: Starting logOCRScan...');
    
    // Add to ocrScans collection
    const docRef = await addDoc(collection(db, 'ocrScans'), {
      userId,
      userName,
      extractedText,
      confidence,
      provider,
      timestamp: Timestamp.now(),
    });
    
    console.log('✅ Firebase: OCR scan added with ID:', docRef.id);

    // Update user stats
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.log('⚠️ Firebase: User document does not exist, creating it...');
      await setDoc(userRef, {
        id: userId,
        name: userName,
        stats: { ocrScans: 1, complianceChecks: 0, searches: 0 },
        createdAt: Timestamp.now(),
      });
    } else {
      const userData = userDoc.data();
      if (!userData.stats) {
        await updateDoc(userRef, {
          stats: { ocrScans: 1, complianceChecks: 0, searches: 0 },
        });
      } else {
        await updateDoc(userRef, {
          'stats.ocrScans': increment(1),
        });
      }
    }
    
    console.log('✅ Firebase: User OCR stats updated!');
  } catch (error) {
    console.error('❌ Firebase: Error logging OCR scan:', error);
    throw error;
  }
}

export async function getOCRScans(
  limitCount: number = 50,
  lastDoc?: QueryDocumentSnapshot<DocumentData>
): Promise<{ scans: OCRScanLog[]; lastVisible: QueryDocumentSnapshot<DocumentData> | null }> {
  try {
    let q = query(
      collection(db, 'ocrScans'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const snapshot = await getDocs(q);
    const scans = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate(),
    })) as OCRScanLog[];

    const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;

    return { scans, lastVisible };
  } catch (error) {
    console.error('Error fetching OCR scans:', error);
    throw error;
  }
}

export async function getUserOCRScans(userId: string): Promise<OCRScanLog[]> {
  try {
    console.log('🔍 Firebase: Fetching OCR scans for user:', userId);
    
    // Use query without compound orderBy to avoid requiring composite index
    let snapshot;
    try {
      const q = query(
        collection(db, 'ocrScans'),
        where('userId', '==', userId),
        limit(100)
      );
      snapshot = await getDocs(q);
    } catch (err) {
      // Fallback: get all scans and filter by userId
      const allScans = await getDocs(query(collection(db, 'ocrScans'), limit(200)));
      snapshot = {
        docs: allScans.docs.filter(d => !userId || d.data().userId === userId)
      };
    }
    
    console.log('📦 Firebase: Found', snapshot.docs.length, 'OCR scans');
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : new Date(),
    })).sort((a: any, b: any) => (b.timestamp?.getTime?.() || 0) - (a.timestamp?.getTime?.() || 0)) as OCRScanLog[];
  } catch (error) {
    console.error('❌ Firebase: Error fetching user OCR scans:', error);
    return [];
  }
}

// ============================================
// COMPLIANCE CHECK LOGGING
// ============================================

export interface ComplianceCheckLog {
  id?: string;
  userId: string;
  userName: string;
  productName: string;
  platform?: string;
  category?: string;
  productUrl?: string;
  isCompliant: boolean;
  issues: string[];
  complianceScore: number;
  violations?: any[];
  timestamp: Date;
}

export async function logComplianceCheck(
  userId: string,
  userName: string,
  productName: string,
  isCompliant: boolean,
  issues: string[],
  complianceScore: number,
  metadata?: {
    platform?: string;
    category?: string;
    productUrl?: string;
    violations?: any[];
  }
): Promise<void> {
  try {
    console.log('🔥 Firebase: Starting logComplianceCheck...');
    console.log('📝 Data:', { userId, userName, productName, isCompliant, complianceScore });
    
    // Add to complianceChecks collection
    const docRef = await addDoc(collection(db, 'complianceChecks'), {
      userId,
      userName,
      productName,
      isCompliant,
      issues,
      complianceScore,
      platform: metadata?.platform || 'E-Commerce',
      category: metadata?.category || 'Packaged Goods',
      productUrl: metadata?.productUrl || '',
      violations: metadata?.violations || [],
      timestamp: Timestamp.now(),
    });
    
    console.log('✅ Firebase: Compliance check added with ID:', docRef.id);

    // Update user stats
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.log('⚠️ Firebase: User document does not exist, creating it...');
      await setDoc(userRef, {
        id: userId,
        name: userName,
        stats: { ocrScans: 0, complianceChecks: 1, searches: 0 },
        createdAt: Timestamp.now(),
      });
      console.log('✅ Firebase: User document created');
    } else {
      console.log('📊 Firebase: Updating existing user stats...');
      const userData = userDoc.data();
      
      if (!userData.stats) {
        console.log('⚠️ Firebase: Stats field missing, initializing...');
        await updateDoc(userRef, {
          stats: { ocrScans: 0, complianceChecks: 1, searches: 0 },
        });
      } else {
        console.log('Current stats:', userData.stats);
        await updateDoc(userRef, {
          'stats.complianceChecks': increment(1),
        });
      }
      
      console.log('✅ Firebase: User stats updated!');
    }
    
  } catch (error) {
    console.error('❌ Firebase: Error logging compliance check:', error);
    throw error;
  }
}

export async function getComplianceChecks(
  limitCount: number = 50,
  lastDoc?: QueryDocumentSnapshot<DocumentData>
): Promise<{ checks: ComplianceCheckLog[]; lastVisible: QueryDocumentSnapshot<DocumentData> | null }> {
  try {
    let q = query(
      collection(db, 'complianceChecks'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const snapshot = await getDocs(q);
    const checks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate(),
    })) as ComplianceCheckLog[];

    const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;

    return { checks, lastVisible };
  } catch (error) {
    console.error('Error fetching compliance checks:', error);
    throw error;
  }
}

export async function getUserComplianceChecks(userId: string): Promise<ComplianceCheckLog[]> {
  try {
    console.log('🔍 Firebase: Fetching compliance checks for user:', userId);
    
    let snapshot;
    try {
      const q = query(
        collection(db, 'complianceChecks'),
        where('userId', '==', userId),
        limit(100)
      );
      snapshot = await getDocs(q);
    } catch (err) {
      // Fallback: get all compliance checks and filter
      const allDocs = await getDocs(query(collection(db, 'complianceChecks'), limit(200)));
      snapshot = {
        docs: allDocs.docs.filter(d => !userId || d.data().userId === userId)
      };
    }
    
    console.log('📦 Firebase: Found', snapshot.docs.length, 'compliance checks');
    
    const checks = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId || '',
        userName: data.userName || 'Anonymous',
        productName: data.productName || 'Scanned Product',
        platform: data.platform || 'E-Commerce',
        category: data.category || 'Packaged Commodities',
        productUrl: data.productUrl || '',
        isCompliant: typeof data.isCompliant === 'boolean' ? data.isCompliant : ((data.complianceScore ?? 0) >= 80),
        issues: data.issues || [],
        complianceScore: typeof data.complianceScore === 'number' ? data.complianceScore : 75,
        violations: data.violations || [],
        timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(),
      };
    }) as ComplianceCheckLog[];
    
    return checks.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  } catch (error) {
    console.error('❌ Firebase: Error fetching user compliance checks:', error);
    return [];
  }
}

// ============================================
// SEARCH LOGGING
// ============================================

export interface SearchLog {
  id?: string;
  userId: string;
  userName: string;
  query: string;
  resultsCount: number;
  timestamp: Date;
}

export async function logSearch(
  userId: string,
  userName: string,
  query: string,
  resultsCount: number
): Promise<void> {
  try {
    console.log('🔥 Firebase: Starting logSearch...');
    
    // Add to searches collection
    const docRef = await addDoc(collection(db, 'searches'), {
      userId,
      userName,
      query,
      resultsCount,
      timestamp: Timestamp.now(),
    });
    
    console.log('✅ Firebase: Search logged with ID:', docRef.id);

    // Update user stats
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      await setDoc(userRef, {
        id: userId,
        name: userName,
        stats: { ocrScans: 0, complianceChecks: 0, searches: 1 },
        createdAt: Timestamp.now(),
      });
    } else {
      const userData = userDoc.data();
      if (!userData.stats) {
        await updateDoc(userRef, {
          stats: { ocrScans: 0, complianceChecks: 0, searches: 1 },
        });
      } else {
        await updateDoc(userRef, {
          'stats.searches': increment(1),
        });
      }
    }
    
    console.log('✅ Firebase: User search stats updated!');
  } catch (error) {
    console.error('❌ Firebase: Error logging search:', error);
    throw error;
  }
}

export async function getSearches(
  limitCount: number = 50,
  lastDoc?: QueryDocumentSnapshot<DocumentData>
): Promise<{ searches: SearchLog[]; lastVisible: QueryDocumentSnapshot<DocumentData> | null }> {
  try {
    let q = query(
      collection(db, 'searches'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const snapshot = await getDocs(q);
    const searches = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : new Date(),
    })) as SearchLog[];

    const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;

    return { searches, lastVisible };
  } catch (error) {
    console.error('Error fetching searches:', error);
    throw error;
  }
}

export async function getUserSearches(userId: string): Promise<SearchLog[]> {
  try {
    console.log('🔍 Firebase: Fetching searches for user:', userId);
    
    let snapshot;
    try {
      const q = query(
        collection(db, 'searches'),
        where('userId', '==', userId),
        limit(100)
      );
      snapshot = await getDocs(q);
    } catch (err) {
      const allDocs = await getDocs(query(collection(db, 'searches'), limit(200)));
      snapshot = {
        docs: allDocs.docs.filter(d => !userId || d.data().userId === userId)
      };
    }
    
    console.log('📦 Firebase: Found', snapshot.docs.length, 'searches');
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : new Date(),
    })).sort((a: any, b: any) => (b.timestamp?.getTime?.() || 0) - (a.timestamp?.getTime?.() || 0)) as SearchLog[];
  } catch (error) {
    console.error('❌ Firebase: Error fetching user searches:', error);
    throw error;
  }
}

// ... rest of your code (ActivityStats, RecentActivity, exportAllData) remains the same
// ============================================
// ANALYTICS & STATISTICS
// ============================================

export interface ActivityStats {
  totalOCRScans: number;
  totalComplianceChecks: number;
  totalSearches: number;
  totalUsers: number;
  activeUsersToday: number;
  averageComplianceScore: number;
}

export async function getActivityStats(): Promise<ActivityStats> {
  try {
    const [ocrScans, complianceChecks, searches, users] = await Promise.all([
      getDocs(collection(db, 'ocrScans')),
      getDocs(collection(db, 'complianceChecks')),
      getDocs(collection(db, 'searches')),
      getDocs(collection(db, 'users')),
    ]);

    // Calculate average compliance score
    const complianceScores = complianceChecks.docs.map(doc => doc.data().complianceScore || 0);
    const averageComplianceScore = complianceScores.length > 0
      ? complianceScores.reduce((a, b) => a + b, 0) / complianceScores.length
      : 0;

    // Count active users today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activeUsersToday = users.docs.filter(doc => {
      const lastLogin = doc.data().lastLogin?.toDate();
      return lastLogin && lastLogin >= today;
    }).length;

    return {
      totalOCRScans: ocrScans.size,
      totalComplianceChecks: complianceChecks.size,
      totalSearches: searches.size,
      totalUsers: users.size,
      activeUsersToday,
      averageComplianceScore: Math.round(averageComplianceScore * 10) / 10,
    };
  } catch (error) {
    console.error('Error fetching activity stats:', error);
    throw error;
  }
}

export interface RecentActivity {
  type: 'ocr' | 'compliance' | 'search';
  userName: string;
  description: string;
  timestamp: Date;
}

export async function getRecentActivity(limitCount: number = 20): Promise<RecentActivity[]> {
  try {
    const [ocrScans, complianceChecks, searches] = await Promise.all([
      getDocs(query(collection(db, 'ocrScans'), orderBy('timestamp', 'desc'), limit(10))),
      getDocs(query(collection(db, 'complianceChecks'), orderBy('timestamp', 'desc'), limit(10))),
      getDocs(query(collection(db, 'searches'), orderBy('timestamp', 'desc'), limit(10))),
    ]);

    const activities: RecentActivity[] = [
      ...ocrScans.docs.map(doc => ({
        type: 'ocr' as const,
        userName: doc.data().userName,
        description: `Scanned product with ${doc.data().confidence}% confidence`,
        timestamp: doc.data().timestamp?.toDate(),
      })),
      ...complianceChecks.docs.map(doc => ({
        type: 'compliance' as const,
        userName: doc.data().userName,
        description: `Checked "${doc.data().productName}" - ${doc.data().complianceScore}% compliant`,
        timestamp: doc.data().timestamp?.toDate(),
      })),
      ...searches.docs.map(doc => ({
        type: 'search' as const,
        userName: doc.data().userName,
        description: `Searched for "${doc.data().query}" - ${doc.data().resultsCount} results`,
        timestamp: doc.data().timestamp?.toDate(),
      })),
    ];

    // Sort by timestamp and limit
    return activities
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limitCount);
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    throw error;
  }
}

// ============================================
// EXPORT UTILITIES
// ============================================

export async function exportAllData(): Promise<{
  users: User[];
  ocrScans: OCRScanLog[];
  complianceChecks: ComplianceCheckLog[];
  searches: SearchLog[];
}> {
  try {
    const [users, ocrScansSnapshot, complianceChecksSnapshot, searchesSnapshot] = await Promise.all([
      getAllUsers(),
      getDocs(collection(db, 'ocrScans')),
      getDocs(collection(db, 'complianceChecks')),
      getDocs(collection(db, 'searches')),
    ]);

    const ocrScans = ocrScansSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate(),
    })) as OCRScanLog[];

    const complianceChecks = complianceChecksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate(),
    })) as ComplianceCheckLog[];

    const searches = searchesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate(),
    })) as SearchLog[];

    return { users, ocrScans, complianceChecks, searches };
  } catch (error) {
    console.error('Error exporting data:', error);
    throw error;
  }
}

export async function getAllComplianceReports(): Promise<{
  complianceChecks: ComplianceCheckLog[];
  ocrScans: OCRScanLog[];
  searches: SearchLog[];
}> {
  try {
    const [complianceChecksSnapshot, ocrScansSnapshot, searchesSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'complianceChecks'), orderBy('timestamp', 'desc'), limit(500))),
      getDocs(query(collection(db, 'ocrScans'), orderBy('timestamp', 'desc'), limit(500))),
      getDocs(query(collection(db, 'searches'), orderBy('timestamp', 'desc'), limit(500))),
    ]);

    const complianceChecks = complianceChecksSnapshot.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        userId: d.userId || '',
        userName: d.userName || 'Anonymous',
        productName: d.productName || 'Unknown Product',
        platform: d.platform || 'E-Commerce',
        category: d.category || 'Packaged Goods',
        productUrl: d.productUrl || '',
        isCompliant: typeof d.isCompliant === 'boolean' ? d.isCompliant : ((d.complianceScore ?? 0) >= 80),
        issues: d.issues || [],
        complianceScore: typeof d.complianceScore === 'number' ? d.complianceScore : 75,
        violations: d.violations || [],
        timestamp: d.timestamp?.toDate ? d.timestamp.toDate() : new Date(),
      };
    }) as ComplianceCheckLog[];

    const ocrScans = ocrScansSnapshot.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        userId: d.userId || '',
        userName: d.userName || 'Inspector',
        extractedText: d.extractedText || '',
        confidence: d.confidence || 0,
        provider: d.provider || 'OCR Engine',
        timestamp: d.timestamp?.toDate ? d.timestamp.toDate() : new Date(),
      };
    }) as OCRScanLog[];

    const searches = searchesSnapshot.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        userId: d.userId || '',
        userName: d.userName || '',
        query: d.query || '',
        resultsCount: d.resultsCount || 0,
        timestamp: d.timestamp?.toDate ? d.timestamp.toDate() : new Date(),
      };
    }) as SearchLog[];

    return { complianceChecks, ocrScans, searches };
  } catch (error) {
    console.error('Error in getAllComplianceReports:', error);
    return { complianceChecks: [], ocrScans: [], searches: [] };
  }
}