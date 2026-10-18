import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Header } from '../components/layout/Header';
import { ImportDatasetModal } from '../components/common/ImportDatasetModal';
import { apiClient } from '../api/client';
import type { DatasetSummary } from '../types/api';

vi.mock('../api/client', () => ({
  apiClient: {
    search: vi.fn().mockResolvedValue({ matches: [], total_matches: 0, query: '' }),
    listDatasets: vi.fn(),
    importDataset: vi.fn(),
    getDatasetTemplate: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    data: any;
    constructor(status: number, message: string, data?: any) {
      super(message);
      this.status = status;
      this.data = data;
    }
  },
}));

describe('Dataset Ingestion & Switcher Frontend Workflows', () => {
  const mockDatasets: DatasetSummary[] = [
    {
      dataset_id: 'DS-DEMO-SALSA-01',
      name: 'FreshHarvest Salsa Line',
      is_demo: true,
      suspect_root_lot: 'LOT-CUM-2026-088',
      counts: { suppliers: 2, raw_lots: 2, finished_lots: 3, shipments: 3 },
    },
    {
      dataset_id: 'DS-MIDWEST-POULTRY-01',
      name: 'Midwest Broiler Facility Stream',
      is_demo: false,
      suspect_root_lot: 'LOT-RAW-CHICK-901',
      counts: { suppliers: 3, raw_lots: 2, finished_lots: 2, shipments: 2 },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Header with active dataset pill and switches dataset upon user selection', async () => {
    const handleSelectDataset = vi.fn();
    const handleOpenImportModal = vi.fn();

    render(
      <Header
        onToggleMobileMenu={vi.fn()}
        onInspectNode={vi.fn()}
        onNewInvestigationClick={vi.fn()}
        activeDataset={mockDatasets[0]}
        datasets={mockDatasets}
        onSelectDataset={handleSelectDataset}
        onOpenImportModal={handleOpenImportModal}
      />
    );

    // Verify active dataset is displayed
    expect(screen.getByText('FreshHarvest Salsa Line')).toBeInTheDocument();
    expect(screen.getByText('Demo')).toBeInTheDocument();

    // Click to open dropdown
    const dropdownBtn = screen.getByTitle('Switch active supply chain dataset');
    fireEvent.click(dropdownBtn);

    // Both datasets should be visible in dropdown
    expect(screen.getByText('FalkorDB Datasets')).toBeInTheDocument();
    expect(screen.getByText('Midwest Broiler Facility Stream')).toBeInTheDocument();
    expect(screen.getByText('Imported')).toBeInTheDocument();

    // Select the second dataset
    fireEvent.click(screen.getByText('Midwest Broiler Facility Stream'));
    expect(handleSelectDataset).toHaveBeenCalledWith(mockDatasets[1]);
  });

  it('renders ImportDatasetModal, loads sample template, and submits validated JSON', async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    const samplePoultryPayload = {
      dataset_metadata: {
        dataset_id: 'DS-MIDWEST-POULTRY-01',
        name: 'Midwest Broiler Facility Stream',
        suspect_root_lot: 'LOT-RAW-CHICK-901',
      },
      suppliers: [{ supplier_id: 'SUP-01', name: 'Valley Grain' }],
    };

    (apiClient.getDatasetTemplate as any).mockResolvedValue(samplePoultryPayload);
    (apiClient.importDataset as any).mockResolvedValue({
      dataset_id: 'DS-MIDWEST-POULTRY-01',
      name: 'Midwest Broiler Facility Stream',
      is_demo: false,
      counts: { raw_lots: 1 },
      suspect_root_lot: 'LOT-RAW-CHICK-901',
      status: 'INGESTED',
      message: 'Ingestion successful',
    });

    render(
      <ImportDatasetModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    );

    expect(screen.getByText('Import Supply Chain Dataset')).toBeInTheDocument();

    // Click "Load Sample Poultry Data"
    const sampleBtn = screen.getByText('Load Sample Poultry Data');
    fireEvent.click(sampleBtn);

    await waitFor(() => {
      expect(apiClient.getDatasetTemplate).toHaveBeenCalledWith('json');
    });

    // Form inputs should be auto-populated
    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(/dataset_metadata/);
      expect((textarea as HTMLTextAreaElement).value).toContain('DS-MIDWEST-POULTRY-01');
    });

    // Submit form
    const submitBtn = screen.getByText('Validate & Ingest to FalkorDB');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiClient.importDataset).toHaveBeenCalledWith(
        expect.objectContaining({
          dataset_id: 'DS-MIDWEST-POULTRY-01',
          name: 'Midwest Broiler Facility Stream',
        })
      );
      expect(handleSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ dataset_id: 'DS-MIDWEST-POULTRY-01' })
      );
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('displays actionable validation error messages if ingestion is rejected by schema validator', async () => {
    const { ApiError } = await import('../api/client');
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    (apiClient.importDataset as any).mockRejectedValue(
      new ApiError(422, 'Validation failed', {
        detail: [
          'RawLot LOT-CHICK-01 references missing supplier SUP-NONEXISTENT',
          'ProductionEvent PE-01 references unlinked raw lot LOT-UNKNOWN',
        ],
      })
    );

    render(
      <ImportDatasetModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    );

    // Enter invalid JSON
    const textarea = screen.getByPlaceholderText(/dataset_metadata/);
    fireEvent.change(textarea, { target: { value: '{"invalid": true}' } });

    // Submit form
    const submitBtn = screen.getByText('Validate & Ingest to FalkorDB');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Schema Validation Failed \(2 errors found - zero records written to FalkorDB\)/)).toBeInTheDocument();
      expect(screen.getByText(/RawLot LOT-CHICK-01 references missing supplier SUP-NONEXISTENT/)).toBeInTheDocument();
      expect(screen.getByText(/ProductionEvent PE-01 references unlinked raw lot LOT-UNKNOWN/)).toBeInTheDocument();
    });

    expect(handleSuccess).not.toHaveBeenCalled();
    expect(handleClose).not.toHaveBeenCalled();
  });
});
