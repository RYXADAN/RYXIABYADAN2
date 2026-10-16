/**
 * Google DeepMind Science Skills Module
 * Conforme à /skills/system_skills/science/SKILL.md
 * 
 * Fournit l'intégration des bases de données biomoléculaires et scientifiques :
 * - AlphaFold DB & RCSB PDB (Structures 3D, métadonnées, pLDDT)
 * - PubChem & ChEMBL (Chimie, SMILES, propriétés moléculaires)
 * - Europe PMC & PubMed (Littérature scientifique biomédicale)
 * - AlphaGenome Atlas (Génomique, liens vérifiés DeepMind)
 */

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 3,
  baseDelayMs = 600
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }
      if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
        const retryAfter = Number(response.headers.get('Retry-After'));
        const delay = !Number.isNaN(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : baseDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      return response;
    } catch (err) {
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Échec après ${maxRetries} tentatives pour ${url}`);
}

export interface ProteinResult {
  source: 'alphafold' | 'pdb';
  id: string;
  gene?: string;
  name: string;
  organism?: string;
  uniprotAccession?: string;
  cifUrl: string;
  pdbUrl?: string;
  bcifUrl?: string;
  paeDocUrl?: string;
  resolution?: number;
  experimentalMethod?: string;
  sequenceLength?: number;
  alphaGenomeUrl?: string;
}

export interface ChemicalResult {
  cid: number;
  title: string;
  iupacName?: string;
  formula: string;
  molecularWeight: number;
  smiles: string;
  imageUrl: string;
  pubchemUrl: string;
}

export interface LiteratureItem {
  id: string;
  title: string;
  authors: string;
  journal: string;
  year: string;
  doi?: string;
  pmid?: string;
  abstract?: string;
  isOpenAccess: boolean;
  url: string;
}

export const scienceService = {
  /**
   * Recherche et analyse de protéine (RCSB PDB ou AlphaFold DB)
   */
  async getProtein(queryId: string): Promise<ProteinResult> {
    const cleanId = queryId.trim();

    // 1. Si identifiant PDB à 4 caractères (ex: 4HHB, 1TUP, 7KRR)
    if (/^[0-9][a-zA-Z0-9]{3}$/i.test(cleanId)) {
      try {
        const pdbRes = await fetchWithRetry(`https://data.rcsb.org/rest/v1/core/entry/${cleanId.toLowerCase()}`);
        if (pdbRes.ok) {
          const pdbData = await pdbRes.json();
          return {
            source: 'pdb',
            id: cleanId.toUpperCase(),
            name: pdbData.struct?.title || `Structure expérimentale ${cleanId.toUpperCase()}`,
            experimentalMethod: pdbData.rcsb_entry_info?.experimental_method?.[0] || 'X-Ray / Cryo-EM',
            resolution: pdbData.rcsb_entry_info?.resolution_combined?.[0],
            cifUrl: `https://files.rcsb.org/download/${cleanId.toUpperCase()}.cif`,
            pdbUrl: `https://files.rcsb.org/download/${cleanId.toUpperCase()}.pdb`,
            bcifUrl: `https://models.rcsb.org/${cleanId.toUpperCase()}.bcif`,
          };
        }
      } catch (err) {
        console.warn('PDB metadata lookup fallback to AlphaFold:', err);
      }
    }

    // 2. Recherche AlphaFold DB via Accession UniProt (ex: P04637 pour TP53, P00520 pour ABL1, EGFR, etc.)
    let accession = cleanId.toUpperCase();

    // Résolution symboles courants de gènes vers UniProt
    const geneMap: Record<string, string> = {
      TP53: 'P04637',
      P53: 'P04637',
      BRCA1: 'P38398',
      BRCA2: 'P51587',
      EGFR: 'P00533',
      PCSK9: 'Q8NBP7',
      KRAS: 'P01116',
      INS: 'P01308',
      INSULIN: 'P01308',
      MYC: 'P01106',
      ACE2: 'Q9BYF1',
      HEMOGLOBIN: 'P69905',
      HBB: 'P68871',
      HBA1: 'P69905',
    };
    if (geneMap[accession]) {
      accession = geneMap[accession];
    }

    const afRes = await fetchWithRetry(`https://alphafold.ebi.ac.uk/api/prediction/${accession}`);
    if (afRes.ok) {
      const afList = await afRes.json();
      if (Array.isArray(afList) && afList.length > 0) {
        const entry = afList[0];
        const geneName = entry.gene || cleanId.toUpperCase();
        return {
          source: 'alphafold',
          id: entry.entryId || `AF-${accession}-F1`,
          gene: entry.gene,
          name: entry.uniprotDescription || `Structure prédite ${entry.gene || accession}`,
          organism: entry.organismScientificName || 'Homo sapiens',
          uniprotAccession: entry.uniprotAccession || accession,
          sequenceLength: (entry.uniprotEnd - entry.uniprotStart + 1) || undefined,
          cifUrl: entry.cifUrl || `https://alphafold.ebi.ac.uk/files/AF-${accession}-F1-model_v6.cif`,
          pdbUrl: entry.pdbUrl || `https://alphafold.ebi.ac.uk/files/AF-${accession}-F1-model_v6.pdb`,
          bcifUrl: entry.bcifUrl || `https://alphafold.ebi.ac.uk/files/AF-${accession}-F1-model_v6.bcif`,
          paeDocUrl: entry.paeDocUrl,
          alphaGenomeUrl: `https://deepmind.google.com/science/alphagenome/atlas?q=${encodeURIComponent(geneName)}`,
        };
      }
    }

    throw new Error(`Aucune structure trouvée pour "${queryId}" dans AlphaFold DB ou RCSB PDB.`);
  },

  /**
   * Recherche chimique dans PubChem (Propriétés, SMILES, 2D)
   */
  async getChemical(query: string): Promise<ChemicalResult> {
    const cleanQuery = query.trim();
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(cleanQuery)}/property/MolecularFormula,MolecularWeight,CanonicalSMILES,IUPACName,Title/JSON`;

    const res = await fetchWithRetry(url);
    if (!res.ok) {
      throw new Error(`Molécule introuvable dans PubChem pour "${query}".`);
    }

    const data = await res.json();
    const props = data.PropertyTable?.Properties?.[0];
    if (!props) {
      throw new Error(`Propriétés chimiques non disponibles pour "${query}".`);
    }

    return {
      cid: props.CID,
      title: props.Title || cleanQuery,
      iupacName: props.IUPACName,
      formula: props.MolecularFormula || '',
      molecularWeight: parseFloat(props.MolecularWeight) || 0,
      smiles: props.CanonicalSMILES || '',
      imageUrl: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${props.CID}/PNG`,
      pubchemUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${props.CID}`,
    };
  },

  /**
   * Recherche bibliographique biomédicale dans Europe PMC / PubMed
   */
  async getLiterature(query: string): Promise<LiteratureItem[]> {
    const cleanQuery = query.trim();
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(cleanQuery)}&format=json&pageSize=6`;

    const res = await fetchWithRetry(url);
    if (!res.ok) {
      throw new Error(`Échec de la recherche bibliographique pour "${query}".`);
    }

    const data = await res.json();
    const list = data.resultList?.result || [];

    return list.map((item: any) => ({
      id: item.id || item.pmid || item.doi || Math.random().toString(),
      title: (item.title || '').replace(/\.$/, ''),
      authors: item.authorString || 'Auteurs non spécifiés',
      journal: item.journalTitle || item.bookOrReportDetails?.publisher || 'Publication scientifique',
      year: item.pubYear || '',
      doi: item.doi,
      pmid: item.pmid,
      abstract: item.abstractText ? item.abstractText.slice(0, 320) + '...' : undefined,
      isOpenAccess: item.isOpenAccess === 'Y',
      url: item.doi
        ? `https://doi.org/${item.doi}`
        : item.pmid
        ? `https://pubmed.ncbi.nlm.nih.gov/${item.pmid}/`
        : `https://europepmc.org/article/MED/${item.id}`,
    }));
  },
};
