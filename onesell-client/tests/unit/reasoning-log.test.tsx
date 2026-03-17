import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReasoningLog from '../../src/renderer/modules/results/ReasoningLog.js';
import type { ReasoningStep } from '../../src/shared/types/index.js';

// Minimal i18n mock — keys pass through
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const sampleSteps: ReasoningStep[] = [
  {
    stepNumber: 1,
    action: 'Analyzed market competition',
    toolUsed: 'rank_competition',
    dataValues: { sellers: 142, avgReviews: 350 },
    insight: 'Competition is moderate with room for new entrants.',
  },
  {
    stepNumber: 2,
    action: 'Calculated estimated margin',
    toolUsed: 'calc_margin',
    dataValues: { cogs: 8.5, sellPrice: 24.99, margin: 0.42 },
    insight: 'Healthy 42% margin after platform fees.',
  },
  {
    stepNumber: 3,
    action: 'Assessed beginner suitability',
    toolUsed: 'flag_beginner_risk',
    dataValues: { riskScore: 22 },
    insight: 'Low risk — suitable for first-time sellers.',
  },
];

describe('ReasoningLog', () => {
  it('renders empty state when no steps provided', () => {
    render(<ReasoningLog steps={[]} justification="" />);
    expect(screen.getByText('detail.reasoningTitle')).toBeTruthy();
    expect(screen.getByText('detail.reasoningEmpty')).toBeTruthy();
  });

  it('shows justification text when no steps but justification exists', () => {
    render(<ReasoningLog steps={[]} justification="This product was recommended because of strong demand." />);
    expect(screen.getByText('This product was recommended because of strong demand.')).toBeTruthy();
  });

  it('renders all reasoning steps', () => {
    render(<ReasoningLog steps={sampleSteps} justification="" />);
    expect(screen.getByText('Analyzed market competition')).toBeTruthy();
    expect(screen.getByText('Calculated estimated margin')).toBeTruthy();
    expect(screen.getByText('Assessed beginner suitability')).toBeTruthy();
  });

  it('shows tool name badges for each step', () => {
    render(<ReasoningLog steps={sampleSteps} justification="" />);
    expect(screen.getByText('rank_competition')).toBeTruthy();
    expect(screen.getByText('calc_margin')).toBeTruthy();
    expect(screen.getByText('flag_beginner_risk')).toBeTruthy();
  });

  it('displays actual data values extracted per step', () => {
    render(<ReasoningLog steps={sampleSteps} justification="" />);
    // Step 1 data values
    expect(screen.getByText(/sellers:/)).toBeTruthy();
    expect(screen.getByText('142')).toBeTruthy();
    // Step 2 data values
    expect(screen.getByText(/margin:/)).toBeTruthy();
    expect(screen.getByText('0.42')).toBeTruthy();
  });

  it('shows plain-English insights for each step', () => {
    render(<ReasoningLog steps={sampleSteps} justification="" />);
    expect(screen.getByText('Competition is moderate with room for new entrants.')).toBeTruthy();
    expect(screen.getByText('Healthy 42% margin after platform fees.')).toBeTruthy();
    expect(screen.getByText(/suitable for first-time sellers/)).toBeTruthy();
  });

  it('renders step numbers', () => {
    render(<ReasoningLog steps={sampleSteps} justification="" />);
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('renders an ordered list element', () => {
    const { container } = render(<ReasoningLog steps={sampleSteps} justification="" />);
    expect(container.querySelector('ol')).toBeTruthy();
    expect(container.querySelectorAll('li').length).toBe(3);
  });
});
