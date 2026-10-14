// Starting vocabulary of annex A (medical devices, regulatory, digital health). `aliases` are strict
// equivalents: they count for coverage. `related` are neighbouring terms, never counted (F-LIB-08).
// `dmContext`: a non-ambiguous form of the entry found in an offer places it in the medical-device
// domain (annex B.3 step 8: an ambiguous DM acronym only counts in that case). Generic terms (technical
// documentation, internal audit, CAPA, ISO/IEC 27001, GDPR…) do not, since other sectors use them too
// (ADR 0013). Zod-free.

export interface AnnexATerm {
  short: string;
  long: { fr: string | null; en: string | null };
  aliases: string[];
  related: string[];
  /** Polysemous acronym (marked * in annex A): compared case-exact, DM context required. */
  ambiguous: boolean;
  dmContext: boolean;
}

const t = (
  short: string,
  fr: string | null,
  en: string | null,
  aliases: string[],
  related: string[] = [],
  opts: { ambiguous?: boolean; dmContext?: boolean } = {},
): AnnexATerm => ({
  short,
  long: { fr, en },
  aliases,
  related,
  ambiguous: opts.ambiguous ?? false,
  dmContext: opts.dmContext ?? true,
});

export const ANNEX_A: readonly AnnexATerm[] = [
  t(
    'DM',
    'dispositif médical',
    'medical device',
    ['dispositif médical', 'dispositifs médicaux', 'medical device', 'medical devices'],
    ['MedTech', 'DMDIV'],
    { ambiguous: true },
  ),
  t(
    'MDR',
    'règlement relatif aux dispositifs médicaux',
    'EU Medical Device Regulation',
    ['EU MDR', 'RDM', 'règlement (UE) 2017/745', 'Regulation (EU) 2017/745'],
    [],
    { ambiguous: true },
  ),
  t('IVDR', 'règlement relatif aux dispositifs médicaux de diagnostic in vitro', 'EU In Vitro Diagnostic Regulation', [
    'EU IVDR',
    'RDIV',
    'règlement (UE) 2017/746',
  ]),
  t('MDD', 'directive relative aux dispositifs médicaux', 'Medical Devices Directive', [
    'directive 93/42/CEE',
    '93/42/EEC',
  ]),
  t(
    'ISO 13485',
    'système de management de la qualité des dispositifs médicaux',
    'quality management systems for medical devices',
    ['NF EN ISO 13485', 'EN ISO 13485'],
    ['SMQ', 'QMS', 'système qualité'],
  ),
  t(
    'ISO 14971',
    'application de la gestion des risques aux dispositifs médicaux',
    'risk management for medical devices',
    ['NF EN ISO 14971', 'EN ISO 14971'],
    ['gestion des risques', 'risk management', 'analyse de risques'],
  ),
  t(
    'IEC 62304',
    'cycle de vie du logiciel de dispositif médical',
    'medical device software life cycle',
    ['CEI 62304', 'EN 62304', 'NF EN 62304'],
    ['cycle de vie logiciel', 'software life cycle'],
  ),
  t(
    'IEC 60601-1',
    'sécurité de base et performances essentielles des appareils électromédicaux',
    'basic safety and essential performance of medical electrical equipment',
    ['CEI 60601-1', 'EN 60601-1'],
    ['sécurité électrique', 'electrical safety'],
  ),
  t(
    'IEC 60601-1-2',
    'perturbations électromagnétiques des appareils électromédicaux',
    'electromagnetic disturbances of medical electrical equipment',
    ['CEI 60601-1-2', 'EN 60601-1-2'],
    ['CEM', 'EMC'],
  ),
  t(
    'IEC 62366-1',
    "ingénierie de l'aptitude à l'utilisation des dispositifs médicaux",
    'usability engineering for medical devices',
    ['CEI 62366-1', 'EN 62366-1'],
    ["aptitude à l'utilisation", 'usability', 'facteurs humains', 'human factors'],
  ),
  t(
    'ISO 10993-1',
    'évaluation biologique des dispositifs médicaux',
    'biological evaluation of medical devices',
    ['EN ISO 10993-1'],
    ['biocompatibilité', 'biocompatibility'],
  ),
  t(
    'IEC 82304-1',
    'logiciels de santé : exigences générales de sécurité des produits',
    'health software product safety',
    ['CEI 82304-1', 'EN 82304-1'],
    ['logiciel de santé', 'health software'],
  ),
  t(
    'IEC 81001-5-1',
    'sécurité des logiciels de santé : activités du cycle de vie',
    'health software security life cycle',
    ['CEI 81001-5-1', 'EN IEC 81001-5-1'],
    ['cybersécurité', 'cybersecurity'],
  ),
  t(
    '21 CFR Part 820',
    'règlement de la FDA sur le système de management de la qualité',
    'FDA Quality Management System Regulation',
    ['21 CFR 820', 'QMSR'],
    ['QSR', 'Quality System Regulation'],
  ),
  t(
    '510(k)',
    'notification préalable à la mise sur le marché',
    'premarket notification',
    ['premarket notification'],
    ['De Novo', 'PMA'],
  ),
  t(
    'CE',
    'marquage CE de conformité',
    'CE marking',
    ['marquage CE', 'CE marking'],
    ['organisme notifié', 'notified body', 'évaluation de la conformité'],
    { ambiguous: true },
  ),
  t(
    'GSPR',
    'exigences générales en matière de sécurité et de performances',
    'general safety and performance requirements',
    ['EGSP', 'General Safety and Performance Requirements'],
    ['exigences essentielles', 'essential requirements'],
  ),
  t(
    'Documentation technique',
    null,
    'technical documentation',
    ['technical documentation', 'technical file', 'dossier technique'],
    [],
    { dmContext: false },
  ),
  t(
    'Évaluation clinique',
    'évaluation clinique',
    'clinical evaluation',
    ['clinical evaluation', 'CER'],
    ["rapport d'évaluation clinique"],
  ),
  t(
    'PMS',
    'surveillance après commercialisation',
    'post-market surveillance',
    ['surveillance après commercialisation', 'post-market surveillance'],
    ['PSUR', 'SCAC', 'PMCF'],
    { ambiguous: true },
  ),
  t(
    'SAC',
    'surveillance après commercialisation',
    'post-market surveillance',
    ['surveillance après commercialisation', 'post-market surveillance'],
    ['PSUR', 'SCAC', 'PMCF'],
    { ambiguous: true },
  ),
  t('PMCF', 'suivi clinique après commercialisation', 'post-market clinical follow-up', ['SCAC'], ['PSUR']),
  t('Matériovigilance', null, 'vigilance', ['matériovigilance'], ['incident reporting']),
  t('UDI', 'identifiant unique des dispositifs', 'Unique Device Identification', ['IUD', 'UDI-DI'], ['EUDAMED']),
  t(
    'PRRC',
    'personne chargée de veiller au respect de la réglementation',
    'person responsible for regulatory compliance',
    ['PCVRR', 'Person Responsible for Regulatory Compliance'],
  ),
  t(
    'ANSM',
    'Agence nationale de sécurité du médicament et des produits de santé',
    'French competent authority for health products',
    [],
    ['autorité compétente', 'competent authority'],
  ),
  t('Classe IIa', null, 'Class IIa', ['classe IIa', 'Class IIa'], ['règle 11']),
  t('Classe IIb', null, 'Class IIb', ['classe IIb', 'Class IIb'], ['règle 11']),
  t('Classe III', null, 'Class III', ['classe III', 'Class III'], ['règle 11']),
  t('Règle 11', 'règle de classification des logiciels', 'Rule 11', ['règle 11', 'rule 11'], ['MDCG 2019-11']),
  t(
    'Classe de sécurité logicielle',
    'classe de sécurité du logiciel',
    'software safety class',
    ['software safety class', 'classe de sécurité logicielle'],
    ['classe A', 'classe B', 'classe C'],
  ),
  t(
    'MDSW',
    'logiciel dispositif médical',
    'medical device software',
    ['logiciel dispositif médical', 'logiciel DM'],
    ['SaMD', 'SiMD', 'MDCG 2019-11'],
  ),
  t(
    'SaMD',
    'logiciel en tant que dispositif médical',
    'Software as a Medical Device',
    ['Software as a Medical Device', 'logiciel en tant que dispositif médical'],
    ['MDSW', 'logiciel DM', 'SiMD'],
  ),
  t(
    'Maîtrise de la conception',
    'maîtrise de la conception et du développement',
    'design controls',
    ['design controls', 'maîtrise de la conception'],
    ['Medical Device File', 'Design and Development File', 'DHF', 'DMR', 'DHR'],
  ),
  t(
    'V&V',
    'vérification et validation',
    'verification and validation',
    ['vérification et validation', 'verification and validation'],
    ['tests', 'IQ/OQ/PQ'],
    { dmContext: false },
  ),
  t(
    'IQ/OQ/PQ',
    "qualification d'installation, opérationnelle et de performance",
    'installation/operational/performance qualification',
    ['IQ OQ PQ'],
    ['validation de procédé', 'process validation'],
    { dmContext: false },
  ),
  t(
    'CAPA',
    'actions correctives et préventives',
    'corrective and preventive actions',
    ['actions correctives et préventives'],
    ['non-conformité'],
    { dmContext: false },
  ),
  t(
    'AMDEC',
    'analyse des modes de défaillance, de leurs effets et de leur criticité',
    'failure mode, effects and criticality analysis',
    ['FMEA', 'FMECA'],
    ['analyse de risques'],
    { dmContext: false },
  ),
  t(
    'Affaires réglementaires',
    null,
    'regulatory affairs',
    ['regulatory affairs'],
    ['conformité réglementaire', 'regulatory compliance'],
    { dmContext: false },
  ),
  t('RA', 'affaires réglementaires', 'regulatory affairs', ['affaires réglementaires', 'regulatory affairs'], [], {
    ambiguous: true,
    dmContext: false,
  }),
  t(
    'RA/QA',
    'affaires réglementaires et assurance qualité',
    'regulatory affairs and quality assurance',
    ['QA/RA', 'QARA', 'RAQA'],
    ['assurance qualité', 'quality assurance'],
    { dmContext: false },
  ),
  t(
    'Audit interne',
    'audit interne du SMQ',
    'internal audit',
    ['internal audit', 'auditeur interne', 'internal auditor'],
    ['ISO 19011', 'audit fournisseur', 'supplier audit'],
    { dmContext: false },
  ),
  t(
    'Traçabilité des exigences',
    'traçabilité exigences, conception et tests',
    'requirements traceability',
    ['requirements traceability', 'matrice de traçabilité'],
    [],
    { dmContext: false },
  ),
  t(
    'ISO/IEC 27001',
    "système de management de la sécurité de l'information",
    'information security management system',
    ['ISO 27001'],
    ['SMSI', 'ISMS'],
    { dmContext: false },
  ),
  t(
    'HDS',
    'hébergement de données de santé',
    'health data hosting certification',
    ['hébergeur de données de santé', 'certification HDS'],
    ['ISO/IEC 27001'],
    { dmContext: false },
  ),
  t(
    'RGPD',
    'règlement général sur la protection des données',
    'General Data Protection Regulation',
    ['GDPR'],
    ['AIPD', 'DPIA', 'DPO'],
    { dmContext: false },
  ),
  t(
    'AI Act',
    "règlement (UE) 2024/1689 sur l'intelligence artificielle",
    'EU Artificial Intelligence Act',
    ['RIA', 'EU AI Act', 'règlement IA'],
    ['MDCG 2025-6'],
    { dmContext: false },
  ),
];

/** Every form of an entry (short, long forms, aliases). */
export function annexForms(e: AnnexATerm): string[] {
  return [e.short, e.long.fr, e.long.en, ...e.aliases].filter((x): x is string => !!x);
}

/**
 * Forms whose presence in an offer places it in the medical-device domain (annex B.3 step 8): every
 * form of the DM-specific entries, except the ambiguous acronyms themselves.
 */
export function dmContextMarkers(isAmbiguous: (s: string) => boolean): string[] {
  const out = new Set<string>();
  for (const e of ANNEX_A) {
    if (!e.dmContext) continue;
    for (const f of annexForms(e)) if (!isAmbiguous(f)) out.add(f);
  }
  return [...out];
}
