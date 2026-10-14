// Allowed standard editions (spec annex A.2, checked 05/10/2026). An `edition` is displayed or
// accepted in a proposal only if it appears here.

export interface AllowedEdition {
  code: string;
  edition: string;
  note: string;
}

export const ALLOWED_EDITIONS: readonly AllowedEdition[] = [
  {
    code: 'ISO 13485',
    edition: '2016',
    note: 'Version harmonisée UE : EN ISO 13485:2016/A11:2021. Aucune nouvelle édition ISO',
  },
  { code: 'ISO 14971', edition: '2019', note: 'EN ISO 14971:2019/A11:2021 ; confirmée en 2025' },
  {
    code: 'IEC 62304',
    edition: '2006+AMD1:2015',
    note: "EN 62304:2006/A1:2015. La 2e édition n'est pas publiée (prévision IEC : 2028) : ne jamais écrire « IEC 62304 Ed. 2 »",
  },
  { code: 'IEC 60601-1', edition: '2005+AMD1:2012+AMD2:2020', note: 'Éd. 3.2' },
  { code: 'IEC 60601-1-2', edition: '2014+AMD1:2020', note: 'Éd. 4.1' },
  { code: 'IEC 62366-1', edition: '2015+AMD1:2020', note: 'Éd. 1.1' },
  {
    code: 'ISO 10993-1',
    edition: '2025',
    note: '6e éd., remplace 2018. Ne pas citer « :2025 » pour une expérience antérieure à fin 2025',
  },
  { code: 'IEC 82304-1', edition: '2016', note: 'Confirmée en 2021' },
  { code: 'IEC 81001-5-1', edition: '2021', note: 'Version EN : EN IEC 81001-5-1:2022' },
  { code: 'ISO/IEC 27001', edition: '2022', note: '' },
  {
    code: '21 CFR Part 820',
    edition: 'QMSR',
    note: "En vigueur depuis le 02/02/2026, intègre l'ISO 13485:2016 par référence",
  },
];

export function isAllowedEdition(code: string, edition: string): boolean {
  return ALLOWED_EDITIONS.some((e) => e.code === code && e.edition === edition);
}
