import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import type { PredictRiskResponse } from '../../types/api';

interface ModelEstimateCardProps {
  productDescription?: string;
  reasonForRecall?: string;
}

export const ModelEstimateCard: React.FC<ModelEstimateCardProps> = ({
  productDescription = 'Organic Cumin Powder 50kg bag (Facility TX-4)',
  reasonForRecall = 'Potential contamination with Salmonella enterica',
}) => {
  const [prediction, setPrediction] = useState<PredictRiskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchPrediction = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.predictRisk({
          product_description: productDescription,
          reason_for_recall: reasonForRecall,
          model_type: 'improved_three_class',
        });
        if (isMounted) {
          setPrediction(res);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Model service unavailable');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchPrediction();
    return () => {
      isMounted = false;
    };
  }, [productDescription, reasonForRecall]);

  return (
    <div
      className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm"
      style={{
        backgroundColor: 'var(--color-surface-card)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-md)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div
        className="flex items-center justify-between pb-space-sm mb-space-sm"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--spacing-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '18px' }}>
            psychology
          </span>
          <span
            className="font-label-sm text-label-sm uppercase tracking-wider"
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              letterSpacing: '0.04em',
            }}
          >
            Model Estimate
          </span>
        </div>
        <span
          style={{
            fontSize: '11px',
            color: 'var(--color-text-secondary)',
            backgroundColor: 'var(--color-surface-low)',
            padding: '2px 6px',
            borderRadius: 'var(--radius-xs)',
            fontWeight: 500,
          }}
        >
          Provisional
        </span>
      </div>

      {loading ? (
        <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '12px' }}>
          Running offline classifier inference...
        </div>
      ) : error ? (
        <div
          role="alert"
          style={{
            padding: '10px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-status-review-tint)',
            color: 'var(--color-status-review-text)',
            fontSize: '12px',
            marginBottom: 'var(--spacing-sm)',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '2px' }}>Offline Inference Unavailable</div>
          <div>{error}</div>
        </div>
      ) : prediction ? (
        <>
          <div
            className="grid grid-cols-2 gap-2 mb-space-md"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              marginBottom: 'var(--spacing-sm)',
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--color-surface-low)',
                padding: '8px 10px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                Predicted Cat.
              </span>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color:
                    prediction.predicted_class === 'Class I'
                      ? 'var(--color-status-affected-text)'
                      : 'var(--color-text-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor:
                      prediction.predicted_class === 'Class I'
                        ? 'var(--color-status-affected-solid)'
                        : 'var(--color-status-verified-solid)',
                  }}
                />
                {prediction.predicted_class || 'Class I'}
              </span>
            </div>

            <div
              style={{
                backgroundColor: 'var(--color-surface-low)',
                padding: '8px 10px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                Confidence
              </span>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-primary)',
                  }}
                />
                {prediction.confidence !== null && prediction.confidence !== undefined
                  ? `${(prediction.confidence * 100).toFixed(1)}%`
                  : 'Pending'}
              </span>
            </div>
          </div>

          {/* Model Identification & Benchmark Clarity */}
          <div
            style={{
              fontSize: '10px',
              color: 'var(--color-text-secondary)',
              marginBottom: '8px',
              padding: '4px 6px',
              borderRadius: 'var(--radius-xs)',
              backgroundColor: 'var(--color-canvas-bg)',
              border: '1px solid var(--color-border)',
            }}
          >
            <strong>Model:</strong> {prediction.published_benchmark_metrics.model_name}
            <br />
            <strong>Locked Test Benchmark:</strong>{' '}
            {(prediction.published_benchmark_metrics.test_accuracy * 100).toFixed(2)}% accuracy (evaluation test set; not lot confidence)
          </div>

          {/* Verbatim Research Disclaimer Box */}
          <div
            className="flex items-start gap-2 bg-surface-container-lowest p-2.5 rounded-lg"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '6px',
              padding: '8px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-surface-low)',
              border: '1px solid var(--color-border)',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '15px', color: 'var(--color-text-secondary)', flexShrink: 0, marginTop: '1px' }}
            >
              info
            </span>
            <p
              style={{
                fontSize: '10.5px',
                lineHeight: '1.35',
                color: 'var(--color-text-secondary)',
                margin: 0,
              }}
            >
              {prediction.disclaimer}
            </p>
          </div>
        </>
      ) : (
        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
          No model prediction generated for this lot.
        </div>
      )}
    </div>
  );
};
