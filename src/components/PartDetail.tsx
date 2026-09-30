import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, deleteField } from 'firebase/firestore';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Package,
  MapPin,
  Calendar,
  AlertTriangle,
  Upload,
  X,
  Image as ImageIcon,
  Save,
  FileText,
  Maximize2,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { useERP } from '../context/ERPContext';
import { Part } from '../types';
import { db } from '../firebase';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { compressImage, withTimeout } from '../utils/imageCompressor';

// ─── PartDetailPage ──────────────────────────────────────────────────────────
// Route-aware wrapper. Reads :partId from the URL, fetches the part directly
// from Firestore, and renders the detail UI. Works on refresh, new tab, and
// direct URL access.

export const PartDetailPage: React.FC = () => {
  const { partId } = useParams<{ partId: string }>();
  const navigate = useNavigate();

  const [part, setPart] = useState<Part | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState('');

  // Fetch part directly from Firestore using the URL param
  useEffect(() => {
    if (!partId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setFetchError('');

    const fetchPart = async () => {
      try {
        const partRef = doc(db, 'parts', partId);
        const snap = await getDoc(partRef);

        if (cancelled) return;

        if (!snap.exists()) {
          setNotFound(true);
        } else {
          setPart({ id: snap.id, ...snap.data() } as Part);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to fetch part:', err);
        setFetchError('Failed to load part. Please check your connection and try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchPart();
    return () => { cancelled = true; };
  }, [partId]);

  const handleBack = () => {
    // Go back in history if possible, otherwise fall through to Parts tab
    navigate(-1);
  };

  const handleEdit = (updatedPart: Part) => {
    // Refresh the part data after an edit
    setPart(updatedPart);
  };

  const handlePartUpdated = (updated: Part) => {
    setPart(updated);
  };

  const handlePartDeleted = () => {
    navigate(-1);
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-12 text-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500 text-sm">Loading part details...</p>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (fetchError) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-12 text-center">
        <AlertTriangle className="h-16 w-16 text-red-300 mx-auto mb-4" />
        <p className="text-slate-700 font-semibold mb-2">Could not load part</p>
        <p className="text-slate-500 text-sm mb-6">{fetchError}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => { setLoading(true); setFetchError(''); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
          >
            Retry
          </button>
          <button
            onClick={handleBack}
            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50"
          >
            Back to Parts
          </button>
        </div>
      </div>
    );
  }

  // ── Not found state ────────────────────────────────────────────────────────
  if (notFound || !part) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-12 text-center">
        <Package className="h-16 w-16 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-700 font-semibold mb-2">Part not found</p>
        <p className="text-slate-500 text-sm mb-6">
          This part may have been deleted or the link is invalid.
        </p>
        <button
          onClick={handleBack}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
        >
          Return to Parts Master
        </button>
      </div>
    );
  }

  // ── Part loaded — render detail UI ─────────────────────────────────────────
  return (
    <PartDetailUI
      part={part}
      onBack={handleBack}
      onPartUpdated={handlePartUpdated}
      onPartDeleted={handlePartDeleted}
    />
  );
};

// ─── PartDetail (legacy inline usage from PartsMaster) ───────────────────────
// Kept for backward compatibility. Uses the part already in context/props.

interface PartDetailProps {
  partId: string;
  onBack: () => void;
  onEdit: (part: Part) => void;
}

export const PartDetail: React.FC<PartDetailProps> = ({ partId, onBack, onEdit }) => {
  const { parts } = useERP();
  const part = parts.find((p) => p.id === partId) ?? null;

  if (!part) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-12 text-center">
        <Package className="h-16 w-16 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500">Part not found</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
        >
          Back to Parts
        </button>
      </div>
    );
  }

  return (
    <PartDetailUI
      part={part}
      onBack={onBack}
      onPartUpdated={() => { /* context subscription keeps part fresh */ }}
      onPartDeleted={onBack}
    />
  );
};

// ─── PartDetailUI ─────────────────────────────────────────────────────────────
// Pure presentational component — receives a Part and callbacks. Handles
// image upload, notes editing, and delete. No routing logic here.

interface PartDetailUIProps {
  part: Part;
  onBack: () => void;
  onPartUpdated: (part: Part) => void;
  onPartDeleted: () => void;
}

const PartDetailUI: React.FC<PartDetailUIProps> = ({
  part,
  onBack,
  onPartUpdated,
  onPartDeleted,
}) => {
  const { updatePart, deletePart } = useERP();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [notes, setNotes] = useState(part.notes || '');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  // Upload States
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Keep local notes in sync if the part prop changes (e.g. after a re-fetch)
  useEffect(() => {
    if (!isEditingNotes) {
      setNotes(part.notes || '');
    }
  }, [part.notes, isEditingNotes]);

  const isLowStock = part.stock <= part.minStock;
  const profitMargin = part.retailPrice - part.purchasePrice;
  const profitPercentage = Math.round((profitMargin / part.purchasePrice) * 100);

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      await updatePart(part.id, { notes: notes.trim() || undefined });
      setIsEditingNotes(false);
      onPartUpdated({ ...part, notes: notes.trim() || undefined });
    } catch (err) {
      alert('Failed to save notes');
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be re-selected after an error
    if (fileInputRef.current) fileInputRef.current.value = '';

    setUploadError('');
    setUploadSuccess(false);

    // ── Client-side validation ───────────────────────────────────────────────
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError('فائل کی قسم درست نہیں۔ براہ کرم JPG, PNG, GIF یا WEBP تصویر منتخب کریں۔');
      return;
    }

    setIsUploadingImage(true);
    setUploadStatus('فوری کمپریشن اور محفوظ کا عمل جاری ہے...');

    try {
      // ── Step 1: Instant Canvas Compression (~30ms) -> generates crisp ~35KB image ────
      const compressed = await compressImage(file, 700, 0.75);

      // ── Step 2: INSTANT SAVE: Commit compressed image directly to Firestore (< 100ms) ────
      await updatePart(part.id, { imageUrl: compressed.dataUrl });
      onPartUpdated({ ...part, imageUrl: compressed.dataUrl });

      // Immediate success response - user sees image on screen INSTANTLY (< 1 second)
      setIsUploadingImage(false);
      setUploadStatus('');
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);

      // ── Step 3: NON-BLOCKING BACKGROUND STORAGE SYNC (Strict 2.5s Timeout) ──────────────
      // Operates silently in the background without freezing the UI or delaying the user!
      if (navigator.onLine) {
        const previousImageUrl = part.imageUrl ?? null;
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `parts/${part.id}/${Date.now()}_${safeName}`;
        const newStorageRef = ref(storage, storagePath);

        withTimeout(
          uploadBytes(newStorageRef, compressed.blob).then(() => getDownloadURL(newStorageRef)),
          2500,
          'Storage timeout'
        )
          .then(async (cloudUrl) => {
            console.log('Background Cloud Storage Sync Successful:', cloudUrl);
            await updatePart(part.id, { imageUrl: cloudUrl });
            onPartUpdated({ ...part, imageUrl: cloudUrl });

            if (previousImageUrl && previousImageUrl.startsWith('http')) {
              try {
                await deleteObject(ref(storage, previousImageUrl));
              } catch (e) {
                /* non-fatal cleanup */
              }
            }
          })
          .catch((cloudErr) => {
            console.log('Background Storage sync skipped (using instant DB image):', cloudErr.message);
          });
      }

    } catch (err: any) {
      console.error('Instant upload error:', err);
      setUploadError(err.message || 'تصویر اپ لوڈ میں خرابی۔');
      setIsUploadingImage(false);
      setUploadStatus('');
    }
  };

  const handleRemoveImage = async () => {
    if (!part.imageUrl) {
      setUploadError('کوئی تصویر نہیں ہے۔');
      return;
    }
    
    if (!confirm('کیا آپ اس تصویر کو ہٹانا چاہتے ہیں؟')) return;

    setUploadError('');
    setUploadSuccess(false);
    setIsUploadingImage(true);
    setUploadStatus('تصویر ہٹائی جا رہی ہے...');

    const urlToDelete = part.imageUrl;

    try {
      // ── Step 1: Remove from Firestore ─────────────────────────────────────
      const partRef = doc(db, 'parts', part.id);
      await updateDoc(partRef, { imageUrl: deleteField() });

      // ── Step 2: Delete from Storage if it's a HTTP URL ───────────────────
      if (urlToDelete.startsWith('http')) {
        try {
          const storageRef = ref(storage, urlToDelete);
          await deleteObject(storageRef);
        } catch (storageErr) {
          console.warn('Storage Delete warning (non-fatal):', storageErr);
        }
      }

      setUploadError('');
      setUploadSuccess(true);
      onPartUpdated({ ...part, imageUrl: undefined });
      setTimeout(() => setUploadSuccess(false), 3000);

    } catch (err) {
      console.error('تصویر ہٹانے میں خرابی:', err);
      setUploadError(err instanceof Error ? err.message : 'تصویر ہٹانے میں خرابی۔');
    } finally {
      setIsUploadingImage(false);
      setUploadStatus('');
    }
  };

  const handleDelete = async () => {
    if (confirm(`Are you absolutely sure you want to delete "${part.name}"? This cannot be undone.`)) {
      try {
        await deletePart(part.id);
        onPartDeleted();
      } catch (err) {
        alert('Failed to delete part');
      }
    }
  };

  return (
    <div className="space-y-5">
      {/* Lightbox Image Preview Modal */}
      {isPreviewOpen && part.imageUrl && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center">
            <button
              onClick={() => setIsPreviewOpen(false)}
              className="absolute -top-12 right-0 p-2 text-white hover:text-slate-300 transition-colors"
              title="Close Preview"
            >
              <X className="h-6 w-6" />
            </button>
            <img
              src={part.imageUrl}
              alt={part.name}
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl border border-slate-800"
            />
            <div className="mt-3 text-center text-white">
              <p className="font-bold text-base">{part.name}</p>
              <p className="text-xs text-slate-400 font-mono">Part Code: {part.partNumber}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-base font-bold text-slate-800">Part Details</h1>
            <p className="text-[11px] text-slate-400 font-mono">
              Complete information and image management
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
          >
            <Edit className="h-3.5 w-3.5" />
            <span>Edit Part</span>
          </button>

          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Image and Basic Info */}
        <div className="space-y-5">
          {/* Part Image Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Part Image
              </h3>
              {part.imageUrl && (
                <button
                  onClick={() => setIsPreviewOpen(true)}
                  className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 font-semibold"
                >
                  <Maximize2 className="h-3 w-3" />
                  <span>Full View</span>
                </button>
              )}
            </div>

            <div className="aspect-square bg-slate-50 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden relative group">
              {part.imageUrl ? (
                <>
                  <img
                    src={part.imageUrl}
                    alt={part.name}
                    className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
                    onClick={() => setIsPreviewOpen(true)}
                  />
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    <button
                      onClick={handleRemoveImage}
                      disabled={isUploadingImage}
                      className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors shadow-md disabled:opacity-50"
                      title="Remove image"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center p-4">
                  <ImageIcon className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">تصویر اپ لوڈ نہیں ہے</p>
                </div>
              )}

              {isUploadingImage && (
                <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center p-4 text-center">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="text-xs font-semibold text-slate-700">{uploadStatus}</p>
                </div>
              )}
            </div>

            {uploadSuccess && (
              <div className="mt-2.5 p-2 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 text-xs flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>تصویر کامیابی سے اپ ڈیٹ ہو گئی!</span>
              </div>
            )}

            {uploadError && (
              <div className="mt-2.5 p-2 bg-red-50 text-red-700 rounded-lg border border-red-200 text-xs font-medium">
                {uploadError}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingImage}
              className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs disabled:opacity-50"
            >
              {isUploadingImage ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>اپ لوڈنگ جاری...</span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  <span>{part.imageUrl ? 'تصویر تبدیل کریں (Change Image)' : 'تصویر اپ لوڈ کریں (Upload Image)'}</span>
                </>
              )}
            </button>
            <p className="mt-2 text-[10px] text-slate-400 text-center">
              خودکار کمپریشن شامل ہے • JPG, PNG, WEBP
            </p>
          </div>

          {/* Category Badge */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <span className="text-[9px] bg-blue-50 text-blue-800 font-bold px-2 py-1 rounded uppercase">
              {part.category}
            </span>
            <h2 className="text-lg font-black text-slate-800 mt-2">{part.name}</h2>
            <p className="text-sm text-slate-500 font-medium mt-1">{part.brand}</p>
            <p className="text-xs text-slate-400 font-mono mt-1">Code: {part.partNumber}</p>
          </div>
        </div>

        {/* Middle Column - Details */}
        <div className="space-y-5">
          {/* Warehouse Details */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
              Warehouse Details
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between items-start text-sm py-2 border-b border-slate-100">
                <span className="text-slate-500">Rack Location:</span>
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-blue-500" />
                  {part.location || 'Not set'}
                </span>
              </div>

              <div className="flex justify-between items-start text-sm py-2 border-b border-slate-100">
                <span className="text-slate-500">Compatibility:</span>
                <span className="font-bold text-slate-800 font-mono">
                  {part.modelCompatibility || 'Universal'}
                </span>
              </div>

              <div className="flex justify-between items-start text-sm py-2 border-b border-slate-100">
                <span className="text-slate-500">Current Stock:</span>
                <span
                  className={`px-2 py-1 rounded-full font-bold text-xs ${
                    isLowStock
                      ? 'bg-red-50 text-red-600 border border-red-100'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {part.stock} units
                </span>
              </div>

              <div className="flex justify-between items-start text-sm py-2">
                <span className="text-slate-500">Min Stock Alert:</span>
                <span className="font-medium text-slate-600">{part.minStock} units</span>
              </div>
            </div>
          </div>

          {/* Pricing & Margin */}
          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 shadow-xs">
            <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-3">
              Pricing &amp; Margin
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-slate-500">Purchase Price:</span>
                <p className="font-mono font-bold text-slate-800 text-lg">
                  Rs. {part.purchasePrice.toLocaleString()}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Retail Price:</span>
                <p className="font-mono font-bold text-slate-800 text-lg">
                  Rs. {part.retailPrice.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-emerald-100">
              <div className="flex justify-between items-center">
                <span className="text-sm text-emerald-800 font-semibold">Profit per Unit:</span>
                <div className="text-right">
                  <span className="font-mono font-bold text-emerald-700 text-lg">
                    Rs. {profitMargin.toLocaleString()}
                  </span>
                  <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
                    {profitPercentage}%
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-emerald-100">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Total Stock Value:</span>
                <span className="font-mono font-bold text-slate-800">
                  Rs. {(part.stock * part.purchasePrice).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Stock Alert */}
          {isLowStock && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-100 flex gap-2 items-start text-xs leading-relaxed">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
              <div>
                <p className="font-bold">Low Stock Warning</p>
                <p>
                  Current stock ({part.stock}) is at or below minimum threshold ({part.minStock}).
                  Consider placing a new purchase order.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Notes & Metadata */}
        <div className="space-y-5">
          {/* Notes Section */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="h-4 w-4" />
                Internal Notes
              </h3>
              {!isEditingNotes && (
                <button
                  onClick={() => {
                    setNotes(part.notes || '');
                    setIsEditingNotes(true);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                >
                  {part.notes ? 'Edit' : 'Add Notes'}
                </button>
              )}
            </div>

            {isEditingNotes ? (
              <div className="space-y-2">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add identification details, machine compatibility, local names, or any internal reminders..."
                  rows={6}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-blue-500 resize-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>{isSavingNotes ? 'Saving...' : 'Save Notes'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setNotes(part.notes || '');
                      setIsEditingNotes(false);
                    }}
                    disabled={isSavingNotes}
                    className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                {part.notes || (
                  <p className="text-slate-400 italic text-xs">
                    No notes added yet. Click "Add Notes" to add internal information about this part.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Record Information
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span className="text-slate-500">Created:</span>
                <span className="font-mono font-medium">
                  {new Date(part.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span className="text-slate-500">Updated:</span>
                <span className="font-mono font-medium">
                  {new Date(part.updatedAt).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Package className="h-4 w-4 text-slate-400" />
                <span className="text-slate-500">Part ID:</span>
                <span className="font-mono font-medium text-[10px]">{part.id}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
