
import { db } from './firebase';
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { VocabWord } from '../types';

// Helper to get today's date string YYYY-MM-DD
const getTodayDateString = () => {
    return new Date().toISOString().split('T')[0];
};

export const getTodaysWords = async (): Promise<VocabWord[] | null> => {
    const today = getTodayDateString();
    const docRef = doc(db, 'words', today);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        return data.words as VocabWord[];
    } else {
        return null;
    }
};

export const saveTodaysWords = async (words: VocabWord[]): Promise<void> => {
    const today = getTodayDateString();
    const docRef = doc(db, 'words', today);

    await setDoc(docRef, {
        words: words,
        createdAt: serverTimestamp()
    });
};

export const subscribeEmail = async (email: string): Promise<boolean> => {
    try {
        const subscribersRef = collection(db, 'subscribers');
        // In a real app we might check for duplicates, but for this demo simplifying
        await addDoc(subscribersRef, {
            email,
            subscribedAt: serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error("Error subscribing:", error);
        return false;
    }
};
