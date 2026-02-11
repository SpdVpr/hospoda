'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, useRef } from 'react';
import { collection, query, getDocs, addDoc, deleteDoc, doc, serverTimestamp, updateDoc, arrayUnion, arrayRemove, orderBy, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { GalleryPhoto } from '@/types';
import styles from './page.module.css';

export default function GalleryPage() {
    const { userProfile, isAdmin } = useAuth();
    const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null);
    const [caption, setCaption] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchPhotos = async () => {
        try {
            const photosQuery = query(collection(db, 'gallery'), orderBy('createdAt', 'desc'), limit(50));
            const photosSnap = await getDocs(photosQuery);
            setPhotos(photosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as GalleryPhoto[]);
        } catch (error) {
            console.error('Error fetching photos:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchPhotos(); }, []);

    // Komprese obrázku pomocí Canvas API
    const compressImage = (file: File, maxWidth: number = 1200, quality: number = 0.8): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;

                    // Zachovat poměr stran, max šířka
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('Canvas context not available'));
                        return;
                    }

                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                resolve(blob);
                            } else {
                                reject(new Error('Compression failed'));
                            }
                        },
                        'image/jpeg',
                        quality
                    );
                };
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target?.result as string;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !userProfile) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Prosím vyberte pouze obrázky.');
            return;
        }

        // Limit original file size to 20MB (will be compressed)
        if (file.size > 20 * 1024 * 1024) {
            alert('Obrázek je příliš velký. Maximum je 20 MB.');
            return;
        }

        setUploading(true);
        try {
            // Komprese obrázku před nahráním
            console.log(`Original size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
            const compressedBlob = await compressImage(file, 1200, 0.8);
            console.log(`Compressed size: ${(compressedBlob.size / 1024 / 1024).toFixed(2)} MB`);

            // Upload to Firebase Storage
            const timestamp = Date.now();
            const fileName = `gallery/${userProfile.uid}/${timestamp}.jpg`;
            const storageRef = ref(storage, fileName);

            // Nahrát komprimovaný blob
            await uploadBytes(storageRef, compressedBlob, {
                contentType: 'image/jpeg',
            });
            const imageUrl = await getDownloadURL(storageRef);

            // Save to Firestore
            await addDoc(collection(db, 'gallery'), {
                imageUrl,
                storagePath: fileName,
                caption: caption || '',
                uploadedBy: userProfile.uid,
                uploadedByName: userProfile.displayName,
                uploadedByPhoto: userProfile.photoURL || null,
                likes: [],
                createdAt: serverTimestamp(),
            });

            setCaption('');
            if (fileInputRef.current) fileInputRef.current.value = '';
            fetchPhotos();
        } catch (error: any) {
            console.error('Error uploading photo:', error);
            alert(`Nahrávání selhalo: ${error.message || 'Neznámá chyba'}. Zkuste to prosím znovu.`);
        } finally {
            setUploading(false);
        }
    };

    const handleLike = async (photo: GalleryPhoto) => {
        if (!userProfile) return;
        const photoRef = doc(db, 'gallery', photo.id);
        const isLiked = photo.likes?.includes(userProfile.uid);

        try {
            await updateDoc(photoRef, {
                likes: isLiked ? arrayRemove(userProfile.uid) : arrayUnion(userProfile.uid)
            });
            // Optimistic update
            setPhotos(prev => prev.map(p =>
                p.id === photo.id
                    ? {
                        ...p, likes: isLiked
                            ? (p.likes || []).filter(id => id !== userProfile.uid)
                            : [...(p.likes || []), userProfile.uid]
                    }
                    : p
            ));
        } catch (error) {
            console.error('Error liking photo:', error);
        }
    };

    const handleDelete = async (photo: GalleryPhoto) => {
        if (!userProfile) return;
        // Only allow delete for photo owner or admin
        if (photo.uploadedBy !== userProfile.uid && !isAdmin) return;
        if (!confirm('Opravdu chcete smazat tuto fotku?')) return;

        try {
            // Delete from Storage using storagePath
            if (photo.storagePath) {
                try {
                    const storageRef = ref(storage, photo.storagePath);
                    await deleteObject(storageRef);
                } catch (storageError) {
                    // Image might not exist in storage, continue anyway
                    console.warn('Could not delete from storage:', storageError);
                }
            }
            // Delete from Firestore
            await deleteDoc(doc(db, 'gallery', photo.id));
            setSelectedPhoto(null);
            fetchPhotos();
        } catch (error) {
            console.error('Error deleting photo:', error);
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours < 1) return 'právě teď';
        if (hours < 24) return `před ${hours}h`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `před ${days}d`;
        return date.toLocaleDateString('cs-CZ');
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>INSTAVES</h1>
                    <p className={styles.subtitle}>Vesnický Instagram – sdílejte společné momenty</p>
                </div>
            </div>

            {/* Upload Section */}
            <div className={styles.uploadSection}>
                <div className={styles.uploadBox}>
                    <input
                        type="text"
                        className={styles.captionInput}
                        placeholder="Přidejte popisek... (volitelné)"
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                    />
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className={styles.fileInput}
                        id="photo-upload"
                        disabled={uploading}
                    />
                    <label htmlFor="photo-upload" className={styles.uploadBtn}>
                        {uploading ? (
                            <span className={styles.uploadingSpinner}>Nahrávám...</span>
                        ) : (
                            <span>Přidat fotku</span>
                        )}
                    </label>
                </div>
            </div>

            {/* Photo Grid */}
            {loading ? (
                <div className={styles.loading}>
                    {[...Array(6)].map((_, i) => <div key={i} className={styles.skeleton}></div>)}
                </div>
            ) : photos.length === 0 ? (
                <div className={styles.empty}>
                    <p>Zatím žádné fotky</p>
                    <p className={styles.emptySubtext}>Buďte první, kdo přidá fotku!</p>
                </div>
            ) : (
                <div className={styles.photoGrid}>
                    {photos.map((photo) => (
                        <div
                            key={photo.id}
                            className={styles.photoCard}
                            onClick={() => setSelectedPhoto(photo)}
                        >
                            <img src={photo.imageUrl} alt={photo.caption || 'INSTAVES'} className={styles.photoImg} />
                            <div className={styles.photoOverlay}>
                                <span className={styles.likeCount}>{photo.likes?.length || 0}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Lightbox Modal */}
            {selectedPhoto && (
                <div className={styles.lightbox} onClick={() => setSelectedPhoto(null)}>
                    <div className={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
                        <button className={styles.closeBtn} onClick={() => setSelectedPhoto(null)}>×</button>

                        <img src={selectedPhoto.imageUrl} alt={selectedPhoto.caption || 'INSTAVES'} className={styles.lightboxImg} />

                        <div className={styles.lightboxInfo}>
                            <div className={styles.lightboxAuthor}>
                                {selectedPhoto.uploadedByPhoto ? (
                                    <img src={selectedPhoto.uploadedByPhoto} alt="" className={styles.authorPhoto} />
                                ) : (
                                    <div className={styles.authorInitials}>
                                        {selectedPhoto.uploadedByName?.charAt(0) || '?'}
                                    </div>
                                )}
                                <div className={styles.authorDetails}>
                                    <span className={styles.authorName}>{selectedPhoto.uploadedByName}</span>
                                    <span className={styles.photoDate}>{formatDate(selectedPhoto.createdAt)}</span>
                                </div>
                            </div>

                            {selectedPhoto.caption && (
                                <p className={styles.lightboxCaption}>{selectedPhoto.caption}</p>
                            )}

                            <div className={styles.lightboxActions}>
                                <button
                                    className={`${styles.likeBtn} ${selectedPhoto.likes?.includes(userProfile?.uid || '') ? styles.liked : ''}`}
                                    onClick={() => handleLike(selectedPhoto)}
                                >
                                    {selectedPhoto.likes?.includes(userProfile?.uid || '') ? 'Líbí se' : 'To se mi líbí'}
                                    ({selectedPhoto.likes?.length || 0})
                                </button>

                                {(selectedPhoto.uploadedBy === userProfile?.uid || isAdmin) && (
                                    <button
                                        className={styles.deletePhotoBtn}
                                        onClick={() => handleDelete(selectedPhoto)}
                                    >
                                        Smazat
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
