import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PortfolioChart } from '@/components/dashboard-overview/portfolio-charts';
import { ClientFollowUps } from '@/components/dashboard-overview/client-follow-ups';
import { reviewClientRecord } from '@/lib/client-record-review';
import { PropertyMapCard } from '@/components/dashboard-overview/property-map-card';
import { QuickLinks } from '@/components/dashboard-overview/quick-links';

describe('Dashboard overview presentation', () => {
  it('distinguishes unavailable property counts from an empty portfolio', () => {
    const missing = renderToStaticMarkup(createElement(PortfolioChart, { statuses: [{ label: 'Open', count: null }] }));
    expect(missing).toContain('temporarily unavailable');
    expect(missing).not.toContain('total lots');
    const empty = renderToStaticMarkup(createElement(PortfolioChart, { statuses: [{ label: 'Open', count: 0 }] }));
    expect(empty).toContain('No property lots yet');
    expect(empty).not.toContain('NaN');
  });

  it('provides readable figures alongside the property chart', () => {
    const html = renderToStaticMarkup(createElement(PortfolioChart, { statuses: [{ label: 'Open', count: 3 }, { label: 'Sold', count: 1 }] }));
    expect(html).toContain('/dashboard/properties?status=Open');
    expect(html).toContain('/dashboard/properties?status=Sold');
    expect(html).toContain('75%');
    expect(html).toContain('25%');
    expect(html).toContain('Open');
    expect(html).toContain('Sold');
  });

  it('distinguishes unavailable record checks from a complete set of records', () => {
    const unavailable = renderToStaticMarkup(createElement(ClientFollowUps, { items: null }));
    expect(unavailable).toContain('temporarily unavailable');
    expect(unavailable).not.toContain('No missing required documents found');
    const empty = renderToStaticMarkup(createElement(ClientFollowUps, { items: [] }));
    expect(empty).toContain('No missing required documents found');
  });

  it('flags blank contacts and checks required document types without counting duplicates', () => {
    const result = reviewClientRecord({ client_id: 'client-1', full_name: 'Sample Client', contact_info: [{ value: '  ' }], client_document: [{ document_type: 'Valid ID' }, { document_type: 'Valid ID' }, { document_type: 'Other' }] });
    expect(result.missingContact).toBe(true);
    expect(result.missingDocuments).toEqual(['Contract', 'Deed of Sale']);
    const complete = reviewClientRecord({ client_id: 'client-2', full_name: 'Complete Client', contact_info: [{ value: '09000000000' }], client_document: [{ document_type: 'Valid ID' }, { document_type: 'Contract' }, { document_type: 'Deed of Sale' }] });
    expect(complete.missingContact).toBe(false);
    expect(complete.missingDocuments).toEqual([]);
  });

  it('links follow-ups to the exact client profile and explains the missing paperwork', () => {
    const html = renderToStaticMarkup(createElement(ClientFollowUps, { items: [{ clientId: 'client-1', name: 'Sample Client', missingContact: true, missingDocuments: ['Contract'] }] }));
    expect(html).toContain('/dashboard/clients?client=client-1');
    expect(html).toContain('Missing: Contract');
    expect(html).toContain('Archived clients are excluded');
  });

  it('renders a scaled site map linking to the full map without nested controls', () => {
    const html = renderToStaticMarkup(createElement(PropertyMapCard, { preview: { site: {
      site_id: 'site-1', name: 'Sample Site', description: null,
      created_at: '', updated_at: '',
      boundary: [[125, 7], [125.01, 7], [125.01, 7.01]], subdivisions: [], lots: [],
    } } }));
    expect(html).toContain('href="/dashboard/properties/map"');
    expect(html).toContain('data-engine="maplibre"');
    expect(html).toContain('Sample Site');
    expect(html).toContain('inert=""');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('Zoom:');
  });

  it('keeps the map card usable when preview data is unavailable or empty', () => {
    const unavailable = renderToStaticMarkup(createElement(PropertyMapCard, { preview: null }));
    expect(unavailable).toContain('temporarily unavailable');
    expect(unavailable).toContain('href="/dashboard/properties/map"');
    const empty = renderToStaticMarkup(createElement(PropertyMapCard, { preview: { site: null } }));
    expect(empty).toContain('No sites to preview');
    expect(empty).not.toContain('data-engine="maplibre"');
  });

  it('offers only authorized tools, with settings available to everyone', () => {
    const html = renderToStaticMarkup(createElement(QuickLinks, { canViewProperties: false, canViewClients: false, isSystemAdmin: false }));
    expect(html).toContain('/dashboard/settings');
    expect(html).not.toContain('/dashboard/admin');
    expect(html).not.toContain('/dashboard/clients');
    expect(html).not.toContain('/dashboard/properties');
    const staff = renderToStaticMarkup(createElement(QuickLinks, { canViewProperties: true, canViewClients: true, isSystemAdmin: false }));
    expect(staff).toContain('/dashboard/clients');
    expect(staff).toContain('/dashboard/properties/map');
    expect(staff).not.toContain('/dashboard/admin');
  });
});
