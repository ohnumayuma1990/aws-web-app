import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders header text', () => {
  render(<App />);
  const linkElement = screen.getByText(/サーバーレス対戦ゲーム/i);
  expect(linkElement).toBeInTheDocument();
});
