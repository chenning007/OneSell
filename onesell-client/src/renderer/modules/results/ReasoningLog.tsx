import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ReasoningStep } from '../../../shared/types/index.js';

interface ReasoningLogProps {
  readonly steps: readonly ReasoningStep[];
  readonly justification: string;
}

export default function ReasoningLog({ steps, justification }: ReasoningLogProps): React.ReactElement {
  const { t } = useTranslation();

  if (steps.length === 0) {
    return (
      <div>
        <h3 style={{ fontSize: 16, marginBottom: 8 }}>{t('detail.reasoningTitle')}</h3>
        <p style={{ fontSize: 14, color: '#888' }}>{t('detail.reasoningEmpty')}</p>
        {justification && (
          <div style={{ marginTop: 12, padding: 12, backgroundColor: '#f8f9fa', borderRadius: 8 }}>
            <p style={{ fontSize: 14, color: '#444', margin: 0 }}>{justification}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>{t('detail.reasoningTitle')}</h3>
      <ol style={{ paddingLeft: 0, listStyle: 'none', margin: 0 }}>
        {steps.map((step) => (
          <li key={step.stepNumber} style={stepStyle}>
            <div style={stepHeaderStyle}>
              <span style={stepNumberStyle}>{step.stepNumber}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>{step.action}</span>
            </div>
            <div style={{ marginLeft: 36, marginTop: 4 }}>
              <span style={toolBadgeStyle}>{step.toolUsed}</span>
              {Object.keys(step.dataValues).length > 0 && (
                <div style={dataValuesStyle}>
                  {Object.entries(step.dataValues).map(([key, val]) => (
                    <span key={key} style={dataChipStyle}>
                      {key}: <strong>{val}</strong>
                    </span>
                  ))}
                </div>
              )}
              <p style={{ fontSize: 13, color: '#555', marginTop: 6, marginBottom: 0 }}>
                {step.insight}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

const stepStyle: React.CSSProperties = {
  padding: '12px 0',
  borderBottom: '1px solid #eee',
};

const stepHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const stepNumberStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 26,
  height: 26,
  borderRadius: '50%',
  backgroundColor: '#4a90e2',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  flexShrink: 0,
};

const toolBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  backgroundColor: '#e8f0fe',
  color: '#1a73e8',
  fontSize: 12,
  borderRadius: 4,
  fontFamily: 'monospace',
};

const dataValuesStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  marginTop: 6,
};

const dataChipStyle: React.CSSProperties = {
  padding: '2px 8px',
  backgroundColor: '#f0f0f0',
  borderRadius: 4,
  fontSize: 12,
  color: '#444',
};
