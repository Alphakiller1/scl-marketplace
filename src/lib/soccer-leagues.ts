/**
 * Soccer league registry (PR-H stub).
 * Validate Odds API keys against the live catalog before enabling in GamePicker.
 * Parent sport remains SOCCER — empty board is honest when off-season or key invalid.
 */
export type SoccerLeague = {
  key: string;
  label: string;
  oddsApiKey: string;
};

export const SOCCER_LEAGUES: readonly SoccerLeague[] = [
  { key: "EPL", label: "EPL", oddsApiKey: "soccer_epl" },
  {
    key: "LA_LIGA",
    label: "La Liga",
    oddsApiKey: "soccer_spain_la_liga",
  },
  {
    key: "SERIE_A",
    label: "Serie A",
    oddsApiKey: "soccer_italy_serie_a",
  },
  {
    key: "BUNDESLIGA",
    label: "Bundesliga",
    oddsApiKey: "soccer_germany_bundesliga",
  },
  {
    key: "LIGUE_1",
    label: "Ligue 1",
    oddsApiKey: "soccer_france_ligue_one",
  },
  { key: "MLS", label: "MLS", oddsApiKey: "soccer_usa_mls" },
  {
    key: "UCL",
    label: "UEFA Champions League",
    oddsApiKey: "soccer_uefa_champs_league",
  },
  {
    key: "EUROPA",
    label: "UEFA Europa League",
    oddsApiKey: "soccer_uefa_europa_league",
  },
  {
    key: "LIGA_MX",
    label: "Liga MX",
    oddsApiKey: "soccer_mexico_ligamx",
  },
] as const;

export function soccerLeagueByKey(key: string): SoccerLeague | undefined {
  return SOCCER_LEAGUES.find((l) => l.key === key);
}
