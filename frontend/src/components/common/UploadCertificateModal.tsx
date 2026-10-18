import React, { useState } from 'react';
import { Button } from './Button';
import { apiClient } from '../../api/client';
import type { EvidenceUploadResponse } from '../../types/api';

interface UploadCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultLotCode?: string;
  onUploadSuccess: (response: EvidenceUploadResponse) => void;
}

export const UploadCertificateModal: React.FC<UploadCertificateModalProps> = ({
  isOpen,
  onClose,
  defaultLotCode = 'LOT-CUM-2026-088',
  onUploadSuccess,
}) => {
  const [lotCode, setLotCode] = useState(defaultLotCode);
  const [documentType, setDocumentType] = useState('CERTIFICATE_OF_ANALYSIS');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<EvidenceUploadResponse | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Client-side quick check (server enforces rigorous 10MB limit and magic byte validation)
      if (file.size > 10 * 1024 * 1024) {
        setError('File exceeds maximum allowable size of 10 MB.');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a certificate file (PDF, PNG, or JPEG).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiClient.uploadEvidence(selectedFile, lotCode.trim(), documentType);
      setSuccessResult(res);
      onUploadSuccess(res);
    } catch (err: any) {
      setError(err?.message || 'Certificate upload failed. Please verify format and lot code.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setError(null);
    setSuccessResult(null);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(36, 51, 47, 0.45)',
        backdropFilter: 'blur(2px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="stitch-card"
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#FFFFFF',
          padding: '24px',
          boxShadow: 'var(--shadow-modal)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '24px' }}>
              upload_file
            </span>
            <h2 id="upload-modal-title" className="text-headline-sm" style={{ color: 'var(--color-text-primary)' }}>
              Upload Supplier Certificate
            </h2>
          </div>
          <button onClick={handleClose} aria-label="Close dialog" style={{ color: 'var(--color-text-secondary)', padding: '4px' }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <p className="text-body-sm" style={{ color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
          Attach microbiological or chemical Certificate of Analysis (CoA) to a supply chain lot in FalkorDB.
        </p>

        {error && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#FDEDEC',
              border: '1px solid #F5C6CB',
              color: 'var(--color-danger)',
              fontSize: '12px',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        {successResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#EBF5F0',
                border: '1px solid #A3D9C9',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary-dark)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>check_circle</span>
                <strong style={{ fontSize: '13px' }}>Certificate Registered Locally</strong>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-primary)' }}>
                <strong>Document ID:</strong> {successResult.document_id}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-primary)' }}>
                <strong>Target Lot:</strong> {successResult.lot_code}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-primary)' }}>
                <strong>Regulatory Status:</strong>{' '}
                <span style={{ fontWeight: 600, color: 'var(--color-accent-marigold)' }}>
                  {successResult.verification_status}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                Note: Upload does not constitute official FDA verification. Verification remains pending QA review.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <a
                href={apiClient.getBaseUrl() + successResult.download_url}
                target="_blank"
                rel="noreferrer"
                download
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface-card)',
                  color: 'var(--color-text-primary)',
                  fontSize: '13px',
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>download</span>
                Download Stored File
              </a>
              <Button variant="primary" onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Target Lot Code
              </label>
              <input
                type="text"
                value={lotCode}
                onChange={(e) => setLotCode(e.target.value)}
                required
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-canvas-bg)',
                  fontFamily: 'inherit',
                  fontSize: '13px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Document Classification
              </label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-canvas-bg)',
                  fontFamily: 'inherit',
                  fontSize: '13px',
                }}
              >
                <option value="CERTIFICATE_OF_ANALYSIS">Certificate of Analysis (CoA)</option>
                <option value="MICROBIAL_SCREEN">Microbiological Screen Report</option>
                <option value="PESTICIDE_RESIDUE_ASSAY">Pesticide Residue Assay</option>
                <option value="BILL_OF_LADING">Bill of Lading / Inbound Manifest</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Select File (PDF, PNG, JPEG up to 10 MB)
              </label>
              <input
                type="file"
                accept=".pdf,.png,.jpeg,.jpg"
                onChange={handleFileChange}
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-canvas-bg)',
                  fontFamily: 'inherit',
                  fontSize: '12px',
                }}
              />
              {selectedFile && (
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>

            <div
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-surface-low)',
                border: '1px solid var(--color-surface-dim)',
                fontSize: '12px',
                color: 'var(--color-primary-dark)',
              }}
            >
              <strong>Local Security Policy: </strong>
              Uploaded certificates are stored locally in isolated storage, validated by magic bytes, linked in FalkorDB, and recorded in the audit trail. No data leaves this device.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <Button variant="secondary" type="button" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={loading || !selectedFile}>
                {loading ? 'Uploading...' : 'Upload & Register'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
