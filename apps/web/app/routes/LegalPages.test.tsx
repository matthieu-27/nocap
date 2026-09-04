// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import ContactRoute from './contact';
import PrivacyRoute from './privacy';
import TermsRoute from './terms';

describe('legal pages', () => {
  it('terms page states the content license and links to privacy policy', () => {
    render(
      <MemoryRouter>
        <TermsRoute />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: 'Terms of Service' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/license their posts/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Privacy Policy' }),
    ).toBeInTheDocument();
  });

  it('privacy page lists the personal data the site stores', () => {
    render(
      <MemoryRouter>
        <PrivacyRoute />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: 'Privacy Policy' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Email address')).toBeInTheDocument();
    expect(
      screen.getByText('Password hash (never the password)'),
    ).toBeInTheDocument();
    expect(screen.getByText(/IP logs, kept 90 days/)).toBeInTheDocument();
  });

  it('contact page shows the report and legal contact email', () => {
    render(
      <MemoryRouter>
        <ContactRoute />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: 'Contact' }),
    ).toBeInTheDocument();
    expect(screen.getByText('contact@nocap.example.org')).toBeInTheDocument();
  });
});
