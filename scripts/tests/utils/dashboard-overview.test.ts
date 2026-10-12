import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PortfolioChart } from '@/components/dashboard-overview/portfolio-charts';
import { ClientFollowUps } from '@/components/dashboard-overview/client-follow-ups';
import { reviewClientRecord } from '@/lib/client-record-review';
import { PropertyMapCard } from '@/components/dashboard-overview/property-map-card';
import { QuickLinks } from '@/components/dashboard-overview/quick-links';

// Presentation tests render on the server; toast CSS must not use the map test's DOM shim.
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

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
    const result = reviewClientRecord({ client_id: 'client-1', full_name: 'Sample Client', contact_info: [{ value: '  ' }], client_document: [{ document_type: 'Other' }] });
    expect(result.missingContact).toBe(true);
    expect(result.missingDocuments).toEqual(['Valid ID']);
    const complete = reviewClientRecord({ client_id: 'client-2', full_name: 'Complete Client', contact_info: [{ value: '09000000000' }], client_document: [{ document_type: 'Valid ID' }, { document_type: 'Valid ID' }] });
    expect(complete.missingContact).toBe(false);
    expect(complete.missingDocuments).toEqual([]);
  });

  it('links follow-ups to the exact client profile and explains the missing paperwork', () => {
    const html = renderToStaticMarkup(createElement(ClientFollowUps, { items: [{ clientId: 'client-1', name: 'Sample Client', missingContact: true, missingDocuments: ['Valid ID'] }] }));
    expect(html).toContain('/dashboard/clients/client-1');
    expect(html).toContain('Missing: Valid ID');
    expect(html).toContain('Archived clients are excluded');
  });

  it('renders a scaled site map linking to the full map without nested controls', () => {
    const html = renderToStaticMarkup(createElement(PropertyMapCard, { preview: { site: {
      site_id: 'site-1', name: 'Sample Site', description: null,
      created_at: '', updated_at: '',
      is_archived: false, archived_at: null,
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

  it('offers only authorized workflow destinations', () => {
    const html = renderToStaticMarkup(createElement(QuickLinks, { canViewProperties: false, canViewClients: false }));
    expect(html).toBe('');
    expect(html).not.toContain('/dashboard/admin');
    expect(html).not.toContain('/dashboard/clients');
    expect(html).not.toContain('/dashboard/properties');
    const staff = renderToStaticMarkup(createElement(QuickLinks, { canViewProperties: true, canViewClients: true }));
    expect(staff).toContain('/dashboard/clients');
    expect(staff).toContain('/dashboard/properties/map');
    expect(staff).not.toContain('/dashboard/admin');
    expect(staff).not.toContain('/dashboard/legal');
    const legal = renderToStaticMarkup(createElement(QuickLinks, { canViewProperties: false, canViewClients: false, canViewTitles: true }));
    expect(legal).toContain('/dashboard/legal');
    expect(legal).not.toContain('/dashboard/clients');
  });
});
