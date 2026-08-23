/** SCL/Odds API soccer league tags -> ESPN scoreboard league slugs. */
const ESPN_SOCCER_LEAGUE_BY_TAG: Record<string, string> = {
  EPL: "eng.1",
  ENGLAND_PREMIER_LEAGUE: "eng.1",
  LA_LIGA: "esp.1",
  SPAIN_LA_LIGA: "esp.1",
  SERIE_A: "ita.1",
  ITALY_SERIE_A: "ita.1",
  BUNDESLIGA: "ger.1",
  GERMANY_BUNDESLIGA: "ger.1",
  DFB_POKAL: "ger.dfb_pokal",
  GERMANY_DFB_POKAL: "ger.dfb_pokal",
  SOCCER_GERMANY_DFB_POKAL: "ger.dfb_pokal",
  LIGUE_1: "fra.1",
  FRANCE_LIGUE_ONE: "fra.1",
  MLS: "usa.1",
  USA_MLS: "usa.1",
  UCL: "uefa.champions",
  UEFA_CHAMPS_LEAGUE: "uefa.champions",
  EUROPA: "uefa.europa",
  UEFA_EUROPA_LEAGUE: "uefa.europa",
  LIGA_MX: "mex.1",
  MEXICO_LIGAMX: "mex.1",
  BRAZIL_SERIE_A: "bra.1",
  BRAZIL_CAMPEONATO: "bra.1",
  ARGENTINA_PRIMERA: "arg.1",
  ARGENTINA_PRIMERA_DIVISION: "arg.1",
  EFL_CHAMPIONSHIP: "eng.2",
  EFL_CHAMP: "eng.2",
  EREDIVISIE: "ned.1",
  NETHERLANDS_EREDIVISIE: "ned.1",
  PRIMEIRA_LIGA: "por.1",
  PORTUGAL_PRIMEIRA_LIGA: "por.1",
};

export function espnSoccerLeagueSlug(
  league: string | null | undefined,
): string | null {
  const tag = league
    ?.trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
  return tag ? (ESPN_SOCCER_LEAGUE_BY_TAG[tag] ?? null) : null;
}
