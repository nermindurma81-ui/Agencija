import { collection, addDoc, getDocs, query, where, writeBatch, doc } from 'firebase/firestore';
import { db } from './firebase';

export interface PublicApiEntry {
  API: string;
  Description: string;
  Auth: string;
  HTTPS: boolean;
  Cors: string;
  Link: string;
  Category: string;
}

export async function syncPublicApis() {
  try {
    // Using a reliable mirror/source for public-apis data
    const response = await fetch('https://raw.githubusercontent.com/davemachado/public-api/master/data/entries.json');
    const data = await response.json();
    const entries: PublicApiEntry[] = data.entries;

    if (!entries || entries.length === 0) throw new Error("No entries found");

    // We'll store them in chunks to avoid Firestore limits
    const collectionRef = collection(db, 'publicApis');
    
    // Clear existing (optional, but good for "update")
    // For simplicity in this demo, we'll just add new ones or update by name
    // A full clear would require deleting all docs first
    
    let count = 0;
    const batchSize = 500;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = entries.slice(i, i + batchSize);
      
      chunk.forEach(entry => {
        const docRef = doc(collectionRef); // Random ID
        batch.set(docRef, {
          ...entry,
          updatedAt: new Date().toISOString()
        });
      });
      
      await batch.commit();
      count += chunk.length;
      console.log(`Synced ${count} APIs...`);
    }

    return count;
  } catch (error) {
    console.error("Error syncing Public APIs:", error);
    throw error;
  }
}

export async function searchPublicApis(searchTerm: string) {
  try {
    const q = query(
      collection(db, 'publicApis'),
      where('Category', '==', searchTerm) // Firestore doesn't support easy full-text search without extensions
    );
    
    // Since Firestore is limited, we might fetch all and filter client-side if the collection is small,
    // but here it's ~1400 entries. 
    // Better approach for this demo: fetch by category or just do a simple keyword search if we had an index.
    // For now, let's fetch a sample or use a specific category.
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as PublicApiEntry);
  } catch (error) {
    console.error("Error searching Public APIs:", error);
    return [];
  }
}
