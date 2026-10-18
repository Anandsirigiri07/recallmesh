import React, { useState } from 'react';
import { Button } from '../common/Button';
import { apiClient } from '../../api/client';

interface NewInvestigationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (caseId: string) => void;
  activeDatasetId?: string;
  initialSuspectLot?: string;
}

export const NewInvestigationModal: React.FC<NewInvestigationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  activeDatasetId,
  initialSuspectLot,
}) => {
  const isPoultry = activeDatasetId?.includes('POULTRY') || initialSuspectLot?.includes('PLT');
  const [title, setTitle] = useState(
    isPoultry
      ? 'Poultry Cutlet Salmonella Enteritidis Contamination'
      : 'Organic Cumin Salmonella Cross-Contamination'
  );
  const [suspectLot, setSuspectLot] = useState(initialSuspectLot || (isPoultry ? 'LOT-PLT-2026-401' : 'LOT-CUM-2026-088'));
  const [hazard, setHazard] = useState(isPoultry ? 'Salmonella Enteritidis' : 'Salmonella enterica');
  const [description, setDescription] = useState(
    isPoultry
      ? 'Surveillance culture identified Salmonella Enteritidis in broiler processing batch.'
      : 'Routine surveillance culture identified Salmonella presence in spice processing stream.'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.createCase({
        title,
        hazard_type: 'BIOLOGICAL',
        pathogen_or_hazard: hazard,
        hazard_description: `${hazard}: ${description}`,
        suspect_raw_lot: suspectLot.trim() || initialSuspectLot || 'LOT-CUM-2026-088',
        description,
        provisional_class: 'Class I',
        source_facility: isPoultry ? 'Midwest Processing Facility #09' : 'Facility TX-4 (El Paso Milling)',
        dataset_id: activeDatasetId || undefined,
      });
      onSuccess(response.case_id);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create investigation docket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
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
        if (e.target === e.currentTarget) onClose();
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
              add_circle
            </span>
            <h2 id="modal-title" className="text-headline-sm" style={{ color: 'var(--color-text-primary)' }}>
              Initiate Incident Docket
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close dialog" style={{ color: 'var(--color-text-secondary)', padding: '4px' }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <p className="text-body-sm" style={{ color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
          Create or associate an FDA FSMA 204 critical tracking event investigation with suspect lot lineage in FalkorDB.
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Investigation Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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
              Suspect Raw Material Lot Code
            </label>
            <input
              type="text"
              value={suspectLot}
              onChange={(e) => setSuspectLot(e.target.value)}
              required
              placeholder="e.g. LOT-CUM-2026-088"
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
              Contaminant / Pathogen Screen
            </label>
            <input
              type="text"
              value={hazard}
              onChange={(e) => setHazard(e.target.value)}
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
              Surveillance Reason / Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
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
              backgroundColor: 'var(--color-surface-low)',
              border: '1px solid var(--color-surface-dim)',
              fontSize: '12px',
              color: 'var(--color-primary-dark)',
            }}
          >
            <strong>Local Demonstration Note: </strong>
            Suspect lot <code>LOT-CUM-2026-088</code> is preloaded with supply chain lineage. Docket will be persisted to FalkorDB and recorded in the audit trail.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <Button variant="secondary" type="button" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? 'Initiating Docket...' : 'Persist Investigation'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
