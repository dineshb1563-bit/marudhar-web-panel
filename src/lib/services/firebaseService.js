import {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    orderBy,
    where
} from "firebase/firestore";
import { db } from "../firebase";

/* ------------------------------------------
   1. GET DATA (ONE TIME)
------------------------------------------- */
export async function getData(
    collectionName,
    filters = [],
    order = null,
    limitCount = null
) {
    let q = collection(db, collectionName);

    // Apply filters
    if (filters.length > 0) {
        q = query(
            q,
            ...filters.map((f) => where(f.field, f.operator, f.value))
        );
    }

    // Apply orderBy
    if (order) {
        q = query(q, orderBy(order.field, order.direction || "asc"));
    }

    // Apply limit
    if (limitCount) {
        q = query(q, limit(limitCount));
    }

    // Final query
    const snapshot = await getDocs(q);
console.log(snapshot.docs.length,"size")
    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    }));
}
/* ------------------------------------------
   2. LIVE DATA (REAL-TIME)
------------------------------------------- */
export function liveData(collectionName, callback) {
    const q = query(collection(db, collectionName), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
        callback(data);
    });

    return unsubscribe; // stop listener when not needed
}

/* ------------------------------------------
   3. ADD DATA
------------------------------------------- */
export async function createData(collectionName, data) {
    return await addDoc(collection(db, collectionName), {
        ...data,
        createdAt: new Date(),
    });
}

/* ------------------------------------------
   4. UPDATE DATA
------------------------------------------- */
export async function updateData(collectionName, id, data) {
    const docRef = doc(db, collectionName, id);
    return await updateDoc(docRef, data);
}

/* ------------------------------------------
   5. DELETE DATA
------------------------------------------- */
export async function deleteData(collectionName, id) {
    const docRef = doc(db, collectionName, id);
    return await deleteDoc(docRef);
}

export const createProgram = async (userId, programData) => {
  try {
    const programsRef = collection(db, "users", userId, "programs");
    const docRef = await addDoc(programsRef, {
      ...programData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error creating program:", error);
    throw error;
  }
};

export const updateProgram = async (userId, programId, programData) => {
  try {
    const programRef = doc(db, "users", userId, "programs", programId);
    await updateDoc(programRef, {
      ...programData,
      updatedAt: new Date(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error updating program:", error);
    throw error;
  }
};

export const deleteProgram = async (userId, programId) => {
  try {
    const programRef = doc(db, "users", userId, "programs", programId);
    await deleteDoc(programRef);
    return { success: true };
  } catch (error) {
    console.error("Error deleting program:", error);
    throw error;
  }
};

export const getSelectedProgram = async (userId) => {
  try {
    const programsRef = collection(db, "users", userId, "programs");
    const q = query(programsRef, where("isSelected", "==", true));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    console.error("Error getting selected program:", error);
    throw error;
  }
};

export function createSearchIndex(data) {
  const indexSet = new Set();

  const addPrefixes = (text) => {
    const str = String(text).toLowerCase().trim();
    if (!str) return;

    // Add full text
    indexSet.add(str);
    
    // Add words split
    str.split(/\s+/).forEach(word => {
      if (word.length > 1) {
        indexSet.add(word);
        
        // Add prefixes for each word
        let prefix = "";
        for (const ch of word) {
          prefix += ch;
          if (prefix.length > 1) { // Skip single character prefixes
            indexSet.add(prefix);
          }
        }
      }
    });
  };

  const traverse = (value) => {
    if (value === null || value === undefined) return;

    if (typeof value === "object") {
      if (Array.isArray(value)) {
        value.forEach(v => traverse(v));
      } else {
        Object.values(value).forEach(v => traverse(v));
      }
    } else {
      addPrefixes(value);
    }
  };

  traverse(data);

  return Array.from(indexSet).filter(item => item.length > 0);
}