type DirectoryLogoAsset = { url: string; kind: 'logo' };

// Temporary continuity assets recovered from the directory export. Supabase
// Storage takes precedence when a media relationship exists.
const assets: Record<string, DirectoryLogoAsset> = {
  recXRpTxUmzbiZYLO: { url: '/directory-logos/recXRpTxUmzbiZYLO.jpg', kind: 'logo' },
  rece62hjPb3DM0l8P: { url: '/directory-logos/rece62hjPb3DM0l8P.png', kind: 'logo' },
  recZQzu4If5VE0Egr: { url: '/directory-logos/recZQzu4If5VE0Egr.jpg', kind: 'logo' },
  recEJfgtRJtCdh4xS: { url: '/directory-logos/recEJfgtRJtCdh4xS.png', kind: 'logo' },
  recJijPZH0koyAY3c: { url: '/directory-logos/recJijPZH0koyAY3c.png', kind: 'logo' },
  recLhzizMbEgMN6gg: { url: '/directory-logos/recLhzizMbEgMN6gg.jpg', kind: 'logo' },
  recGLMhJYXTRE46st: { url: '/directory-logos/recGLMhJYXTRE46st.png', kind: 'logo' },
  recUVIMp2TSDKQ79F: { url: '/directory-logos/recUVIMp2TSDKQ79F.png', kind: 'logo' },
  recYpWUN69hNqECRt: { url: '/directory-logos/recYpWUN69hNqECRt.jpg', kind: 'logo' }
};

export function directoryLogoAsset(businessId: string) {
  return assets[businessId];
}
