import React, { useState } from 'react';
import { Button } from './Button';
import { apiClient } from '../../api/client';
import type { EvidenceRequestResponse } from '../../types/api';

interface SupplierRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultLotCode?: string;
  defaultSupplier?: string;
  onRequestSuccess: (response: EvidenceRequestResponse) => void;
}

export const SupplierRequestModal: React.FC<SupplierRequestModalProps> = ({
  isOpen,
  onClose,
  defaultLotCode = 'LOT-CUM-2026-088',
  defaultSupplier = 'PRIMAVERA_ORGANICS_LTD',
  onRequestSuccess,
}) => {
  const [targetLot, setTargetLot] = useState(defaultLotCode);
  const [supplierName, setSupplierName] = useState(defaultSupplier);
  const [instructions, setInstructions] = useState('Urgent request for batch Certificate of Analysis (microbiological assay for Salmonella)');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<EvidenceRequestResponse | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await apiClient.requestSupplierEvidence(targetLot.trim(), supplierName.trim(), instructions);
      setSuccessResult(res);
      onRequestSuccess(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to dispatch simulated supplier request.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setSuccessResult(null);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="supplier-modal-title"
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
              send_time_extension
            </span>
            <h2 id="supplier-modal-title" className="text-headline-sm" style={{ color: 'var(--color-text-primary)' }}>
              Simulate Supplier Evidence Request
            </h2>
          </div>
          <button onClick={handleClose} aria-label="Close dialog" style={{ color: 'var(--color-text-secondary)', padding: '4px' }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <p className="text-body-sm" style={{ color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
          Initiate a digital-twin supplier evidence request to record an auditable CoA inquiry in FalkorDB.
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
                <strong style={{ fontSize: '13px' }}>Simulation Logged to Graph & Audit Trail</strong>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-primary)' }}>
                <strong>Request ID:</strong> {successResult.request_id}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-primary)' }}>
                <strong>Target Lot:</strong> {successResult.target_lot}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-primary)' }}>
                <strong>Supplier:</strong> {successResult.supplier_name}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-primary)' }}>
                <strong>Status:</strong>{' '}
                <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                  {successResult.status}
                </span>
              </div>
              <div
                style={{
                  marginTop: '6px',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: '#FFF8E1',
                  border: '1px solid #FFE082',
                  fontSize: '11px',
                  color: '#8D6E63',
                  lineHeight: '1.4',
                }}
              >
                <strong>Simulation Boundary: </strong>
                {successResult.disclaimer}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
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
                value={targetLot}
                onChange={(e) => setTargetLot(e.target.value)}
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
                Target Supplier Entity
              </label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                required
                placeholder="e.g. PRIMAVERA_ORGANICS_LTD"
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
                Inquiry Instructions / Requirements
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={2}
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-canvas-bg)',
                  fontFamily: 'inherit',
                  fontSize: '13px',
                  resize: 'none',
                }}
              />
            </div>

            <div
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#FFF8E1',
                border: '1px solid #FFE082',
                fontSize: '12px',
                color: '#6D4C41',
              }}
            >
              <strong>Simulation Notice: </strong>
              This action creates an internal simulated request record in FalkorDB. No external email, API call, or network request is sent to suppliers.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <Button variant="secondary" type="button" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? 'Logging Request...' : 'Simulate Request'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
