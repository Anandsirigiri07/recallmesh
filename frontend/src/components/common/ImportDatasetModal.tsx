import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { apiClient, ApiError } from '../../api/client';
import type { DatasetImportResponse } from '../../types/api';

interface ImportDatasetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (imported: DatasetImportResponse) => void;
}

export const ImportDatasetModal: React.FC<ImportDatasetModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [inputText, setInputText] = useState<string>('');
  const [datasetId, setDatasetId] = useState<string>('');
  const [datasetName, setDatasetName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoadingSample, setIsLoadingSample] = useState<boolean>(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const handleReset = () => {
    setInputText('');
    setDatasetId('');
    setDatasetName('');
    setGeneralError(null);
    setValidationErrors([]);
  };

  const handleLoadSample = async () => {
    setIsLoadingSample(true);
    setGeneralError(null);
    setValidationErrors([]);
    try {
      const template = await apiClient.getDatasetTemplate(format);
      if (format === 'json') {
        setInputText(JSON.stringify(template, null, 2));
        if (template?.dataset_metadata?.dataset_id) {
          setDatasetId(template.dataset_metadata.dataset_id);
        }
        if (template?.dataset_metadata?.name) {
          setDatasetName(template.dataset_metadata.name);
        }
      } else {
        setInputText(typeof template === 'string' ? template : String(template));
        setDatasetId('DS-CTE-POULTRY-01');
        setDatasetName('Midwest Poultry Facility Feed CTE');
      }
    } catch (err: any) {
      setGeneralError(err?.message || `Failed to load sample ${format.toUpperCase()} template`);
    } finally {
      setIsLoadingSample(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const template = await apiClient.getDatasetTemplate(format);
      const content = format === 'json' ? JSON.stringify(template, null, 2) : template;
      const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = format === 'json' ? 'sample_fsma204_dataset.json' : 'sample_cte_template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setGeneralError(err?.message || `Failed to download ${format.toUpperCase()} template`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setInputText(text);
      if (file.name.endsWith('.csv')) {
        setFormat('csv');
      } else if (file.name.endsWith('.json')) {
        setFormat('json');
        try {
          const parsed = JSON.parse(text);
          if (parsed?.dataset_metadata?.dataset_id) {
            setDatasetId(parsed.dataset_metadata.dataset_id);
          }
          if (parsed?.dataset_metadata?.name) {
            setDatasetName(parsed.dataset_metadata.name);
          }
        } catch {
          // ignore parse errors on auto-fill
        }
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) {
      setGeneralError('Please enter dataset payload or load a sample template.');
      return;
    }

    setIsSubmitting(true);
    setGeneralError(null);
    setValidationErrors([]);

    try {
      let payload: any = {
        format,
        dataset_id: datasetId.trim() || undefined,
        name: datasetName.trim() || undefined,
      };

      if (format === 'json') {
        try {
          payload.payload = JSON.parse(inputText);
        } catch (jsonErr: any) {
          setGeneralError(`Invalid JSON syntax: ${jsonErr.message}`);
          setIsSubmitting(false);
          return;
        }
      } else {
        payload.csv_content = inputText;
      }

      const response = await apiClient.importDataset(payload);
      handleReset();
      onSuccess(response);
      onClose();
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 422) {
        const detail = err.data?.detail;
        if (detail?.errors && Array.isArray(detail.errors)) {
          setValidationErrors(detail.errors);
        } else if (Array.isArray(detail)) {
          setValidationErrors(detail.map((d: any) => (typeof d === 'string' ? d : d.msg || JSON.stringify(d))));
        } else if (typeof detail === 'string') {
          setValidationErrors([detail]);
        } else if (detail?.message) {
          setGeneralError(detail.message);
        } else {
          setGeneralError(err.message || 'Validation failed for submitted supply chain data.');
        }
      } else {
        setGeneralError(err?.message || 'Server error while importing dataset to FalkorDB.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        handleReset();
        onClose();
      }}
      title="Import Supply Chain Dataset"
      maxWidth="780px"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
          Ingest real FSMA Rule 204 supply-chain records into FalkorDB with strict isolation. Data is validated
          in-memory before graph ingestion to prevent partial or corrupted writes.
        </p>

        {/* Format Selector Tabs & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', backgroundColor: 'var(--color-surface-low)', padding: '2px', borderRadius: '6px' }}>
            <button
              type="button"
              onClick={() => setFormat('json')}
              style={{
                padding: '6px 14px',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: format === 'json' ? '#FFFFFF' : 'transparent',
                color: format === 'json' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                boxShadow: format === 'json' ? 'var(--shadow-card)' : 'none',
              }}
            >
              FSMA 204 JSON
            </button>
            <button
              type="button"
              onClick={() => setFormat('csv')}
              style={{
                padding: '6px 14px',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: format === 'csv' ? '#FFFFFF' : 'transparent',
                color: format === 'csv' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                boxShadow: format === 'csv' ? 'var(--shadow-card)' : 'none',
              }}
            >
              CTE Tabular CSV
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon="sample"
              onClick={handleLoadSample}
              disabled={isLoadingSample || isSubmitting}
            >
              {isLoadingSample ? 'Loading sample...' : 'Load Sample Poultry Data'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon="download"
              onClick={handleDownloadTemplate}
              disabled={isSubmitting}
            >
              Download Template
            </Button>
          </div>
        </div>

        {/* Optional Overrides */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
              Dataset ID {format === 'json' && <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>(optional, overrides JSON metadata)</span>}
            </label>
            <input
              type="text"
              placeholder={format === 'json' ? 'e.g., DS-MIDWEST-POULTRY-01' : 'DS-CUSTOM-FEED-01 (Required for CSV)'}
              value={datasetId}
              onChange={(e) => setDatasetId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid var(--color-border)',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
              Dataset Name <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Midwest Broiler Feed Stream 2026"
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid var(--color-border)',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Input Textarea & File Upload */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {format === 'json' ? 'JSON Structure' : 'CSV Records (CTE: RECEIVING, TRANSFORMATION, SHIPPING)'}
            </label>
            <label
              style={{
                fontSize: '11px',
                color: 'var(--color-primary)',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>upload_file</span>
              Upload File
              <input
                type="file"
                accept={format === 'json' ? '.json' : '.csv'}
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </label>
          </div>
          <textarea
            rows={12}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              format === 'json'
                ? '{\n  "dataset_metadata": { "dataset_id": "...", "name": "..." },\n  "suppliers": [...],\n  "ingredients": [...],\n  "raw_lots": [...]\n}'
                : 'cte_type,event_id,event_date,facility_id,lot_code,product_name,quantity,unit,source_or_supplier,destination_or_line\nRECEIVING,EV-REC-01,2026-10-10,FAC-MW,LOT-RAW-01,Ingredient A,500,KG,SUP-01,\n...'
            }
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
              fontFamily: 'monospace',
              fontSize: '12px',
              lineHeight: 1.4,
              backgroundColor: '#FAFCFB',
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Validation Errors Display */}
        {validationErrors.length > 0 && (
          <div
            style={{
              padding: '12px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: '6px',
              color: '#991B1B',
              fontSize: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, marginBottom: '6px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>error</span>
              Schema Validation Failed ({validationErrors.length} errors found - zero records written to FalkorDB):
            </div>
            <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: 1.5 }}>
              {validationErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {generalError && (
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: '6px',
              color: '#991B1B',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>error</span>
            {generalError}
          </div>
        )}

        {/* Modal Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              handleReset();
              onClose();
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon="publish"
            disabled={isSubmitting || !inputText.trim()}
          >
            {isSubmitting ? 'Validating & Ingesting...' : 'Validate & Ingest to FalkorDB'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
