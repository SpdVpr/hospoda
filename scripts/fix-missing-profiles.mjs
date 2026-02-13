/**
 * Fix Missing Firestore User Profiles
 * 
 * This script creates Firestore user documents for Firebase Auth users 
 * that are missing their profile documents.
 * 
 * Usage: node scripts/fix-missing-profiles.mjs
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAN84dIGFAUFdWCbpV_tr_xgh4gOSvwe9E",
    authDomain: "hospoda-5ccde.firebaseapp.com",
    projectId: "hospoda-5ccde",
    storageBucket: "hospoda-5ccde.firebasestorage.app",
    messagingSenderId: "477793660632",
    appId: "1:477793660632:web:190242bcba75654c4cb1ad",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Users missing from Firestore (from Firebase Auth)
const missingUsers = [
    {
        uid: "oJ2W6VfiXQUV358IXRlEWXlnyFl1",
        email: "valeriepodivinska@seznam.cz",
        displayName: "Valerie Podivínská",
    },
    {
        uid: "GmOWXt6c1YVVx5iVMCPWJWC1e3u2",
        email: "andrea.mus@seznam.cz",
        displayName: "Andrea Mus",
    },
    {
        uid: "M2ObW2sL79WkvDhEF72ELNmSe5N2",
        email: "vojtahacsik@icloud.com",
        displayName: "Vojta Háčšík",
    },
    {
        uid: "2AoJVG8hvDg9cmgHmmAj5nbbLwm2",
        email: "vojta@hospodavesnice.cz",
        displayName: "Vojta",
    },
];

async function fixProfiles() {
    console.log("═══════════════════════════════════════════");
    console.log("  Fix Missing Firestore Profiles");
    console.log("═══════════════════════════════════════════\n");

    for (const user of missingUsers) {
        const profileRef = doc(db, 'users', user.uid);

        // Check if document already exists
        const snap = await getDoc(profileRef);
        if (snap.exists()) {
            console.log(`✓ SKIP: ${user.email} — profile already exists`);
            continue;
        }

        // Create the profile
        try {
            await setDoc(profileRef, {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                role: "employee",
                isActive: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            console.log(`✓ CREATED: ${user.email} (${user.uid})`);
        } catch (err) {
            console.error(`✕ FAILED: ${user.email}:`, err.message || err);
        }
    }

    console.log("\n═══════════════════════════════════════════");
    console.log("  Done! Users should now see their profiles.");
    console.log("═══════════════════════════════════════════");
    process.exit(0);
}

fixProfiles();
