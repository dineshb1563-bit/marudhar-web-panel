import { NextResponse } from 'next/server';
import admin from '../admin';

const db = admin.firestore();

// Token verify ko thoda fast rakha hai
async function verifyAuthToken(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return { error: 'No token provided', status: 401 };
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    return { user: decodedToken, error: null };
  } catch (error) {
    return { error: 'Invalid token', status: 401 };
  }
}

export async function POST(request) {
  try {
    const auth = await verifyAuthToken(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { programId, userId, ageGroups } = await request.json();
    if (!programId || !userId || !ageGroups) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    if (auth.user.uid !== userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    // 1. Optimize Age Group Lookup: Pehle hi sort karke memory mein rakho
    const sortedAgeGroups = [...ageGroups].sort((a, b) => a.startAge - b.startAge);

    const membersRef = db.collection('users').doc(userId).collection('programs').doc(programId).collection('members');

    // 2. Fetch only necessary fields to save memory and speed up
    const membersSnapshot = await membersRef
      .where('delete_flag', '==', false)
      .select('bobDate', 'dateJoin') // Sirf wahi fields lo jo calculation mein chahiye
      .get();

    if (membersSnapshot.empty) {
      return NextResponse.json({ success: true, updatedCount: 0 });
    }

    // Age calculation logic (Fast version)
    const calculateUpdate = (memberData) => {
      const { bobDate, dateJoin } = memberData;
      if (!bobDate || !dateJoin) return null;

      const [bDay, bMonth, bYear] = bobDate.split('-').map(Number);
      const [jDay, jMonth, jYear] = dateJoin.split('-').map(Number);
      
      const birthDate = new Date(bYear, bMonth - 1, bDay);
      const joinDate = new Date(jYear, jMonth - 1, jDay);
      
      let age = joinDate.getFullYear() - birthDate.getFullYear();
      const m = joinDate.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && joinDate.getDate() < birthDate.getDate())) age--;

      // Logic for matching group
      let matchingGroup = sortedAgeGroups.find(g => age >= g.startAge && age < g.endAge);
      if (!matchingGroup) {
        if (age < sortedAgeGroups[0].startAge) matchingGroup = sortedAgeGroups[0];
        else matchingGroup = sortedAgeGroups[sortedAgeGroups.length - 1];
      }
      return matchingGroup;
    };

    // 3. Batch Splitting (Firestore limit is 500)
    const chunks = [];
    const batchSize = 450; // Safety margin
    let currentBatch = db.batch();
    let countInBatch = 0;
    let totalUpdated = 0;

    membersSnapshot.docs.forEach((doc) => {
      const match = calculateUpdate(doc.data());
      if (match) {
        currentBatch.update(doc.ref, {
          ageGroup: match.id,
          joinFees: match.joinFee,
          payAmount: match.payAmount,
          ageGroupRange: `${match.startAge}-${match.endAge}`,
          updatedAt: admin.firestore.FieldValue.serverTimestamp() // Faster than new Date()
        });
        
        countInBatch++;
        totalUpdated++;

        if (countInBatch === batchSize) {
          chunks.push(currentBatch.commit());
          currentBatch = db.batch();
          countInBatch = 0;
        }
      }
    });

    // 4. Last batch commit
    if (countInBatch > 0) chunks.push(currentBatch.commit());

    // Execute all batches in parallel
    await Promise.all(chunks);

    return NextResponse.json({
      success: true,
      updatedCount: totalUpdated,
      message: `Updated ${totalUpdated} members`
    });

  } catch (error) {
    console.error('Fast update error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}